import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { Toaster } from '@/components/ui/sonner'
import { todayIso } from '@/lib/format'
import { account, mockApi, overview, provider } from '@/test/server'

vi.mock('docx-preview', () => ({
  renderAsync: vi.fn(async (_data: ArrayBuffer, el: HTMLElement) => {
    el.textContent = 'rendered word document'
  }),
}))

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <App />
      <Toaster />
    </QueryClientProvider>,
  )
}

async function pickDate(iso: string) {
  await userEvent.click(screen.getByRole('button', { name: /statement date/i }))
  await userEvent.click(document.querySelector(`[data-day="${iso}"] button`) as HTMLElement)
}
const pickToday = () => pickDate(todayIso())

const submitButton = () => screen.getByRole('button', { name: /^submit$/i })

afterEach(() => vi.unstubAllGlobals())

describe('welcome', () => {
  it('greets the client by name with a calm, measured message', async () => {
    mockApi({ 'GET /accounts': () => ({ json: overview([account(1, 'Barclays', 'UPLOADED')]) }) })
    renderApp()
    expect(screen.getByTestId('welcome')).toHaveTextContent('Welcome, Olivia')
    expect(screen.getByText(/one step closer to having your wealth looked after/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Connect your accounts' })).toBeInTheDocument()
    await screen.findByTestId('ready-count')
  })
})

describe('readiness', () => {
  it('counts only current statements and keeps submit disabled while anything is incomplete', async () => {
    mockApi({
      'GET /accounts': () => ({
        json: overview([account(1, 'Barclays', 'UPLOADED'), account(2, 'HSBC', 'MISSING'), account(3, 'Vanguard', 'OUTDATED')]),
      }),
    })
    renderApp()

    expect(await screen.findByTestId('ready-count')).toHaveTextContent('1 of 3 ready')
    expect(submitButton()).toHaveAttribute('aria-disabled', 'true')
    const summary = screen.getByTestId('readiness-summary')
    expect(summary).toHaveTextContent(/HSBC has no statement, and Vanguard is more than 3 months old/)
  })

  it('enables submit once the server reports every statement as current', async () => {
    mockApi({
      'GET /accounts': () => ({ json: overview([account(1, 'Barclays', 'UPLOADED'), account(2, 'HSBC', 'UPLOADED')]) }),
    })
    renderApp()

    expect(await screen.findByTestId('ready-count')).toHaveTextContent('2 of 2 ready')
    expect(submitButton()).toHaveAttribute('aria-disabled', 'false')
  })
})

describe('submitting', () => {
  it('shows the server reason and the offending providers when an incomplete set is rejected', async () => {
    const issues = [{ accountId: 2, provider: 'HSBC', status: 'MISSING' }]
    mockApi({
      'GET /accounts': () => ({ json: overview([account(1, 'Barclays', 'UPLOADED'), account(2, 'HSBC', 'MISSING')]) }),
      'POST /submit': () => ({
        status: 422,
        json: { code: 'INCOMPLETE_SUBMISSION', message: '1 provider still needs a current statement.', issues },
      }),
    })
    renderApp()
    await screen.findByTestId('ready-count')

    await userEvent.click(submitButton())

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('1 provider still needs a current statement.')
    expect(within(alert).getByText('HSBC')).toBeInTheDocument()
    expect(await screen.findByText("Can't submit yet: 1 statement is missing. Add or replace it to continue.")).toBeInTheDocument()
  })

  it('explains in the notification how many statements are missing and how many are outdated', async () => {
    mockApi({
      'GET /accounts': () => ({ json: overview([account(1, 'HSBC', 'MISSING'), account(2, 'Vanguard', 'OUTDATED'), account(3, 'Aviva', 'OUTDATED')]) }),
      'POST /submit': () => ({
        status: 422,
        json: {
          code: 'INCOMPLETE_SUBMISSION',
          message: '3 providers still need a current statement.',
          issues: [
            { accountId: 1, provider: 'HSBC', status: 'MISSING' },
            { accountId: 2, provider: 'Vanguard', status: 'OUTDATED' },
            { accountId: 3, provider: 'Aviva', status: 'OUTDATED' },
          ],
        },
      }),
    })
    renderApp()
    await screen.findByTestId('ready-count')
    await userEvent.click(submitButton())
    expect(
      await screen.findByText("Can't submit yet: 1 statement is missing and 2 are more than 3 months old. Add or replace them to continue."),
    ).toBeInTheDocument()
  })

  it('confirms success after a complete submission', async () => {
    mockApi({
      'GET /accounts': () => ({ json: overview([account(1, 'Barclays', 'UPLOADED')]) }),
      'POST /submit': () => ({ json: { submitted: true, submittedAt: '2026-10-08T09:00:00Z', accounts: 1 } }),
    })
    renderApp()
    await screen.findByTestId('ready-count')

    await userEvent.click(submitButton())

    expect(await screen.findByText('Your pack has been submitted')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submitted/i })).toBeInTheDocument()
  })
})

describe('filtering', () => {
  it('narrows the list to the chosen status', async () => {
    mockApi({
      'GET /accounts': () => ({ json: overview([account(1, 'Barclays', 'UPLOADED'), account(2, 'HSBC', 'MISSING')]) }),
    })
    renderApp()
    await screen.findByTestId('account-HSBC')

    await userEvent.click(screen.getByRole('button', { name: /^missing/i }))

    expect(screen.getByTestId('account-HSBC')).toBeInTheDocument()
    expect(screen.queryByTestId('account-Barclays')).not.toBeInTheDocument()
  })
})

