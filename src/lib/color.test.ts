import { describe, expect, it } from 'vitest'
import {
  contrastRatio,
  hexToRgb,
  normalizeHex,
  readableTextColor,
  rgbToCmyk,
  rgbToHex,
  rgbToHsl,
  tintScale,
  wcagLevel,
} from './color'

describe('color', () => {
  it('normalisiert HEX-Werte', () => {
    expect(normalizeHex('fff')).toBe('#FFFFFF')
    expect(normalizeHex('#e4572e')).toBe('#E4572E')
    expect(normalizeHex(' #ABC ')).toBe('#AABBCC')
    expect(normalizeHex('#12345')).toBeNull()
    expect(normalizeHex('rot')).toBeNull()
  })

  it('rechnet HEX ↔ RGB', () => {
    expect(hexToRgb('#E4572E')).toEqual({ r: 228, g: 87, b: 46 })
    expect(rgbToHex({ r: 228, g: 87, b: 46 })).toBe('#E4572E')
  })

  it('rechnet RGB → HSL und CMYK', () => {
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 })
    expect(rgbToCmyk({ r: 0, g: 0, b: 0 })).toEqual({ c: 0, m: 0, y: 0, k: 100 })
    expect(rgbToCmyk({ r: 255, g: 0, b: 0 })).toEqual({ c: 0, m: 100, y: 100, k: 0 })
  })

  it('berechnet WCAG-Kontraste', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0)
    expect(wcagLevel(21)).toBe('AAA')
    expect(wcagLevel(4.6)).toBe('AA')
    expect(wcagLevel(3.2)).toBe('AA groß')
    expect(wcagLevel(1.5)).toBe('–')
    expect(readableTextColor('#FFE600')).toBe('#15171F')
    expect(readableTextColor('#0A2A66')).toBe('#FFFFFF')
  })

  it('erzeugt eine Abstufung mit der Ausgangsfarbe als 500', () => {
    const scale = tintScale('#E4572E')
    expect(scale).toHaveLength(10)
    expect(scale.find((s) => s.step === 500)?.hex).toBe('#E4572E')
    expect(scale[0].hex).not.toBe('#E4572E')
  })
})
