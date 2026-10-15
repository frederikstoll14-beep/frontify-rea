import { expect, type Page } from '@playwright/test'

export function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.local`
}

export async function signUp(page: Page, name: string, email: string, redirect = '/') {
  await page.goto(`/login?modus=registrieren&weiter=${encodeURIComponent(redirect)}`)
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill('test-passwort-123')
  await page.getByRole('button', { name: 'Konto erstellen' }).click()
}

export async function createWorkspaceAndBrand(
  page: Page,
  workspace: string,
  brand: string,
  template = /^Sportverein/,
) {
  await page.getByRole('button', { name: 'Workspace anlegen' }).first().click()
  await page.getByLabel('Name').fill(workspace)
  await page.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page).toHaveURL(/\/w\//)
  await page.getByRole('button', { name: 'Neue Marke' }).click()
  await page.getByLabel('Name').fill(brand)
  await page.getByRole('button', { name: template }).click()
  await page.getByRole('button', { name: 'Marke anlegen' }).click()
  await expect(page).toHaveURL(/\/b\//, { timeout: 20_000 })
  return page.url()
}
