import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  ANON_KEY,
  SUPABASE_URL,
  call,
  connectApp,
  mcpClient,
  newUser,
  ok,
  startMcp,
  type RunningServer,
} from './helpers'

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('MCP – alle Funktionen im Zusammenspiel', () => {
  let server: RunningServer
  let alice: Awaited<ReturnType<typeof newUser>>
  let bob: Awaited<ReturnType<typeof newUser>>
  let c: Client
  let wsId: string
  let brandId: string
  let brandName: string
  let fileServer: ReturnType<typeof createServer>
  let fileUrl: string

  beforeAll(async () => {
    server = await startMcp()
    alice = await newUser('alice')
    bob = await newUser('bob')
    // Ein Workspace und eine Marke, die nicht freigegeben werden (Kontrolle)
    const secretWs = await alice.client.rpc('create_workspace', { p_name: 'Nicht freigegeben' })
    await alice.client.rpc('create_brand', { p_workspace: secretWs.data!.id, p_name: 'Unsichtbar' })
    // Freigabe: Alice verbindet die App ohne vorhandenen Workspace – Workspaces legt die App selbst an.
    const first = await alice.client.rpc('create_workspace', { p_name: 'Startpunkt' })
    wsId = first.data!.id
    const conn = await connectApp({ user: alice.client, workspaceIds: [wsId] })
    c = await mcpClient(server.url, conn.accessToken)

    fileServer = createServer(async (_req, res) => {
      const png = await sharp({ create: { width: 640, height: 480, channels: 3, background: '#d9481f' } })
        .png()
        .toBuffer()
      res.writeHead(200, { 'content-type': 'image/png' })
      res.end(png)
    })
    await new Promise<void>((r) => fileServer.listen(0, '127.0.0.1', r))
    fileUrl = `http://127.0.0.1:${(fileServer.address() as AddressInfo).port}/orange.png`
  })

  afterAll(async () => {
    await c?.close()
    await server.close()
    fileServer?.close()
  })

  it('Workspace und Marke anlegen, ändern, teilen', async () => {
    const created = await ok(c, 'create_workspace', { name: 'Brand Identity WS 26', description: 'Kurs' })
    const newWs = created.data.id
    const list = await ok(c, 'list_workspaces')
    expect(list.data.map((w: any) => w.name)).toEqual(
      expect.arrayContaining(['Startpunkt', 'Brand Identity WS 26']),
    )
    expect(list.data.map((w: any) => w.name)).not.toContain('Nicht freigegeben')

    await ok(c, 'update_workspace', { workspace: newWs, description: 'Kurs 2026' })
    const brand = await ok(c, 'create_brand', {
      workspace: newWs,
      name: 'SV Rheinblick',
      template: 'verein',
      tagline: 'Gemeinsam am Rhein',
    })
    brandId = brand.data.id
    brandName = brand.data.name
    const overview = await ok(c, 'get_brand', { brand: brandId })
    expect(overview.data.guidelines.length).toBeGreaterThan(0)
    expect(overview.data.libraries.length).toBeGreaterThan(0)
    expect(overview.data.role).toBe('admin')

    await ok(c, 'update_brand', {
      brand: brandId,
      tagline: 'Neu',
      theme: { primary: '#0B3C7A', accent: '#D9481F' },
      home: { welcome: 'Hallo' },
    })
    const bad = await call(c, 'update_brand', { brand: brandId, theme: { primary: 'blau' } })
    expect(bad.isError).toBe(true)

    const noConfirm = await call(c, 'set_brand_sharing', { brand: brandId, is_public: true })
    expect(noConfirm.isError).toBe(true)
    const shared = await ok(c, 'set_brand_sharing', {
      brand: brandId,
      is_public: true,
      confirm_public: true,
      public_until: '2030-01-01',
    })
    expect(shared.data.is_public).toBe(true)
    await ok(c, 'set_brand_sharing', { brand: brandId, is_public: false })

    const templates = await ok(c, 'list_templates')
    expect(templates.data.templates.map((t: any) => t.id)).toContain('verein')
    const found = await ok(c, 'search', { brand: brandId, query: 'Rheinblick' })
    expect(Array.isArray(found.data)).toBe(true)
  })

  it('Handbuch: Seiten und Bausteine', async () => {
    const g = await ok(c, 'create_guideline', {
      brand: brandId,
      title: 'Testhandbuch',
      description: 'Für Tests',
    })
    const gId = g.data.id
    const chapter = await ok(c, 'create_page', {
      brand: brandId,
      guideline: gId,
      title: 'Kapitel 1',
      kind: 'chapter',
    })
    const page = await ok(c, 'create_page', {
      brand: brandId,
      guideline: gId,
      title: 'Markenkern',
      chapter: 'Kapitel 1',
      intro: 'Wofür wir stehen',
      blocks: [
        { type: 'heading', content: { text: 'Unsere Werte', eyebrow: 'Kern' } },
        {
          type: 'text',
          content: { markdown: '**Mut** und _Zusammenhalt_\n\n- eins\n- zwei\n\n<script>alert(1)</script>' },
        },
        { type: 'callout', content: { tone: 'tip', title: 'Tipp', markdown: 'Kurz halten.' } },
        {
          type: 'table',
          content: {
            rows: [
              ['A', 'B'],
              ['1', '2'],
            ],
          },
        },
        { type: 'checklist', content: { title: 'Prüfen', items: [{ text: 'Logo' }, { text: 'Farben' }] } },
        { type: 'accordion', content: { items: [{ title: 'Warum?', markdown: 'Darum.' }] } },
      ],
    })
    const pageId = page.data.id
    expect(page.data.blocks).toHaveLength(6)
    expect(chapter.data.kind).toBe('chapter')

    const full = await ok(c, 'get_page', { page: pageId })
    const text = full.data.blocks.find((b: any) => b.type === 'text')
    expect(text.content.html).toContain('<strong>Mut</strong>')
    expect(text.content.html).not.toContain('script')
    expect(full.data.blocks[4].content.items[0].id).toBeTruthy()
    const outline = await ok(c, 'get_page', {
      page: 'Markenkern',
      guideline: 'Testhandbuch',
      brand: brandId,
      detail: 'outline',
    })
    expect(outline.data.blocks[0].outline).toContain('Unsere Werte')

    const inserted = await ok(c, 'add_block', {
      page: pageId,
      type: 'quote',
      content: { text: 'Immer weiter', source: 'Trainer' },
      position: 0,
    })
    const firstBlocks = await ok(c, 'get_page', { page: pageId, detail: 'outline' })
    expect(firstBlocks.data.blocks[0].type).toBe('quote')
    expect(firstBlocks.data.blocks).toHaveLength(7)

    await ok(c, 'update_block', { block_id: inserted.data.id, content: { source: 'Kapitän' } })
    const after = await ok(c, 'get_page', { page: pageId })
    expect(after.data.blocks[0].content).toMatchObject({ text: 'Immer weiter', source: 'Kapitän' })

    await ok(c, 'move_block', { block_id: inserted.data.id, position: 3 })
    const moved = await ok(c, 'get_page', { page: pageId, detail: 'outline' })
    expect(moved.data.blocks[3].id).toBe(inserted.data.id)

    const invalid = await call(c, 'add_block', { page: pageId, type: 'callout', content: { tone: 'rosa' } })
    expect(invalid.isError).toBe(true)
    expect(invalid.text).toContain('get_block_schema')
    const unknownField = await call(c, 'add_block', {
      page: pageId,
      type: 'heading',
      content: { titel: 'x' },
    })
    expect(unknownField.isError).toBe(true)

    const schema = await ok(c, 'get_block_schema', { type: 'logos' })
    expect(schema.data.json_schema).toBeTruthy()
    expect((await ok(c, 'get_block_schema')).data).toHaveLength(22)

    await ok(c, 'delete_block', { block_id: inserted.data.id })
    await ok(c, 'create_page_revision', { page: pageId, label: 'Vor Ersetzen' })
    await ok(c, 'replace_page_blocks', {
      page: pageId,
      blocks: [{ type: 'heading', content: { text: 'Neu' } }],
    })
    expect((await ok(c, 'get_page', { page: pageId, detail: 'outline' })).data.blocks).toHaveLength(1)
    const revisions = await ok(c, 'list_page_revisions', { page: pageId })
    expect(revisions.data.length).toBeGreaterThanOrEqual(2)
    const target = revisions.data.find((r: any) => r.label === 'Vor Ersetzen')
    await ok(c, 'restore_page_revision', { page: pageId, revision_id: target.id })
    expect((await ok(c, 'get_page', { page: pageId, detail: 'outline' })).data.blocks).toHaveLength(6)

    await ok(c, 'update_page', { page: pageId, intro: 'Neu formuliert' })
    const second = await ok(c, 'create_page', { brand: brandId, guideline: gId, title: 'Zweite Seite' })
    await ok(c, 'move_page', { page: second.data.id, chapter: 'Kapitel 1', position: 0 })
    const structure = await ok(c, 'list_guidelines', { brand: brandId, guideline: gId })
    const chapterNode = structure.data[0].structure.find((n: any) => n.kind === 'chapter')
    expect(chapterNode.pages.map((p: any) => p.title)).toEqual(['Zweite Seite', 'Markenkern'])
    await ok(c, 'update_guideline', { brand: brandId, guideline: gId, is_published: false })

    const wrong = await call(c, 'delete_guideline', {
      brand: brandId,
      guideline: gId,
      confirm_title: 'falsch',
    })
    expect(wrong.isError).toBe(true)
    await ok(c, 'delete_page', { page: second.data.id })
  })

  it('Markenbasis: Farben, Schriften, Textstile, Tokens', async () => {
    const palette = await ok(c, 'create_palette', { brand: brandId, name: 'Hausfarben' })
    const color = await ok(c, 'save_color', {
      brand: brandId,
      palette: 'Hausfarben',
      name: 'Rheinblau',
      hex: '0b3c7a',
      token: 'rhein-blau',
      cmyk: '100 80 0 20',
      pantone: '294 C',
    })
    expect(color.data.hex).toBe('#0B3C7A')
    const badToken = await call(c, 'save_color', {
      brand: brandId,
      palette: 'Hausfarben',
      name: 'X',
      hex: '#FFFFFF',
      token: 'Bad Token',
    })
    expect(badToken.isError).toBe(true)
    const badHex = await call(c, 'save_color', {
      brand: brandId,
      palette: 'Hausfarben',
      name: 'Y',
      hex: 'zzz',
    })
    expect(badHex.isError).toBe(true)
    await ok(c, 'save_color', { brand: brandId, palette: 'Hausfarben', name: 'Sonnengelb', hex: '#FFC72C' })
    await ok(c, 'save_color', { brand: brandId, color_id: color.data.id, usage: 'Primärfarbe' })
    await ok(c, 'move_color', { brand: brandId, color_id: color.data.id, position: 1 })
    const colors = await ok(c, 'list_colors', { brand: brandId })
    const mine = colors.data.find((p: any) => p.id === palette.data.id)
    expect(mine.colors.map((x: any) => x.name)).toEqual(['Sonnengelb', 'Rheinblau'])
    expect(mine.colors[1].contrast_on_white.wcag).toBe('AAA')
    await ok(c, 'update_palette', { brand: brandId, palette: palette.data.id, description: 'Alle Farben' })

    expect((await ok(c, 'check_contrast', { foreground: '#000', background: '#fff' })).data.ratio).toBe(21)

    const font = await ok(c, 'save_font', {
      brand: brandId,
      family: 'Barlow Condensed',
      source: 'upload',
      role: 'Headline',
      weights: [700],
    })
    await ok(c, 'upload_font_file', {
      brand: brandId,
      font: font.data.id,
      weight: 700,
      file_name: 'Barlow-Bold.woff2',
      content_base64: Buffer.from('wOF2fake').toString('base64'),
    })
    const bad = await call(c, 'upload_font_file', {
      brand: brandId,
      font: font.data.id,
      file_name: 'x.exe',
      text: 'x',
    })
    const ambiguous = await call(c, 'upload_font_file', {
      brand: brandId,
      font: 'Barlow Condensed',
      file_name: 'a.woff2',
      text: 'x',
    })
    expect(ambiguous.text).toContain('nicht eindeutig')
    expect(bad.isError).toBe(true)
    const style = await ok(c, 'save_text_style', {
      brand: brandId,
      name: 'H1',
      token: 'heading-1',
      font_family: 'Barlow Condensed',
      font_weight: 700,
      font_size: 48,
      line_height: 1.1,
    })
    await ok(c, 'save_text_style', { brand: brandId, style_id: style.data.id, font_size: 52 })
    const typo = await ok(c, 'list_typography', { brand: brandId })
    expect(typo.data.fonts.find((f: any) => f.id === font.data.id).files).toHaveLength(1)
    expect(Number(typo.data.text_styles.find((s: any) => s.id === style.data.id).font_size)).toBe(52)

    const css = await ok(c, 'export_tokens', { brand: brandId, format: 'css' })
    expect(css.data.content).toContain('--')
    expect(css.data.content).toContain('--color-rhein-blau: #0b3c7a;')
    const ase = await ok(c, 'export_tokens', { brand: brandId, format: 'ase' })
    expect(ase.data.download_url).toMatch(/^http/)
    const file = await fetch(ase.data.download_url)
    expect(file.ok).toBe(true)

    await ok(c, 'delete_text_style', { brand: brandId, style_id: style.data.id })
    await ok(c, 'delete_font', { brand: brandId, font: font.data.id })
    await ok(c, 'delete_color', { brand: brandId, color_id: color.data.id })
  })

  it('Dateien: hochladen, ansehen, umwandeln, versionieren, herunterladen', async () => {
    const lib = await ok(c, 'create_library', { brand: brandId, name: 'Testlogos', kind: 'logos' })
    expect(lib.data.slug).toBe('testlogos')

    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100"><rect width="200" height="100" fill="#0B3C7A"/></svg>'
    const a1 = await ok(c, 'upload_asset', {
      brand: brandId,
      library: 'Testlogos',
      file_name: 'logo-dunkel.svg',
      text: svg,
      tags: ['logo', 'dunkel'],
      copyright: '© SV Rheinblick',
    })
    expect(a1.data.mime_type).toBe('image/svg+xml')
    expect(a1.data.width).toBe(200)
    expect(a1.data.title).toBe('logo dunkel')

    const png = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#FFC72C' } })
      .png()
      .toBuffer()
    const a2 = await ok(c, 'upload_asset', {
      brand: brandId,
      library: 'Testlogos',
      file_name: 'gross.png',
      content_base64: png.toString('base64'),
      title: 'Großes Bild',
    })
    expect(a2.data.width).toBe(1600)
    const details = await ok(c, 'get_asset', { asset_id: a2.data.id })
    expect(details.data.thumbnail_url).toMatch(/^http/)
    expect((await fetch(details.data.thumbnail_url)).ok).toBe(true)

    const a3 = await ok(c, 'upload_asset', {
      brand: brandId,
      library: 'Testlogos',
      file_name: 'orange.png',
      url: fileUrl,
    })
    expect(a3.data.mime_type).toBe('image/png')

    // große Dateien: Upload-Adresse, PUT, registrieren
    const slot = await ok(c, 'create_upload_url', {
      brand: brandId,
      file_name: 'direkt.png',
      mime_type: 'image/png',
    })
    const put = await fetch(slot.data.upload_url, {
      method: 'PUT',
      headers: { 'content-type': 'image/png' },
      body: new Uint8Array(png),
    })
    expect(put.ok).toBe(true)
    const a4 = await ok(c, 'upload_asset', {
      brand: brandId,
      library: 'Testlogos',
      file_name: 'direkt.png',
      upload_path: slot.data.upload_path,
    })
    expect(a4.data.width).toBe(1600)
    const notYet = await call(c, 'upload_asset', {
      brand: brandId,
      file_name: 'x.png',
      upload_path: `${brandId}/assets/gibt-es-nicht.png`,
    })
    expect(notYet.isError).toBe(true)
    const foreign = await call(c, 'upload_asset', {
      brand: brandId,
      file_name: 'x.png',
      upload_path: `${wsId}/assets/x.png`,
    })
    expect(foreign.isError).toBe(true)
    const two = await call(c, 'upload_asset', {
      brand: brandId,
      file_name: 'x.png',
      text: 'a',
      content_base64: 'YQ==',
    })
    expect(two.isError).toBe(true)

    const listed = await ok(c, 'list_assets', { brand: brandId, library: 'Testlogos', thumbnails: true })
    expect(listed.data).toHaveLength(4)
    expect((await ok(c, 'list_assets', { brand: brandId, tag: 'logo' })).data).toHaveLength(1)
    expect((await ok(c, 'list_assets', { brand: brandId, query: 'orange' })).data).toHaveLength(1)
    expect((await ok(c, 'list_assets', { brand: brandId, mime_prefix: 'image/svg' })).data).toHaveLength(1)

    await ok(c, 'update_asset', {
      asset_id: a1.data.id,
      add_tags: ['primär'],
      remove_tags: ['dunkel'],
      description: 'Dunkles Logo',
    })
    expect((await ok(c, 'get_asset', { asset_id: a1.data.id })).data.tags.sort()).toEqual(['logo', 'primär'])
    await ok(c, 'bulk_update_assets', { asset_ids: [a2.data.id, a3.data.id], add_tags: ['foto'] })
    expect((await ok(c, 'list_assets', { brand: brandId, tag: 'foto' })).data).toHaveLength(2)

    // Download: SVG als Text, PNG als Bild, umgewandelt als PNG aus SVG
    const dlSvg = await ok(c, 'download_asset', { asset_id: a1.data.id })
    expect(dlSvg.data.download_url).toMatch(/^http/)
    expect(dlSvg.raw.content.some((x) => x.type === 'text' && x.text.includes('<svg'))).toBe(true)
    const dlPng = await ok(c, 'download_asset', { asset_id: a3.data.id })
    expect(dlPng.raw.content.some((x) => x.type === 'image')).toBe(true)
    const converted = await ok(c, 'download_asset', {
      asset_id: a1.data.id,
      format: 'png',
      width: 400,
      background: '#FFFFFF',
    })
    expect(converted.data.mime_type).toBe('image/png')
    expect(converted.raw.content.some((x) => x.type === 'image')).toBe(true)
    const meta = await sharp(
      Buffer.from((converted.raw.content.find((x) => x.type === 'image') as any).data, 'base64'),
    ).metadata()
    expect(meta.width).toBe(400)
    const linkOnly = await ok(c, 'download_asset', { asset_id: a2.data.id, inline: false })
    expect((await fetch(linkOnly.data.download_url)).ok).toBe(true)

    const zip = await ok(c, 'download_assets_zip', {
      brand: brandId,
      library: 'Testlogos',
      zip_name: 'Logos',
    })
    expect(zip.data.files).toBe(4)
    const zipResponse = await fetch(zip.data.download_url)
    expect(zipResponse.ok).toBe(true)
    expect((await zipResponse.arrayBuffer()).byteLength).toBe(zip.data.size_bytes)

    // Versionen
    const replaced = await ok(c, 'replace_asset_file', {
      asset_id: a1.data.id,
      file_name: 'logo-neu.svg',
      text: svg.replace('#0B3C7A', '#D9481F'),
      note: 'Neue Farbe',
    })
    expect(replaced.data.version).toBe(2)
    const versions = await ok(c, 'list_asset_versions', { asset_id: a1.data.id })
    expect(versions.data).toHaveLength(1)
    await ok(c, 'restore_asset_version', { asset_id: a1.data.id, version_id: versions.data[0].id })
    const restored = await ok(c, 'download_asset', { asset_id: a1.data.id })
    expect(restored.raw.content.some((x) => x.type === 'text' && x.text.includes('#0B3C7A'))).toBe(true)

    // Sammlungen
    const col = await ok(c, 'create_collection', {
      brand: brandId,
      library: 'Testlogos',
      name: 'Favoriten',
      asset_ids: [a1.data.id],
    })
    await ok(c, 'update_collection', {
      brand: brandId,
      collection: 'Favoriten',
      add_asset_ids: [a2.data.id],
      remove_asset_ids: [a1.data.id],
    })
    const cols = await ok(c, 'list_collections', { brand: brandId })
    expect(cols.data.find((x: any) => x.id === col.data.id).asset_ids).toEqual([a2.data.id])
    expect(
      (await ok(c, 'list_assets', { brand: brandId, library: 'Testlogos', collection: 'Favoriten' })).data,
    ).toHaveLength(1)

    // Baustein mit Bild aus der Bibliothek
    const g = await ok(c, 'create_guideline', { brand: brandId, title: 'Bilder' })
    const p = await ok(c, 'create_page', {
      brand: brandId,
      guideline: g.data.id,
      title: 'Logos',
      blocks: [
        { type: 'image', content: { image: { assetId: a2.data.id }, caption: 'Test' } },
        { type: 'logos', content: { items: [{ assetId: a1.data.id, label: 'Dunkel' }] } },
        { type: 'assets', content: { assetIds: [a1.data.id, a2.data.id] } },
      ],
    })
    const withImages = await ok(c, 'get_page', { page: p.data.id, image_urls: true })
    expect(withImages.data.blocks[0].content.image.path).toContain(brandId)
    expect(withImages.data.blocks[0].content.image.url).toMatch(/^http/)
    expect(withImages.data.blocks[1].content.items[0].image.assetId).toBe(a1.data.id)
    const cross = await call(c, 'add_block', {
      page: p.data.id,
      type: 'image',
      content: { image: { assetId: '00000000-0000-4000-8000-000000000000' } },
    })
    expect(cross.isError).toBe(true)
    const crossPath = await call(c, 'add_block', {
      page: p.data.id,
      type: 'image',
      content: { image: { path: `${wsId}/assets/x.png` } },
    })
    expect(crossPath.isError).toBe(true)

    // Logo setzen
    await ok(c, 'set_brand_image', { brand: brandId, kind: 'logo', asset_id: a1.data.id })
    const withLogo = await ok(c, 'get_brand', { brand: brandId })
    expect(withLogo.data.logo_path).toContain(brandId)
    await ok(c, 'set_brand_image', {
      brand: brandId,
      kind: 'cover',
      file_name: 'cover.png',
      content_base64: png.toString('base64'),
    })
    await ok(c, 'set_brand_image', { brand: brandId, kind: 'cover', remove: true })

    // Löschen entfernt auch die Dateien im Speicher
    const before = await alice.client.storage.from('brand-files').list(`${brandId}/assets`)
    const removed = await ok(c, 'delete_assets', { asset_ids: [a3.data.id, a4.data.id] })
    expect(removed.text).toContain('2')
    const after = await alice.client.storage.from('brand-files').list(`${brandId}/assets`)
    expect(after.data!.length).toBeLessThan(before.data!.length)
    expect((await ok(c, 'list_assets', { brand: brandId })).data).toHaveLength(2)

    const badName = await call(c, 'delete_library', {
      brand: brandId,
      library: 'Testlogos',
      confirm_name: 'nein',
    })
    expect(badName.isError).toBe(true)
  })

  it('Mitglieder, Einladungen und Kommentare', async () => {
    const added = await ok(c, 'invite_member', { brand: brandId, email: bob.email, role: 'viewer' })
    expect(added.text).toContain('hinzugefügt')
    const members = await ok(c, 'list_brand_members', { brand: brandId })
    expect(members.data.map((m: any) => m.email)).toContain(bob.email)
    await ok(c, 'set_brand_member_role', { brand: brandId, user: bob.email, role: 'editor' })
    expect(
      (await ok(c, 'list_brand_members', { brand: brandId })).data.find((m: any) => m.email === bob.email)
        .role,
    ).toBe('editor')

    const link = await ok(c, 'invite_member', { brand: brandId, role: 'viewer', max_uses: 5 })
    expect(link.data.link).toContain('/einladung/')
    const mail = await ok(c, 'invite_member', { brand: brandId, email: 'neu@test.local', role: 'viewer' })
    expect(mail.text).toContain('Einladung')
    const invites = await ok(c, 'list_invitations', { brand: brandId })
    expect(invites.data).toHaveLength(2)
    await ok(c, 'revoke_invitation', { invitation_id: invites.data[0].id })
    expect((await ok(c, 'list_invitations', { brand: brandId })).data).toHaveLength(1)
    await ok(c, 'invite_member', { workspace: wsId, role: 'member' })
    expect((await ok(c, 'list_invitations', { workspace: wsId })).data).toHaveLength(1)

    await ok(c, 'remove_brand_member', { brand: brandId, user: bob.email })
    const wsMembers = await ok(c, 'list_workspace_members', { workspace: wsId })
    expect(wsMembers.data[0].role).toBe('owner')
    const lastOwner = await call(c, 'set_workspace_member_role', {
      workspace: wsId,
      user: alice.email,
      role: 'member',
    })
    expect(lastOwner.isError).toBe(true)

    // Kommentare
    const pages = await ok(c, 'list_guidelines', { brand: brandId })
    const anyPage = pages.data
      .flatMap((g: any) => g.structure)
      .flatMap((n: any) => (n.kind === 'chapter' ? n.pages : [n]))[0]
    const root = await ok(c, 'add_comment', { brand: brandId, page: anyPage.id, body: 'Bitte prüfen' })
    await ok(c, 'add_comment', {
      brand: brandId,
      page: anyPage.id,
      body: 'Erledigt',
      parent_id: root.data.id,
    })
    expect((await ok(c, 'list_comments', { page: anyPage.id })).data).toHaveLength(2)
    expect((await ok(c, 'list_comments', { brand: brandId })).data.length).toBeGreaterThanOrEqual(1)
    await ok(c, 'resolve_comment', { comment_id: root.data.id })
    expect((await ok(c, 'list_comments', { brand: brandId })).data).toHaveLength(0)
    await ok(c, 'delete_comment', { comment_id: root.data.id })
    const activity = await ok(c, 'get_activity', { brand: brandId, limit: 10 })
    expect(activity.data.length).toBeGreaterThan(0)
  })

  it('Export und Import', async () => {
    const exported = await ok(c, 'export_brand', { brand: brandId })
    const file = exported.data.export ?? (await (await fetch(exported.data.download_url)).json())
    expect(file.format).toBe('brandbench-brand')
    const wsList = await ok(c, 'list_workspaces')
    const target = await ok(c, 'create_brand', {
      workspace: wsList.data[0].id,
      name: 'Kopie',
      template: 'leer',
    })
    await ok(c, 'import_brand', { brand: target.data.id, export: file })
    const copy = await ok(c, 'get_brand', { brand: target.data.id })
    expect(copy.data.guidelines.length).toBeGreaterThan(1)
    const broken = await call(c, 'import_brand', { brand: target.data.id, export: { format: 'x' } })
    expect(broken.isError).toBe(true)
    await ok(c, 'apply_template', { brand: target.data.id, template: 'unternehmen' })
    await ok(c, 'delete_brand', { brand: target.data.id, confirm_name: 'Kopie' })
  })

  it('Löschen verlangt Bestätigung, Brands und Workspaces verschwinden samt Dateien', async () => {
    const wrong = await call(c, 'delete_brand', { brand: brandId, confirm_name: 'falsch' })
    expect(wrong.isError).toBe(true)
    await ok(c, 'delete_brand', { brand: brandId, confirm_name: brandName })
    const folder = await alice.client.storage.from('brand-files').list(brandId)
    expect(folder.data ?? []).toHaveLength(0)
    const info = await ok(c, 'list_workspaces')
    const extra = info.data.find((w: any) => w.name === 'Brand Identity WS 26')
    const noConfirm = await call(c, 'delete_workspace', { workspace: extra.id, confirm_name: 'Brand' })
    expect(noConfirm.isError).toBe(true)
    await ok(c, 'delete_workspace', { workspace: extra.id, confirm_name: 'Brand Identity WS 26' })
    expect((await ok(c, 'list_workspaces')).data.map((w: any) => w.name)).not.toContain(
      'Brand Identity WS 26',
    )
  })
})

