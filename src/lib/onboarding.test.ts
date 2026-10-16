import { describe, expect, it } from 'vitest'
import { hasSeenTour, isTourRoute, TOUR_META_KEY, TOUR_VERSION } from './onboarding'

describe('Produkttour', () => {
  it('erscheint nur auf passenden Seiten', () => {
    expect(isTourRoute('/')).toBe(true)
    expect(isTourRoute('/w/team')).toBe(true)
    expect(isTourRoute('/b/marke/g/handbuch/start')).toBe(true)
    expect(isTourRoute('/login')).toBe(false)
    expect(isTourRoute('/einladung/abc')).toBe(false)
    expect(isTourRoute('/passwort-neu')).toBe(false)
    expect(isTourRoute('/b/marke/drucken/handbuch')).toBe(false)
  })

  it('merkt sich die gesehene Version im Konto oder im Browser', () => {
    expect(hasSeenTour(undefined, null)).toBe(false)
    expect(hasSeenTour({ full_name: 'Alex' }, null)).toBe(false)
    expect(hasSeenTour({ [TOUR_META_KEY]: TOUR_VERSION }, null)).toBe(true)
    expect(hasSeenTour({}, TOUR_VERSION)).toBe(true)
    expect(hasSeenTour({ [TOUR_META_KEY]: TOUR_VERSION - 1 }, null)).toBe(false)
    expect(hasSeenTour({ [TOUR_META_KEY]: 'ja' }, null)).toBe(false)
  })
})
