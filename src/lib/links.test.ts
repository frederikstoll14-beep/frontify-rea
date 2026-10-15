import { describe, expect, it } from 'vitest'
import { resolveQuickLink } from './links'

describe('resolveQuickLink', () => {
  it('löst interne Ziele auf', () => {
    expect(resolveQuickLink('library:logos', '/b/x')).toEqual({
      to: '/b/x/bibliothek/logos',
      external: false,
    })
    expect(resolveQuickLink('page:markenhandbuch/farben', '/b/x')).toEqual({
      to: '/b/x/g/markenhandbuch/farben',
      external: false,
    })
  })
  it('erlaubt nur sichere externe Links', () => {
    expect(resolveQuickLink('https://example.com', '/b/x')?.external).toBe(true)
    expect(resolveQuickLink('mailto:a@b.de', '/b/x')?.external).toBe(true)
    expect(resolveQuickLink('javascript:alert(1)', '/b/x')).toBeNull()
    expect(resolveQuickLink('JaVaScRiPt:alert(1)', '/b/x')).toBeNull()
    expect(resolveQuickLink('//evil.example', '/b/x')).toBeNull()
    expect(resolveQuickLink('data:text/html,hi', '/b/x')).toBeNull()
  })
})
