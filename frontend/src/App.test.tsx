import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { Toaster } from '@/components/ui/sonner'
import { account, mockApi, overview, provider } from '@/test/server'

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <App />
      <Toaster />
    </QueryClientProvider>,
  )
}

const submitButton = () => screen.getByRole('button', { name: /^submit/i })

afterEach(() => vi.unstubAllGlobals())

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
    expect(screen.getByText(/HSBC has no statement/)).toBeInTheDocument()
    expect(screen.getByText(/Vanguard is more than 3 months old/)).toBeInTheDocument()
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
    await userEvent.click(screen.getByRole('button', { name: 'Add 1 provider' }))

    expect(await screen.findByText('1 provider added')).toBeInTheDocument()
    expect(api.calls.find(c => c.key === 'POST /accounts')?.body).toEqual({ providerIds: [5] })
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

    await userEvent.click(screen.getByRole('button', { name: /upload statement for hsbc/i }))
    await userEvent.upload(await screen.findByLabelText('Statement file'), new File(['x'], 'hsbc_sep.pdf', { type: 'application/pdf' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save statement' }))

    expect(await screen.findByText('Statement saved')).toBeInTheDocument()
    expect(api.calls.find(c => c.key === 'PUT /accounts/1/statement')?.body).toMatchObject({ filename: 'hsbc_sep.pdf' })
    await waitFor(() => expect(screen.getByTestId('ready-count')).toHaveTextContent('1 of 1 ready'))
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
