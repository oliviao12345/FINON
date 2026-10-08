import { expect, test } from '@playwright/test'

const api = `http://localhost:${process.env.E2E_API_PORT ?? '8080'}/api`

test('each browser has its own private data, and files cannot be opened with someone else\'s session', async ({ browser }) => {
  const alice = await (await browser.newContext()).newPage()
  const bob = await (await browser.newContext()).newPage()
  const aliceCtx = alice.context()
  const bobCtx = bob.context()

  await alice.goto('/')
  await bob.goto('/')
  await expect(alice.getByTestId('ready-count')).toHaveText('2 of 4 ready')
  await expect(bob.getByTestId('ready-count')).toHaveText('2 of 4 ready')

  // Alice removes a provider and adds her own; Bob must see none of it.
  await alice.getByRole('button', { name: 'Remove Barclays' }).click()
  await alice.getByRole('button', { name: 'Remove', exact: true }).click()
  await expect(alice.getByTestId('ready-count')).toHaveText('1 of 3 ready')
  await alice.reload()
  await expect(alice.getByTestId('ready-count')).toHaveText('1 of 3 ready')

  await bob.reload()
  await expect(bob.getByTestId('ready-count')).toHaveText('2 of 4 ready')
  await expect(bob.getByTestId('account-Barclays')).toBeVisible()

  // A brand-new visitor starts from the same four samples, not from Alice's changes.
  const cara = await (await browser.newContext()).newPage()
  await cara.goto('/')
  await expect(cara.getByTestId('ready-count')).toHaveText('2 of 4 ready')
  await expect(cara.getByTestId('account-Barclays')).toBeVisible()

  // Files: Bob's session cannot open a file that belongs to Alice, and no session means no access.
  const aliceSession = await alice.evaluate(() => localStorage.getItem('finon.session') as string)
  const bobSession = await bob.evaluate(() => localStorage.getItem('finon.session') as string)
  expect(aliceSession).not.toBe(bobSession)

  const aliceList = await (await aliceCtx.request.get(`${api}/accounts`, { headers: { 'X-Session-Id': aliceSession } })).json()
  const aliceFidelity = aliceList.accounts.find((a: { provider: { name: string } }) => a.provider.name === 'Fidelity').id

  const own = await aliceCtx.request.get(`${api}/accounts/${aliceFidelity}/statement/file`, { headers: { 'X-Session-Id': aliceSession } })
  expect(own.status()).toBe(200)
  const theirs = await bobCtx.request.get(`${api}/accounts/${aliceFidelity}/statement/file`, { headers: { 'X-Session-Id': bobSession } })
  expect(theirs.status()).toBe(404)
  const anonymous = await bobCtx.request.get(`${api}/accounts/${aliceFidelity}/statement/file`)
  expect(anonymous.status()).toBe(400)
})
