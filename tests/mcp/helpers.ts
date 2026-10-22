import { createHash, randomBytes } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { createHandler } from '../../mcp/src/http'
import { toNodeListener } from '../../mcp/src/node'
import { ANON_KEY, SUPABASE_URL, anonClient, newUser, type Client as Supa } from '../db/helpers'

export { ANON_KEY, SUPABASE_URL, anonClient, newUser }

export interface RunningServer {
  url: string
  origin: string
  close: () => Promise<void>
}

/** Startet den MCP-Server lokal gegen den Supabase-Stack. */
export async function startMcp(extraEnv: Record<string, string> = {}): Promise<RunningServer> {
  const handler = createHandler({
    SUPABASE_URL,
    SUPABASE_ANON_KEY: ANON_KEY,
    MCP_ALLOW_PRIVATE_URLS: '1',
    ...extraEnv,
  })
  const server: Server = createServer(toNodeListener(handler))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port
  return {
    url: `http://127.0.0.1:${port}/mcp`,
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}

function base64url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export interface Connection {
  accessToken: string
  refreshToken: string
  clientId: string
}

export interface ConnectOptions {
  /** Angemeldete Person (Sitzung in der Web-App). */
  user: Supa
  redirectUri?: string
  clientName?: string
  workspaceIds?: string[]
  brandIds?: string[]
  readOnly?: boolean
  /** true = keine Auswahl speichern (Zustimmung ohne Freigabe). */
  skipGrant?: boolean
}

/**
 * Spielt den OAuth-Ablauf wie Claude durch: Registrierung, Anmelde-Anfrage, Zustimmungsseite
 * (hier über supabase-js statt Browser) und Token-Abruf.
 */
export async function connectApp(options: ConnectOptions): Promise<Connection> {
  const redirectUri = options.redirectUri ?? 'https://claude.ai/api/mcp/auth_callback'
  const issuer = `${SUPABASE_URL}/auth/v1`
  const meta = await (await fetch(`${issuer}/.well-known/oauth-authorization-server`)).json()

  const registration = await fetch(meta.registration_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: options.clientName ?? 'Claude',
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }),
  })
  if (!registration.ok) throw new Error(`Registrierung fehlgeschlagen: ${registration.status} ${await registration.text()}`)
  const client = await registration.json()

  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  const state = base64url(randomBytes(8))
  const authorize = new URL(meta.authorization_endpoint)
  authorize.search = new URLSearchParams({
    response_type: 'code',
    client_id: client.client_id,
    redirect_uri: redirectUri,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString()
  const redirect = await fetch(authorize, { redirect: 'manual' })
  const location = redirect.headers.get('location')
  if (!location) throw new Error(`Keine Weiterleitung zur Zustimmungsseite (${redirect.status})`)
  const consentUrl = new URL(location)
  if (consentUrl.pathname !== '/oauth/consent') throw new Error(`Unerwartete Zustimmungsseite: ${location}`)
  const authorizationId = consentUrl.searchParams.get('authorization_id')!

  const details = await options.user.auth.oauth.getAuthorizationDetails(authorizationId)
  if (details.error || !details.data || !('authorization_id' in details.data)) {
    throw new Error(`Details: ${details.error?.message ?? 'unerwartet'}`)
  }
  if (!options.skipGrant) {
    const saved = await options.user.rpc('save_mcp_grant', {
      p_client_id: details.data.client.id,
      p_client_name: details.data.client.name,
      p_workspaces: options.workspaceIds ?? [],
      p_brands: options.brandIds ?? [],
      p_read_only: options.readOnly ?? false,
    })
    if (saved.error) throw new Error(`save_mcp_grant: ${saved.error.message}`)
  }
  const approved = await options.user.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
  if (approved.error || !approved.data) throw new Error(`Zustimmung: ${approved.error?.message}`)
  const back = new URL(approved.data.redirect_url)
  if (back.searchParams.get('state') !== state) throw new Error('state stimmt nicht')
  const code = back.searchParams.get('code')!

  const tokenResponse = await fetch(meta.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: client.client_id,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  })
  if (!tokenResponse.ok) throw new Error(`Token: ${tokenResponse.status} ${await tokenResponse.text()}`)
  const tokens = await tokenResponse.json()
  return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, clientId: client.client_id }
}

export async function mcpClient(serverUrl: string, accessToken: string): Promise<Client> {
  const client = new Client({ name: 'brandbench-test', version: '1.0.0' })
  await client.connect(
    new StreamableHTTPClientTransport(new URL(serverUrl), {
      requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
    }),
  )
  return client
}

export interface ToolResponse {
  isError: boolean
  text: string
  /** JSON-Teil der Antwort (nach der Klartext-Zeile) */
  data: any // eslint-disable-line @typescript-eslint/no-explicit-any
  raw: CallToolResult
}

export async function call(client: Client, name: string, args: Record<string, unknown> = {}): Promise<ToolResponse> {
  const raw = (await client.callTool({ name, arguments: args })) as CallToolResult
  const first = raw.content.find((c) => c.type === 'text')
  const text = first && first.type === 'text' ? first.text : ''
  let data: unknown = undefined
  const split = text.indexOf('\n\n')
  if (split >= 0) {
    try {
      data = JSON.parse(text.slice(split + 2))
    } catch {
      data = undefined
    }
  }
  return { isError: Boolean(raw.isError), text, data, raw }
}

/** Wirft, wenn ein Tool fehlschlägt – für den Normalfall in Tests. */
export async function ok(client: Client, name: string, args: Record<string, unknown> = {}): Promise<ToolResponse> {
  const res = await call(client, name, args)
  if (res.isError) throw new Error(`${name} fehlgeschlagen: ${res.text}`)
  return res
}
