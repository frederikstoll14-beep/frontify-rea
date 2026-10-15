import { expect, test } from '@playwright/test'
import { createWorkspaceAndBrand, signUp, uniqueEmail } from './helpers'

test('Portal ist auf dem Smartphone ohne horizontales Scrollen nutzbar', async ({ page }) => {
  await signUp(page, 'Mobil Test', uniqueEmail('mobil'))
  const brandUrl = await createWorkspaceAndBrand(page, 'Mobil', 'Mobil-Marke')
  for (const path of ['', '/g/markenhandbuch', '/basis', '/bibliothek/logos']) {
    await page.goto(new URL(brandUrl).pathname + path)
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, `horizontaler Überlauf auf ${path || '/'}`).toBeLessThanOrEqual(1)
  }
  await page.goto(new URL(brandUrl).pathname + '/g/markenhandbuch')
  await page.getByRole('button', { name: 'Inhalt' }).click()
  await page.getByRole('link', { name: 'Werte' }).click()
  await expect(page.getByRole('heading', { name: 'Werte', level: 1 })).toBeVisible()
})
