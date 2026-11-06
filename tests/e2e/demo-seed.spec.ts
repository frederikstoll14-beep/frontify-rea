import { expect, test } from '@playwright/test'
import { signUp, uniqueEmail } from './helpers'

test('Neues Konto bekommt Beispiel-Workspace und Beispiel-Marke, gelöscht bleibt gelöscht', async ({
  page,
}) => {
  await signUp(page, 'Neu Eintritt', uniqueEmail('beispiel'))

  // Beispiel ist da und nutzbar
  await expect(page.getByRole('link', { name: /Beispiel-Workspace/ })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('link', { name: /SV Rheinblick 1921/ }).first()).toBeVisible()
  await page.getByRole('link', { name: /Beispiel-Workspace/ }).click()
  await expect(page.getByRole('heading', { name: 'Beispiel-Workspace' })).toBeVisible()
  await page
    .getByRole('link', { name: /SV Rheinblick 1921/ })
    .first()
    .click()
  await expect(page.getByRole('heading', { name: 'SV Rheinblick 1921' })).toBeVisible()
  await page.getByRole('link', { name: /Zum Markenhandbuch/ }).click()
  await expect(page.getByRole('link', { name: 'Werte' })).toBeVisible()

  // Genau einmal, auch nach Neuladen
  await page.goto('/')
  await page.reload()
  await expect(page.getByRole('link', { name: /Beispiel-Workspace/ })).toHaveCount(1)

  // Löschen (Workspace → Einstellungen) und nicht wiederkommen
  await page.getByRole('link', { name: /Beispiel-Workspace/ }).click()
  await page.getByRole('tab', { name: 'Einstellungen' }).click()
  await page.getByRole('button', { name: 'Workspace löschen' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Endgültig löschen' }).click()
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 })
  await page.reload()
  await expect(page.getByRole('heading', { name: /Hallo/ })).toBeVisible()
  await expect(page.getByText('Beispiel-Workspace')).toHaveCount(0)
  await page.waitForTimeout(1500)
  await expect(page.getByText('Beispiel-Workspace')).toHaveCount(0)
})
