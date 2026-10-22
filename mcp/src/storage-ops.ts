import type { Ctx, ScopeBrand } from './context'
import { buildStoragePath, signedUrl } from './files'
import { extensionOf } from './mime'

/** Löscht alle Dateien einer Marke (Ordner = brand_id) im Speicher. */
export async function removeBrandFiles(ctx: Ctx, prefix: string): Promise<void> {
  for (let guard = 0; guard < 200; guard++) {
    const { data, error } = await ctx.storage.list(prefix, { limit: 1000 })
    if (error || !data || data.length === 0) return
    const files: string[] = []
    for (const entry of data) {
      const path = `${prefix}/${entry.name}`
      if (entry.id === null) await removeBrandFiles(ctx, path)
      else files.push(path)
    }
    if (files.length === 0) return
    const { error: removeError } = await ctx.storage.remove(files)
    if (removeError) return
  }
}

const EXPORT_TTL_MS = 24 * 60 * 60 * 1000

/** Entfernt alte Export-Dateien (älter als 24 Stunden) aus dem Export-Ordner der Marke. */
async function cleanupExports(ctx: Ctx, brandId: string): Promise<void> {
  const folder = `${brandId}/exports`
  const { data } = await ctx.storage.list(folder, { limit: 100, sortBy: { column: 'created_at', order: 'asc' } })
  const old = (data ?? [])
    .filter((entry) => entry.id !== null && entry.created_at && Date.now() - Date.parse(entry.created_at) > EXPORT_TTL_MS)
    .map((entry) => `${folder}/${entry.name}`)
  if (old.length > 0) await ctx.storage.remove(old).catch(() => undefined)
}

export interface PublishedExport {
  path: string
  url: string
  expiresInMinutes: number
}

/**
 * Legt eine erzeugte Datei (ZIP, Export …) für eine Stunde per Download-Link bereit.
 * Braucht Schreibrechte in der Marke; sonst null (dann inline ausliefern).
 */
export async function publishExport(
  ctx: Ctx,
  brand: ScopeBrand,
  fileName: string,
  bytes: Buffer,
  mime: string,
): Promise<PublishedExport | null> {
  if (brand.role === 'viewer') return null
  const ext = extensionOf(fileName)
  const path = buildStoragePath(brand.id, 'exports', `export${ext ? `.${ext}` : ''}`)
  const { error } = await ctx.storage.upload(path, bytes, { contentType: mime, upsert: false })
  if (error) return null
  void cleanupExports(ctx, brand.id)
  const url = await signedUrl(ctx, path, 3600, fileName)
  return url ? { path, url, expiresInMinutes: 60 } : null
}
