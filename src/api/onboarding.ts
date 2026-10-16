import { supabase } from '@/lib/supabase'
import { TOUR_META_KEY, TOUR_VERSION } from '@/lib/onboarding'

const localKey = (userId: string) => `brandbench:tour:${userId}`

export function readLocalTourVersion(userId: string): number | null {
  try {
    const value = Number(localStorage.getItem(localKey(userId)))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

/** Speichert im Konto (geräteübergreifend) und im Browser, dass die Tour gesehen wurde. */
export async function markTourSeen(userId: string): Promise<void> {
  try {
    localStorage.setItem(localKey(userId), String(TOUR_VERSION))
  } catch {
    // ignorieren
  }
  await supabase.auth.updateUser({ data: { [TOUR_META_KEY]: TOUR_VERSION } })
}
