import { z } from 'zod'
import { BLOCK_META, BLOCK_TYPES, defaultContent, type BlockType } from '@/lib/blocks/types'
import type { Ctx } from './context'
import { ToolError } from './errors'
import { assertBrandPath } from './files'
import { markdownToHtml, sanitizeRichHtml } from './richtext'

const str = (fallback = '') => z.string().default(fallback)
const bool = (fallback: boolean) => z.boolean().default(fallback)
const id = () => z.string().min(1).default(() => crypto.randomUUID())
const int = (min: number, max: number, fallback: number) => z.number().int().min(min).max(max).default(fallback)

const background = z.enum(['light', 'dark', 'brand', 'checker'])

const imageRef = z
  .object({
    path: z.string().min(1),
    width: z.number().nullable().optional(),
    height: z.number().nullable().optional(),
    assetId: z.string().nullable().optional(),
    mime: z.string().nullable().optional(),
  })
  .strict()
  .nullable()
  .default(null)

/** Inhalts-Schemas aller Bausteine; spiegeln src/lib/blocks/types.ts. Fehlende Felder bekommen Standardwerte. */
export const BLOCK_SCHEMAS = {
  heading: z.object({ text: str('Neuer Abschnitt'), level: int(2, 3, 2), eyebrow: str() }).strict(),
  text: z.object({ html: str(), columns: int(1, 2, 1) }).strict(),
  callout: z
    .object({ tone: z.enum(['info', 'tip', 'warning', 'danger']).default('info'), title: str(), html: str() })
    .strict(),
  quote: z
    .object({ text: str(), source: str(), size: z.enum(['large', 'normal']).default('large') })
    .strict(),
  checklist: z
    .object({ title: str(), items: z.array(z.object({ id: id(), text: str() }).strict()).default([]) })
    .strict(),
  table: z.object({ header: bool(true), rows: z.array(z.array(z.string())).default([['', '']]) }).strict(),
  accordion: z
    .object({ items: z.array(z.object({ id: id(), title: str(), html: str() }).strict()).default([]) })
    .strict(),
  colors: z
    .object({
      paletteIds: z.array(z.string()).default([]),
      layout: z.enum(['cards', 'list', 'strip']).default('cards'),
      values: z
        .object({
          rgb: bool(true),
          hsl: bool(false),
          cmyk: bool(true),
          pantone: bool(true),
          hks: bool(false),
          ral: bool(false),
          ncs: bool(false),
        })
        .strict()
        .default({ rgb: true, hsl: false, cmyk: true, pantone: true, hks: false, ral: false, ncs: false }),
      showContrast: bool(true),
      showScale: bool(false),
    })
    .strict(),
  typography: z
    .object({
      mode: z.enum(['both', 'fonts', 'styles']).default('both'),
      fontIds: z.array(z.string()).default([]),
      styleIds: z.array(z.string()).default([]),
      sampleText: str('Gemeinsam auf dem Platz. Gemeinsam für die Region.'),
    })
    .strict(),
  logos: z
    .object({
      items: z
        .array(
          z
            .object({
              id: id(),
              assetId: z.string().nullable().default(null),
              image: imageRef,
              label: str(),
              description: str(),
              background: background.default('light'),
            })
            .strict(),
        )
        .default([]),
      columns: int(1, 4, 2),
      allowDownload: bool(true),
    })
    .strict(),
  dos_donts: z
    .object({
      items: z
        .array(
          z
            .object({
              id: id(),
              kind: z.enum(['do', 'dont']).default('do'),
              title: str(),
              text: str(),
              image: imageRef,
            })
            .strict(),
        )
        .default([]),
      columns: int(1, 3, 2),
    })
    .strict(),
  cards: z
    .object({
      items: z
        .array(z.object({ id: id(), title: str(), text: str(), image: imageRef, link: str() }).strict())
        .default([]),
      columns: int(2, 4, 3),
      style: z.enum(['plain', 'filled', 'outline']).default('filled'),
      imageRatio: z.enum(['square', 'landscape', 'portrait']).default('landscape'),
    })
    .strict(),
  image: z
    .object({
      image: imageRef,
      alt: str(),
      caption: str(),
      background: z.enum(['light', 'dark', 'brand', 'checker', 'none']).default('none'),
      fit: z.enum(['contain', 'cover']).default('contain'),
      ratio: z.enum(['auto', '1:1', '4:3', '16:9', '3:2']).default('auto'),
      allowDownload: bool(false),
    })
    .strict(),
  gallery: z
    .object({
      items: z.array(z.object({ id: id(), image: imageRef, caption: str() }).strict()).default([]),
      columns: int(2, 4, 3),
      ratio: z.enum(['1:1', '4:3', '16:9', '3:4']).default('4:3'),
    })
    .strict(),
  video: z.object({ url: str(), file: imageRef, caption: str() }).strict(),
  audio: z.object({ file: imageRef, title: str(), caption: str() }).strict(),
  embed: z.object({ url: str(), height: z.number().int().min(120).max(2000).default(480), caption: str() }).strict(),
  assets: z
    .object({
      title: str('Downloads'),
      description: str(),
      assetIds: z.array(z.string()).default([]),
      columns: int(2, 5, 4),
      showDownloadAll: bool(true),
      background: background.default('light'),
    })
    .strict(),
  divider: z
    .object({ style: z.enum(['line', 'space']).default('line'), size: z.enum(['s', 'm', 'l']).default('m') })
    .strict(),
  note: z.object({ html: str() }).strict(),
  code: z.object({ language: str('html'), code: str() }).strict(),
  download_kit: z
    .object({
      title: str('Farben & Schriften für Designer:innen und Entwickler:innen'),
      description: str(),
      formats: z
        .array(z.enum(['css', 'scss', 'json', 'tailwind', 'ase']))
        .default(['css', 'scss', 'json', 'tailwind', 'ase']),
    })
    .strict(),
} satisfies Record<BlockType, z.ZodType>

