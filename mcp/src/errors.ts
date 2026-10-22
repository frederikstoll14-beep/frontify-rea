import { errorMessage } from '@/lib/utils'

/** Fehler mit einer Meldung, die direkt an die Person bzw. das Modell gehen darf. */
export class ToolError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message)
    this.name = 'ToolError'
  }
}

interface SupabaseLikeError {
  message?: string
  code?: string
  details?: string | null
  hint?: string | null
  status?: number
  statusCode?: string | number
}

const PGRST_NOT_FOUND = 'PGRST116'

/** Übersetzt Fehler von Supabase (Datenbank, Storage, Auth) in verständliche Meldungen. */
export function describeError(error: unknown): string {
  if (error instanceof ToolError) return error.hint ? `${error.message} ${error.hint}` : error.message
  if (error && typeof error === 'object') {
    const e = error as SupabaseLikeError
    if (e.code === PGRST_NOT_FOUND) return 'Nicht gefunden – oder dir fehlt dafür die Berechtigung.'
    if (e.code === '23505') return `Das gibt es schon (${e.details ?? e.message ?? 'Eintrag doppelt'}).`
    if (e.code === '23503') return 'Das hängt noch mit anderen Einträgen zusammen oder verweist auf etwas, das es nicht gibt.'
    if (e.code === '23514') return `Ungültiger Wert: ${e.details ?? e.message ?? ''}`.trim()
    if (e.code === '22P02') return 'Ungültige ID oder ungültiger Wert.'
    if (e.code === '42501') return 'Dafür fehlen dir die Rechte (oder die Verbindung ist auf „nur lesen“ beschränkt).'
    if (e.code === 'P0001' && e.message) return e.message
  }
  return errorMessage(error)
}

export function notAllowed(what: string): ToolError {
  return new ToolError(`${what} ist nicht möglich: Dafür fehlen dir die Rechte.`)
}
