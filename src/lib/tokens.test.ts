import { describe, expect, it } from 'vitest'
import { toAse, toCssVariables, toDtcgJson, toScss, toTailwindTheme, type TokenSource } from './tokens'

const source: TokenSource = {
  brandName: 'SV Musterstadt',
  palettes: [
    {
      name: 'Vereinsfarben',
      colors: [
        { name: 'Vereinsrot', hex: '#C8102E', token: 'brand-red', cmyk: '0/100/85/5' },
        { name: 'Weiß', hex: '#FFFFFF' },
      ],
    },
    { name: 'Akzente', colors: [{ name: 'Weiß', hex: '#F5F5F5' }] },
  ],
  fonts: [{ family: 'Barlow Condensed', fallback: 'sans-serif', role: 'Headline' }],
  textStyles: [
    {
      name: 'H1',
      font_family: 'Barlow Condensed',
      font_weight: 700,
      font_size: 48,
      line_height: 1.1,
      letter_spacing: 0,
      text_transform: 'uppercase',
      italic: false,
    },
  ],
}

describe('tokens', () => {
  it('erzeugt CSS-Variablen mit eindeutigen Schlüsseln', () => {
    const css = toCssVariables(source)
    expect(css).toContain('--color-brand-red: #c8102e;')
    expect(css).toContain('--color-weiss: #ffffff;')
    expect(css).toContain('--color-weiss-2: #f5f5f5;')
    expect(css).toContain("--font-headline: 'Barlow Condensed', sans-serif;")
    expect(css).toContain('--text-h1-size: 3rem;')
    expect(css).toContain('text-transform: uppercase;')
  })

  it('erzeugt SCSS und Tailwind', () => {
    expect(toScss(source)).toContain('$color-brand-red: #c8102e;')
    expect(toTailwindTheme(source)).toContain('@theme {')
  })

  it('erzeugt valides DTCG-JSON', () => {
    const json = JSON.parse(toDtcgJson(source))
    expect(json.color.vereinsfarben['brand-red'].$value).toBe('#c8102e')
    expect(json.color.vereinsfarben['brand-red'].$description).toContain('CMYK 0/100/85/5')
    expect(json.typography.h1.$value.fontSize).toBe('48px')
  })

  it('erzeugt eine ASE-Datei mit korrektem Header und Blockanzahl', () => {
    const bytes = toAse(source)
    const view = new DataView(bytes.buffer)
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('ASEF')
    expect(view.getUint16(4)).toBe(1)
    // 2 Gruppen à (Start + Ende) + 3 Farben
    expect(view.getUint32(8)).toBe(7)
    // erster Block ist Gruppenstart
    expect(view.getUint16(12)).toBe(0xc001)
  })
})