export const WIDTHS = ['full', 'two_thirds', 'half', 'third', 'quarter'] as const

export const BLOCK_NOTES: Partial<Record<BlockType, string>> = {
  text: 'Statt html darf "markdown" angegeben werden (wird in sauberes HTML umgewandelt).',
  callout: 'Statt html darf "markdown" angegeben werden.',
  note: 'Statt html darf "markdown" angegeben werden. Nur im Bearbeitungsmodus sichtbar.',
  accordion: 'Items: { title, markdown | html }.',
  image: 'image: { "assetId": "<Asset-ID>" } oder nur die Asset-ID als Text – Pfad, Maße und Typ werden ergänzt.',
  gallery: 'items[].image: { "assetId": "<Asset-ID>" } oder die Asset-ID als Text.',
  logos: 'items[]: { assetId, label, description, background } – das Bild wird aus dem Asset ergänzt.',
  cards: 'items[].image: { "assetId": "<Asset-ID>" } oder die Asset-ID als Text.',
  dos_donts: 'items[].image: { "assetId": "<Asset-ID>" } oder die Asset-ID als Text.',
  video: 'url: YouTube/Vimeo-Link oder file: { "assetId": ... } für eine hochgeladene Videodatei.',
  audio: 'file: { "assetId": ... }.',
  assets: 'assetIds: IDs von Assets dieser Marke.',
  colors: 'paletteIds leer = alle Paletten der Marke.',
  typography: 'fontIds/styleIds leer = alle.',
  embed: 'url: Figma, Canva, Miro, Google Slides/Docs, Spotify, SoundCloud, YouTube, Vimeo oder andere https-Adresse.',
}