describe('MCP – Sicherheit', () => {
  let server: RunningServer
  beforeAll(async () => {
    server = await startMcp({ MCP_ALLOW_PRIVATE_URLS: '' })
  })
  afterAll(async () => {
    await server.close()
  })

  it('Sitzungs-Tokens der Web-App (ohne App-Kennung) werden abgewiesen', async () => {
    const user = await newUser('web')
    const { data } = await user.client.auth.getSession()
    const res = await fetch(server.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: `Bearer ${data.session!.access_token}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })
    expect(res.status).toBe(403)
  })

  it('Ungültige und gefälschte Tokens werden abgewiesen', async () => {
    for (const token of ['abc', 'a.b.c', ANON_KEY]) {
      const res = await fetch(server.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      })
      expect(res.status).toBe(401)
    }
  })

  it('Eine App sieht nur ihre Auswahl – auch direkt über die Datenbank', async () => {
    const alice = await newUser('alice')
    const ws = (await alice.client.rpc('create_workspace', { p_name: 'Frei' })).data!
    const hidden = (await alice.client.rpc('create_workspace', { p_name: 'Versteckt' })).data!
    const b1 = (await alice.client.rpc('create_brand', { p_workspace: ws.id, p_name: 'Frei A' })).data!
    const b2 = (await alice.client.rpc('create_brand', { p_workspace: hidden.id, p_name: 'Versteckt B' }))
      .data!
    const conn = await connectApp({ user: alice.client, brandIds: [b1.id] })

    // Direkter Zugriff mit dem App-Token (ohne MCP-Server)
    const { createClient } = await import('@supabase/supabase-js')
    const direct = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${conn.accessToken}` } },
      auth: { persistSession: false },
    })
    const brands = await direct.from('brands').select('id').eq('is_public', false)
    expect((brands.data ?? []).map((b) => b.id)).toEqual([b1.id])
    expect((await direct.from('workspaces').select('id')).data).toHaveLength(0)
    expect((await direct.from('guidelines').select('id').eq('brand_id', b2.id)).data).toHaveLength(0)
    const write = await direct.from('brands').update({ name: 'Gehackt' }).eq('id', b2.id).select('id')
    expect(write.data ?? []).toHaveLength(0)
    expect((await direct.rpc('delete_my_account')).error?.message).toContain('direkt in Brandbench')
    const widen = await direct.rpc('save_mcp_grant', {
      p_client_id: conn.clientId,
      p_client_name: 'x',
      p_workspaces: [hidden.id],
      p_brands: [b2.id],
      p_read_only: false,
    })
    expect(widen.error).toBeTruthy()
    expect((await direct.from('mcp_grants').select('*')).data ?? []).toHaveLength(0)
    expect((await alice.client.from('brands').select('id').eq('id', b2.id)).data).toHaveLength(1)

    const client = await mcpClient(server.url, conn.accessToken)
    const list = await ok(client, 'list_brands')
    expect(list.data.map((b: any) => b.name)).toEqual(['Frei A'])
    const reach = await call(client, 'get_brand', { brand: b2.id })
    expect(reach.isError).toBe(true)
    const noWs = await call(client, 'create_brand', { workspace: 'Versteckt', name: 'Eindringling' })
    expect(noWs.isError).toBe(true)
    // Nur ein einzelnes Brand freigegeben: keine Workspace-Aktionen
    const wsTools = await call(client, 'update_workspace', { workspace: 'Frei', name: 'X' })
    expect(wsTools.isError).toBe(true)
    await client.close()
  })

  it('Fremde Personen sehen nichts, Rollen werden eingehalten', async () => {
    const alice = await newUser('alice')
    const bob = await newUser('bob')
    const ws = (await alice.client.rpc('create_workspace', { p_name: 'Aliceland' })).data!
    const brand = (
      await alice.client.rpc('create_brand', {
        p_workspace: ws.id,
        p_name: 'Alice Marke',
        p_template: { guidelines: [{ title: 'HB', items: [{ title: 'Seite', blocks: [] }] }] } as never,
      })
    ).data!
    await alice.client.rpc('add_member_by_email', {
      p_workspace: ws.id,
      p_email: bob.email,
      p_brand: brand.id,
      p_brand_role: 'viewer',
    })

    const bobConn = await connectApp({ user: bob.client, brandIds: [brand.id] })
    const bobClient = await mcpClient(server.url, bobConn.accessToken)
    expect((await ok(bobClient, 'get_brand', { brand: brand.id })).data.role).toBe('viewer')
    const write = await call(bobClient, 'update_brand', { brand: brand.id, tagline: 'x' })
    expect(write.isError).toBe(true)
    const edit = await call(bobClient, 'create_guideline', { brand: brand.id, title: 'x' })
    expect(edit.isError).toBe(true)
    // Betrachter dürfen kommentieren
    const pages = await ok(bobClient, 'list_guidelines', { brand: brand.id })
    const page = pages.data[0].structure[0]
    const pageId = page.kind === 'chapter' ? page.pages[0].id : page.id
    await ok(bobClient, 'add_comment', { brand: brand.id, page: pageId, body: 'Hallo von Bob' })
    await bobClient.close()
  })

  it('Nur-lesen: Lesen geht, alles Schreibende ist gesperrt', async () => {
    const alice = await newUser('alice')
    const ws = (await alice.client.rpc('create_workspace', { p_name: 'Lesen' })).data!
    const brand = (
      await alice.client.rpc('create_brand', {
        p_workspace: ws.id,
        p_name: 'Nur Lesen',
        p_template: {
          guidelines: [{ title: 'HB', items: [{ title: 'Seite', blocks: [] }] }],
          libraries: [{ name: 'Bilder', kind: 'media' }],
        } as never,
      })
    ).data!
    const conn = await connectApp({ user: alice.client, workspaceIds: [ws.id], readOnly: true })
    const client = await mcpClient(server.url, conn.accessToken)
    const info = await ok(client, 'get_connection_info')
    expect(info.data.mode).toBe('read_only')
    expect((await ok(client, 'get_brand', { brand: brand.id })).data.role).toBe('viewer')
    for (const [tool, args] of [
      ['create_workspace', { name: 'x' }],
      ['create_brand', { workspace: ws.id, name: 'x' }],
      ['update_brand', { brand: brand.id, tagline: 'x' }],
      ['create_guideline', { brand: brand.id, title: 'x' }],
      ['create_library', { brand: brand.id, name: 'x' }],
      ['upload_asset', { brand: brand.id, file_name: 'a.txt', text: 'hi' }],
      ['create_upload_url', { brand: brand.id, file_name: 'a.txt' }],
      ['invite_member', { brand: brand.id, role: 'viewer' }],
      ['delete_brand', { brand: brand.id, confirm_name: 'Nur Lesen' }],
    ] as const) {
      const res = await call(client, tool, args as Record<string, unknown>)
      expect(res.isError, tool).toBe(true)
    }
    // und auch direkt in der Datenbank
    const { createClient } = await import('@supabase/supabase-js')
    const direct = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${conn.accessToken}` } },
      auth: { persistSession: false },
    })
    expect(
      (await direct.from('guidelines').insert({ brand_id: brand.id, title: 'x', slug: 'x' })).error,
    ).toBeTruthy()
    expect((await direct.rpc('create_workspace', { p_name: 'x' })).error).toBeTruthy()
    await client.close()
  })

  it('Widerrufene oder fehlende Freigabe: keine Daten, klare Meldung', async () => {
    const alice = await newUser('alice')
    const ws = (await alice.client.rpc('create_workspace', { p_name: 'Widerruf' })).data!
    await alice.client.rpc('create_brand', { p_workspace: ws.id, p_name: 'Marke' })
    const conn = await connectApp({ user: alice.client, workspaceIds: [ws.id] })
    const client = await mcpClient(server.url, conn.accessToken)
    expect((await ok(client, 'list_brands')).data).toHaveLength(1)
    await alice.client.from('mcp_grants').delete().eq('client_id', conn.clientId)
    const revoked = await call(client, 'list_brands')
    expect(revoked.isError).toBe(true)
    expect(revoked.text).toContain('Verbundene Apps')
    const info = await ok(client, 'get_connection_info')
    expect(info.data.granted).toBe(false)
    await client.close()

    const bob = await newUser('bob')
    const none = await connectApp({ user: bob.client, skipGrant: true })
    const bobClient = await mcpClient(server.url, none.accessToken)
    const res = await call(bobClient, 'list_workspaces')
    expect(res.isError).toBe(true)
    await bobClient.close()
  })

  it('Datei-Abruf per URL ist gegen interne Adressen geschützt', async () => {
    const alice = await newUser('alice')
    const ws = (await alice.client.rpc('create_workspace', { p_name: 'SSRF' })).data!
    const brand = (await alice.client.rpc('create_brand', { p_workspace: ws.id, p_name: 'Marke' })).data!
    const conn = await connectApp({ user: alice.client, workspaceIds: [ws.id] })
    const client = await mcpClient(server.url, conn.accessToken)
    await ok(client, 'create_library', { brand: brand.id, name: 'Bilder' })
    for (const url of [
      'http://127.0.0.1:1/x.png',
      'https://localhost/x.png',
      'https://169.254.169.254/latest/meta-data',
      'https://[::1]/x',
      'file:///etc/passwd',
      'ftp://example.org/x',
    ]) {
      const res = await call(client, 'upload_asset', { brand: brand.id, file_name: 'x.png', url })
      expect(res.isError, url).toBe(true)
    }
    await client.close()
  })
})
