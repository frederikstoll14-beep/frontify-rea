import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { authenticate, type AuthFailure } from './auth'
import { SERVER_NAME, SERVER_VERSION, readConfig, type McpConfig } from './config'
import { Ctx } from './context'
import { buildServer } from './server'

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, mcp-session-id, mcp-protocol-version, last-event-id',
  'access-control-expose-headers': 'www-authenticate, mcp-session-id',
  'access-control-max-age': '86400',
}

/** Vercel begrenzt Anfragen an Funktionen auf 4,5 MB. */
const MAX_BODY = 4_400_000

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS_HEADERS, ...headers },
  })
}

/** Adresse, unter der der Server von außen erreichbar ist. */
export function publicOrigin(request: Request, config: McpConfig | null): string {
  if (config?.publicUrl) return new URL(config.publicUrl).origin
  const url = new URL(request.url)
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() ?? (local ? url.protocol.replace(':', '') : 'https')
  return `${proto}://${host}`
}

function metadataUrl(origin: string): string {
  return `${origin}/.well-known/oauth-protected-resource/mcp`
}

function challenge(origin: string, failure: Pick<AuthFailure, 'error' | 'description'>): string {
  const parts = [`resource_metadata="${metadataUrl(origin)}"`]
  if (failure.error !== 'invalid_request') {
    parts.push(`error="${failure.error}"`, `error_description="${failure.description.replace(/"/g, "'")}"`)
  }
  return `Bearer ${parts.join(', ')}`
}

function protectedResource(origin: string, config: McpConfig) {
  return {
    resource: `${origin}/mcp`,
    authorization_servers: [`${config.supabaseUrl}/auth/v1`],
    bearer_methods_supported: ['header'],
    resource_name: 'Brandbench',
    resource_documentation: config.appUrl ? `${config.appUrl}/konto` : undefined,
  }
}

let metadataCache: { at: number; body: unknown } | null = null

/** Für ältere MCP-Clients: Metadaten des Autorisierungs-Servers auch unter dieser Adresse anbieten. */
async function authorizationServerMetadata(config: McpConfig): Promise<unknown | null> {
  if (metadataCache && Date.now() - metadataCache.at < 10 * 60_000) return metadataCache.body
  try {
    const url = `${config.supabaseUrl}/.well-known/oauth-authorization-server/auth/v1`
    const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const body = await res.json()
    metadataCache = { at: Date.now(), body }
    return body
  } catch {
    return null
  }
}

function withAcceptHeader(request: Request): Request {
  const accept = request.headers.get('accept') ?? ''
  if (accept.includes('application/json') && accept.includes('text/event-stream')) return request
  const headers = new Headers(request.headers)
  headers.set('accept', 'application/json, text/event-stream')
  return new Request(request, { headers })
}

export type FetchHandler = (request: Request) => Promise<Response>

/** HTTP-Einstieg des Servers; läuft auf Vercel, lokal und in Tests identisch. */
export function createHandler(env: Record<string, string | undefined> = process.env): FetchHandler {
  return async function handle(request) {
    const url = new URL(request.url)
    let path = url.pathname.replace(/\/+$/, '') || '/'
    // Auf Vercel liegt die Funktion unter /api/mcp; öffentlich ist sie unter /mcp erreichbar.
    if (path === '/api/mcp') path = '/mcp'
    const configResult = readConfig(env)
    const config = configResult.ok ? configResult.config : null
    const origin = publicOrigin(request, config)

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })

    if (path === '/' || path === '/health' || path === '/api/health') {
      return json(configResult.ok ? 200 : 503, {
        name: SERVER_NAME,
        version: SERVER_VERSION,
        ok: configResult.ok,
        problem: configResult.ok ? undefined : configResult.problem,
        mcp: `${origin}/mcp`,
      })
    }

    if (!config) {
      return json(503, { error: 'server_not_configured', error_description: configResult.ok ? '' : configResult.problem })
    }

    if (path.startsWith('/.well-known/oauth-protected-resource')) {
      return json(200, protectedResource(origin, config), { 'cache-control': 'public, max-age=300' })
    }
    if (path.startsWith('/.well-known/oauth-authorization-server') || path.startsWith('/.well-known/openid-configuration')) {
      const body = await authorizationServerMetadata(config)
      return body ? json(200, body, { 'cache-control': 'public, max-age=300' }) : json(404, { error: 'not_found' })
    }

    if (path !== '/mcp') return json(404, { error: 'not_found' })

    // Dieser Server hält keine Sitzungen offen: kein Server-Stream (GET) und kein Sitzungs-Ende (DELETE).
    if (request.method !== 'POST') {
      return json(405, { error: 'method_not_allowed', error_description: 'Nur POST wird unterstützt.' }, { allow: 'POST, OPTIONS' })
    }

    const auth = await authenticate(config, request.headers.get('authorization'))
    if (!auth.ok) {
      return json(
        auth.status,
        { error: auth.error, error_description: auth.description },
        { 'www-authenticate': challenge(origin, auth) },
      )
    }

    const ctx = new Ctx(config, auth.principal, origin)
    const server = buildServer(ctx)
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
      maxRequestBodySize: MAX_BODY,
    })
    try {
      await server.connect(transport)
      const response = await transport.handleRequest(withAcceptHeader(request))
      const headers = new Headers(response.headers)
      for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value)
      headers.set('cache-control', 'no-store')
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
    } catch (error) {
      console.error('mcp request failed', error instanceof Error ? error.message : 'unknown error')
      return json(500, { jsonrpc: '2.0', error: { code: -32603, message: 'Interner Fehler' }, id: null })
    } finally {
      queueMicrotask(() => void server.close().catch(() => undefined))
    }
  }
}
