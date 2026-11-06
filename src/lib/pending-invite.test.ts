import { describe, expect, it } from 'vitest'
import {
  forgetInvite,
  parseInviteToken,
  pendingInvite,
  rememberInvite,
  shouldResumeInvite,
} from './pending-invite'

function memoryStore() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

describe('Offene Einladung', () => {
  it('merkt sich einen Token und vergisst ihn wieder', () => {
    const store = memoryStore()
    expect(pendingInvite(store)).toBeNull()
    rememberInvite('a1b2c3d4e5f6a7b8c9d0', store)
    expect(pendingInvite(store)).toBe('a1b2c3d4e5f6a7b8c9d0')
    forgetInvite(store)
    expect(pendingInvite(store)).toBeNull()
  })

  it('speichert nichts Ungültiges und übersteht gesperrten Speicher', () => {
    const store = memoryStore()
    rememberInvite('<script>', store)
    expect(pendingInvite(store)).toBeNull()
    const broken = {
      getItem: () => {
        throw new Error('gesperrt')
      },
      setItem: () => {
        throw new Error('gesperrt')
      },
      removeItem: () => {
        throw new Error('gesperrt')
      },
    }
    expect(() => rememberInvite('a1b2c3d4e5f6', broken)).not.toThrow()
    expect(pendingInvite(broken)).toBeNull()
    expect(() => forgetInvite(broken)).not.toThrow()
    expect(pendingInvite(null)).toBeNull()
  })

  it('liest den Token aus Links und nacktem Text', () => {
    expect(parseInviteToken('https://brandbench.vercel.app/einladung/a1b2c3d4e5f6a7b8?x=1')).toBe(
      'a1b2c3d4e5f6a7b8',
    )
    expect(parseInviteToken('  a1b2c3d4e5f6a7b8  ')).toBe('a1b2c3d4e5f6a7b8')
    expect(parseInviteToken('hallo')).toBeNull()
    expect(parseInviteToken('https://example.org/ohne-token')).toBeNull()
  })

  it('leitet nur auf normalen Seiten weiter', () => {
    expect(shouldResumeInvite('/')).toBe(true)
    expect(shouldResumeInvite('/w/kurs')).toBe(true)
    expect(shouldResumeInvite('/einladung/abc')).toBe(false)
    expect(shouldResumeInvite('/login')).toBe(false)
    expect(shouldResumeInvite('/oauth/consent')).toBe(false)
  })
})
