import { beforeAll, describe, expect, it } from 'vitest'
import { getTemplate } from '../../src/lib/templates'
import { anonClient, must, newUser, type Client } from './helpers'

/**
 * Sicherheits- und Rechte-Tests gegen einen lokalen Supabase-Stack.
 * Start: `npx supabase start` – danach `npm run test:db`.
 */

type User = Awaited<ReturnType<typeof newUser>>

let owner: User // Dozent:in, Workspace-Owner
let student: User // Team-Mitglied (Editor einer Marke)
let viewer: User // Kommiliton:in (Viewer)
let outsider: User // nicht im Workspace
let wsMember: User // Workspace-Mitglied ohne Marken-Rolle
let workspaceId: string
let brandId: string
let brandSlug: string
let pageId: string
let libraryId: string

async function firstPage(client: Client, brand: string) {
  return must(
    await client
      .from('guideline_pages')
      .select('id, title, kind')
      .eq('brand_id', brand)
      .eq('kind', 'page')
      .limit(1)
      .single(),
  )
}

beforeAll(async () => {
  ;[owner, student, viewer, outsider, wsMember] = await Promise.all([
    newUser('dozentin'),
    newUser('student'),
    newUser('viewer'),
    newUser('outsider'),
    newUser('wsmember'),
  ])

  const ws = must(await owner.client.rpc('create_workspace', { p_name: 'Brand Identity WS 26/27' }))
  workspaceId = ws.id

  const template = getTemplate('verein')
  expect(template).toBeTruthy()
  const brand = must(
    await owner.client.rpc('create_brand', {
      p_workspace: workspaceId,
      p_name: 'SV Teststadt 1904',
      p_org_type: 'verein',
      p_template: JSON.parse(JSON.stringify(template!.data)),
    }),
  )
  brandId = brand.id
  brandSlug = brand.slug
  pageId = (await firstPage(owner.client, brandId)).id
  libraryId = must(
    await owner.client.from('libraries').select('id').eq('brand_id', brandId).eq('slug', 'logos').single(),
  ).id
})

describe('Workspace & Marke anlegen', () => {
  it('legt Workspace mit Owner-Mitgliedschaft und eindeutigem Slug an', async () => {
    const members = must(
      await owner.client.from('workspace_members').select('*').eq('workspace_id', workspaceId),
    )
    expect(members).toHaveLength(1)
    expect(members[0].role).toBe('owner')
    const second = must(await owner.client.rpc('create_workspace', { p_name: 'Brand Identity WS 26/27' }))
    expect(second.slug).not.toBe(
      must(await owner.client.from('workspaces').select('slug').eq('id', workspaceId).single()).slug,
    )
  })

  it('wendet die Vorlage vollständig an', async () => {
    const guidelines = must(await owner.client.from('guidelines').select('id').eq('brand_id', brandId))
    expect(guidelines.length).toBe(1)
    const pages = must(await owner.client.from('guideline_pages').select('id, kind').eq('brand_id', brandId))
    expect(pages.filter((p) => p.kind === 'chapter').length).toBeGreaterThanOrEqual(8)
    expect(pages.filter((p) => p.kind === 'page').length).toBeGreaterThanOrEqual(20)
    const blocks = must(await owner.client.from('blocks').select('id').eq('brand_id', brandId))
    expect(blocks.length).toBeGreaterThan(50)
    const colors = must(await owner.client.from('colors').select('id').eq('brand_id', brandId))
    expect(colors.length).toBe(5)
    const libraries = must(await owner.client.from('libraries').select('slug').eq('brand_id', brandId))
    expect(libraries.map((l) => l.slug)).toContain('logos')
    const brand = must(await owner.client.from('brands').select('theme').eq('id', brandId).single())
    expect((brand.theme as { headingFont?: string }).headingFont).toBe('Barlow Condensed')
  })

  it('verhindert, dass Nicht-Mitglieder Marken im Workspace anlegen', async () => {
    const { error } = await outsider.client.rpc('create_brand', { p_workspace: workspaceId, p_name: 'Fremd' })
    expect(error?.message).toMatch(/Kein Mitglied/)
  })

  it('erlaubt anonymen Nutzern keine RPCs zum Anlegen', async () => {
    const { error } = await anonClient().rpc('create_workspace', { p_name: 'Hack' })
    expect(error).toBeTruthy()
  })
})

