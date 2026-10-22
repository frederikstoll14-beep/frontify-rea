import type { IncomingMessage, ServerResponse } from 'node:http'
import { createHandler, type FetchHandler } from './http'

async function readBody(req: IncomingMessage & { body?: unknown }): Promise<Buffer | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined
  // Vercel liest und parst den Body unter Umständen schon.
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) return req.body
    if (typeof req.body === 'string') return Buffer.from(req.body)
    return Buffer.from(JSON.stringify(req.body))
  }
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

/** Verbindet den Fetch-Handler mit Node-HTTP (Vercel-Funktion, lokaler Server). */
export function toNodeListener(handler: FetchHandler) {
  return async function listener(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const host = req.headers.host ?? 'localhost'
      const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0] ?? 'http'
      const headers = new Headers()
      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) value.forEach((v) => headers.append(key, v))
        else if (value !== undefined) headers.set(key, value)
      }
      const body = await readBody(req)
      const request = new Request(`${proto}://${host}${req.url ?? '/'}`, {
        method: req.method,
        headers,
        body: body && body.length > 0 ? new Uint8Array(body) : undefined,
      })
      const response = await handler(request)
      const out: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        out[key] = value
      })
      res.writeHead(response.status, out)
      res.end(Buffer.from(await response.arrayBuffer()))
    } catch (error) {
      console.error('mcp adapter failed', error instanceof Error ? error.message : 'unknown error')
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'internal_error' }))
    }
  }
}

export const nodeListener = toNodeListener(createHandler())
