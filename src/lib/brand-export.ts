import type { BlockType, BlockWidth } from '@/lib/blocks/types'
import type {
  BrandHome,
  BrandTemplateData,
  BrandTheme,
  TemplateBlock,
  TemplateChapter,
  TemplateGuideline,
  TemplatePage,
} from '@/lib/templates/types'

export const EXPORT_FORMAT = 'markenkompass-brand'
export const EXPORT_VERSION = 1

export interface BrandExportFile {
  format: typeof EXPORT_FORMAT
  version: number
  exportedAt: string
  source: { brandId: string; name: string; slug: string }
  data: BrandTemplateData
}

export interface ExportInput {
  brand: { id: string; name: string; slug: string; theme: BrandTheme; home: BrandHome }
  palettes: Array<{
    name: string
    description: string
    colors: Array<{
      name: string
      hex: string
      token: string
      cmyk: string
      pantone: string
      hks: string
      ral: string
      ncs: string
      usage: string
      description: string
    }>
  }>
  fonts: Array<{ family: string; source: string; role: string; weights: number[]; fallback: string; license: string; description: string }>
  textStyles: Array<{
    name: string
    token: string
    font_family: string
    font_weight: number
    font_size: number
    line_height: number
    letter_spacing: number
    text_transform: string
    italic: boolean
    sample: string
    usage: string
  }>
  libraries: Array<{ name: string; kind: string; slug: string; description: string }>
  guidelines: Array<{ id: string; title: string; slug: string; description: string; icon: string }>
  pages: Array<{
    id: string
    guideline_id: string
    parent_id: string | null
    kind: 'chapter' | 'page'
    title: string
    slug: string
    intro: string
    sort: number
  }>
  blocks: Array<{ page_id: string; type: string; width: string; sort: number; content: unknown }>
}

/** Baut aus dem aktuellen Stand einer Marke eine Datei, die sich als Vorlage wieder einspielen lässt. */
export function buildBrandExport(input: ExportInput): BrandExportFile {
  const blocksOf = (pageId: string): TemplateBlock[] =>
    input.blocks
      .filter((b) => b.page_id === pageId)
      .sort((a, b) => a.sort - b.sort)
      .map((b) => ({ type: b.type as BlockType, width: b.width as BlockWidth, content: b.content as never }))

  const toPage = (p: ExportInput['pages'][number]): TemplatePage => ({
    title: p.title,
    slug: p.slug,
    intro: p.intro,
    blocks: blocksOf(p.id),
  })

  const guidelines: TemplateGuideline[] = input.guidelines.map((g) => {
    const top = input.pages.filter((p) => p.guideline_id === g.id && p.parent_id === null).sort((a, b) => a.sort - b.sort)
    const items: Array<TemplateChapter | TemplatePage> = top.map((item) =>
      item.kind === 'chapter'
        ? {
            kind: 'chapter' as const,
            title: item.title,
            pages: input.pages
              .filter((p) => p.parent_id === item.id)
              .sort((a, b) => a.sort - b.sort)
              .map(toPage),
          }
        : toPage(item),
    )
    return { title: g.title, slug: g.slug, description: g.description, icon: g.icon, items }
  })

  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    source: { brandId: input.brand.id, name: input.brand.name, slug: input.brand.slug },
    data: {
      theme: input.brand.theme,
      home: input.brand.home,
      palettes: input.palettes.map((p) => ({
        name: p.name,
        description: p.description,
        colors: p.colors.map((c) => ({
          name: c.name,
          hex: c.hex,
          token: c.token || undefined,
          cmyk: c.cmyk,
          pantone: c.pantone,
          hks: c.hks,
          ral: c.ral,
          ncs: c.ncs,
          usage: c.usage,
          description: c.description,
        })),
      })),
      // Eigene Schriftdateien werden nicht exportiert (Lizenz!) → als Systemschrift
      fonts: input.fonts.map((f) => ({
        family: f.family,
        source: f.source === 'google' ? 'google' : 'system',
        role: f.role,
        weights: f.weights,
        fallback: f.fallback,
        license: f.license,
        description: f.description,
      })),
      textStyles: input.textStyles.map((s) => ({
        name: s.name,
        token: s.token || undefined,
        fontFamily: s.font_family,
        fontWeight: s.font_weight,
        fontSize: Number(s.font_size),
        lineHeight: Number(s.line_height),
        letterSpacing: Number(s.letter_spacing),
        textTransform: s.text_transform as 'none',
        italic: s.italic,
        sample: s.sample,
        usage: s.usage,
      })),
      libraries: input.libraries.map((l) => ({
        name: l.name,
        kind: l.kind as 'media',
        slug: l.slug,
        description: l.description,
      })),
      guidelines,
    },
  }
}

export function parseBrandExport(text: string): BrandExportFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Die Datei ist kein gültiges JSON.')
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('Unbekanntes Dateiformat.')
  const file = parsed as Partial<BrandExportFile>
  if (file.format !== EXPORT_FORMAT || !file.data || typeof file.data !== 'object') {
    throw new Error('Das ist keine Markenkompass-Exportdatei.')
  }
  if ((file.version ?? 0) > EXPORT_VERSION) throw new Error('Die Datei stammt aus einer neueren Version.')
  return file as BrandExportFile
}

/**
 * Entfernt Verweise auf Dateien und Assets, die zu einer anderen Marke gehören
 * (deren Speicherordner wäre für Mitglieder der Zielmarke nicht lesbar).
 */
export function stripForeignReferences<T>(value: T, targetBrandId: string): T {
  const visit = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(visit)
    if (!node || typeof node !== 'object') return node
    const record = node as Record<string, unknown>
    if (typeof record.path === 'string' && !record.path.startsWith(`${targetBrandId}/`)) return null
    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(record)) {
      if (key === 'assetIds' && Array.isArray(child)) out[key] = []
      else if (key === 'assetId') out[key] = null
      else if (key === 'paletteIds' || key === 'fontIds' || key === 'styleIds') out[key] = []
      else out[key] = visit(child)
    }
    return out
  }
  return visit(value) as T
}