describe('searching your providers', () => {
  const several = () => overview([
    account(1, 'Hargreaves Lansdown', 'UPLOADED'),
    account(2, 'Lloyds Bank', 'MISSING'),
    account(3, 'Vanguard', 'OUTDATED'),
  ])

  it('narrows the list as the client types, ignoring case and punctuation', async () => {
    mockApi({ 'GET /accounts': () => ({ json: several() }) })
    renderApp()
    await screen.findByTestId('account-Vanguard')
    await userEvent.type(screen.getByRole('searchbox', { name: /search your providers/i }), 'LLOYDS')
    expect(screen.getByTestId('account-Lloyds Bank')).toBeInTheDocument()
    expect(screen.queryByTestId('account-Vanguard')).not.toBeInTheDocument()
  })

  it('understands initials and small typos', async () => {
    mockApi({ 'GET /accounts': () => ({ json: several() }) })
    renderApp()
    await screen.findByTestId('account-Vanguard')
    const box = screen.getByRole('searchbox', { name: /search your providers/i })
    await userEvent.type(box, 'hl')
    expect(screen.getByTestId('account-Hargreaves Lansdown')).toBeInTheDocument()
    expect(screen.queryByTestId('account-Lloyds Bank')).not.toBeInTheDocument()
    await userEvent.clear(box)
    await userEvent.type(box, 'vangard')
    expect(screen.getByTestId('account-Vanguard')).toBeInTheDocument()
  })

  it('also finds providers by file name or by status word', async () => {
    mockApi({ 'GET /accounts': () => ({ json: several() }) })
    renderApp()
    await screen.findByTestId('account-Vanguard')
    const box = screen.getByRole('searchbox', { name: /search your providers/i })
    await userEvent.type(box, 'outdated')
    expect(screen.getByTestId('account-Vanguard')).toBeInTheDocument()
    expect(screen.queryByTestId('account-Lloyds Bank')).not.toBeInTheDocument()
  })

  it('combines with the status filters, and offers a way out when nothing matches', async () => {
    mockApi({ 'GET /accounts': () => ({ json: several() }) })
    renderApp()
    await screen.findByTestId('account-Vanguard')
    await userEvent.click(screen.getByRole('button', { name: /^missing/i }))
    await userEvent.type(screen.getByRole('searchbox', { name: /search your providers/i }), 'vanguard')
    expect(screen.getByText(/No providers match “vanguard”/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(screen.getByTestId('account-Lloyds Bank')).toBeInTheDocument()
    expect(screen.getByTestId('account-Vanguard')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: /search your providers/i })).toHaveValue('')
  })
})

describe('needs-attention shortcut', () => {
  const mixed = () => overview([account(1, 'Barclays', 'UPLOADED'), account(2, 'HSBC', 'MISSING'), account(3, 'Vanguard', 'OUTDATED')])

  it('filters the list to everything missing or outdated when the submit line is selected', async () => {
    mockApi({ 'GET /accounts': () => ({ json: mixed() }) })
    renderApp()
    await screen.findByTestId('account-Barclays')

    await userEvent.click(screen.getByRole('button', { name: /submit unavailable - 2 providers need attention/i }))

    expect(screen.queryByTestId('account-Barclays')).not.toBeInTheDocument()
    expect(screen.getByTestId('account-HSBC')).toBeInTheDocument()
    expect(screen.getByTestId('account-Vanguard')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /needs attention/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('offers the same view as a filter, and hides it when nothing needs attention', async () => {
    mockApi({ 'GET /accounts': () => ({ json: overview([account(1, 'Barclays', 'UPLOADED')]) }) })
    renderApp()
    await screen.findByTestId('account-Barclays')
    expect(screen.queryByRole('button', { name: /needs attention/i })).not.toBeInTheDocument()
  })
})

describe('names in the readiness summary', () => {
  const mixed = () => overview([
    account(1, 'Barclays', 'UPLOADED'),
    account(2, 'HSBC', 'MISSING'),
    account(3, 'Monzo', 'MISSING'),
    account(4, 'Vanguard', 'OUTDATED'),
  ])

  it('are tappable and open the right dialog straight away', async () => {
    mockApi({ 'GET /accounts': () => ({ json: mixed() }) })
    renderApp()
    await screen.findByTestId('ready-count')
    const summary = screen.getByTestId('readiness-summary')
    expect(summary).toHaveTextContent('HSBC and Monzo have no statement, and Vanguard is more than 3 months old')

    await userEvent.click(within(summary).getByRole('button', { name: 'Monzo' }))
    expect(await screen.findByRole('heading', { name: 'Add statement - Monzo' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')

    await userEvent.click(within(summary).getByRole('button', { name: 'Vanguard' }))
    expect(await screen.findByRole('heading', { name: 'Replace statement - Vanguard' })).toBeInTheDocument()
  })

  it('are plain text with no links once everything is ready', async () => {
    mockApi({ 'GET /accounts': () => ({ json: overview([account(1, 'Barclays', 'UPLOADED')]) }) })
    renderApp()
    await screen.findByTestId('ready-count')
    expect(within(screen.getByTestId('readiness-summary')).queryAllByRole('button')).toHaveLength(0)
  })
})

describe('progress bar shortcuts', () => {
  const accounts = () => overview([account(1, 'Barclays', 'UPLOADED'), account(2, 'HSBC', 'MISSING'), account(3, 'Vanguard', 'OUTDATED')])

  it('opens the add-statement dialog for the provider behind a red segment', async () => {
    mockApi({ 'GET /accounts': () => ({ json: accounts() }) })
    renderApp()
    await screen.findByTestId('ready-count')

    await userEvent.click(screen.getByRole('button', { name: /HSBC: no statement\. Select to add one/ }))

    expect(await screen.findByRole('heading', { name: 'Add statement - HSBC' })).toBeInTheDocument()
  })

  it('opens the replace dialog for an outdated (amber) segment', async () => {
    mockApi({ 'GET /accounts': () => ({ json: accounts() }) })
    renderApp()
    await screen.findByTestId('ready-count')

    await userEvent.click(screen.getByRole('button', { name: /Vanguard: statement is outdated/ }))

    expect(await screen.findByRole('heading', { name: 'Replace statement - Vanguard' })).toBeInTheDocument()
  })

  it('takes the client to the statement on file for a green segment without opening anything, clearing any filter hiding it', async () => {
    mockApi({ 'GET /accounts': () => ({ json: accounts() }) })
    renderApp()
    await screen.findByTestId('ready-count')
    await userEvent.click(screen.getByRole('button', { name: /^missing/i }))
    expect(screen.queryByTestId('account-Barclays')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Barclays: statement on file\. Select to view it/ }))

    const card = await screen.findByTestId('account-Barclays')
    expect(card).toHaveClass('ring-2')
    expect(card).toHaveTextContent('Barclays.pdf')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /replace statement for barclays/i })).toBeInTheDocument()
  })

  it('labels each bar with its provider, status and action for hover and keyboard focus', async () => {
    mockApi({ 'GET /accounts': () => ({ json: accounts() }) })
    renderApp()
    await screen.findByTestId('ready-count')
    const segment = screen.getByRole('button', { name: /HSBC: no statement/ })
    expect(within(segment).getByText('HSBC')).toBeInTheDocument()
    expect(within(segment).getByText('Missing')).toBeInTheDocument()
    expect(within(segment).getByText('Add statement?')).toBeInTheDocument()
  })

  it('exposes the segments to keyboard and screen-reader users', async () => {
    mockApi({ 'GET /accounts': () => ({ json: accounts() }) })
    renderApp()
    await screen.findByTestId('ready-count')
    expect(screen.getByRole('list', { name: /select one to jump to it/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Select to/ })).toHaveLength(3)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
  })
})

describe('adding providers', () => {
  it('sends the chosen ids and confirms with feedback', async () => {
    let current = overview([account(1, 'Barclays', 'UPLOADED')])
    const api = mockApi({
      'GET /accounts': () => ({ json: current }),
      'GET /providers': () => ({ json: [provider(5, 'Monzo'), provider(6, 'Starling Bank')] }),
      'POST /accounts': () => {
        current = overview([...current.accounts, account(5, 'Monzo', 'MISSING')])
        return { status: 201, json: current }
      },
    })
    renderApp()
    await screen.findByTestId('ready-count')

    await userEvent.click(screen.getAllByRole('button', { name: /add provider/i })[0])
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Monzo' }))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Category for Monzo' }), 'Savings')
    await userEvent.click(screen.getByRole('button', { name: 'Add 1 provider' }))

    expect(await screen.findByText('1 provider added')).toBeInTheDocument()
    expect(api.calls.find(c => c.key === 'POST /accounts')?.body).toEqual({
      providerIds: [5],
      customNames: [],
      choices: [{ providerId: 5, category: 'Savings' }],
    })
    await waitFor(() => expect(screen.getByTestId('ready-count')).toHaveTextContent('1 of 2 ready'))
  })

  it('surfaces the server error inside the dialog when adding fails', async () => {
    mockApi({
      'GET /accounts': () => ({ json: overview([account(1, 'Barclays', 'UPLOADED')]) }),
      'GET /providers': () => ({ json: [provider(5, 'Monzo')] }),
      'POST /accounts': () => ({ status: 409, json: { code: 'DUPLICATE_PROVIDER', message: 'Already added: Monzo.', issues: [] } }),
    })
    renderApp()
    await screen.findByTestId('ready-count')

    await userEvent.click(screen.getAllByRole('button', { name: /add provider/i })[0])
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Monzo' }))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Category for Monzo' }), 'Bank')
    await userEvent.click(screen.getByRole('button', { name: 'Add 1 provider' }))

    expect(await screen.findByText('Already added: Monzo.')).toBeInTheDocument()
  })
})

