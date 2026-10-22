import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { call, connectApp, mcpClient, newUser, ok, startMcp, type RunningServer } from './helpers'

describe('MCP – Anmeldung und erste Schritte', () => {
  let server: RunningServer
  beforeAll(async () => {
    server = await startMcp()
  })
  afterAll(async () => {
    await server.close()
  })

  it('verlangt eine Anmeldung und verweist auf die Metadaten', async () => {
    const res = await fetch(server.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toContain('resource_metadata=')
    const meta = await (await fetch(`${server.origin}/.well-known/oauth-protected-resource/mcp`)).json()
    expect(meta.resource).toBe(server.url)
    expect(meta.authorization_servers[0]).toMatch(/\/auth\/v1$/)
  })

  it('verbindet über OAuth und zeigt nur die Freigabe', async () => {
    const alice = await newUser('alice')
    const ws = await alice.client.rpc('create_workspace', { p_name: 'Kurs A' })
    const brand = await alice.client.rpc('create_brand', { p_workspace: ws.data!.id, p_name: 'Marke A1' })
    const other = await alice.client.rpc('create_workspace', { p_name: 'Privat' })
    await alice.client.rpc('create_brand', { p_workspace: other.data!.id, p_name: 'Geheim' })

    const conn = await connectApp({ user: alice.client, workspaceIds: [ws.data!.id] })
    const client = await mcpClient(server.url, conn.accessToken)
    const tools = await client.listTools()
    expect(tools.tools.length).toBeGreaterThan(50)

    const info = await ok(client, 'get_connection_info')
    expect(info.data.mode).toBe('read_write')
    expect(info.data.brands.map((b: { name: string }) => b.name)).toEqual(['Marke A1'])

    const brands = await ok(client, 'list_brands')
    expect(brands.data).toHaveLength(1)
    const secret = await call(client, 'get_brand', { brand: 'Geheim' })
    expect(secret.isError).toBe(true)
    expect(brand.data!.name).toBe('Marke A1')
    await client.close()
  })
})
