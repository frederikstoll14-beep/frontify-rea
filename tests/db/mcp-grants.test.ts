import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import type { Database } from '../../src/lib/database.types'
import { connectApp } from '../mcp/helpers'
import { ANON_KEY, SUPABASE_URL, must, newUser, type Client } from './helpers'

/** Client mit dem Token einer verbundenen App (so, wie ihn Claude bekommt). */
function asApp(accessToken: string): Client {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

describe('Verbundene Apps: Auswahl wird in der Datenbank erzwungen', () => {
  it('Speicher: nur Dateien freigegebener Marken sind les- und schreibbar', async () => {
    const alice = await newUser('alice')
    const ws = must(await alice.client.rpc('create_workspace', { p_name: 'Speicher' }))
    const open = must(await alice.client.rpc('create_brand', { p_workspace: ws.id, p_name: 'Offen' }))
    const closed = must(await alice.client.rpc('create_brand', { p_workspace: ws.id, p_name: 'Zu' }))
    for (const brand of [open, closed]) {
      const up = await alice.client.storage
        .from('brand-files')
        .upload(`${brand.id}/assets/a.png`, png, { contentType: 'image/png' })
      expect(up.error).toBeNull()
    }
    const conn = await connectApp({ user: alice.client, brandIds: [open.id] })
    const app = asApp(conn.accessToken)

    expect((await app.storage.from('brand-files').download(`${open.id}/assets/a.png`)).error).toBeNull()
    expect((await app.storage.from('brand-files').download(`${closed.id}/assets/a.png`)).error).toBeTruthy()
    expect(
      (await app.storage.from('brand-files').createSignedUrl(`${closed.id}/assets/a.png`, 60)).error,
    ).toBeTruthy()
    expect(
      (
        await app.storage
          .from('brand-files')
          .upload(`${closed.id}/assets/b.png`, png, { contentType: 'image/png' })
      ).error,
    ).toBeTruthy()
    expect(
      (
        await app.storage
          .from('brand-files')
          .upload(`${open.id}/assets/b.png`, png, { contentType: 'image/png' })
      ).error,
    ).toBeNull()
  })

  it('Profile: E-Mail-Adressen aus nicht freigegebenen Workspaces bleiben verborgen', async () => {
    const alice = await newUser('alice')
    const bob = await newUser('bob')
    const carol = await newUser('carol')
    const shared = must(await alice.client.rpc('create_workspace', { p_name: 'Gemeinsam' }))
    const other = must(await alice.client.rpc('create_workspace', { p_name: 'Anderswo' }))
    must(await alice.client.rpc('add_member_by_email', { p_workspace: shared.id, p_email: bob.email }))
    must(await alice.client.rpc('add_member_by_email', { p_workspace: other.id, p_email: carol.email }))

    const conn = await connectApp({ user: alice.client, workspaceIds: [shared.id] })
    const app = asApp(conn.accessToken)
    const emails = must(await app.from('profiles').select('email'))
      .map((p) => p.email)
      .sort()
    expect(emails).toEqual([alice.email, bob.email].sort())
    // In der Web-App sieht Alice weiterhin alle
    expect(must(await alice.client.from('profiles').select('email')).map((p) => p.email)).toContain(
      carol.email,
    )
  })

  it('Neue Workspaces der App gehören automatisch zur Auswahl, fremde nicht', async () => {
    const alice = await newUser('alice')
    const ws = must(await alice.client.rpc('create_workspace', { p_name: 'Start' }))
    const conn = await connectApp({ user: alice.client, workspaceIds: [ws.id] })
    const app = asApp(conn.accessToken)
    const created = must(await app.rpc('create_workspace', { p_name: 'Von der App' }))
    const scope = must(await app.rpc('mcp_scope')) as { workspaces: Array<{ id: string }> }
    expect(scope.workspaces.map((w) => w.id).sort()).toEqual([ws.id, created.id].sort())
    // Ein später in der Web-App angelegter Workspace bleibt unsichtbar
    must(await alice.client.rpc('create_workspace', { p_name: 'Später im Web' }))
    expect(must(await app.from('workspaces').select('id'))).toHaveLength(2)
  })

  it('Gesperrt für Apps: Workspace verlassen, Einladung einlösen, Konto löschen, Auswahl ändern', async () => {
    const alice = await newUser('alice')
    const ws = must(await alice.client.rpc('create_workspace', { p_name: 'Gesperrt' }))
    const invite = must(
      await alice.client
        .from('invitations')
        .insert({ workspace_id: ws.id, workspace_role: 'member', created_by: alice.id })
        .select('token')
        .single(),
    )
    const conn = await connectApp({ user: alice.client, workspaceIds: [ws.id] })
    const app = asApp(conn.accessToken)
    expect((await app.rpc('leave_workspace', { p_workspace: ws.id })).error?.message).toContain(
      'direkt in Brandbench',
    )
    expect((await app.rpc('accept_invitation', { p_token: invite.token })).error?.message).toContain(
      'direkt in Brandbench',
    )
    expect((await app.rpc('delete_my_account')).error?.message).toContain('direkt in Brandbench')
    expect(
      (
        await app.rpc('save_mcp_grant', {
          p_client_id: conn.clientId,
          p_client_name: 'x',
          p_workspaces: [],
          p_brands: [],
          p_read_only: false,
        })
      ).error,
    ).toBeTruthy()
    expect((await app.from('mcp_grants').select('*')).data ?? []).toHaveLength(0)
    expect(
      (await app.from('mcp_grants').delete().eq('client_id', conn.clientId).select('client_id')).data ?? [],
    ).toHaveLength(0)
    // Alice (Web) sieht ihre Verbindung
    expect(must(await alice.client.from('mcp_grants').select('client_id'))).toHaveLength(1)
  })

  it('Nur lesen: weder Inhalte noch Kommentare noch Mitglieder lassen sich ändern', async () => {
    const alice = await newUser('alice')
    const ws = must(await alice.client.rpc('create_workspace', { p_name: 'Lesen' }))
    const brand = must(
      await alice.client.rpc('create_brand', {
        p_workspace: ws.id,
        p_name: 'Marke',
        p_template: { guidelines: [{ title: 'HB', items: [{ title: 'Seite', blocks: [] }] }] },
      }),
    )
    const page = must(
      await alice.client.from('guideline_pages').select('id').eq('brand_id', brand.id).limit(1).single(),
    )
    const conn = await connectApp({ user: alice.client, workspaceIds: [ws.id], readOnly: true })
    const app = asApp(conn.accessToken)

    expect(must(await app.from('guideline_pages').select('id').eq('brand_id', brand.id))).toHaveLength(1)
    expect(
      (await app.from('comments').insert({ brand_id: brand.id, page_id: page.id, body: 'x' })).error,
    ).toBeTruthy()
    expect(
      (await app.from('guideline_pages').update({ title: 'x' }).eq('id', page.id).select('id')).data ?? [],
    ).toHaveLength(0)
    expect(
      (await app.from('workspaces').update({ name: 'x' }).eq('id', ws.id).select('id')).data ?? [],
    ).toHaveLength(0)
    expect(
      (
        await app
          .from('invitations')
          .insert({ workspace_id: ws.id, workspace_role: 'member', created_by: alice.id })
      ).error,
    ).toBeTruthy()
    expect((await app.rpc('create_brand', { p_workspace: ws.id, p_name: 'Neu' })).error).toBeTruthy()
    // Alice selbst (Web-Sitzung) darf alles wie bisher
    expect(
      (await alice.client.from('guideline_pages').update({ title: 'ok' }).eq('id', page.id)).error,
    ).toBeNull()
  })
})
