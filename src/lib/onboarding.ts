/**
 * Produkttour: Steigt die Version, sehen alle Nutzer:innen die Tour beim nächsten Login erneut
 * (z. B. nach größeren neuen Funktionen).
 */
export const TOUR_VERSION = 1
export const TOUR_META_KEY = 'tour_seen_version'

/** Seiten, auf denen die Tour nicht von selbst aufgeht (Anmeldung, Einladung, Druckansicht). */
const QUIET_ROUTES = [
  /^\/login/,
  /^\/registrieren/,
  /^\/passwort-/,
  /^\/einladung\//,
  /^\/b\/[^/]+\/drucken\//,
]

export function isTourRoute(pathname: string): boolean {
  return !QUIET_ROUTES.some((pattern) => pattern.test(pathname))
}

/** Gesehen, wenn Konto-Metadaten oder (als Rückfall) der Browser die aktuelle Version kennen. */
export function hasSeenTour(
  metadata: Record<string, unknown> | undefined,
  localVersion: number | null,
): boolean {
  const remote = metadata?.[TOUR_META_KEY]
  const seen = Math.max(typeof remote === 'number' ? remote : 0, localVersion ?? 0)
  return seen >= TOUR_VERSION
}