export function describeBlockType(type: BlockType): {
  type: BlockType
  label: string
  description: string
  category: string
  notes: string | null
  default_content: unknown
  json_schema: unknown
} {
  const meta = BLOCK_META[type]
  return {
    type,
    label: meta.label,
    description: meta.description,
    category: meta.category,
    notes: BLOCK_NOTES[type] ?? null,
    default_content: defaultContent(type),
    json_schema: z.toJSONSchema(BLOCK_SCHEMAS[type], { io: 'input' }),
  }
}

// ---------------------------------------------------------------------
// Eingaben aufbereiten (Alias-Namen, Markdown, Asset-Verweise, IDs)
// ---------------------------------------------------------------------
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function camel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase())
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** snake_case-Schlüssel → camelCase (die Bausteine verwenden camelCase). */
function camelizeKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelizeKeys)
  if (!isRecord(value)) return value
  const out: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) out[camel(key)] = camelizeKeys(child)
  return out
}

/** markdown → html (und html bereinigen) in den Feldern, die Rich Text enthalten. */
function prepareRichText(type: BlockType, content: Record<string, unknown>): void {
  const convert = (node: Record<string, unknown>) => {
    if (typeof node.markdown === 'string') {
      node.html = markdownToHtml(node.markdown)
      delete node.markdown
    } else if (typeof node.html === 'string') {
      node.html = sanitizeRichHtml(node.html)
    }
  }
  if (type === 'text' || type === 'callout' || type === 'note') convert(content)
  if (type === 'accordion' && Array.isArray(content.items)) {
    for (const item of content.items) if (isRecord(item)) convert(item)
  }
}

type AssetRow = {
  id: string
  file_path: string
  mime_type: string
  width: number | null
  height: number | null
}

function collectAssetIds(type: BlockType, content: Record<string, unknown>): string[] {
  const ids = new Set<string>()
  const visit = (value: unknown, key?: string) => {
    if (Array.isArray(value)) return value.forEach((v) => visit(v, key))
    if (typeof value === 'string' && (key === 'image' || key === 'file') && UUID.test(value)) ids.add(value)
    if (!isRecord(value)) return
    if (typeof value.assetId === 'string' && UUID.test(value.assetId)) ids.add(value.assetId)
    for (const [k, child] of Object.entries(value)) {
      if (k === 'assetIds' && Array.isArray(child)) {
        for (const v of child) if (typeof v === 'string') ids.add(v)
      } else {
        visit(child, k)
      }
    }
  }
  visit(content)
  if (type === 'assets' && Array.isArray(content.assetIds)) {
    for (const v of content.assetIds) if (typeof v === 'string') ids.add(v)
  }
  return [...ids]
}

function refFromAsset(asset: AssetRow) {
  return {
    path: asset.file_path,
    width: asset.width,
    height: asset.height,
    assetId: asset.id,
    mime: asset.mime_type,
  }
}

function fillAssetRefs(value: unknown, assets: Map<string, AssetRow>, parentKey?: string): unknown {
  if (Array.isArray(value)) return value.map((v) => fillAssetRefs(v, assets, parentKey))
  if (typeof value === 'string' && (parentKey === 'image' || parentKey === 'file') && UUID.test(value)) {
    const asset = assets.get(value.toLowerCase())
    return asset ? refFromAsset(asset) : value
  }
  if (!isRecord(value)) return value
  const out: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) out[key] = fillAssetRefs(child, assets, key)
  // Bild-Objekt nur mit assetId → Pfad usw. ergänzen
  if ((parentKey === 'image' || parentKey === 'file') && typeof out.assetId === 'string' && !out.path) {
    const asset = assets.get(out.assetId.toLowerCase())
    if (asset) return refFromAsset(asset)
  }
  // Logos: Bild aus dem verknüpften Asset
  if (typeof out.assetId === 'string' && 'label' in out && (out.image === undefined || out.image === null)) {
    const asset = assets.get(out.assetId.toLowerCase())
    if (asset) out.image = refFromAsset(asset)
  }
  return out
}

