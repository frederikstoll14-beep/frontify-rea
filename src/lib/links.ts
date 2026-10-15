/** Schnellzugriff-Links der Startseite: interne Kurzformen und sichere externe Ziele. */
export function resolveQuickLink(url: string, basePath: string): { to: string; external: boolean } | null {
  const value = url.trim()
  if (value.startsWith('library:'))
    return { to: `${basePath}/bibliothek/${encodeURIComponent(value.slice(8))}`, external: false }
  if (value.startsWith('page:'))
    return {
      to: `${basePath}/g/${value.slice(5).split('/').map(encodeURIComponent).join('/')}`,
      external: false,
    }
  if (value.startsWith('/') && !value.startsWith('//')) return { to: value, external: false }
  // Nur sichere Protokolle zulassen (kein javascript:, data: …)
  if (/^(https?:|mailto:)/i.test(value)) return { to: value, external: true }
  return null
}
