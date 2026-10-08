import { expect, test } from '@playwright/test'

test('complete the pack and submit', async ({ page, request }) => {
  const before = await (await request.get('http://localhost:8080/api/accounts')).json()
  test.skip(before.readiness.total !== 4, 'needs the freshly seeded demo data')

  await page.goto('/')
  await expect(page.getByTestId('ready-count')).toHaveText('2 of 4 ready')

  const submit = page.getByRole('button', { name: /^submit/i })
  await expect(submit).toHaveAttribute('aria-disabled', 'true')
  await submit.click({ force: true })
  await expect(page.getByRole('alert')).toContainText('2 providers still need a current statement')

  await page.getByRole('button', { name: /upload statement for hsbc/i }).click()
  await page.getByLabel('Statement file').setInputFiles({ name: 'hsbc_sep.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') })
  await page.getByRole('button', { name: 'Save statement' }).click()
  await expect(page.getByTestId('account-HSBC')).toContainText('Uploaded')

  await page.getByRole('button', { name: /replace statement for vanguard/i }).click()
  await page.getByLabel('Statement file').setInputFiles({ name: 'vanguard_sep.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') })
  await page.getByRole('button', { name: 'Save statement' }).click()
  await expect(page.getByTestId('ready-count')).toHaveText('4 of 4 ready')

  await page.getByRole('button', { name: 'Add provider' }).first().click()
  await page.getByText('Monzo', { exact: true }).click()
  await page.getByRole('button', { name: 'Add 1 provider' }).click()
  await expect(page.getByTestId('ready-count')).toHaveText('4 of 5 ready')
  await expect(submit).toHaveAttribute('aria-disabled', 'true')

  await page.getByRole('button', { name: 'Remove Monzo' }).click()
  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  await expect(page.getByTestId('ready-count')).toHaveText('4 of 4 ready')

  await expect(submit).toHaveAttribute('aria-disabled', 'false')
  await submit.click()
  await expect(page.getByText('Your pack has been submitted')).toBeVisible()
})