function checkForeignPaths(value: unknown, brandId: string): void {
  if (Array.isArray(value)) return value.forEach((v) => checkForeignPaths(v, brandId))
  if (!isRecord(value)) return
  if (typeof value.path === 'string') assertBrandPath(value.path, brandId)
  Object.values(value).forEach((v) => checkForeignPaths(v, brandId))
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join('.') || '(Inhalt)'}: ${issue.message}`)
    .join('; ')
}

async function assertIdsBelongToBrand(
  ctx: Ctx,
  brandId: string,
  table: 'color_palettes' | 'fonts' | 'text_styles' | 'assets',
  ids: string[],
  label: string,
): Promise<void> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return
  if (unique.some((value) => !UUID.test(value))) throw new ToolError(`${label}: ungültige ID.`)
  const { data, error } = await ctx.sb.from(table).select('id').eq('brand_id', brandId).in('id', unique)
  if (error) throw error
  const found = new Set((data ?? []).map((row) => row.id))
  const missing = unique.filter((value) => !found.has(value))
  if (missing.length > 0) {
    throw new ToolError(`${label}: nicht in dieser Marke gefunden (${missing.slice(0, 3).join(', ')}).`)
  }
}

/** Prüft und ergänzt den Inhalt eines Bausteins; wirft eine verständliche Fehlermeldung bei Problemen. */
export async function normalizeBlockContent(
  ctx: Ctx,
  brandId: string,
  type: BlockType,
  input: unknown,
): Promise<Record<string, unknown>> {
  if (!(BLOCK_TYPES as readonly string[]).includes(type)) {
    throw new ToolError(`Unbekannter Bausteintyp „${type}“.`, `Möglich: ${BLOCK_TYPES.join(', ')}.`)
  }
  if (input !== undefined && !isRecord(input)) throw new ToolError('content muss ein Objekt sein.')
  const content = camelizeKeys(input ?? {}) as Record<string, unknown>
  prepareRichText(type, content)

  const assetIds = collectAssetIds(type, content).filter((value) => UUID.test(value))
  const assets = new Map<string, AssetRow>()
  if (assetIds.length > 0) {
    const { data, error } = await ctx.sb
      .from('assets')
      .select('id, file_path, mime_type, width, height')
      .eq('brand_id', brandId)
      .in('id', assetIds)
    if (error) throw error
    for (const row of data ?? []) assets.set(row.id.toLowerCase(), row)
    const missing = assetIds.filter((value) => !assets.has(value.toLowerCase()))
    if (missing.length > 0) {
      throw new ToolError(`Asset nicht in dieser Marke gefunden: ${missing.slice(0, 3).join(', ')}.`, 'IDs bekommst du mit list_assets.')
    }
  }
  const filled = fillAssetRefs(content, assets)
  checkForeignPaths(filled, brandId)

  const parsed = BLOCK_SCHEMAS[type].safeParse(filled)
  if (!parsed.success) {
    throw new ToolError(
      `Ungültiger Inhalt für Baustein „${type}“: ${formatIssues(parsed.error)}.`,
      'Rufe get_block_schema auf, um Felder und Beispiel zu sehen.',
    )
  }
  const result = parsed.data as Record<string, unknown>

  if (type === 'colors') {
    await assertIdsBelongToBrand(ctx, brandId, 'color_palettes', result.paletteIds as string[], 'paletteIds')
  }
  if (type === 'typography') {
    await assertIdsBelongToBrand(ctx, brandId, 'fonts', result.fontIds as string[], 'fontIds')
    await assertIdsBelongToBrand(ctx, brandId, 'text_styles', result.styleIds as string[], 'styleIds')
  }
  if (type === 'assets') {
    await assertIdsBelongToBrand(ctx, brandId, 'assets', result.assetIds as string[], 'assetIds')
  }
  return result
}
