import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

const UMLAUTS: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }

/** Entspricht public.slugify() in der Datenbank. */
export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => UMLAUTS[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'eintrag'
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exp
  return `${value.toLocaleString('de-DE', { maximumFractionDigits: exp === 0 ? 0 : 1 })} ${units[exp]}`
}

const dateFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
const dateTimeFormat = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '–'
  return dateFormat.format(typeof value === 'string' ? new Date(value) : value)
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '–'
  return dateTimeFormat.format(typeof value === 'string' ? new Date(value) : value)
}

export function timeAgo(value: string | Date, now: Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000)
  if (seconds < 45) return 'gerade eben'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `vor ${minutes} Min.`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `vor ${hours} Std.`
  const days = Math.round(hours / 24)
  if (days === 1) return 'gestern'
  if (days < 7) return `vor ${days} Tagen`
  return formatDate(date)
}

export function initials(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function fileExtension(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx > 0 ? name.slice(idx + 1).toLowerCase() : ''
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return translateError(error.message)
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return translateError(error.message)
  }
  return 'Unbekannter Fehler'
}

const ERROR_TRANSLATIONS: Array<[RegExp, string]> = [
  [/Invalid login credentials/i, 'E-Mail oder Passwort ist falsch.'],
  [/User already registered/i, 'Für diese E-Mail gibt es schon ein Konto. Melde dich an.'],
  [/Email not confirmed/i, 'Bitte bestätige zuerst deine E-Mail-Adresse.'],
  [/Password should be at least/i, 'Das Passwort ist zu kurz (mindestens 6 Zeichen).'],
  [/row-level security|permission denied/i, 'Dafür fehlen dir die Rechte.'],
  [/duplicate key value.*slug/i, 'Diese Kurz-URL ist schon vergeben.'],
  [/The resource already exists/i, 'Eine Datei mit diesem Namen existiert bereits.'],
  [/Payload too large|exceeded the maximum allowed size/i, 'Die Datei ist zu groß (max. 50 MB).'],
  [/rate limit/i, 'Zu viele Versuche. Bitte warte kurz.'],
  [/Failed to fetch|NetworkError/i, 'Keine Verbindung zum Server.'],
]

function translateError(message: string): string {
  for (const [pattern, text] of ERROR_TRANSLATIONS) {
    if (pattern.test(message)) return text
  }
  return message
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = items.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function uniqueId(): string {
  return crypto.randomUUID()
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function downloadText(content: string, fileName: string, mime = 'text/plain'): void {
  downloadBlob(new Blob([content], { type: `${mime};charset=utf-8` }), fileName)
}
