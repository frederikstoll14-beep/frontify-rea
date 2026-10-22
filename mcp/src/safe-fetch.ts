import { lookup as dnsLookup } from 'node:dns'
import type { LookupFunction } from 'node:net'
import { isIP } from 'node:net'
import http from 'node:http'
import https from 'node:https'
import { ToolError } from './errors'

const MAX_REDIRECTS = 3
const TIMEOUT_MS = 25_000

function ipv4ToNumber(ip: string): number {
  return ip.split('.').reduce((acc, part) => acc * 256 + Number(part), 0)
}

function inRange(ip: number, base: string, bits: number): boolean {
  const start = ipv4ToNumber(base)
  const size = 2 ** (32 - bits)
  return ip >= start && ip < start + size
}

/** true, wenn die Adresse nicht öffentlich erreichbar sein sollte (lokal, privat, Metadaten-Dienste …). */
export function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const n = ipv4ToNumber(address)
    return [
      ['0.0.0.0', 8],
      ['10.0.0.0', 8],
      ['100.64.0.0', 10],
      ['127.0.0.0', 8],
      ['169.254.0.0', 16],
      ['172.16.0.0', 12],
      ['192.0.0.0', 24],
      ['192.168.0.0', 16],
      ['198.18.0.0', 15],
      ['224.0.0.0', 4],
      ['240.0.0.0', 4],
    ].some(([base, bits]) => inRange(n, base as string, bits as number))
  }
  if (isIP(address) === 6) {
    const lower = address.toLowerCase()
    if (lower === '::' || lower === '::1') return true
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower)
    if (mapped) return isPrivateAddress(mapped[1])
    return /^(fc|fd|fe[89ab]|ff)/.test(lower)
  }
  return true
}

function guardedLookup(allowPrivate: boolean): LookupFunction {
  return (hostname, options, callback) => {
    dnsLookup(hostname, options, (error, address, family) => {
      if (error) return callback(error, address as never, family)
      const list = Array.isArray(address) ? address : [{ address: address as string, family }]
      if (!allowPrivate && list.some((entry) => isPrivateAddress(entry.address))) {
        return callback(new Error('Adresse nicht erlaubt') as NodeJS.ErrnoException, '' as never, 4)
      }
      return Array.isArray(address)
        ? callback(null, address as never, family)
        : callback(null, address as string, family)
    })
  }
}

export interface Fetched {
  bytes: Buffer
  contentType: string
  finalUrl: string
}

/**
 * Lädt eine Datei von einer öffentlichen https-Adresse herunter. Schutz vor Zugriffen auf interne
 * Dienste (SSRF): Die Adresse wird beim Verbinden geprüft (auch nach Weiterleitungen), Größe und Dauer sind begrenzt.
 */
export async function fetchPublicFile(
  rawUrl: string,
  options: { maxBytes: number; allowPrivate?: boolean },
): Promise<Fetched> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new ToolError('Die Adresse (url) ist ungültig.')
  }
  const allowPrivate = options.allowPrivate === true
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== 'https:' && !(allowPrivate && url.protocol === 'http:')) {
      throw new ToolError('Es sind nur https-Adressen erlaubt.')
    }
    if (url.username || url.password) throw new ToolError('Adressen mit Zugangsdaten sind nicht erlaubt.')
    if (isIP(url.hostname.replace(/^\[|\]$/g, '')) !== 0 && !allowPrivate && isPrivateAddress(url.hostname.replace(/^\[|\]$/g, ''))) {
      throw new ToolError('Diese Adresse ist nicht erlaubt.')
    }
    const response = await request(url, options.maxBytes, allowPrivate)
    if (response.redirect) {
      url = new URL(response.redirect, url)
      continue
    }
    return { bytes: response.bytes, contentType: response.contentType, finalUrl: url.toString() }
  }
  throw new ToolError('Zu viele Weiterleitungen.')
}

interface RawResponse {
  redirect: string | null
  bytes: Buffer
  contentType: string
}

function request(url: URL, maxBytes: number, allowPrivate: boolean): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http
    const req = transport.request(
      url,
      {
        method: 'GET',
        timeout: TIMEOUT_MS,
        lookup: guardedLookup(allowPrivate),
        headers: { 'user-agent': 'Brandbench-MCP/1.0', accept: '*/*' },
      },
      (res) => {
        const status = res.statusCode ?? 0
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume()
          resolve({ redirect: res.headers.location, bytes: Buffer.alloc(0), contentType: '' })
          return
        }
        if (status < 200 || status >= 300) {
          res.resume()
          reject(new ToolError(`Der Abruf der Datei ist fehlgeschlagen (HTTP ${status}).`))
          return
        }
        const declared = Number(res.headers['content-length'] ?? 0)
        if (declared > maxBytes) {
          res.resume()
          reject(new ToolError(`Die Datei ist zu groß (maximal ${Math.round(maxBytes / 1_000_000)} MB).`))
          return
        }
        const chunks: Buffer[] = []
        let total = 0
        res.on('data', (chunk: Buffer) => {
          total += chunk.length
          if (total > maxBytes) {
            req.destroy(new ToolError(`Die Datei ist zu groß (maximal ${Math.round(maxBytes / 1_000_000)} MB).`))
            return
          }
          chunks.push(chunk)
        })
        res.on('end', () =>
          resolve({
            redirect: null,
            bytes: Buffer.concat(chunks),
            contentType: String(res.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase(),
          }),
        )
        res.on('error', reject)
      },
    )
    req.on('timeout', () => req.destroy(new ToolError('Der Abruf der Datei hat zu lange gedauert.')))
    req.on('error', (error) =>
      reject(error instanceof ToolError ? error : new ToolError(`Die Datei konnte nicht abgerufen werden (${error.message}).`)),
    )
    req.end()
  })
}
