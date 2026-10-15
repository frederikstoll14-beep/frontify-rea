/** Registry für ausstehende Autosaves, damit Moduswechsel und Navigation vorher speichern können. */
type Flusher = () => Promise<void>

const flushers = new Set<Flusher>()

export function registerFlusher(flush: Flusher): () => void {
  flushers.add(flush)
  return () => {
    flushers.delete(flush)
  }
}

export async function flushPendingSaves(): Promise<void> {
  await Promise.all([...flushers].map((flush) => flush()))
}