describe('statements', () => {
  it('saves the file name and date and reflects the new status', async () => {
    let current = overview([account(1, 'HSBC', 'MISSING')])
    const api = mockApi({
      'GET /accounts': () => ({ json: current }),
      'PUT /accounts/1/statement': () => {
        current = overview([account(1, 'HSBC', 'UPLOADED')])
        return { json: current.accounts[0] }
      },
    })
    renderApp()
    await screen.findByTestId('ready-count')

    await userEvent.click(screen.getByRole('button', { name: /add statement for hsbc/i }))
    await userEvent.upload(await screen.findByLabelText('Statement file'), new File(['x'], 'hsbc_sep.pdf', { type: 'application/pdf' }))
    await pickToday()
    await userEvent.click(screen.getByRole('button', { name: 'Save statement' }))

    expect(await screen.findByText('Statement saved for HSBC')).toBeInTheDocument()
    expect(api.calls.find(c => c.key === 'PUT /accounts/1/statement')?.body).toMatchObject({ filename: 'hsbc_sep.pdf' })
    await waitFor(() => expect(screen.getByTestId('ready-count')).toHaveTextContent('1 of 1 ready'))
  })
})

describe('damaged files', () => {
  it('shows the server explanation and keeps the chosen file and date so the client can try again', async () => {
    mockApi({
      'GET /accounts': () => ({ json: overview([account(1, 'HSBC', 'MISSING')]) }),
      'PUT /accounts/1/statement': () => ({
        status: 400,
        json: { code: 'FILE_UNREADABLE', message: "We couldn't open that file. It looks damaged or incomplete, so we haven't saved it.", issues: [] },
      }),
    })
    renderApp()
    await screen.findByTestId('ready-count')
    await userEvent.click(screen.getByRole('button', { name: /add statement for hsbc/i }))
    await userEvent.upload(await screen.findByLabelText('Statement file'), new File(['x'], 'broken.pdf', { type: 'application/pdf' }))
    await pickToday()
    await userEvent.click(screen.getByRole('button', { name: 'Save statement' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't open that file")
    expect(screen.getByTestId('statement-file-name')).toHaveTextContent('broken.pdf')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

describe('statement file size', () => {
  it('refuses a file over 5 MB with a clear message and keeps Save off', async () => {
    mockApi({ 'GET /accounts': () => ({ json: overview([account(1, 'HSBC', 'MISSING')]) }) })
    renderApp()
    await screen.findByTestId('ready-count')
    await userEvent.click(screen.getByRole('button', { name: /add statement for hsbc/i }))
    const big = new File([new ArrayBuffer(5 * 1024 * 1024 + 1)], 'big.pdf', { type: 'application/pdf' })
    await userEvent.upload(await screen.findByLabelText('Statement file'), big)
    expect(await screen.findByRole('alert')).toHaveTextContent('under 5 MB')
    expect(screen.getByRole('button', { name: 'Save statement' })).toBeDisabled()
  })
})

describe('statement file types', () => {
  async function openUpload() {
    mockApi({ 'GET /accounts': () => ({ json: overview([account(1, 'HSBC', 'MISSING')]) }) })
    renderApp()
    await screen.findByTestId('ready-count')
    await userEvent.click(screen.getByRole('button', { name: /add statement for hsbc/i }))
    return await screen.findByLabelText('Statement file')
  }

  it.each(['s.pdf', 's.doc', 's.docx', 's.jpg', 's.jpeg', 's.png', 'SCAN.PDF'])('accepts %s', async name => {
    const input = await openUpload()
    await userEvent.setup({ applyAccept: false }).upload(input, new File(['x'], name))
    expect(screen.getByTestId('statement-file-name')).toHaveTextContent(name)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await pickToday()
    expect(screen.getByRole('button', { name: 'Save statement' })).toBeEnabled()
  })

  it.each(['notes.txt', 'sheet.xlsx', 'run.exe', 'noextension'])('rejects %s with a clear message', async name => {
    const input = await openUpload()
    await userEvent.setup({ applyAccept: false }).upload(input, new File(['x'], name))
    expect(await screen.findByRole('alert')).toHaveTextContent(/PDF, Word document/)
    expect(screen.getByRole('button', { name: 'Save statement' })).toBeDisabled()
  })
})

describe('searching the catalogue', () => {
  it('finds providers by initials and typos in the Add dialog, best matches first', async () => {
    mockApi({
      'GET /accounts': () => ({ json: overview([account(1, 'Barclays', 'UPLOADED')]) }),
      'GET /providers': () => ({ json: [
        { ...provider(5, 'Hargreaves Lansdown'), category: 'Investments' },
        { ...provider(6, 'Monzo') },
        { ...provider(7, 'Vanguard'), category: 'Investments' },
      ] }),
    })
    renderApp()
    await screen.findByTestId('ready-count')
    await userEvent.click(screen.getAllByRole('button', { name: /add provider/i })[0])
    const box = await screen.findByRole('searchbox', { name: /search providers/i })
    await userEvent.type(box, 'hl')
    expect(await screen.findByRole('checkbox', { name: 'Hargreaves Lansdown' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Monzo' })).not.toBeInTheDocument()
    await userEvent.clear(box)
    await userEvent.type(box, 'vangard')
    expect(screen.getByRole('checkbox', { name: 'Vanguard' })).toBeInTheDocument()
  })
})

describe('managing the selection before adding', () => {
  async function pick(names: string[]) {
    mockApi({
      'GET /accounts': () => ({ json: overview([account(1, 'Barclays', 'UPLOADED')]) }),
      'GET /providers': () => ({
        json: [provider(5, 'Monzo'), provider(6, 'Starling Bank'), { ...provider(7, 'Vanguard'), category: 'Investments' }, { ...provider(8, 'Universities Superannuation Scheme (USS)'), category: 'Pension' }],
      }),
    })
    renderApp()
    await screen.findByTestId('ready-count')
    await userEvent.click(screen.getAllByRole('button', { name: /add provider/i })[0])
    for (const n of names) await userEvent.click(await screen.findByRole('checkbox', { name: n }))
    return screen.getByRole('region', { name: 'Your selection' })
  }

  it('has its own search that narrows just the selected providers, smartly', async () => {
    const panel = await pick(['Monzo', 'Starling Bank', 'Vanguard'])
    const box = within(panel).getByRole('searchbox', { name: 'Search your selection' })
    await userEvent.type(box, 'vangard')
    expect(within(panel).getByText('Vanguard')).toBeInTheDocument()
    expect(within(panel).queryByText('Monzo')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add 3 providers' })).toBeEnabled()

    await userEvent.clear(box)
    await userEvent.type(box, 'zzz')
    expect(within(panel).getByText(/No selected providers match “zzz”/)).toBeInTheDocument()
  })

  it('lets any one be removed with a small x, which also unticks it in the main list', async () => {
    const panel = await pick(['Monzo', 'Starling Bank'])
    await userEvent.click(within(panel).getByRole('button', { name: 'Remove Monzo from selection' }))
    expect(within(panel).getByText('Remove Monzo?')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Monzo' })).toBeChecked()
    await userEvent.click(within(panel).getByRole('button', { name: 'Yes, remove Monzo' }))
    expect(screen.getByRole('checkbox', { name: 'Monzo' })).not.toBeChecked()
    expect(within(panel).queryByText('Monzo')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add 1 provider' })).toBeEnabled()

    await userEvent.click(within(panel).getByRole('button', { name: 'Remove Starling Bank from selection' }))
    await userEvent.click(within(panel).getByRole('button', { name: 'Yes, remove Starling Bank' }))
    expect(screen.queryByRole('region', { name: 'Your selection' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add providers' })).toBeDisabled()
  })

  it('asks first, and "Keep" or Escape leaves the provider selected without closing the dialog', async () => {
    const panel = await pick(['Monzo'])
    await userEvent.click(within(panel).getByRole('button', { name: 'Remove Monzo from selection' }))
    await userEvent.click(within(panel).getByRole('button', { name: 'Keep' }))
    expect(screen.getByRole('checkbox', { name: 'Monzo' })).toBeChecked()
    expect(within(panel).getByText('Monzo')).toBeInTheDocument()

    await userEvent.click(within(panel).getByRole('button', { name: 'Remove Monzo from selection' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(within(panel).queryByText('Remove Monzo?')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Monzo' })).toBeChecked()
  })

  it('keeps long names tidy and still removable', async () => {
    const panel = await pick(['Universities Superannuation Scheme (USS)'])
    expect(within(panel).getByRole('button', { name: 'Remove Universities Superannuation Scheme (USS) from selection' })).toBeInTheDocument()
  })
})

describe('providers that are already on the list', () => {
  async function openAdd(available: ReturnType<typeof provider>[] = [provider(5, 'Monzo')]) {
    mockApi({
      'GET /accounts': () => ({ json: overview([account(1, 'HSBC', 'MISSING'), account(2, 'Barclays', 'UPLOADED')]) }),
      'GET /providers': () => ({ json: available }),
    })
    renderApp()
    await screen.findByTestId('ready-count')
    await userEvent.click(screen.getAllByRole('button', { name: /add provider/i })[0])
    await screen.findByRole('checkbox', { name: available[0].name })
    return screen.getByRole('searchbox', { name: /search providers/i })
  }

  it('says so, instead of "no providers match", and offers to take the client to the entry', async () => {
    const box = await openAdd()
    await userEvent.type(box, 'hsbc')

    expect(screen.getByTestId('already-added-summary')).toHaveTextContent('HSBC is already on your list.')
    expect(screen.queryByText(/No providers match/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /as another provider/i })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Go to HSBC' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('account-HSBC')).toHaveClass('ring-2')
  })

  it('shows existing entries alongside new matches, so nothing looks missing', async () => {
    const box = await openAdd([provider(9, 'HSBC Bank (UK) Pension Scheme', 'Pension')])
    await userEvent.type(box, 'hsbc')
    expect(screen.getByRole('checkbox', { name: 'HSBC Bank (UK) Pension Scheme' })).toBeInTheDocument()
    const section = screen.getByRole('region', { name: 'Already on your list' })
    expect(within(section).getByText('HSBC')).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: 'Go to HSBC' })).toBeInTheDocument()
  })

  it('still offers "add as another provider" for a name that truly is new', async () => {
    const box = await openAdd()
    await userEvent.type(box, 'Smith Family Trust')
    expect(screen.getByText(/No providers match/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add “smith family trust” as another provider/i })).toBeInTheDocument()
  })

  it('refuses a typed Other name that is the same provider in disguise, with a way to find it', async () => {
    await openAdd()
    await userEvent.click(screen.getByRole('button', { name: /^other/i }))
    await userEvent.type(screen.getByLabelText('Provider or institution name'), 'H.S.B.C.{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent('HSBC is already on your list.')
    expect(screen.queryByRole('region', { name: 'Your selection' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Go to HSBC' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('ticks the catalogue entry instead when a typed name matches one that is still available', async () => {
    await openAdd()
    await userEvent.click(screen.getByRole('button', { name: /^other/i }))
    await userEvent.type(screen.getByLabelText('Provider or institution name'), 'MONZO{Enter}')
    expect(screen.getByRole('checkbox', { name: 'Monzo' })).toBeChecked()
    const panel = screen.getByRole('region', { name: 'Your selection' })
    expect(within(panel).getByText('Monzo')).toBeInTheDocument()
    expect(within(panel).queryByText('Added by you')).not.toBeInTheDocument()
    expect(screen.getByText("Monzo is in our list, so we've ticked it for you.")).toBeInTheDocument()
  })

  it('refuses the same typed name twice in one selection, however it is punctuated', async () => {
    await openAdd()
    await userEvent.click(screen.getByRole('button', { name: /^other/i }))
    await userEvent.type(screen.getByLabelText('Provider or institution name'), 'Smith Trust{Enter}')
    await userEvent.click(screen.getByRole('button', { name: /^other/i }))
    await userEvent.type(screen.getByLabelText('Provider or institution name'), 'smith-trust.{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent('already in your selection')
  })
})

describe('categories', () => {
  async function openAdd() {
    const api = mockApi({
      'GET /accounts': () => ({ json: overview([account(1, 'Barclays', 'UPLOADED')]) }),
      'GET /providers': () => ({ json: [{ ...provider(5, 'Vanguard'), category: 'Investments' }, provider(6, 'Monzo')] }),
      'POST /accounts': () => ({ status: 201, json: overview([account(1, 'Barclays', 'UPLOADED')]) }),
    })
    renderApp()
    await screen.findByTestId('ready-count')
    await userEvent.click(screen.getAllByRole('button', { name: /add provider/i })[0])
    return api
  }

  it('pre-fills each category with the suggestion, visibly, and lets the client switch it', async () => {
    const api = await openAdd()
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Vanguard' }))
    const picker = screen.getByRole('combobox', { name: 'Category for Vanguard' })
    expect(picker).toHaveValue('Investments')
    expect(within(picker).getByRole('option', { name: 'Investments (suggested)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add 1 provider' })).toBeEnabled()

    await userEvent.selectOptions(picker, 'Pension')
    await userEvent.click(screen.getByRole('button', { name: 'Add 1 provider' }))
    await waitFor(() =>
      expect(api.calls.find(c => c.key === 'POST /accounts')?.body).toEqual({
        providerIds: [5],
        customNames: [],
        choices: [{ providerId: 5, category: 'Pension' }],
      }),
    )
  })

  it('sends the suggested category when the client leaves it as it is', async () => {
    const api = await openAdd()
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Vanguard' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add 1 provider' }))
    await waitFor(() =>
      expect(api.calls.find(c => c.key === 'POST /accounts')?.body).toMatchObject({
        choices: [{ providerId: 5, category: 'Investments' }],
      }),
    )
  })

  it('starts typed-in providers on Other, clearly marked as added by the client, and lets them switch it', async () => {
    await openAdd()
    await userEvent.click(await screen.findByRole('button', { name: /^other/i }))
    await userEvent.type(screen.getByLabelText('Provider or institution name'), 'Smith Trust{Enter}')
    const picker = screen.getByRole('combobox', { name: 'Category for Smith Trust' })
    expect(picker).toHaveValue('Other')
    expect(screen.getByText('Added by you')).toBeInTheDocument()
    await userEvent.selectOptions(picker, 'Property')
    expect(picker).toHaveValue('Property')
  })

  it('lists providers under their category headings, with manually added ones in their own section', async () => {
    const vanguard = { ...account(2, 'Vanguard', 'MISSING'), category: 'Investments' }
    const hsbc = account(3, 'HSBC', 'MISSING')
    const trust = { ...account(4, 'Smith Trust', 'MISSING'), provider: { ...provider(4, 'Smith Trust'), id: null }, category: 'Pension', manual: true }
    mockApi({ 'GET /accounts': () => ({ json: overview([hsbc, vanguard, trust]) }) })
    renderApp()
    await screen.findByTestId('account-HSBC')

    expect(within(screen.getByTestId('group-bank')).getByTestId('account-HSBC')).toBeInTheDocument()
    expect(within(screen.getByTestId('group-investments')).getByTestId('account-Vanguard')).toBeInTheDocument()
    const own = screen.getByTestId('group-added-by-you')
    expect(within(own).getByTestId('account-Smith Trust')).toBeInTheDocument()
    expect(within(own).getByText(/Providers you typed in yourself/)).toBeInTheDocument()
    expect(screen.queryByTestId('group-pension')).not.toBeInTheDocument()
  })

  it('lists the categories alphabetically with Other always last, and Property included', async () => {
    mockApi({ 'GET /accounts': () => ({ json: overview([account(1, 'Barclays', 'UPLOADED')]) }) })
    renderApp()
    await screen.findByTestId('account-Barclays')
    const picker = screen.getByRole('combobox', { name: 'Category for Barclays' })
    const names = within(picker).getAllByRole('option').map(o => o.textContent ?? '')
    expect(names).toContain('Property')
    const withoutOther = names.slice(0, -1)
    expect(withoutOther).toEqual([...withoutOther].sort((a, b) => a.localeCompare(b)))
    expect(names[names.length - 1]).toBe('Other')
    expect(names).toEqual(['Bank', 'Building society', 'Insurance', 'Investments', 'Pension', 'Property', 'Savings', 'Other'])
  })

  it('shows the chosen category on the row instead of a placeholder', async () => {
    const trust = { ...account(4, 'Nigeria', 'MISSING'), provider: { ...provider(4, 'Nigeria', 'Other'), id: null }, category: 'Bank', manual: true }
    mockApi({ 'GET /accounts': () => ({ json: overview([trust]) }) })
    renderApp()
    const card = await screen.findByTestId('account-Nigeria')
    expect(card).toHaveTextContent('Bank · no statement supplied')
    expect(card).not.toHaveTextContent('Other ·')
  })

  it('lets the client change a category later and confirms it', async () => {
    const api = mockApi({
      'GET /accounts': () => ({ json: overview([account(1, 'Vanguard', 'MISSING')]) }),
      'PUT /accounts/1/category': () => ({ json: account(1, 'Vanguard', 'MISSING') }),
    })
    renderApp()
    await screen.findByTestId('account-Vanguard')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Category for Vanguard' }), 'Investments')
    expect(await screen.findByText('Vanguard moved to Investments')).toBeInTheDocument()
    expect(api.calls.find(c => c.key === 'PUT /accounts/1/category')?.body).toEqual({ category: 'Investments' })
  })
})

describe('other providers', () => {
  async function openAdd() {
    const api = mockApi({
      'GET /accounts': () => ({ json: overview([account(1, 'Barclays', 'UPLOADED')]) }),
      'GET /providers': () => ({ json: [provider(5, 'Monzo')] }),
      'POST /accounts': () => ({ status: 201, json: overview([account(1, 'Barclays', 'UPLOADED'), account(9, 'Smith Family Trust', 'MISSING')]) }),
    })
    renderApp()
    await screen.findByTestId('ready-count')
    await userEvent.click(screen.getAllByRole('button', { name: /add provider/i })[0])
    await screen.findByRole('checkbox', { name: 'Monzo' })
    await userEvent.click(screen.getByRole('button', { name: /^other/i }))
    return api
  }

  it('lets the client type a provider that is not listed and sends it with the selection', async () => {
    const api = await openAdd()
    await userEvent.type(screen.getByLabelText('Provider or institution name'), '  Smith   Family Trust {Enter}')
    expect(within(screen.getByRole('region', { name: 'Your selection' })).getByText('Smith Family Trust')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Monzo' }))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Category for Monzo' }), 'Bank')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Category for Smith Family Trust' }), 'Investments')
    await userEvent.click(screen.getByRole('button', { name: 'Add 2 providers' }))

    expect(await screen.findByText('2 providers added')).toBeInTheDocument()
    expect(api.calls.find(c => c.key === 'POST /accounts')?.body).toEqual({
      providerIds: [5],
      customNames: ['Smith Family Trust'],
      choices: [{ providerId: 5, category: 'Bank' }, { name: 'Smith Family Trust', category: 'Investments' }],
    })
  })

  it('rejects an unusable name and a repeated name without calling the server', async () => {
    const api = await openAdd()
    const input = screen.getByLabelText('Provider or institution name')
    await userEvent.type(input, 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Add to list' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('2 to 80 characters')

    await userEvent.clear(input)
    await userEvent.type(input, 'Smith Trust{Enter}')
    await userEvent.click(screen.getByRole('button', { name: /^other/i }))
    await userEvent.type(screen.getByLabelText('Provider or institution name'), 'smith trust{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent('already in your selection')
    expect(api.calls.some(c => c.key === 'POST /accounts')).toBe(false)
  })

  it('removes a typed provider from the selection', async () => {
    await openAdd()
    await userEvent.type(screen.getByLabelText('Provider or institution name'), 'Smith Trust{Enter}')
    await userEvent.click(screen.getByRole('button', { name: /remove smith trust from selection/i }))
    await userEvent.click(await screen.findByRole('button', { name: 'Yes, remove Smith Trust' }))
    expect(screen.queryByRole('region', { name: 'Your selection' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add providers' })).toBeDisabled()
  })
})

describe('viewing what was uploaded', () => {
  const MIME: Record<string, string> = {
    pdf: 'application/pdf', png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }
  const withFile = (name: string, filename: string, hasFile = true, contentType?: string) => {
    const a = account(1, name, 'UPLOADED')
    const ext = filename.split('.').pop() ?? ''
    return { ...a, statement: { ...a.statement!, filename, hasFile, contentType: contentType ?? MIME[ext] } }
  }

  async function openView(a: ReturnType<typeof withFile>) {
    mockApi({ 'GET /accounts': () => ({ json: overview([a]) }) })
    renderApp()
    await screen.findByTestId('ready-count')
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`view statement for ${a.provider.name}`, 'i') }))
    return await screen.findByRole('dialog')
  }

  it('shows the recorded details and embeds the actual PDF', async () => {
    const dialog = await openView(withFile('Barclays', 'jan.pdf'))
    expect(within(dialog).getByTestId('view-filename')).toHaveTextContent('jan.pdf')
    expect(within(dialog).getByText('PDF document')).toBeInTheDocument()
    expect(within(dialog).getByText('20 Sept 2026')).toBeInTheDocument()
    expect(within(dialog).getByText('Valid until')).toBeInTheDocument()
    expect(within(dialog).getByTestId('view-until')).toBeInTheDocument()
    const frame = within(dialog).getByTitle(/your uploaded statement: jan\.pdf/i)
    expect(frame).toHaveAttribute('src', expect.stringContaining('/api/accounts/1/statement/file?v=1790000000000'))
    expect(frame.getAttribute('src')).toContain('#navpanes=0&toolbar=0&view=FitH')
    expect(within(dialog).getByRole('link', { name: /open file/i })).toHaveAttribute('target', '_blank')
    expect(within(dialog).getByRole('link', { name: /download/i })).toHaveAttribute('download', 'jan.pdf')
  })

  it('shows an image statement as a picture', async () => {
    const dialog = await openView(withFile('Barclays', 'scan.png'))
    expect(within(dialog).getByRole('img', { name: /your uploaded statement: scan\.png/i })).toHaveAttribute('src', expect.stringContaining('/statement/file'))
  })

  it('explains when an image cannot be previewed, for example if the file was renamed', async () => {
    const dialog = await openView(withFile('Barclays', 'renamed.jpeg'))
    fireEvent.error(within(dialog).getByRole('img'))
    expect(await within(dialog).findByTestId('view-preview-failed')).toHaveTextContent(/can't be previewed here/i)
    expect(within(dialog).getByRole('link', { name: /open file/i })).toBeInTheDocument()
  })

  it('goes by what the file really is, not what it was called', async () => {
    const dialog = await openView(withFile('Barclays', 'STATEMENT.jpeg', true, MIME.docx))
    expect(within(dialog).getByText('Word document')).toBeInTheDocument()
    expect(within(dialog).queryByRole('img')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: /download/i })).toBeInTheDocument()
  })

  const FILE_ROUTE = 'GET /accounts/1/statement/file?v=1790000000000'

  async function openWordView(filename: string, contentType: string) {
    const a = withFile('Barclays', filename, true, contentType)
    mockApi({
      'GET /accounts': () => ({ json: overview([a]) }),
      [FILE_ROUTE]: () => ({ json: 'bytes' }),
    })
    renderApp()
    await screen.findByTestId('ready-count')
    await userEvent.click(screen.getByRole('button', { name: /view statement for barclays/i }))
    return await screen.findByRole('dialog')
  }

  it('draws a preview of a modern Word document right in the panel', async () => {
    const dialog = await openWordView('letter.docx', MIME.docx)
    await waitFor(() => expect(within(dialog).getByTestId('word-preview')).toHaveAttribute('data-state', 'ready'))
    expect(within(dialog).getByLabelText(/preview of letter\.docx/i)).toHaveTextContent('rendered word document')
    expect(within(dialog).getByRole('link', { name: /download/i })).toBeInTheDocument()
  })

  it('falls back to a clear message and the download if a document cannot be drawn', async () => {
    const { renderAsync } = await import('docx-preview')
    vi.mocked(renderAsync).mockRejectedValueOnce(new Error('bad file'))
    const dialog = await openWordView('letter.docx', MIME.docx)
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/couldn't draw a preview/i)
    expect(within(dialog).getByRole('link', { name: /download/i })).toBeInTheDocument()
  })

  it('explains that older .doc files cannot be previewed, and offers the download', async () => {
    const dialog = await openWordView('old.doc', 'application/msword')
    expect(within(dialog).queryByTestId('word-preview')).not.toBeInTheDocument()
    expect(within(dialog).getByText(/Older Word \(\.doc\) files can't be previewed here/i)).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: /download/i })).toBeInTheDocument()
  })

  it('says plainly when only the name and date exist', async () => {
    const dialog = await openView(withFile('Barclays', 'jan.pdf', false))
    expect(within(dialog).getByTestId('view-no-preview')).toHaveTextContent(/no file is stored/i)
  })

  it('goes from the view panel straight to replacing the statement', async () => {
    const dialog = await openView(withFile('Barclays', 'jan.pdf'))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Replace statement' }))
    expect(await screen.findByRole('heading', { name: 'Replace statement - Barclays' })).toBeInTheDocument()
  })

  it('only offers View where a statement exists', async () => {
    mockApi({ 'GET /accounts': () => ({ json: overview([account(1, 'HSBC', 'MISSING')]) }) })
    renderApp()
    await screen.findByTestId('ready-count')
    expect(screen.queryByRole('button', { name: /view statement/i })).not.toBeInTheDocument()
  })
})

describe('statement help', () => {
  const withHelp = { ...account(1, 'HSBC', 'MISSING'), provider: { ...provider(1, 'HSBC'), statementHelpUrl: 'https://example.com/help', supportPhone: '0345 000 0000' } }

  it('offers a verified help link and a callable, copyable number on rows that need a statement', async () => {
    mockApi({ 'GET /accounts': () => ({ json: overview([withHelp, account(2, 'Barclays', 'UPLOADED')]) }) })
    renderApp()
    await screen.findByTestId('account-HSBC')

    const link = screen.getByRole('link', { name: /how to get your statement/i })
    expect(link).toHaveAttribute('href', 'https://example.com/help')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(screen.getByRole('link', { name: /0345 000 0000/ })).toHaveAttribute('href', 'tel:03450000000')

    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await userEvent.click(screen.getByRole('button', { name: /copy hsbc phone number/i }))
    expect(writeText).toHaveBeenCalledWith('0345 000 0000')
    expect(await screen.findByText('HSBC number copied')).toBeInTheDocument()
  })

  it('falls back to the provider website, then to a web search, so every row that needs a statement has a link', async () => {
    const site = { ...account(2, 'Vanguard', 'MISSING'), provider: { ...provider(2, 'Vanguard'), websiteUrl: 'https://www.example.com' } }
    const bare = account(3, 'Aviva', 'OUTDATED')
    const personal = { ...account(4, 'Smith Family Trust', 'MISSING'), provider: { ...provider(4, 'Smith Family Trust'), id: null } }
    mockApi({ 'GET /accounts': () => ({ json: overview([site, bare, personal]) }) })
    renderApp()
    await screen.findByTestId('account-Vanguard')

    const kind = (name: string) => within(screen.getByTestId(`account-${name}`)).getAllByRole('link')[0]
    expect(kind('Vanguard')).toHaveAttribute('data-link-kind', 'website')
    expect(kind('Vanguard')).toHaveAttribute('href', 'https://www.example.com')
    expect(kind('Vanguard')).toHaveTextContent("Visit Vanguard's website")
    expect(kind('Aviva')).toHaveAttribute('data-link-kind', 'search')
    expect(kind('Aviva').getAttribute('href')).toContain('google.com/search?q=Aviva%20how%20to%20get%20a%20statement')
    expect(kind('Smith Family Trust')).toHaveAttribute('data-link-kind', 'search')
  })

  it('prefers the verified how-to link over the website, and shows no link once the statement is current', async () => {
    const both = { ...withHelp, provider: { ...withHelp.provider, websiteUrl: 'https://www.example.com' } }
    const current = { ...both, id: 5, provider: { ...both.provider, id: 5, name: 'Nationwide' }, status: 'UPLOADED' as const }
    mockApi({ 'GET /accounts': () => ({ json: overview([both, current]) }) })
    renderApp()
    await screen.findByTestId('account-HSBC')
    expect(within(screen.getByTestId('account-HSBC')).getAllByRole('link')[0]).toHaveAttribute('href', 'https://example.com/help')
    expect(within(screen.getByTestId('account-Nationwide')).queryAllByRole('link')).toHaveLength(0)
  })

  it('explains what is needed using the brief wording', async () => {
    mockApi({ 'GET /accounts': () => ({ json: overview([account(1, 'HSBC', 'MISSING'), account(2, 'Vanguard', 'OUTDATED')]) }) })
    renderApp()
    await screen.findByTestId('account-HSBC')
    expect(screen.getByText(/latest statement is needed/i)).toBeInTheDocument()
    expect(screen.getByText(/needs replacing/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add statement for hsbc/i })).toHaveTextContent('Add statement')
    expect(screen.getByText('Submit unavailable - 2 providers need attention')).toBeInTheDocument()
  })
})

describe('saving feedback', () => {
  async function openDialog(routes: Parameters<typeof mockApi>[0]) {
    mockApi({ 'GET /accounts': () => ({ json: overview([account(1, 'HSBC', 'MISSING')]) }), ...routes })
    renderApp()
    await screen.findByTestId('ready-count')
    await userEvent.click(screen.getByRole('button', { name: /add statement for hsbc/i }))
    await userEvent.upload(await screen.findByLabelText('Statement file'), new File(['x'], 'old.pdf', { type: 'application/pdf' }))
  }

  it('shows what is about to be saved once a date is chosen', async () => {
    await openDialog({})
    expect(screen.queryByTestId('ready-to-save')).not.toBeInTheDocument()
    await pickToday()
    expect(screen.getByTestId('ready-to-save')).toHaveTextContent('old.pdf')
  })

  it('warns when the saved statement is already outdated', async () => {
    await openDialog({ 'PUT /accounts/1/statement': () => ({ json: account(1, 'HSBC', 'OUTDATED') }) })
    await pickToday()
    await userEvent.click(screen.getByRole('button', { name: 'Save statement' }))
    expect(await screen.findByText(/more than 3 months old\. HSBC still needs a newer statement/)).toBeInTheDocument()
  })

  it('keeps the entered file and date when saving fails, and lets the client retry', async () => {
    let calls = 0
    await openDialog({
      'PUT /accounts/1/statement': () => (++calls === 1
        ? { status: 500, json: { code: 'X', message: 'Could not save.' } }
        : { json: account(1, 'HSBC', 'UPLOADED') }),
    })
    await pickToday()
    await userEvent.click(screen.getByRole('button', { name: 'Save statement' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save.')
    expect(screen.getByTestId('statement-file-name')).toHaveTextContent('old.pdf')

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect((await screen.findAllByText('Statement saved for HSBC')).length).toBeGreaterThan(0)
  })
})

describe('statement date picker', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 8, 12))
  })
  afterEach(() => vi.useRealTimers())

  async function openPicker() {
    const api = mockApi({
      'GET /accounts': () => ({ json: overview([account(1, 'HSBC', 'MISSING')]) }),
      'PUT /accounts/1/statement': () => ({ json: account(1, 'HSBC', 'OUTDATED') }),
    })
    renderApp()
    await screen.findByTestId('ready-count')
    await userEvent.click(screen.getByRole('button', { name: /add statement for hsbc/i }))
    await userEvent.upload(await screen.findByLabelText('Statement file'), new File(['x'], 'hsbc.pdf', { type: 'application/pdf' }))
    await userEvent.click(screen.getByRole('button', { name: /statement date/i }))
    return api
  }
  const day = (iso: string) => document.querySelector(`[data-day="${iso}"] button`) as HTMLButtonElement

  it('starts with no date chosen, gives no verdict, and keeps Save off', async () => {
    await openPicker()
    expect(screen.getByRole('button', { name: /select the statement date/i })).toBeInTheDocument()
    expect(screen.getByTestId('date-validity')).toHaveAttribute('data-validity', 'none')
    expect(screen.queryByText('This statement is current')).not.toBeInTheDocument()
    expect(screen.queryByText('This statement is outdated')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save statement' })).toBeDisabled()
    expect(screen.getByText(/Current: 8 Jul 2026 onwards/)).toBeInTheDocument()
  })

  it('says the statement is current only after a current date is chosen', async () => {
    await openPicker()
    await userEvent.click(day('2026-10-08'))
    expect(screen.getByTestId('date-validity')).toHaveAttribute('data-validity', 'current')
    expect(screen.getByText('This statement is current')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save statement' })).toBeEnabled()
  })

  it('disables future dates', async () => {
    await openPicker()
    expect(day('2026-10-09')).toBeDisabled()
    expect(day('2026-10-08')).toBeEnabled()
  })

  it('lets an outdated date be chosen, explains why it will not count, and still allows saving it', async () => {
    const api = await openPicker()
    for (let i = 0; i < 3; i++) await userEvent.click(screen.getByRole('button', { name: /previous month/i }))

    expect(day('2026-07-07').closest('td')).toHaveClass('is-outdated')
    expect(day('2026-07-08').closest('td')).not.toHaveClass('is-outdated')

    await userEvent.click(day('2026-07-07'))
    expect(screen.getByTestId('date-validity')).toHaveAttribute('data-validity', 'outdated')
    expect(screen.getByText('This statement is outdated')).toBeInTheDocument()
    expect(screen.getByText(/won't count towards your readiness/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Save statement' }))
    expect((await screen.findAllByText(/more than 3 months old\. HSBC still needs a newer statement/)).length).toBeGreaterThan(0)
    expect(api.calls.find(c => c.key === 'PUT /accounts/1/statement')?.body).toMatchObject({ statementDate: '2026-07-07' })
  })

  it('closes the calendar when the already-selected date is clicked again', async () => {
    await openPicker()
    await userEvent.click(day('2026-10-08'))
    await userEvent.click(screen.getByRole('button', { name: /statement date/i }))
    await userEvent.click(day('2026-10-08'))
    expect(document.getElementById('statement-calendar')).toBeNull()
    expect(screen.getByTestId('date-validity')).toHaveAttribute('data-validity', 'current')
  })

  it('treats a statement exactly three months old as current', async () => {
    await openPicker()
    for (let i = 0; i < 3; i++) await userEvent.click(screen.getByRole('button', { name: /previous month/i }))
    await userEvent.click(day('2026-07-08'))
    expect(screen.getByTestId('date-validity')).toHaveAttribute('data-validity', 'current')
  })
})

describe('loading and failure states', () => {
  it('offers a retry when the accounts cannot be loaded', async () => {
    mockApi({
      'GET /accounts': () => ({ status: 500, json: { code: 'X', message: 'Server unavailable.' } }),
    })
    renderApp()

    expect(await screen.findByText('Server unavailable.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