describe('Sichtbarkeit', () => {
  it('Außenstehende und Anonyme sehen private Marken nicht', async () => {
    expect(must(await outsider.client.from('brands').select('id').eq('id', brandId))).toHaveLength(0)
    expect(must(await anonClient().from('brands').select('id').eq('id', brandId))).toHaveLength(0)
    expect(must(await anonClient().from('blocks').select('id').eq('brand_id', brandId))).toHaveLength(0)
    expect(must(await outsider.client.from('colors').select('id').eq('brand_id', brandId))).toHaveLength(0)
  })

  it('Einladungslink: Vorschau anonym, Einlösen nur angemeldet', async () => {
    const invite = must(
      await owner.client
        .from('invitations')
        .insert({
          workspace_id: workspaceId,
          brand_id: brandId,
          brand_role: 'viewer',
          workspace_role: 'member',
          created_by: owner.id,
        })
        .select()
        .single(),
    )
    const preview = must(await anonClient().rpc('invitation_preview', { p_token: invite.token }))
    expect(preview[0].brand_name).toBe('SV Teststadt 1904')
    expect(preview[0].is_valid).toBe(true)
    // Anonyme Nutzer sehen die Einladungstabelle nicht
    expect(must(await anonClient().from('invitations').select('id'))).toHaveLength(0)
    expect(must(await outsider.client.from('invitations').select('id'))).toHaveLength(0)

    const { error: anonError } = await anonClient().rpc('accept_invitation', { p_token: invite.token })
    expect(anonError).toBeTruthy()

    const accepted = must(await viewer.client.rpc('accept_invitation', { p_token: invite.token }))
    expect(accepted[0].brand_slug).toBe(brandSlug)
    expect(must(await viewer.client.from('brands').select('id').eq('id', brandId))).toHaveLength(1)
  })

  it('Marken-Einladung gibt keinen Zugriff auf andere Marken des Workspaces', async () => {
    const other = must(
      await owner.client.rpc('create_brand', {
        p_workspace: workspaceId,
        p_name: 'Andere Gruppe',
        p_template: {},
      }),
    )
    expect(must(await viewer.client.from('brands').select('id').eq('id', other.id))).toHaveLength(0)
    expect(
      must(await viewer.client.from('workspace_members').select('user_id').eq('workspace_id', workspaceId)),
    ).toHaveLength(0)
    const { error } = await viewer.client.rpc('create_brand', {
      p_workspace: workspaceId,
      p_name: 'Gast-Marke',
    })
    expect(error?.message).toMatch(/Kein Mitglied/)
  })

  it('Viewer darf lesen und kommentieren, aber nicht bearbeiten', async () => {
    const blocks = must(await viewer.client.from('blocks').select('id').eq('page_id', pageId))
    expect(blocks.length).toBeGreaterThan(0)

    const { data: updated } = await viewer.client
      .from('blocks')
      .update({ content: { html: 'gehackt' } })
      .eq('id', blocks[0].id)
      .select()
    expect(updated ?? []).toHaveLength(0)

    const { error: insertError } = await viewer.client
      .from('blocks')
      .insert({ page_id: pageId, brand_id: brandId, type: 'text', content: {} })
    expect(insertError).toBeTruthy()

    const comment = must(
      await viewer.client
        .from('comments')
        .insert({ page_id: pageId, brand_id: brandId, body: 'Schöne Farben! Kontrast prüfen.' })
        .select()
        .single(),
    )
    expect(comment.author_id).toBe(viewer.id)
  })

  it('Workspace-Mitglieder sehen Marken mit Sichtbarkeit "workspace", aber nicht "private"', async () => {
    must(await owner.client.rpc('add_member_by_email', { p_workspace: workspaceId, p_email: wsMember.email }))
    expect(must(await wsMember.client.from('brands').select('id').eq('id', brandId))).toHaveLength(1)
    must(await owner.client.from('brands').update({ visibility: 'private' }).eq('id', brandId).select())
    expect(must(await wsMember.client.from('brands').select('id').eq('id', brandId))).toHaveLength(0)
    // Viewer mit eigener Marken-Rolle sieht sie weiterhin
    expect(must(await viewer.client.from('brands').select('id').eq('id', brandId))).toHaveLength(1)
    must(await owner.client.from('brands').update({ visibility: 'workspace' }).eq('id', brandId).select())
  })

  it('öffentliche Marken sind anonym lesbar – ohne Kommentare, Mitglieder und Verlauf', async () => {
    must(await owner.client.from('brands').update({ is_public: true }).eq('id', brandId).select())
    const anon = anonClient()
    expect(must(await anon.from('brands').select('id, name').eq('slug', brandSlug))).toHaveLength(1)
    expect(must(await anon.from('blocks').select('id').eq('page_id', pageId)).length).toBeGreaterThan(0)
    expect(must(await anon.from('comments').select('id').eq('brand_id', brandId))).toHaveLength(0)
    expect(must(await anon.from('brand_members').select('user_id').eq('brand_id', brandId))).toHaveLength(0)
    expect(must(await anon.from('activity').select('id').eq('brand_id', brandId))).toHaveLength(0)
    // Anonyme Nutzer können nichts schreiben
    const { error } = await anon.from('blocks').insert({ page_id: pageId, brand_id: brandId, type: 'text' })
    expect(error).toBeTruthy()
  })

  it('abgelaufene Freigabe schaltet den öffentlichen Zugriff ab', async () => {
    must(
      await owner.client
        .from('brands')
        .update({ public_until: new Date(Date.now() - 60_000).toISOString() })
        .eq('id', brandId)
        .select(),
    )
    expect(must(await anonClient().from('brands').select('id').eq('id', brandId))).toHaveLength(0)
    must(
      await owner.client
        .from('brands')
        .update({ is_public: false, public_until: null })
        .eq('id', brandId)
        .select(),
    )
  })

  it('Entwürfe sind nur für Bearbeitende sichtbar', async () => {
    must(await owner.client.from('guideline_pages').update({ is_published: false }).eq('id', pageId).select())
    expect(must(await viewer.client.from('guideline_pages').select('id').eq('id', pageId))).toHaveLength(0)
    expect(must(await viewer.client.from('blocks').select('id').eq('page_id', pageId))).toHaveLength(0)
    expect(must(await owner.client.from('guideline_pages').select('id').eq('id', pageId))).toHaveLength(1)
    must(await owner.client.from('guideline_pages').update({ is_published: true }).eq('id', pageId).select())
  })
})

