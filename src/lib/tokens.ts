import { hexToRgb } from './color'
import { slugify } from './utils'

export interface TokenColor {
  name: string
  hex: string
  token?: string | null
  description?: string | null
  cmyk?: string | null
  pantone?: string | null
  hks?: string | null
  ral?: string | null
}

export interface TokenPalette {
  name: string
  colors: TokenColor[]
}

export interface TokenTextStyle {
  name: string
  token?: string | null
  font_family: string
  font_weight: number
  font_size: number
  line_height: number
  letter_spacing: number
  text_transform: string
  italic: boolean
}

export interface TokenFont {
  family: string
  fallback: string
  role?: string | null
}

export interface TokenSource {
  brandName: string
  palettes: TokenPalette[]
  textStyles: TokenTextStyle[]
  fonts: TokenFont[]
}

function colorKey(color: TokenColor): string {
  return color.token && color.token.length > 0 ? color.token : slugify(color.name)
}

function styleKey(style: TokenTextStyle): string {
  return style.token && style.token.length > 0 ? style.token : slugify(style.name)
}

function fontStack(family: string, fallback: string): string {
  const quoted = /\s/.test(family) ? `'${family}'` : family
  return `${quoted}, ${fallback || 'sans-serif'}`
}

/** Eindeutige Schlüssel, auch wenn zwei Farben gleich heißen. */
function uniqueColors(source: TokenSource): Array<{ key: string; color: TokenColor; palette: string }> {
  const seen = new Map<string, number>()
  const result: Array<{ key: string; color: TokenColor; palette: string }> = []
  for (const palette of source.palettes) {
    for (const color of palette.colors) {
      const base = colorKey(color)
      const count = seen.get(base) ?? 0
      seen.set(base, count + 1)
      result.push({ key: count === 0 ? base : `${base}-${count + 1}`, color, palette: palette.name })
    }
  }
  return result
}

function fontKey(font: TokenFont, index: number): string {
  if (font.role && font.role.trim().length > 0) return slugify(font.role)
  return index === 0 ? 'primary' : index === 1 ? 'secondary' : slugify(font.family)
}

export function toCssVariables(source: TokenSource): string {
  const lines: string[] = [`/* Design Tokens – ${source.brandName} */`, ':root {']
  for (const { key, color } of uniqueColors(source)) {
    lines.push(`  --color-${key}: ${color.hex.toLowerCase()};`)
  }
  source.fonts.forEach((font, i) => {
    lines.push(`  --font-${fontKey(font, i)}: ${fontStack(font.family, font.fallback)};`)
  })
  for (const style of source.textStyles) {
    const key = styleKey(style)
    lines.push(`  --text-${key}-size: ${style.font_size / 16}rem;`)
    lines.push(`  --text-${key}-line-height: ${style.line_height};`)
    lines.push(`  --text-${key}-weight: ${style.font_weight};`)
    lines.push(`  --text-${key}-letter-spacing: ${style.letter_spacing}em;`)
  }
  lines.push('}')
  for (const style of source.textStyles) {
    const key = styleKey(style)
    const font = source.fonts.find((f) => f.family === style.font_family)
    lines.push('')
    lines.push(`.text-${key} {`)
    lines.push(`  font-family: ${fontStack(style.font_family, font?.fallback ?? 'sans-serif')};`)
    lines.push(`  font-size: var(--text-${key}-size);`)
    lines.push(`  line-height: var(--text-${key}-line-height);`)
    lines.push(`  font-weight: var(--text-${key}-weight);`)
    lines.push(`  letter-spacing: var(--text-${key}-letter-spacing);`)
    if (style.text_transform !== 'none') lines.push(`  text-transform: ${style.text_transform};`)
    if (style.italic) lines.push('  font-style: italic;')
    lines.push('}')
  }
  return lines.join('\n') + '\n'
}

export function toScss(source: TokenSource): string {
  const lines: string[] = [`// Design Tokens – ${source.brandName}`]
  for (const { key, color } of uniqueColors(source)) {
    lines.push(`$color-${key}: ${color.hex.toLowerCase()};`)
  }
  source.fonts.forEach((font, i) => {
    lines.push(`$font-${fontKey(font, i)}: ${fontStack(font.family, font.fallback)};`)
  })
  if (source.textStyles.length > 0) {
    lines.push('')
    lines.push('$text-styles: (')
    for (const style of source.textStyles) {
      lines.push(
        `  '${styleKey(style)}': (family: '${style.font_family}', size: ${style.font_size / 16}rem, line-height: ${style.line_height}, weight: ${style.font_weight}, letter-spacing: ${style.letter_spacing}em),`,
      )
    }
    lines.push(');')
  }
  return lines.join('\n') + '\n'
}

type DtcgToken = { $type: string; $value: unknown; $description?: string }
type DtcgGroup = { [key: string]: DtcgToken | DtcgGroup | string | undefined }

