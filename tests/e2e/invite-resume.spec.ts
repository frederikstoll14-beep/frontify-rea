import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import { dismissTour, uniqueEmail } from './helpers'

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const PASSWORD = 'test-passwort-123'

/** Dozentin mit Workspace, Marke und Gruppen-Link; Studierende bekommen ein Konto per API. */
async function setup() {
  const api = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
  const lecturer = uniqueEmail('dozentin')
  const signedUp = await api.auth.signUp({ email: lecturer, password: PASSWORD })
  const workspace = (await api.rpc('create_workspace', { p_name: 'Kurs Einladung' })).data!
  await api.rpc('create_brand', { p_workspace: workspace.id, p_name: 'Gruppenprojekt' })
  const invitation = (
    await api
      .from('invitations')
      .insert({ workspace_id: workspace.id, workspace_role: 'member', created_by: signedUp.data.user!.id })
      .select('token')
      .single()
  ).data!
  const student = async () => {
    const email = uniqueEmail('student')
    const other = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
    expect(
      (await other.auth.signUp({ email, password: PASSWORD, options: { data: { full_name: 'Stu Dent' } } }))
        .error,
    ).toBeNull()
    return email
  }
  return { token: invitation.token, student }
}

test('Einladung wird nachgeholt, wenn die Anmeldung nicht über den Link läuft', async ({ page }) => {
  const { token, student } = await setup()
  const email = await student()

  // Link öffnen (noch nicht angemeldet), dann ganz normal anmelden – ohne „weiter“-Parameter
  await page.goto(`/einladung/${token}`)
  await expect(page.getByRole('heading', { name: 'Du bist eingeladen' })).toBeVisible()
  await page.goto('/login')
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill(PASSWORD)
  await page.getByRole('button', { name: 'Anmelden' }).click()

  await expect(page).toHaveURL(/\/w\//, { timeout: 15_000 })
  await dismissTour(page)
  await expect(page.getByText('Gruppenprojekt')).toBeVisible()
})

test('Einladungslink lässt sich auf der leeren Startseite einfügen', async ({ page }) => {
  const { token, student } = await setup()
  const email = await student()
  await page.goto('/login')
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill(PASSWORD)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await dismissTour(page)
  await expect(page.getByRole('heading', { name: 'Einladung erhalten?' }).first()).toBeVisible()

  await page.getByLabel('Einladungslink').fill('kein link')
  await page.getByRole('button', { name: 'Einlösen' }).click()
  await expect(page.getByText('Das sieht nicht nach einem Einladungslink aus.')).toBeVisible()

  await page.getByLabel('Einladungslink').fill(`${new URL(page.url()).origin}/einladung/${token}`)
  await page.getByRole('button', { name: 'Einlösen' }).click()
  await expect(page).toHaveURL(/\/w\//, { timeout: 15_000 })
  await expect(page.getByText('Gruppenprojekt')).toBeVisible()
})