describe('Bearbeiten', () => {
  it('Editor per E-Mail hinzufügen und Inhalte bearbeiten', async () => {
    // Kursmitglied (Workspace) + Editor der Team-Marke
    must(await owner.client.rpc('add_member_by_email', { p_workspace: workspaceId, p_email: student.email }))
    const result = must(
      await owner.client.rpc('add_member_by_email', {
        p_workspace: workspaceId,
        p_email: student.email,
        p_brand: brandId,
        p_brand_role: 'editor',
      }),
    )
    expect(result).toBe('added')
    const block = must(
      await student.client
        .from('blocks')
        .insert({
          page_id: pageId,
          brand_id: brandId,
          type: 'text',
          content: { html: '<p>Hallo</p>' },
          sort: 99,
        })
        .select()
        .single(),
    )
    expect(block.updated_by).toBe(student.id)
    const updated = must(
      await student.client
        .from('blocks')
        .update({ content: { html: '<p>Neu</p>' } })
        .eq('id', block.id)
        .select(),
    )
    expect(updated).toHaveLength(1)
  })

  it('Editor darf Marken-Einstellungen und Mitglieder nicht ändern', async () => {
    const updated = must(
      await student.client.from('brands').update({ name: 'Umbenannt' }).eq('id', brandId).select(),
    )
    expect(updated).toHaveLength(0)
    const { error } = await student.client
      .from('brand_members')
      .insert({ brand_id: brandId, user_id: outsider.id, role: 'admin' })
    expect(error).toBeTruthy()
  })

  it('brand_id wird immer aus dem Elternobjekt abgeleitet (kein Cross-Brand-Schreiben)', async () => {
    // Student legt eigene Marke an und versucht, einen Block in fremde Seite zu schreiben
    const own = must(
      await student.client.rpc('create_brand', {
        p_workspace: workspaceId,
        p_name: 'Eigene Marke',
        p_template: {},
      }),
    )
    const otherBrandGuideline = must(
      await owner.client.from('guidelines').select('id').eq('brand_id', brandId).limit(1).single(),
    )
    // Viewer versucht über eigene brand_id in fremde Seite zu schreiben
    const { error } = await viewer.client
      .from('blocks')
      .insert({ page_id: pageId, brand_id: own.id, type: 'text', content: {} })
    expect(error).toBeTruthy()
    // brand_id im Insert wird ignoriert und aus der Seite abgeleitet
    const block = must(
      await student.client
        .from('blocks')
        .insert({ page_id: pageId, brand_id: own.id, type: 'text', content: {} })
        .select('brand_id')
        .single(),
    )
    expect(block.brand_id).toBe(brandId)
    expect(otherBrandGuideline.id).toBeTruthy()
  })

  it('Kapitel lassen sich nicht verschachteln', async () => {
    const chapter = must(
      await owner.client
        .from('guideline_pages')
        .select('id, guideline_id')
        .eq('brand_id', brandId)
        .eq('kind', 'chapter')
        .limit(1)
        .single(),
    )
    const { error } = await owner.client.from('guideline_pages').insert({
      guideline_id: chapter.guideline_id,
      brand_id: brandId,
      parent_id: chapter.id,
      kind: 'chapter',
      title: 'Unterkapitel',
      slug: 'unterkapitel',
    })
    expect(error?.message).toMatch(/Kapitel/)
  })

  it('Seitenversionen speichern und lesen (nur Bearbeitende)', async () => {
    const revision = must(
      await student.client
        .from('page_revisions')
        .insert({ page_id: pageId, brand_id: brandId, label: 'Abgabe 1', snapshot: { blocks: [] } })
        .select()
        .single(),
    )
    expect(revision.created_by).toBe(student.id)
    expect(must(await viewer.client.from('page_revisions').select('id').eq('page_id', pageId))).toHaveLength(
      0,
    )
  })

  it('Suche findet Seiten, Blöcke und Farben', async () => {
    const results = must(await viewer.client.rpc('search_brand', { p_brand: brandId, p_query: 'Werte' }))
    expect(results.some((r) => r.kind === 'page')).toBe(true)
    const colors = must(await viewer.client.rpc('search_brand', { p_brand: brandId, p_query: 'Akzent' }))
    expect(colors.some((r) => r.kind === 'color')).toBe(true)
    const none = must(await outsider.client.rpc('search_brand', { p_brand: brandId, p_query: 'Werte' }))
    expect(none).toHaveLength(0)
  })

  it('Aktivitätsverlauf protokolliert Änderungen für Mitglieder', async () => {
    const activity = must(
      await viewer.client.from('activity').select('action, entity').eq('brand_id', brandId),
    )
    expect(activity.some((a) => a.entity === 'comments')).toBe(true)
    expect(activity.some((a) => a.entity === 'brand_members')).toBe(true)
  })
})

