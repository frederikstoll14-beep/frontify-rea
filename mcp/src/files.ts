import { z } from 'zod'
import type { Ctx, ScopeBrand } from './context'
import { ToolError } from './errors'
import { createThumbnail, isImage, readDimensions, type ImageDims } from './images'
import { extensionOf, guessMime, safeFileName } from './mime'
import { fetchPublicFile } from './safe-fetch'

/** Obergrenze pro Datei (entspricht dem Limit des Supabase-Speichers). */
export const MAX_FILE_BYTES = 50 * 1024 * 1024

/** Gemeinsame Eingabefelder für alles, was eine Datei annimmt. */
export const fileSourceShape = {
  file_name: z.string().min(1).max(200).describe('Dateiname mit Endung, z. B. "logo-dunkel.svg"'),
  text: z
    .string()
    .optional()
    .describe(
      'Dateiinhalt als Text (ideal für SVG, CSS, JSON, Markdown). Genau eine Quelle angeben: text, content_base64, url oder upload_path.',
    ),
  content_base64: z
    .string()
    .optional()
    .describe(
      'Dateiinhalt base64-kodiert, nur für kleine Dateien (bis ca. 3 MB). Größere Dateien: url oder create_upload_url.',
    ),
  url: z
    .string()
    .optional()
    .describe('Öffentliche https-Adresse, von der die Datei geladen wird (bis 50 MB).'),
  upload_path: z
    .string()
    .optional()
    .describe('Pfad einer bereits hochgeladenen Datei aus create_upload_url (für große Dateien).'),
  mime_type: z.string().optional().describe('Dateityp, falls er sich nicht aus der Endung ergibt.'),
}

/** Kurzfassung der Quellen-Felder für Tools, die nur eine Datei entgegennehmen (spart Platz in der Tool-Liste). */
export const fileSourceShapeShort = {
  file_name: z.string().min(1).max(200).describe('Dateiname mit Endung'),
  text: z.string().optional().describe('Quelle (genau eine): Dateiinhalt als Text, z. B. SVG'),
  content_base64: z.string().optional().describe('Quelle: base64, bis ca. 3 MB'),
  url: z.string().optional().describe('Quelle: öffentliche https-Adresse'),
  upload_path: z.string().optional().describe('Quelle: Pfad aus create_upload_url'),
  mime_type: z.string().optional(),
}

/** Wie fileSourceShape, aber der Dateiname ist optional (für Tools, die alternativ eine vorhandene Datei verwenden). */
export const optionalFileSourceShape = {
  ...fileSourceShapeShort,
  file_name: fileSourceShapeShort.file_name.optional(),
}

export interface FileSourceInput {
  file_name: string
  text?: string
  content_base64?: string
  url?: string
  upload_path?: string
  mime_type?: string
}

export interface ResolvedFile {
  /** Bytes, die noch hochgeladen werden müssen; null, wenn die Datei schon im Speicher liegt. */
  bytes: Buffer | null
  /** Pfad der schon hochgeladenen Datei (bei upload_path). */
  existingPath: string | null
  fileName: string
  mime: string
  size: number
}

function decodeBase64(input: string): Buffer {
  const raw = input.replace(/^data:[^,]*;base64,/, '').replace(/\s+/g, '')
  if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(raw)) throw new ToolError('content_base64 ist kein gültiges Base64.')
  return Buffer.from(raw, 'base64')
}

export function assertBrandPath(path: string, brandId: string): void {
  if (!path.startsWith(`${brandId}/`) || path.includes('..') || path.includes('//')) {
    throw new ToolError('Der Pfad gehört nicht zu dieser Marke.')
  }
}

export async function resolveFile(
  ctx: Ctx,
  brand: ScopeBrand,
  input: FileSourceInput,
): Promise<ResolvedFile> {
  const sources = [input.text, input.content_base64, input.url, input.upload_path].filter(
    (v) => v !== undefined,
  )
  if (sources.length !== 1) {
    throw new ToolError('Bitte genau eine Quelle angeben: text, content_base64, url oder upload_path.')
  }
  const fileName = safeFileName(input.file_name)
  const byExtension = guessMime(fileName)

  if (input.upload_path !== undefined) {
    assertBrandPath(input.upload_path, brand.id)
    const { data, error } = await ctx.storage.info(input.upload_path)
    if (error || !data) {
      throw new ToolError(
        'Die Datei wurde noch nicht hochgeladen.',
        'Lade sie zuerst mit der Upload-Adresse aus create_upload_url hoch (HTTP PUT) und rufe das Tool dann erneut auf.',
      )
    }
    const size = Number((data as { size?: number }).size ?? 0)
    const contentType = String((data as { contentType?: string }).contentType ?? '')
    return {
      bytes: null,
      existingPath: input.upload_path,
      fileName,
      mime:
        input.mime_type ||
        (contentType && contentType !== 'application/octet-stream' ? contentType : byExtension),
      size,
    }
  }

  let bytes: Buffer
  let detected = ''
  if (input.text !== undefined) {
    bytes = Buffer.from(input.text, 'utf8')
  } else if (input.content_base64 !== undefined) {
    bytes = decodeBase64(input.content_base64)
  } else {
    const fetched = await fetchPublicFile(input.url!, {
      maxBytes: MAX_FILE_BYTES,
      allowPrivate: ctx.config.allowPrivateUrls,
    })
    bytes = fetched.bytes
    detected = fetched.contentType
  }
  if (bytes.length === 0) throw new ToolError('Die Datei ist leer.')
  if (bytes.length > MAX_FILE_BYTES) throw new ToolError('Die Datei ist größer als 50 MB.')
  const mime =
    input.mime_type ||
    (byExtension !== 'application/octet-stream' ? byExtension : '') ||
    (detected && detected !== 'application/octet-stream' ? detected : '') ||
    'application/octet-stream'
  return { bytes, existingPath: null, fileName, mime, size: bytes.length }
}

