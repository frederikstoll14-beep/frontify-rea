import { describe, expect, it } from 'vitest'
import { BLOCK_TYPES, defaultContent } from '@/lib/blocks/types'
import { BLOCK_SCHEMAS } from './blocks'
import { readConfig } from './config'
import { matchByRef } from './context'
import { createHandler, publicOrigin } from './http'
import { guessMime, safeFileName, titleFromFileName } from './mime'
import { markdownToHtml, sanitizeRichHtml } from './richtext'
import { isPrivateAddress } from './safe-fetch'
import { ALL_TOOLS } from './server'

const ENV = { SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_ANON_KEY: 'anon-key-for-tests' }

describe('Konfiguration', () => {
  it('akzeptiert die Namen der Web-App und die Server-Namen', () => {
    for (const env of [
      ENV,
      { VITE_SUPABASE_URL: 'https://abc.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' },
      { NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co/', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'k' },
    ]) {
      expect(readConfig(env).ok).toBe(true)
    }
  })

  it('erklärt, was fehlt', () => {
    const result = readConfig({})
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.problem).toContain('SUPABASE_URL')
  })

  it('verweigert den geheimen Schlüssel', () => {
    const result = readConfig({ SUPABASE_URL: 'https://abc.supabase.co', SUPABASE_ANON_KEY: 'sb_secret_xyz' })
    expect(result.ok).toBe(false)
  })
})

describe('Tools', () => {
  it('haben eindeutige, saubere Namen und Beschreibungen', () => {
    const names = ALL_TOOLS.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
    for (const tool of ALL_TOOLS) {
      expect(tool.name, tool.name).toMatch(/^[a-z][a-z0-9_]*$/)
      expect(tool.description.length, tool.name).toBeGreaterThan(30)
      expect(tool.title.length, tool.name).toBeGreaterThan(3)
    }
  })

  it('kennzeichnen Löschendes als destruktiv und Lesendes als read', () => {
    for (const tool of ALL_TOOLS) {
      if (/^(delete_|remove_)/.test(tool.name)) expect(tool.kind, tool.name).toBe('destructive')
      if (/^(list_|get_)/.test(tool.name)) expect(tool.kind, tool.name).toBe('read')
    }
  })

  it('verlangen für das Löschen großer Einheiten den Namen als Bestätigung', () => {
    for (const name of ['delete_workspace', 'delete_brand', 'delete_guideline', 'delete_library']) {
      const tool = ALL_TOOLS.find((t) => t.name === name)!
      expect(
        Object.keys(tool.input).some((key) => key.startsWith('confirm_')),
        name,
      ).toBe(true)
    }
  })
})

describe('Bausteine', () => {
  it('haben für jeden Typ ein Schema, das leere Eingaben mit App-Standardwerten füllt', () => {
    const stripIds = (value: unknown): unknown =>
      JSON.parse(JSON.stringify(value, (key, v) => (key === 'id' ? undefined : v)))
    for (const type of BLOCK_TYPES) {
      const parsed = BLOCK_SCHEMAS[type].parse({})
      // dos_donts/cards/checklist/accordion haben in der App Beispiel-Einträge, im Server leere Listen
      if (['checklist', 'accordion', 'dos_donts', 'cards', 'table'].includes(type)) continue
      expect(stripIds(parsed), type).toEqual(stripIds(defaultContent(type)))
    }
  })

  it('lehnen unbekannte Felder und falsche Werte ab', () => {
    expect(BLOCK_SCHEMAS.heading.safeParse({ titel: 'x' }).success).toBe(false)
    expect(BLOCK_SCHEMAS.callout.safeParse({ tone: 'rosa' }).success).toBe(false)
    expect(BLOCK_SCHEMAS.cards.safeParse({ columns: 9 }).success).toBe(false)
  })
})

describe('Rich Text', () => {
  it('wandelt Markdown um und entfernt Gefährliches', () => {
    const html = markdownToHtml(
      '**fett** und [Link](javascript:alert(1)) <script>x</script> <img src=x onerror=alert(1)>',
    )
    expect(html).toContain('<strong>fett</strong>')
    expect(html).not.toMatch(/script|javascript:|onerror|<img/i)
    expect(sanitizeRichHtml('<a href="https://example.org" onclick="x()">ok</a>')).toBe(
      '<a href="https://example.org" rel="noopener noreferrer nofollow">ok</a>',
    )
  })
})

describe('Dateinamen und Typen', () => {
  it('erkennt Typen und neutralisiert Pfade', () => {
    expect(guessMime('Logo.SVG')).toBe('image/svg+xml')
    expect(guessMime('x.unbekannt')).toBe('application/octet-stream')
    expect(safeFileName('../../etc/passwd')).toBe('passwd')
    expect(safeFileName('a\\b\\c.png')).toBe('c.png')
    expect(safeFileName('\u0000\u0001')).toBe('datei')
    expect(titleFromFileName('logo_dunkel-v2.svg')).toBe('logo dunkel v2')
  })
})