describe('Storage', () => {
  const file = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/svg+xml' })

  it('Editor lädt hoch, Viewer liest, Außenstehende nicht', async () => {
    const path = `${brandId}/assets/test-${Date.now()}.svg`
    const { error: uploadError } = await student.client.storage.from('brand-files').upload(path, file)
    expect(uploadError).toBeNull()

    const asset = must(
      await student.client
        .from('assets')
        .insert({
          library_id: libraryId,
          brand_id: brandId,
          title: 'Wappen',
          file_path: path,
          file_name: 'wappen.svg',
          mime_type: 'image/svg+xml',
          ext: 'svg',
        })
        .select()
        .single(),
    )
    expect(asset.brand_id).toBe(brandId)

    const { data: viewerUrl } = await viewer.client.storage.from('brand-files').createSignedUrl(path, 60)
    expect(viewerUrl?.signedUrl).toBeTruthy()
    const { data: outsiderUrl } = await outsider.client.storage.from('brand-files').createSignedUrl(path, 60)
    expect(outsiderUrl?.signedUrl ?? null).toBeNull()

    const { error: viewerUpload } = await viewer.client.storage
      .from('brand-files')
      .upload(`${brandId}/assets/viewer.svg`, file)
    expect(viewerUpload).toBeTruthy()
  })

  it('Uploads außerhalb des eigenen Marken-Ordners werden abgelehnt', async () => {
    const { error } = await student.client.storage.from('brand-files').upload(`kein-uuid/test.svg`, file)
    expect(error).toBeTruthy()
    const { error: rootError } = await student.client.storage.from('brand-files').upload(`test.svg`, file)
    expect(rootError).toBeTruthy()
  })
})