export function buildStoragePath(brandId: string, folder: string, fileName: string): string {
  const ext = extensionOf(fileName)
  return `${brandId}/${folder}/${crypto.randomUUID()}${ext ? `.${ext}` : ''}`
}

export interface StoredFile {
  path: string
  thumbPath: string | null
  fileName: string
  mime: string
  ext: string
  size: number
  width: number | null
  height: number | null
}

/** Legt die Datei im Marken-Ordner ab (inkl. Vorschaubild) und liefert die Daten für die Datenbank. */
export async function storeFile(
  ctx: Ctx,
  brand: ScopeBrand,
  file: ResolvedFile,
  folder: string,
): Promise<StoredFile> {
  let bytes = file.bytes
  let path = file.existingPath
  if (bytes) {
    path = buildStoragePath(brand.id, folder, file.fileName)
    const { error } = await ctx.storage.upload(path, bytes, {
      contentType: file.mime,
      upsert: false,
      cacheControl: '3600',
    })
    if (error) throw error
  } else if (path && isImage(file.mime) && file.size <= 25 * 1024 * 1024) {
    // Bei großen Direkt-Uploads Maße und Vorschaubild nachträglich bestimmen
    const { data } = await ctx.storage.download(path)
    if (data) bytes = Buffer.from(await data.arrayBuffer())
  }
  let dims: ImageDims | null = null
  let thumbPath: string | null = null
  if (bytes) {
    dims = readDimensions(bytes, file.mime)
    const thumb = await createThumbnail(bytes, file.mime, dims)
    if (thumb) {
      const candidate = buildStoragePath(brand.id, 'thumbs', 'thumb.webp')
      const { error } = await ctx.storage.upload(candidate, thumb, {
        contentType: 'image/webp',
        upsert: false,
      })
      if (!error) thumbPath = candidate
    }
  }
  return {
    path: path!,
    thumbPath,
    fileName: file.fileName,
    mime: file.mime,
    ext: extensionOf(file.fileName),
    size: file.size,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
  }
}

/** Räumt hochgeladene Dateien wieder auf, wenn danach etwas schiefging. */
export async function discardStored(ctx: Ctx, stored: Pick<StoredFile, 'path' | 'thumbPath'>): Promise<void> {
  const paths = [stored.path, stored.thumbPath].filter((p): p is string => Boolean(p))
  if (paths.length > 0) await ctx.storage.remove(paths).catch(() => undefined)
}

export async function removePaths(ctx: Ctx, paths: Array<string | null | undefined>): Promise<void> {
  const list = [...new Set(paths.filter((p): p is string => Boolean(p)))]
  for (let i = 0; i < list.length; i += 100) {
    await ctx.storage.remove(list.slice(i, i + 100)).catch(() => undefined)
  }
}

export async function signedUrl(
  ctx: Ctx,
  path: string,
  seconds = 3600,
  download?: string | boolean,
): Promise<string | null> {
  const { data } = await ctx.storage.createSignedUrl(path, seconds, download ? { download } : undefined)
  return data?.signedUrl ?? null
}

export async function signedUrls(ctx: Ctx, paths: string[], seconds = 3600): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const unique = [...new Set(paths.filter(Boolean))]
  for (let i = 0; i < unique.length; i += 100) {
    const { data } = await ctx.storage.createSignedUrls(unique.slice(i, i + 100), seconds)
    for (const entry of data ?? []) if (entry.path && entry.signedUrl) result.set(entry.path, entry.signedUrl)
  }
  return result
}

export async function downloadBytes(ctx: Ctx, path: string): Promise<Buffer> {
  const { data, error } = await ctx.storage.download(path)
  if (error || !data) throw new ToolError('Die Datei konnte nicht geladen werden.', error?.message)
  return Buffer.from(await data.arrayBuffer())
}
