import { ToolError } from './errors'

interface Result<T> {
  data: T
  error: { message: string; code?: string } | null
}

/** Liefert die Zeilen oder wirft den Datenbankfehler. */
export function rows<T>(result: Result<T[] | null>): T[] {
  if (result.error) throw result.error
  return result.data ?? []
}

export function row<T>(result: Result<T>): NonNullable<T> {
  if (result.error) throw result.error
  if (result.data === null || result.data === undefined) throw new ToolError('Nicht gefunden oder keine Berechtigung.')
  return result.data as NonNullable<T>
}

export function maybeRow<T>(result: Result<T>): NonNullable<T> | null {
  if (result.error) throw result.error
  return (result.data ?? null) as NonNullable<T> | null
}

/** Für update/delete mit .select(): Wenn keine Zeile betroffen war, fehlte das Recht oder es gibt den Eintrag nicht. */
export function affected<T>(result: Result<T[] | null>, what = 'Eintrag'): T[] {
  const data = rows(result)
  if (data.length === 0) {
    throw new ToolError(`${what} nicht gefunden – oder dir fehlt dafür die Berechtigung.`)
  }
  return data
}

export function page(limit: number | undefined, offset: number | undefined, max = 200, fallback = 50) {
  const size = Math.min(Math.max(limit ?? fallback, 1), max)
  const from = Math.max(offset ?? 0, 0)
  return { size, from, to: from + size - 1 }
}

/** Entfernt undefined-Felder (damit PATCH-Anfragen nur geänderte Werte enthalten). */
export function defined<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>
}

export function requireChange(patch: Record<string, unknown>): void {
  if (Object.keys(patch).length === 0) throw new ToolError('Es wurde nichts zum Ändern angegeben.')
}

/** Eindeutige Kurz-URL innerhalb einer Liste bestehender Werte. */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  let slug = base
  let i = 2
  while (used.has(slug)) slug = `${base}-${i++}`
  return slug
}
