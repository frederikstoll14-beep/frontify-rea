import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { expect, test } from '@playwright/test'
import { call, mcpClient, ok } from '../mcp/helpers'
import { signUp, uniqueEmail } from './helpers'

/* eslint-disable @typescript-eslint/no-explicit-any */

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

test('Zustimmungsseite: Auswahl treffen, App nutzt nur das Freigegebene, in den Einstellungen änderbar', async ({
  browser,
}) => {
  // Der gebündelte Server (api/mcp.js) wird hier bewusst selbst getestet.
  const bundle = pathToFileURL(fileURLToPath(new URL('../../api/mcp.js', import.meta.url))).href
  const { default: listener } = (await import(bundle)) as { default: (req: unknown, res: unknown) => void }
  process.env.SUPABASE_URL = SUPABASE_URL
  process.env.SUPABASE_ANON_KEY = ANON_KEY
  const mcp = createServer(listener as never)
  await new Promise<void>((resolve) => mcp.listen(0, '127.0.0.1', resolve))
  const mcpUrl = `http://127.0.0.1:${(mcp.address() as AddressInfo).port}/mcp`

  try {
    const email = uniqueEmail('claude-nutzerin')
    const page = await browser.newPage()
    await signUp(page, 'Lea Beispiel', email)

    // Daten über die API anlegen (zwei Workspaces, eine davon mit zwei Marken)
    const { createClient } = await import('@supabase/supabase-js')
    const api = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
    expect((await api.auth.signInWithPassword({ email, password: 'test-passwort-123' })).error).toBeNull()
    const kurs = (await api.rpc('create_workspace', { p_name: 'Kurs Alpha' })).data!
    const privat = (await api.rpc('create_workspace', { p_name: 'Privat Beta' })).data!
    await api.rpc('create_brand', { p_workspace: kurs.id, p_name: 'Alpha Eins' })
    await api.rpc('create_brand', { p_workspace: kurs.id, p_name: 'Alpha Zwei' })
    await api.rpc('create_brand', { p_workspace: privat.id, p_name: 'Beta Geheim' })

    // --- OAuth-Anfrage wie von Claude ---
    const start = await startAuthorization()
    await page.route('https://claude.ai/**', (route) => route.fulfill({ status: 200, body: 'ok' }))
    await page.goto(`/oauth/consent?authorization_id=${start.authorizationId}`)

    await expect(page.getByRole('heading', { name: /„Claude“ mit Brandbench verbinden/ })).toBeVisible()
    await expect(page.getByText('Bekannte App')).toBeVisible()
    const allow = page.getByRole('button', { name: 'Zugriff erlauben' })
    await expect(allow).toBeDisabled()

    // Ganzen Workspace „Kurs Alpha“ wählen, aus „Privat Beta“ keine Marke
    await page.getByRole('checkbox', { name: 'Ganzen Workspace Kurs Alpha freigeben' }).check()
    await expect(page.getByRole('checkbox', { name: 'Marke Alpha Eins freigeben' })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: 'Marke Alpha Eins freigeben' })).toBeDisabled()
    await expect(page.getByText('1 ganzer Workspace (2 Marken erreichbar)')).toBeVisible()
    await expect(allow).toBeEnabled()

    const callback = page.waitForRequest((req) =>
      req.url().startsWith('https://claude.ai/api/mcp/auth_callback'),
    )
    await allow.click()
    const returned = new URL((await callback).url())
    expect(returned.searchParams.get('state')).toBe(start.state)
    const tokens = await exchange(start, returned.searchParams.get('code')!)

    // --- Die App sieht genau die Auswahl ---
    const client = await mcpClient(mcpUrl, tokens.access_token)
    const info = await ok(client, 'get_connection_info')
    expect(info.data.mode).toBe('read_write')
    expect(info.data.workspaces.map((w: any) => w.name)).toEqual(['Kurs Alpha'])
    expect(info.data.brands.map((b: any) => b.name).sort()).toEqual(['Alpha Eins', 'Alpha Zwei'])
    expect((await call(client, 'get_brand', { brand: 'Beta Geheim' })).isError).toBe(true)

    // --- Konto → Verbundene Apps ---
    await page.goto('/konto')
    const card = page.getByRole('region', { name: 'Verbundene Apps' })
    await expect(card.getByText('Claude', { exact: true }).first()).toBeVisible()
    await expect(card.getByText('1 Workspace, 0 einzelne Marken')).toBeVisible()
    await page.getByRole('button', { name: 'Auswahl ändern' }).click()
    const dialog = page.getByRole('dialog', { name: /Zugriff für „Claude“/ })
    await dialog.getByRole('checkbox', { name: 'Ganzen Workspace Kurs Alpha freigeben' }).uncheck()
    await dialog.getByRole('checkbox', { name: 'Marke Alpha Zwei freigeben' }).check()
    await dialog.getByRole('checkbox', { name: 'Marke Beta Geheim freigeben' }).check()
    await dialog.getByText('Nur lesen').click()
    await dialog.getByRole('button', { name: 'Speichern' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(card.getByText('Nur lesen')).toBeVisible()

    // Die Änderung gilt sofort, ohne Neuverbindung
    const after = await ok(client, 'get_connection_info')
    expect(after.data.mode).toBe('read_only')
    expect(after.data.workspaces).toHaveLength(0)
    expect(after.data.brands.map((b: any) => b.name).sort()).toEqual(['Alpha Zwei', 'Beta Geheim'])
    expect((await call(client, 'update_brand', { brand: 'Alpha Zwei', tagline: 'x' })).isError).toBe(true)

    // --- Trennen ---
    await page.getByRole('button', { name: 'Trennen' }).click()
    await page
      .getByRole('dialog', { name: /trennen\?/ })
      .getByRole('button', { name: 'Trennen' })
      .click()
    await expect(page.getByText('Noch keine App verbunden.')).toBeVisible()
    const gone = await call(client, 'list_brands')
    expect(gone.isError).toBe(true)
    await client.close()

    // --- Ablehnen ---
    const second = await startAuthorization()
    await page.goto(`/oauth/consent?authorization_id=${second.authorizationId}`)
    const denied = page.waitForRequest((req) =>
      req.url().startsWith('https://claude.ai/api/mcp/auth_callback'),
    )
    await page.getByRole('button', { name: 'Abbrechen' }).click()
    expect(new URL((await denied).url()).searchParams.get('error')).toBe('access_denied')
  } finally {
    mcp.close()
  }

  // ---- Hilfsfunktionen: OAuth-Registrierung und Token-Austausch wie ein MCP-Client ----
  async function startAuthorization() {
    const { createHash, randomBytes } = await import('node:crypto')
    const meta = await (await fetch(`${SUPABASE_URL}/auth/v1/.well-known/oauth-authorization-server`)).json()
    const redirectUri = 'https://claude.ai/api/mcp/auth_callback'
    const registration = await (
      await fetch(meta.registration_endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          client_name: 'Claude',
          redirect_uris: [redirectUri],
          token_endpoint_auth_method: 'none',
        }),
      })
    ).json()
    const b64 = (b: Buffer) => b.toString('base64url')
    const verifier = b64(randomBytes(32))
    const state = b64(randomBytes(8))
    const url = new URL(meta.authorization_endpoint)
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: registration.client_id,
      redirect_uri: redirectUri,
      state,
      code_challenge: b64(createHash('sha256').update(verifier).digest()),
      code_challenge_method: 'S256',
    }).toString()
    const redirect = await fetch(url, { redirect: 'manual' })
    const authorizationId = new URL(redirect.headers.get('location')!).searchParams.get('authorization_id')!
    return {
      authorizationId,
      state,
      verifier,
      clientId: registration.client_id as string,
      redirectUri,
      tokenEndpoint: meta.token_endpoint as string,
    }
  }

  async function exchange(start: Awaited<ReturnType<typeof startAuthorization>>, code: string) {
    const res = await fetch(start.tokenEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: start.clientId,
        redirect_uri: start.redirectUri,
        code_verifier: start.verifier,
      }),
    })
    expect(res.ok).toBe(true)
    return (await res.json()) as { access_token: string; refresh_token: string }
  }
})

