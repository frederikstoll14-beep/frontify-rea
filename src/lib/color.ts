export interface Rgb {
  r: number
  g: number
  b: number
}

export interface Hsl {
  h: number
  s: number
  l: number
}

export interface Cmyk {
  c: number
  m: number
  y: number
  k: number
}

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/** Normalisiert Eingaben wie "fff", "#FfF" oder "#ffffff" zu "#FFFFFF". Gibt null bei ungültigen Werten zurück. */
export function normalizeHex(input: string): string | null {
  const match = HEX_RE.exec(input.trim())
  if (!match) return null
  let value = match[1]
  if (value.length === 3) {
    value = value
      .split('')
      .map((c) => c + c)
      .join('')
  }
  return `#${value.toUpperCase()}`
}

export function hexToRgb(hex: string): Rgb {
  const normalized = normalizeHex(hex)
  if (!normalized) throw new Error(`Ungültiger HEX-Wert: ${hex}`)
  const n = Number.parseInt(normalized.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const part = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase()
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0)
        break
      case gn:
        h = (bn - rn) / d + 2
        break
      default:
        h = (rn - gn) / d + 4
    }
    h /= 6
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

/**
 * Naive Umrechnung RGB → CMYK (ohne ICC-Profil). Nur als Richtwert;
 * verbindliche Druckwerte werden manuell gepflegt.
 */
export function rgbToCmyk({ r, g, b }: Rgb): Cmyk {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const k = 1 - Math.max(rn, gn, bn)
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 }
  const c = (1 - rn - k) / (1 - k)
  const m = (1 - gn - k) / (1 - k)
  const y = (1 - bn - k) / (1 - k)
  return { c: Math.round(c * 100), m: Math.round(m * 100), y: Math.round(y * 100), k: Math.round(k * 100) }
}

export function formatRgb(rgb: Rgb): string {
  return `${rgb.r} ${rgb.g} ${rgb.b}`
}

export function formatHsl(hsl: Hsl): string {
  return `${hsl.h}° ${hsl.s}% ${hsl.l}%`
}

export function formatCmyk(cmyk: Cmyk): string {
  return `${cmyk.c}/${cmyk.m}/${cmyk.y}/${cmyk.k}`
}

function channel(v: number): number {
  const s = v / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

export type WcagLevel = 'AAA' | 'AA' | 'AA groß' | '–'

export function wcagLevel(ratio: number): WcagLevel {
  if (ratio >= 7) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3) return 'AA groß'
  return '–'
}

/** Liefert Schwarz oder Weiß – je nachdem, was auf der Farbe besser lesbar ist. */
export function readableTextColor(hex: string): '#FFFFFF' | '#15171F' {
  return contrastRatio(hex, '#FFFFFF') >= contrastRatio(hex, '#15171F') ? '#FFFFFF' : '#15171F'
}

export function mix(hexA: string, hexB: string, weight: number): string {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  const w = Math.min(1, Math.max(0, weight))
  return rgbToHex({ r: a.r * (1 - w) + b.r * w, g: a.g * (1 - w) + b.g * w, b: a.b * (1 - w) + b.b * w })
}

/** Abstufungen 50–900 als Orientierung für digitale Anwendungen. */
export function tintScale(hex: string): Array<{ step: number; hex: string }> {
  const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]
  return steps.map((step) => {
    if (step === 500) return { step, hex: normalizeHex(hex) ?? hex }
    if (step < 500) return { step, hex: mix(hex, '#FFFFFF', (500 - step) / 520) }
    return { step, hex: mix(hex, '#000000', (step - 500) / 560) }
  })
}
