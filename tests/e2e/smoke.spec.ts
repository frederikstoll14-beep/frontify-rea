import { expect, test } from '@playwright/test'
import { createWorkspaceAndBrand, signUp, uniqueEmail } from './helpers'

test('Dozentin legt Kurs und Marke an, Studentin tritt per Link bei, Gäste sehen das Portal', async ({
  browser,
}) => {
  // --- Dozentin ---
  const lecturer = await browser.newPage()
  await signUp(lecturer, 'Prof. Lea Beispiel', uniqueEmail('dozentin'))
  await expect(lecturer.getByRole('heading', { name: /Hallo, Lea/ })).toBeVisible()
  const brandUrl = await createWorkspaceAndBrand(lecturer, 'Brand Identity WS 26/27', 'SV Teststadt 1904')
  const brandPath = new URL(brandUrl).pathname

  // Portal und Handbuch aus der Vorlage
  await expect(lecturer.getByRole('heading', { name: 'SV Teststadt 1904' })).toBeVisible()
  await lecturer.getByRole('link', { name: /Zum Markenhandbuch/ }).click()
  await expect(lecturer.getByRole('heading', { name: 'Willkommen', level: 1 })).toBeVisible()
  await expect(lecturer.getByRole('link', { name: 'Werte' })).toBeVisible()

  // Baustein hinzufügen und speichern
  await lecturer.getByRole('radio', { name: /Bearbeiten/ }).click()
  await lecturer.getByRole('button', { name: 'Baustein hinzufügen' }).click()
  await lecturer.getByPlaceholder(/Suchen, z. B./).fill('Zitat')
  await lecturer.keyboard.press('Enter')
  await lecturer.getByPlaceholder('Claim, Leitsatz oder Zitat').fill('Mehr als ein Verein.')
  // Wechsel in die Ansicht speichert ausstehende Änderungen zuerst
  await lecturer.getByRole('radio', { name: /Ansehen/ }).click()
  await expect(lecturer.getByRole('radio', { name: /Ansehen/ })).toHaveAttribute('aria-checked', 'true')
  await lecturer.reload()
  await expect(lecturer.getByText('„Mehr als ein Verein.“')).toBeVisible()

  // Farbe in der Markenbasis anlegen
  await lecturer.goto(`${brandPath}/basis`)
  await lecturer.getByRole('button', { name: 'Farbe', exact: true }).first().click()
  await lecturer.getByLabel('Name', { exact: true }).fill('Vereinsrot')
  await lecturer.getByLabel('HEX-Wert').fill('#C8102E')
  await lecturer.getByRole('button', { name: 'Speichern' }).click()
  await expect(lecturer.getByText('Vereinsrot')).toBeVisible()

  // Einladungslink für den Kurs (Workspace) erzeugen
  const workspaceLink = lecturer.getByRole('menuitem', { name: /Workspace:/ })
  await lecturer.getByRole('button', { name: 'Weitere' }).click()
  await workspaceLink.click()
  await lecturer.getByRole('tab', { name: /Mitglieder/ }).click()
  await lecturer.getByRole('button', { name: /Einladungslink für Gruppe/ }).click()
  await lecturer.getByRole('button', { name: 'Link erstellen' }).click()
  const inviteUrl = await lecturer.locator('input[readonly]').last().inputValue()
  expect(inviteUrl).toContain('/einladung/')
  await lecturer.keyboard.press('Escape')

  // --- Studentin tritt bei ---
  const student = await browser.newPage()
  const invitePath = new URL(inviteUrl).pathname
  await student.goto(invitePath)
  await expect(student.getByRole('heading', { name: 'Du bist eingeladen' })).toBeVisible()
  await student.getByRole('link', { name: /Konto erstellen/ }).click()
  await student.getByLabel('Name').fill('Mia Student')
  await student.getByLabel('E-Mail').fill(uniqueEmail('studentin'))
  await student.getByLabel('Passwort').fill('test-passwort-123')
  await student.getByRole('button', { name: 'Konto erstellen' }).click()
  await expect(student).toHaveURL(/\/w\//, { timeout: 15_000 })
  await expect(student.getByText('SV Teststadt 1904')).toBeVisible()

  // Als Workspace-Mitglied: ansehen und kommentieren, aber nicht bearbeiten
  await student.goto(`${brandPath}/g/markenhandbuch`)
  await expect(student.getByRole('heading', { name: 'Willkommen', level: 1 })).toBeVisible()
  await expect(student.getByRole('radio', { name: /Bearbeiten/ })).toHaveCount(0)
  await student.getByRole('button', { name: 'Kommentare' }).click()
  await student.getByPlaceholder('Feedback oder Frage …').fill('Bitte Kontrast der Akzentfarbe prüfen.')
  await student.getByRole('button', { name: 'Kommentieren' }).click()
  await expect(student.getByText('Bitte Kontrast der Akzentfarbe prüfen.')).toBeVisible()

  // --- Öffentliche Freigabe ---
  const guest = await browser.newPage()
  await guest.goto(brandPath)
  await expect(guest.getByRole('heading', { name: 'Marke nicht gefunden' })).toBeVisible()

  await lecturer.goto(`${brandPath}/einstellungen?tab=teilen`)
  await lecturer.getByRole('switch').first().click()
  await expect(lecturer.getByText('Freigabe aktiv')).toBeVisible()

  await guest.reload()
  await expect(guest.getByRole('heading', { name: 'SV Teststadt 1904' })).toBeVisible()
  await guest.getByRole('link', { name: /Zum Markenhandbuch/ }).click()
  await expect(guest.getByRole('heading', { name: 'Willkommen', level: 1 })).toBeVisible()
  // Gäste sehen keine Kommentare
  await expect(guest.getByRole('button', { name: 'Kommentare' })).toHaveCount(0)
})