describe('Schutz vor Zugriffen auf interne Adressen', () => {
  it('erkennt private und öffentliche Adressen', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '::1',
      'fd00::1',
      'fe80::1',
      '::ffff:127.0.0.1',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true)
    }
    for (const ip of ['8.8.8.8', '93.184.216.34', '172.32.0.1', '2606:4700:4700::1111']) {
      expect(isPrivateAddress(ip), ip).toBe(false)
    }
  })
})

describe('Auflösung über ID, Kurz-URL oder Namen', () => {
  const items = [
    { id: '11111111-1111-4111-8111-111111111111', name: 'SV Rheinblick 1921', slug: 'sv-rheinblick-1921' },
    { id: '22222222-2222-4222-8222-222222222222', name: 'FC Nordlicht', slug: 'fc-nordlicht' },
    { id: '33333333-3333-4333-8333-333333333333', name: 'FC Nordstern', slug: 'fc-nordstern' },
  ]
  const keys = [(i: (typeof items)[number]) => i.name, (i: (typeof items)[number]) => i.slug]

  it('findet exakt, ohne Groß-/Kleinschreibung und über eindeutige Teile', () => {
    expect(matchByRef(items, items[1].id, keys, 'Marke').name).toBe('FC Nordlicht')
    expect(matchByRef(items, 'fc-nordlicht', keys, 'Marke').name).toBe('FC Nordlicht')
    expect(matchByRef(items, 'fc nordlicht', keys, 'Marke').name).toBe('FC Nordlicht')
    expect(matchByRef(items, 'rheinblick', keys, 'Marke').name).toBe('SV Rheinblick 1921')
  })

  it('meldet Mehrdeutiges und Unbekanntes verständlich', () => {
    expect(() => matchByRef(items, 'nord', keys, 'Marke')).toThrow(/nicht eindeutig/)
    expect(() => matchByRef(items, 'xyz', keys, 'Marke')).toThrow(/nicht gefunden/)
  })
})

describe('HTTP-Rahmen', () => {
  const handle = createHandler(ENV)
  const get = (path: string, init: RequestInit = {}, host = 'brandbench.example') =>
    handle(new Request(`https://${host}${path}`, init))

  it('meldet Gesundheit und fehlende Konfiguration', async () => {
    const ok = await get('/mcp/health')
    expect(ok.status).toBe(200)
    expect((await ok.json()).mcp).toBe('https://brandbench.example/mcp')
    const broken = await createHandler({})(new Request('https://x.example/health'))
    expect(broken.status).toBe(503)
  })

  it('beschreibt sich selbst für OAuth-Clients', async () => {
    for (const path of [
      '/.well-known/oauth-protected-resource',
      '/.well-known/oauth-protected-resource/mcp',
    ]) {
      const body = await (await get(path)).json()
      expect(body.resource).toBe('https://brandbench.example/mcp')
      expect(body.authorization_servers).toEqual(['http://127.0.0.1:54321/auth/v1'])
    }
  })

  it('verlangt Anmeldung und verweist auf die Metadaten', async () => {
    const res = await get('/mcp', { method: 'POST', body: '{}' })
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toBe(
      'Bearer resource_metadata="https://brandbench.example/.well-known/oauth-protected-resource/mcp"',
    )
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('beantwortet Preflight-Anfragen, lehnt andere Methoden und Pfade ab', async () => {
    expect((await get('/mcp', { method: 'OPTIONS' })).status).toBe(204)
    expect((await get('/mcp')).status).toBe(405)
    expect((await get('/mcp', { method: 'DELETE' })).status).toBe(405)
    expect((await get('/nirgends')).status).toBe(404)
  })

  it('ordnet Anfragen auch über den Hinweis ?route=… richtig zu (Vercel-Rewrites)', async () => {
    const prm = await get('/api/mcp?route=prm')
    expect((await prm.json()).resource).toBe('https://brandbench.example/mcp')
    expect((await get('/api/mcp?route=health')).status).toBe(200)
    expect((await get('/mcp?route=prm')).status).toBe(200)
  })

  it('erkennt Vercel-Pfad und öffentliche Adresse', async () => {
    expect((await get('/api/mcp', { method: 'POST', body: '{}' })).status).toBe(401)
    expect(publicOrigin(new Request('http://localhost:8787/mcp'), null)).toBe('http://localhost:8787')
    expect(
      publicOrigin(
        new Request('http://internal/mcp', {
          headers: { 'x-forwarded-host': 'app.example', 'x-forwarded-proto': 'https' },
        }),
        null,
      ),
    ).toBe('https://app.example')
  })
})
