import type { Font, FontFile } from '@/api/basics'

/**
 * Lädt Marken-Schriften.
 * Google-Fonts werden DSGVO-freundlich über Bunny Fonts (EU, ohne Tracking) eingebunden,
 * hochgeladene Schriften per FontFace-API aus dem Storage.
 */

const SYSTEM_FONTS = new Set([
  'arial',
  'helvetica',
  'georgia',
  'times new roman',
  'verdana',
  'tahoma',
  'trebuchet ms',
  'courier new',
  'system-ui',
  'inter variable',
  'fraunces variable',
])

const loadedLinks = new Set<string>()

export function bunnyFamilySlug(family: string): string {
  return family.trim().toLowerCase().replace(/\s+/g, '-')
}

export function loadWebFonts(families: Array<{ family: string; weights?: number[] | null }>): void {
  const items = families.filter((f) => f.family && !SYSTEM_FONTS.has(f.family.trim().toLowerCase()))
  if (items.length === 0) return
  const query = items
    .map((f) => {
      const weights = [...new Set([400, 700, ...(f.weights ?? [])])].sort((a, b) => a - b)
      return `${bunnyFamilySlug(f.family)}:${weights.join(',')}`
    })
    .join('|')
  const href = `https://fonts.bunny.net/css?family=${query}&display=swap`
  if (loadedLinks.has(href)) return
  loadedLinks.add(href)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}

const loadedFaces = new Set<string>()

export async function loadUploadedFont(
  font: Pick<Font, 'family'>,
  files: FontFile[],
  resolveUrl: (path: string) => Promise<string | null>,
): Promise<void> {
  await Promise.all(
    files.map(async (file) => {
      const key = `${font.family}|${file.path}`
      if (loadedFaces.has(key)) return
      const url = await resolveUrl(file.path)
      if (!url) return
      try {
        const face = new FontFace(font.family, `url(${url})`, {
          weight: String(file.weight),
          style: file.style,
          display: 'swap',
        })
        await face.load()
        document.fonts.add(face)
        loadedFaces.add(key)
      } catch {
        // Ungültige Schriftdatei – ignorieren
      }
    }),
  )
}

export function fontStack(family: string | null | undefined, fallback = 'system-ui, sans-serif'): string {
  if (!family) return fallback
  return `'${family.replace(/'/g, '')}', ${fallback}`
}