test('Nicht angemeldet: Login-Seite, danach zurück zur Zustimmung (auch mobil ohne Querscrollen)', async ({
  browser,
}) => {
  const email = uniqueEmail('mobil')
  const { createClient } = await import('@supabase/supabase-js')
  const api = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
  const signedUp = await api.auth.signUp({
    email,
    password: 'test-passwort-123',
    options: { data: { full_name: 'Mo Bil' } },
  })
  expect(signedUp.error).toBeNull()
  const ws = (await api.rpc('create_workspace', { p_name: 'Mobil Kurs' })).data!
  await api.rpc('create_brand', { p_workspace: ws.id, p_name: 'Mobil Marke' })

  const { createHash, randomBytes } = await import('node:crypto')
  const meta = await (await fetch(`${SUPABASE_URL}/auth/v1/.well-known/oauth-authorization-server`)).json()
  const redirectUri = 'https://claude.ai/api/mcp/auth_callback'
  const registration = await (
    await fetch(meta.registration_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Claude',
        redirect_uris: [redirectUri],
        token_endpoint_auth_method: 'none',
      }),
    })
  ).json()
  const url = new URL(meta.authorization_endpoint)
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: registration.client_id,
    redirect_uri: redirectUri,
    state: 'abc',
    code_challenge: createHash('sha256').update(randomBytes(32)).digest('base64url'),
    code_challenge_method: 'S256',
  }).toString()
  const redirect = await fetch(url, { redirect: 'manual' })
  const authorizationId = new URL(redirect.headers.get('location')!).searchParams.get('authorization_id')!

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  const page = await context.newPage()
  await page.goto(`/oauth/consent?authorization_id=${authorizationId}`)
  await expect(page).toHaveURL(/\/login\?weiter=/)
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill('test-passwort-123')
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.getByRole('heading', { name: /„Claude“ mit Brandbench verbinden/ })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page).toHaveURL(/authorization_id=/)

  await page.getByRole('checkbox', { name: 'Ganzen Workspace Mobil Kurs freigeben' }).check()
  await expect(page.getByRole('button', { name: 'Zugriff erlauben' })).toBeEnabled()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await context.close()
})