/** Design Tokens im W3C-DTCG-Format (Design Tokens Community Group). */
export function toDtcgJson(source: TokenSource): string {
  const color: DtcgGroup = {}
  for (const palette of source.palettes) {
    const group: DtcgGroup = {}
    for (const c of palette.colors) {
      const token: DtcgToken = { $type: 'color', $value: c.hex.toLowerCase() }
      const extras = [
        c.description,
        c.cmyk && `CMYK ${c.cmyk}`,
        c.pantone && `Pantone ${c.pantone}`,
        c.hks && `HKS ${c.hks}`,
        c.ral && `RAL ${c.ral}`,
      ]
        .filter(Boolean)
        .join(' · ')
      if (extras) token.$description = extras
      group[colorKey(c)] = token
    }
    color[slugify(palette.name)] = group
  }
  const fontFamily: DtcgGroup = {}
  source.fonts.forEach((font, i) => {
    fontFamily[fontKey(font, i)] = { $type: 'fontFamily', $value: [font.family, font.fallback || 'sans-serif'] }
  })
  const typography: DtcgGroup = {}
  for (const style of source.textStyles) {
    typography[styleKey(style)] = {
      $type: 'typography',
      $value: {
        fontFamily: style.font_family,
        fontSize: `${style.font_size}px`,
        fontWeight: style.font_weight,
        lineHeight: style.line_height,
        letterSpacing: `${style.letter_spacing}em`,
      },
    }
  }
  const doc: DtcgGroup = { color, fontFamily, typography }
  return JSON.stringify(doc, null, 2) + '\n'
}

/** Tailwind CSS v4 (@theme) */
export function toTailwindTheme(source: TokenSource): string {
  const lines: string[] = [`/* Tailwind CSS v4 – ${source.brandName} */`, '@theme {']
  for (const { key, color } of uniqueColors(source)) {
    lines.push(`  --color-${key}: ${color.hex.toLowerCase()};`)
  }
  source.fonts.forEach((font, i) => {
    lines.push(`  --font-${fontKey(font, i)}: ${fontStack(font.family, font.fallback)};`)
  })
  for (const style of source.textStyles) {
    const key = styleKey(style)
    lines.push(`  --text-${key}: ${style.font_size / 16}rem;`)
    lines.push(`  --text-${key}--line-height: ${style.line_height};`)
    lines.push(`  --text-${key}--font-weight: ${style.font_weight};`)
  }
  lines.push('}')
  return lines.join('\n') + '\n'
}

/**
 * Adobe Swatch Exchange (.ase) – importierbar in Illustrator, InDesign, Photoshop.
 * Jede Palette wird eine Farbgruppe, Farben als globale RGB-Farbfelder.
 */
export function toAse(source: TokenSource): Uint8Array {
  const chunks: Uint8Array[] = []
  let blockCount = 0

  const utf16 = (text: string): Uint8Array => {
    const value = text.slice(0, 200)
    const out = new Uint8Array((value.length + 1) * 2)
    const view = new DataView(out.buffer)
    for (let i = 0; i < value.length; i++) view.setUint16(i * 2, value.charCodeAt(i))
    return out
  }

  const block = (type: number, body: Uint8Array) => {
    const head = new Uint8Array(6)
    const view = new DataView(head.buffer)
    view.setUint16(0, type)
    view.setUint32(2, body.length)
    chunks.push(head, body)
    blockCount++
  }

  const named = (name: string, extra: Uint8Array): Uint8Array => {
    const nameBytes = utf16(name)
    const out = new Uint8Array(2 + nameBytes.length + extra.length)
    const view = new DataView(out.buffer)
    view.setUint16(0, nameBytes.length / 2)
    out.set(nameBytes, 2)
    out.set(extra, 2 + nameBytes.length)
    return out
  }

  for (const palette of source.palettes) {
    block(0xc001, named(palette.name, new Uint8Array(0)))
    for (const color of palette.colors) {
      const { r, g, b } = hexToRgb(color.hex)
      const extra = new Uint8Array(4 + 12 + 2)
      const view = new DataView(extra.buffer)
      extra.set([82, 71, 66, 32], 0) // "RGB "
      view.setFloat32(4, r / 255)
      view.setFloat32(8, g / 255)
      view.setFloat32(12, b / 255)
      view.setUint16(16, 0) // global
      block(0x0001, named(color.name, extra))
    }
    block(0xc002, new Uint8Array(0))
  }

  const header = new Uint8Array(12)
  const view = new DataView(header.buffer)
  header.set([65, 83, 69, 70], 0) // "ASEF"
  view.setUint16(4, 1)
  view.setUint16(6, 0)
  view.setUint32(8, blockCount)

  const total = chunks.reduce((sum, c) => sum + c.length, header.length)
  const out = new Uint8Array(total)
  out.set(header, 0)
  let offset = header.length
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}

export type TokenFormat = 'css' | 'scss' | 'json' | 'tailwind' | 'ase'

export const TOKEN_FORMATS: Record<TokenFormat, { label: string; file: string; mime: string; hint: string }> = {
  css: { label: 'CSS-Variablen', file: 'tokens.css', mime: 'text/css', hint: 'Für Websites' },
  scss: { label: 'SCSS', file: '_tokens.scss', mime: 'text/x-scss', hint: 'Für Sass-Projekte' },
  json: { label: 'JSON (W3C)', file: 'tokens.json', mime: 'application/json', hint: 'Figma Tokens, Style Dictionary' },
  tailwind: { label: 'Tailwind v4', file: 'tailwind-theme.css', mime: 'text/css', hint: 'Für Tailwind-Projekte' },
  ase: {
    label: 'Adobe Swatches (.ase)',
    file: 'farben.ase',
    mime: 'application/octet-stream',
    hint: 'Illustrator, InDesign, Photoshop',
  },
}

export function buildTokenFile(format: TokenFormat, source: TokenSource): Blob {
  const meta = TOKEN_FORMATS[format]
  if (format === 'ase') {
    const bytes = toAse(source)
    const buffer = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(buffer).set(bytes)
    return new Blob([buffer], { type: meta.mime })
  }
  const text =
    format === 'css'
      ? toCssVariables(source)
      : format === 'scss'
        ? toScss(source)
        : format === 'json'
          ? toDtcgJson(source)
          : toTailwindTheme(source)
  return new Blob([text], { type: `${meta.mime};charset=utf-8` })
}