describe('Rollen-Schutz', () => {
  it('der letzte Owner kann nicht entfernt werden', async () => {
    const { error } = await owner.client
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', owner.id)
    expect(error?.message).toMatch(/Owner/)
  })

  it('Admins können keine Owner ernennen', async () => {
    must(
      await owner.client
        .from('workspace_members')
        .update({ role: 'admin' })
        .eq('workspace_id', workspaceId)
        .eq('user_id', wsMember.id)
        .select(),
    )
    const { error } = await wsMember.client
      .from('workspace_members')
      .update({ role: 'owner' })
      .eq('workspace_id', workspaceId)
      .eq('user_id', student.id)
    expect(error?.message).toMatch(/Owner/)
  })

  it('E-Mail-Einladung wird bei Registrierung automatisch eingelöst', async () => {
    const email = `spaeter-${Date.now()}@test.local`
    must(
      await owner.client
        .from('invitations')
        .insert({
          workspace_id: workspaceId,
          brand_id: brandId,
          brand_role: 'editor',
          email,
          created_by: owner.id,
        })
        .select(),
    )
    const later = anonClient()
    const { data, error } = await later.auth.signUp({ email, password: 'test-passwort-123' })
    expect(error).toBeNull()
    expect(data.session).toBeTruthy()
    const roles = must(
      await later.from('brand_members').select('role').eq('brand_id', brandId).eq('user_id', data.user!.id),
    )
    expect(roles[0]?.role).toBe('editor')
  })

  it('Einladung an andere E-Mail kann nicht eingelöst werden', async () => {
    const invite = must(
      await owner.client
        .from('invitations')
        .insert({ workspace_id: workspaceId, email: 'jemand@test.local', created_by: owner.id })
        .select()
        .single(),
    )
    const { error } = await outsider.client.rpc('accept_invitation', { p_token: invite.token })
    expect(error?.message).toMatch(/andere E-Mail/)
  })
})

describe('Konto löschen', () => {
  it('Owner können ihr Konto erst nach Übergabe löschen, andere sofort', async () => {
    const { error } = await owner.client.rpc('delete_my_account')
    expect(error?.message).toMatch(/Owner/)

    const leaving = await newUser('weg')
    must(await owner.client.rpc('add_member_by_email', { p_workspace: workspaceId, p_email: leaving.email }))
    must(
      await leaving.client
        .from('comments')
        .insert({ page_id: pageId, brand_id: brandId, body: 'Tschüss' })
        .select()
        .single(),
    )
    const { error: deleteError } = await leaving.client.rpc('delete_my_account')
    expect(deleteError).toBeNull()
    const members = must(
      await owner.client.from('workspace_members').select('user_id').eq('user_id', leaving.id),
    )
    expect(members).toHaveLength(0)
    const profiles = must(await owner.client.from('profiles').select('id').eq('id', leaving.id))
    expect(profiles).toHaveLength(0)
    // Kommentare bleiben anonymisiert erhalten
    const comments = must(await owner.client.from('comments').select('author_id, body').eq('body', 'Tschüss'))
    expect(comments[0].author_id).toBeNull()
  })
})
