import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1000, height: 640 } })

test('the button bar sits flush at the bottom of a scrolling dialog', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /view statement for barclays/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByTitle(/your uploaded statement/i)).toBeVisible()

  await dialog.evaluate(el => el.scrollTo(0, 120))
  const { scrollable, gap } = await dialog.evaluate(el => {
    const footer = el.querySelector('[data-slot=dialog-footer]')!.getBoundingClientRect()
    return { scrollable: el.scrollHeight > el.clientHeight, gap: Math.round(el.getBoundingClientRect().bottom - footer.bottom) }
  })
  expect(scrollable).toBe(true)
  expect(Math.abs(gap)).toBeLessThan(1)
})
