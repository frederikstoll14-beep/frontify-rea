import { z } from 'zod'
import { BLOCK_META, BLOCK_TYPES, type BlockType } from '@/lib/blocks/types'
import { slugify, stripHtml } from '@/lib/utils'
import { BLOCK_NOTES, WIDTHS, describeBlockType, normalizeBlockContent } from '../blocks'
import { matchByRef, type Ctx, type ScopeBrand } from '../context'
import { affected, defined, requireChange, row, rows, uniqueSlug } from '../db'
import { ToolError } from '../errors'
import { signedUrls } from '../files'
import { resolveGuideline, resolvePage, type GuidelinePage } from '../resolve'
import { defineTool } from '../tool'

const blockType = z.enum(BLOCK_TYPES as unknown as [BlockType, ...BlockType[]])
const width = z.enum(WIDTHS)

const blockInput = z.object({
  type: blockType,
  width: width.optional(),
  content: z.record(z.string(), z.unknown()).optional().describe('Inhalt je nach Typ – siehe get_block_schema'),
})

type BlockRow = { id: string; type: string; width: string; sort: number; content: unknown }

function textOf(value: unknown): string {
  return typeof value === 'string' ? stripHtml(value) : ''
}

/** Kurzbeschreibung eines Bausteins für Übersichten. */
function outline(block: BlockRow): string {
  const c = (block.content ?? {}) as Record<string, unknown>
  const label = BLOCK_META[block.type as BlockType]?.label ?? block.type
  const first = (...values: unknown[]) => values.map(textOf).find((v) => v.length > 0) ?? ''
  let detail = ''
  switch (block.type) {
    case 'heading':
      detail = first(c.text)
      break
    case 'text':
    case 'note':
      detail = first(c.html)
      break
    case 'callout':
      detail = first(c.title, c.html)
      break
    case 'quote':
      detail = first(c.text)
      break
    case 'checklist':
    case 'accordion':
    case 'cards':
    case 'gallery':
    case 'logos':
    case 'dos_donts':
      detail = `${Array.isArray(c.items) ? c.items.length : 0} Einträge${c.title ? `, ${textOf(c.title)}` : ''}`
      break
    case 'table':
      detail = `${Array.isArray(c.rows) ? c.rows.length : 0} Zeilen`
      break
    case 'image':
      detail = first(c.caption, c.alt) || 'Bild'
      break
    case 'assets':
      detail = `${Array.isArray(c.assetIds) ? c.assetIds.length : 0} Dateien`
      break
    case 'embed':
    case 'video':
      detail = first(c.url)
      break
    default:
      detail = ''
  }
  return `${label}${detail ? `: ${detail.slice(0, 120)}` : ''}`
}

async function loadBlock(ctx: Ctx, blockId: string) {
  const found = await ctx.sb.from('blocks').select('*').eq('id', blockId).maybeSingle()
  if (found.error) throw found.error
  if (!found.data) throw new ToolError('Baustein nicht gefunden – oder nicht freigegeben.')
  const brand = await ctx.brandById(found.data.brand_id)
  return { block: found.data, brand }
}

async function snapshotPage(ctx: Ctx, page: GuidelinePage, label: string): Promise<void> {
  const blocks = rows(await ctx.sb.from('blocks').select('type, width, sort, content').eq('page_id', page.id).order('sort'))
  row(
    await ctx.sb
      .from('page_revisions')
      .insert({
        page_id: page.id,
        brand_id: page.brand_id,
        label,
        snapshot: { title: page.title, intro: page.intro, blocks } as never,
      })
      .select('id')
      .single(),
  )
}

async function insertBlocks(
  ctx: Ctx,
  brand: ScopeBrand,
  pageId: string,
  blocks: Array<z.infer<typeof blockInput>>,
  startSort: number,
) {
  const prepared = []
  for (const [index, block] of blocks.entries()) {
    const content = await normalizeBlockContent(ctx, brand.id, block.type, block.content)
    prepared.push({
      page_id: pageId,
      brand_id: brand.id,
      type: block.type,
      width: block.width ?? 'full',
      sort: startSort + index,
      content: content as never,
    })
  }
  if (prepared.length === 0) return []
  return rows(await ctx.sb.from('blocks').insert(prepared).select('id, type, sort'))
}

function pageUrl(ctx: Ctx, brand: ScopeBrand, guidelineSlug: string, pageSlug: string): string | null {
  return ctx.link(`/b/${brand.slug}/g/${guidelineSlug}/${pageSlug}`)
}

export const guidelineTools = [
  defineTool({
    name: 'list_guidelines',
    title: 'Handbücher und Seiten',
    description:
      'Zeigt die Handbücher (Guidelines) einer Marke mit ihrer Gliederung: Kapitel und Seiten mit IDs, Kurz-URLs, Veröffentlichungsstatus und Anzahl der Bausteine.',
    input: { brand: z.string().optional(), guideline: z.string().optional().describe('Nur dieses Handbuch') },
    kind: 'read',
    async run({ brand: ref, guideline: gRef }, ctx) {
      const brand = await ctx.brand(ref)
      let list = rows(await ctx.sb.from('guidelines').select('*').eq('brand_id', brand.id).order('sort'))
      if (gRef) list = [await resolveGuideline(ctx, brand, gRef)]
      const pages = list.length
        ? rows(
            await ctx.sb
              .from('guideline_pages')
              .select('id, guideline_id, parent_id, kind, title, slug, is_published, sort, blocks(count)')
              .in('guideline_id', list.map((g) => g.id))
              .order('sort'),
          )
        : []
      const count = (v: unknown) => (Array.isArray(v) ? ((v[0] as { count?: number })?.count ?? 0) : 0)
      const data = list.map((g) => {
        const own = pages.filter((p) => p.guideline_id === g.id)
        const node = (p: (typeof own)[number]) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          published: p.is_published,
          blocks: count(p.blocks),
        })
        return {
          id: g.id,
          title: g.title,
          slug: g.slug,
          description: g.description,
          icon: g.icon,
          published: g.is_published,
          structure: own
            .filter((p) => p.parent_id === null)
            .map((p) =>
              p.kind === 'chapter'
                ? { ...node(p), kind: 'chapter', pages: own.filter((c) => c.parent_id === p.id).map(node) }
                : { ...node(p), kind: 'page' },
            ),
        }
      })
      return { summary: `${data.length} Handbuch/Handbücher in „${brand.name}“.`, data }
    },
  }),

  defineTool({
    name: 'create_guideline',
    title: 'Handbuch anlegen',
    description: 'Legt ein neues Handbuch (Guideline) in einer Marke an, mit einer ersten Seite „Einführung“.',
    input: {
      brand: z.string().optional(),
      title: z.string().min(1).max(160),
      description: z.string().max(1000).optional(),
      icon: z.string().max(40).optional().describe('Lucide-Icon-Name, z. B. book-open'),
    },
    kind: 'write',
    async run({ brand: ref, title, description, icon }, ctx) {
      const brand = await ctx.editableBrand(ref)
      const existing = rows(await ctx.sb.from('guidelines').select('slug, sort').eq('brand_id', brand.id))
      const guideline = row(
        await ctx.sb
          .from('guidelines')
          .insert({
            brand_id: brand.id,
            title: title.trim(),
            slug: uniqueSlug(slugify(title), existing.map((g) => g.slug)),
            description: description ?? '',
            icon: icon ?? 'book-open',
            sort: existing.length > 0 ? Math.max(...existing.map((g) => g.sort)) + 1 : 0,
          })
          .select()
          .single(),
      )
      const first = row(
        await ctx.sb
          .from('guideline_pages')
          .insert({ guideline_id: guideline.id, brand_id: brand.id, kind: 'page', title: 'Einführung', slug: 'einfuehrung' })
          .select('id, slug')
          .single(),
      )
      return {
        summary: `Handbuch „${guideline.title}“ in „${brand.name}“ angelegt.`,
        data: { id: guideline.id, slug: guideline.slug, first_page: first, url: ctx.link(`/b/${brand.slug}/g/${guideline.slug}`) },
      }
    },
  }),

  defineTool({
    name: 'update_guideline',
    title: 'Handbuch bearbeiten',
    description: 'Ändert Titel, Beschreibung, Icon, Kurz-URL oder Veröffentlichung eines Handbuchs. Unveröffentlichte Handbücher sehen nur Bearbeitende.',
    input: {
      brand: z.string().optional(),
      guideline: z.string().optional(),
      title: z.string().min(1).max(160).optional(),
      description: z.string().max(1000).optional(),
      icon: z.string().max(40).optional(),
      slug: z.string().min(1).max(80).optional(),
      is_published: z.boolean().optional(),
    },
    kind: 'write',
    idempotent: true,
    async run({ brand: ref, guideline: gRef, title, description, icon, slug, is_published }, ctx) {
      const brand = await ctx.editableBrand(ref)
      const guideline = await resolveGuideline(ctx, brand, gRef)
      const patch = defined({ title: title?.trim(), description, icon, slug: slug ? slugify(slug) : undefined, is_published })
      requireChange(patch)
      const [updated] = affected(await ctx.sb.from('guidelines').update(patch).eq('id', guideline.id).select(), 'Handbuch')
      return { summary: `Handbuch „${updated.title}“ gespeichert.`, data: { id: updated.id, title: updated.title, slug: updated.slug, published: updated.is_published } }
    },
  }),

  defineTool({
    name: 'delete_guideline',
    title: 'Handbuch löschen',
    description: 'Löscht ein Handbuch mit allen Kapiteln, Seiten, Bausteinen und Versionen. Unwiderruflich. confirm_title muss den exakten Titel enthalten.',
    input: { brand: z.string().optional(), guideline: z.string(), confirm_title: z.string() },
    kind: 'destructive',
    async run({ brand: ref, guideline: gRef, confirm_title }, ctx) {
      const brand = await ctx.editableBrand(ref)
      const guideline = await resolveGuideline(ctx, brand, gRef)
      if (confirm_title.trim() !== guideline.title) {
        throw new ToolError(`Zur Bestätigung muss confirm_title genau „${guideline.title}“ lauten.`)
      }
      affected(await ctx.sb.from('guidelines').delete().eq('id', guideline.id).select('id'), 'Handbuch')
      return { summary: `Handbuch „${guideline.title}“ gelöscht.` }
    },
  }),

  defineTool({
    name: 'get_page',
    title: 'Seite lesen',
    description:
      'Liest eine Handbuch-Seite mit allen Bausteinen. page = ID, Titel oder Kurz-URL (dann brand/guideline angeben, wenn nicht eindeutig). detail "outline" liefert nur eine kompakte Gliederung, "full" den kompletten Inhalt jedes Bausteins.',
    input: {
      brand: z.string().optional(),
      guideline: z.string().optional(),
      page: z.string().describe('Seiten-ID, Titel oder Kurz-URL'),
      detail: z.enum(['outline', 'full']).optional().describe('Standard: full'),
      image_urls: z.boolean().optional().describe('Signierte Bild-URLs (1 Stunde gültig) zu Bildern der Bausteine ergänzen'),
    },
    kind: 'read',
    async run({ brand: bRef, guideline: gRef, page: pRef, detail, image_urls }, ctx) {
      const { brand, guideline, page } = await resolvePage(ctx, { brand: bRef, guideline: gRef, page: pRef })
      const blocks = rows(await ctx.sb.from('blocks').select('*').eq('page_id', page.id).order('sort'))
      const header = {
        id: page.id,
        kind: page.kind,
        title: page.title,
        slug: page.slug,
        intro: page.intro,
        published: page.is_published,
        guideline: { id: guideline.id, title: guideline.title },
        url: pageUrl(ctx, brand, guideline.slug, page.slug),
        updated_at: page.updated_at,
      }
      if (detail === 'outline') {
        return {
          summary: `Seite „${page.title}“ mit ${blocks.length} Baustein(en).`,
          data: { ...header, blocks: blocks.map((b, i) => ({ id: b.id, position: i, type: b.type, width: b.width, outline: outline(b) })) },
        }
      }
      let urls = new Map<string, string>()
      if (image_urls) {
        const paths: string[] = []
        const visit = (v: unknown) => {
          if (Array.isArray(v)) v.forEach(visit)
          else if (v && typeof v === 'object') {
            const rec = v as Record<string, unknown>
            if (typeof rec.path === 'string') paths.push(rec.path)
            Object.values(rec).forEach(visit)
          }
        }
        blocks.forEach((b) => visit(b.content))
        urls = await signedUrls(ctx, paths)
      }
      const withUrls = (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map(withUrls)
        if (value && typeof value === 'object') {
          const rec = value as Record<string, unknown>
          const out: Record<string, unknown> = {}
          for (const [k, v] of Object.entries(rec)) out[k] = withUrls(v)
          if (typeof rec.path === 'string' && urls.has(rec.path)) out.url = urls.get(rec.path)
          return out
        }
        return value
      }
      return {
        summary: `Seite „${page.title}“ mit ${blocks.length} Baustein(en).`,
        data: {
          ...header,
          blocks: blocks.map((b, i) => ({ id: b.id, position: i, type: b.type, width: b.width, outline: outline(b), content: image_urls ? withUrls(b.content) : b.content })),
        },
      }
    },
  }),

  defineTool({
    name: 'create_page',
    title: 'Seite oder Kapitel anlegen',
    description:
      'Legt eine Seite oder ein Kapitel in einem Handbuch an. Seiten können direkt Bausteine mitbringen (blocks) – so entsteht eine fertige Seite in einem Schritt. Typen und Felder der Bausteine: get_block_schema.',
    input: {
      brand: z.string().optional(),
      guideline: z.string().optional(),
      title: z.string().min(1).max(160),
      kind: z.enum(['page', 'chapter']).default('page'),
      chapter: z.string().optional().describe('Kapitel (Titel, Kurz-URL oder ID), in das die Seite einsortiert wird'),
      intro: z.string().max(2000).optional().describe('Kurzer Einleitungstext unter dem Titel'),
      is_published: z.boolean().optional(),
      blocks: z.array(blockInput).max(60).optional(),
    },
    kind: 'write',
    async run({ brand: bRef, guideline: gRef, title, kind, chapter, intro, is_published, blocks }, ctx) {
      const brand = await ctx.editableBrand(bRef)
      const guideline = await resolveGuideline(ctx, brand, gRef)
      const pages = rows(await ctx.sb.from('guideline_pages').select('*').eq('guideline_id', guideline.id))
      if (kind === 'chapter' && (chapter || (blocks && blocks.length > 0))) {
        throw new ToolError('Kapitel haben weder ein übergeordnetes Kapitel noch Bausteine.')
      }
      let parentId: string | null = null
      if (chapter) {
        const parent = matchByRef(pages.filter((p) => p.kind === 'chapter'), chapter, [(p) => p.title, (p) => p.slug], 'Kapitel')
        parentId = parent.id
      }
      const siblings = pages.filter((p) => p.parent_id === parentId)
      const created = row(
        await ctx.sb
          .from('guideline_pages')
          .insert({
            guideline_id: guideline.id,
            brand_id: brand.id,
            parent_id: parentId,
            kind,
            title: title.trim(),
            slug: uniqueSlug(slugify(title), pages.map((p) => p.slug)),
            intro: intro ?? '',
            sort: siblings.length > 0 ? Math.max(...siblings.map((p) => p.sort)) + 1 : 0,
            ...(is_published === undefined ? {} : { is_published }),
          })
          .select()
          .single(),
      )
      let inserted: Array<{ id: string; type: string; sort: number }> = []
      try {
        if (blocks && blocks.length > 0) inserted = await insertBlocks(ctx, brand, created.id, blocks, 0)
      } catch (error) {
        await ctx.sb.from('guideline_pages').delete().eq('id', created.id)
        throw error
      }
      return {
        summary: `${kind === 'chapter' ? 'Kapitel' : 'Seite'} „${created.title}“ angelegt${inserted.length ? ` mit ${inserted.length} Baustein(en)` : ''}.`,
        data: { id: created.id, slug: created.slug, kind, blocks: inserted, url: pageUrl(ctx, brand, guideline.slug, created.slug) },
      }
    },
  }),

  defineTool({
    name: 'update_page',
    title: 'Seite bearbeiten',
    description: 'Ändert Titel, Einleitung, Kurz-URL oder Veröffentlichung einer Seite oder eines Kapitels. Bausteine ändern: update_block, add_block.',
    input: {
      brand: z.string().optional(),
      guideline: z.string().optional(),
      page: z.string().describe('Seiten-ID, Titel oder Kurz-URL'),
      title: z.string().min(1).max(160).optional(),
      intro: z.string().max(2000).optional(),
      slug: z.string().min(1).max(80).optional(),
      is_published: z.boolean().optional(),
    },
    kind: 'write',
    idempotent: true,
    async run({ brand: bRef, guideline: gRef, page: pRef, title, intro, slug, is_published }, ctx) {
      const target = await resolvePage(ctx, { brand: bRef, guideline: gRef, page: pRef })
      await ctx.requireEdit(target.brand)
      const patch = defined({ title: title?.trim(), intro, slug: slug ? slugify(slug) : undefined, is_published })
      requireChange(patch)
      const [updated] = affected(await ctx.sb.from('guideline_pages').update(patch).eq('id', target.page.id).select(), 'Seite')
      return { summary: `„${updated.title}“ gespeichert.`, data: { id: updated.id, title: updated.title, slug: updated.slug, published: updated.is_published } }
    },
  }),

  defineTool({
    name: 'move_page',
    title: 'Seite verschieben oder umsortieren',
    description:
      'Verschiebt eine Seite in ein anderes Kapitel (chapter) oder auf die oberste Ebene (chapter="none") und/oder an eine andere Position (position, 0 = ganz oben). Kapitel selbst können nur umsortiert werden.',
    input: {
      brand: z.string().optional(),
      guideline: z.string().optional(),
      page: z.string().describe('Seiten-ID, Titel oder Kurz-URL'),
      chapter: z.string().optional().describe('Zielkapitel (Titel, Kurz-URL, ID) oder "none" für die oberste Ebene'),
      position: z.number().int().min(0).optional().describe('Position unter den Geschwistern, 0 = ganz oben (Standard: ans Ende)'),
    },
    kind: 'write',
    idempotent: true,
    async run({ brand: bRef, guideline: gRef, page: pRef, chapter, position }, ctx) {
      const target = await resolvePage(ctx, { brand: bRef, guideline: gRef, page: pRef })
      await ctx.requireEdit(target.brand)
      const all = rows(await ctx.sb.from('guideline_pages').select('*').eq('guideline_id', target.guideline.id).order('sort'))
      let parentId: string | null = target.page.parent_id
      if (chapter !== undefined) {
        if (target.page.kind === 'chapter') throw new ToolError('Kapitel können nicht verschachtelt werden.')
        parentId =
          chapter === 'none'
            ? null
            : matchByRef(all.filter((p) => p.kind === 'chapter'), chapter, [(p) => p.title, (p) => p.slug], 'Kapitel').id
      }
      const siblings = all.filter((p) => p.parent_id === parentId && p.id !== target.page.id)
      const index = Math.min(position ?? siblings.length, siblings.length)
      const ordered = [...siblings.slice(0, index), target.page, ...siblings.slice(index)]
      await Promise.all(
        ordered.map(async (p, i) => {
          const patch = p.id === target.page.id ? { sort: i, parent_id: parentId } : { sort: i }
          if (p.id !== target.page.id && p.sort === i) return
          affected(await ctx.sb.from('guideline_pages').update(patch).eq('id', p.id).select('id'), 'Seite')
        }),
      )
      return { summary: `„${target.page.title}“ verschoben (Position ${index}).` }
    },
  }),

  defineTool({
    name: 'delete_page',
    title: 'Seite oder Kapitel löschen',
    description: 'Löscht eine Seite samt Bausteinen und Versionen. Ein Kapitel wird mit allen Seiten darin gelöscht. Unwiderruflich.',
    input: {
      brand: z.string().optional(),
      guideline: z.string().optional(),
      page: z.string().describe('Seiten-ID, Titel oder Kurz-URL'),
    },
    kind: 'destructive',
    async run({ brand: bRef, guideline: gRef, page: pRef }, ctx) {
      const target = await resolvePage(ctx, { brand: bRef, guideline: gRef, page: pRef })
      await ctx.requireEdit(target.brand)
      affected(await ctx.sb.from('guideline_pages').delete().eq('id', target.page.id).select('id'), 'Seite')
      return { summary: `${target.page.kind === 'chapter' ? 'Kapitel' : 'Seite'} „${target.page.title}“ gelöscht.` }
    },
  }),

  defineTool({
    name: 'get_block_schema',
    title: 'Bausteintypen und ihre Felder',
    description:
      'Ohne type: Liste aller Bausteintypen (Überschrift, Text, Farben, Logos, Galerie …) mit Beschreibung. Mit type: Felder (JSON-Schema), Standardinhalt und Hinweise – vor add_block/create_page nutzen, wenn du die Felder nicht kennst.',
    input: { type: blockType.optional() },
    kind: 'read',
    async run({ type }) {
      if (type) return { summary: `Baustein „${BLOCK_META[type].label}“.`, data: describeBlockType(type) }
      return {
        summary: `${BLOCK_TYPES.length} Bausteintypen. Breiten: ${WIDTHS.join(', ')}.`,
        data: BLOCK_TYPES.map((t) => ({
          type: t,
          label: BLOCK_META[t].label,
          description: BLOCK_META[t].description,
          category: BLOCK_META[t].category,
          note: BLOCK_NOTES[t] ?? null,
        })),
      }
    },
  }),

  defineTool({
    name: 'add_block',
    title: 'Baustein hinzufügen',
    description:
      'Fügt einer Seite einen Baustein hinzu (Text, Überschrift, Farben, Logos, Bild, Galerie, Tabelle …). Felder siehe get_block_schema. Für Fließtext genügt content: {"markdown": "..."}. Bilder: content.image = {"assetId": "<ID aus list_assets>"}.',
    input: {
      brand: z.string().optional(),
      guideline: z.string().optional(),
      page: z.string().describe('Seiten-ID, Titel oder Kurz-URL'),
      type: blockType,
      content: z.record(z.string(), z.unknown()).optional(),
      width: width.optional().describe('Breite im Raster (Standard full)'),
      position: z.number().int().min(0).optional().describe('Position auf der Seite, 0 = ganz oben (Standard: ans Ende)'),
    },
    kind: 'write',
    async run({ brand: bRef, guideline: gRef, page: pRef, type, content, width: w, position }, ctx) {
      const target = await resolvePage(ctx, { brand: bRef, guideline: gRef, page: pRef }, { kind: 'page' })
      await ctx.requireEdit(target.brand)
      if (target.page.kind !== 'page') throw new ToolError('Kapitel haben keine Bausteine – nimm eine Seite.')
      const existing = rows(await ctx.sb.from('blocks').select('id, sort').eq('page_id', target.page.id).order('sort'))
      const index = Math.min(position ?? existing.length, existing.length)
      const normalized = await normalizeBlockContent(ctx, target.brand.id, type, content)
      // Platz schaffen: nachfolgende Bausteine um eins nach hinten
      for (const b of existing.slice(index).reverse()) {
        affected(await ctx.sb.from('blocks').update({ sort: b.sort + 1 }).eq('id', b.id).select('id'), 'Baustein')
      }
      const sort = index < existing.length ? existing[index].sort : (existing.at(-1)?.sort ?? -1) + 1
      const created = row(
        await ctx.sb
          .from('blocks')
          .insert({ page_id: target.page.id, brand_id: target.brand.id, type, width: w ?? 'full', sort, content: normalized as never })
          .select('id, type, sort')
          .single(),
      )
      return { summary: `Baustein „${BLOCK_META[type].label}“ auf „${target.page.title}“ eingefügt (Position ${index}).`, data: created }
    },
  }),

  defineTool({
    name: 'update_block',
    title: 'Baustein ändern',
    description:
      'Ändert Inhalt und/oder Breite eines Bausteins (ID aus get_page). merge=true (Standard) führt die angegebenen Felder mit dem bestehenden Inhalt zusammen; merge=false ersetzt den Inhalt komplett (fehlende Felder bekommen Standardwerte).',
    input: {
      block_id: z.string(),
      content: z.record(z.string(), z.unknown()).optional(),
      width: width.optional(),
      merge: z.boolean().optional().describe('Standard: true'),
    },
    kind: 'write',
    idempotent: true,
    async run({ block_id, content, width: w, merge }, ctx) {
      const { block, brand } = await loadBlock(ctx, block_id)
      await ctx.requireEdit(brand)
      const patch: Record<string, unknown> = {}
      if (w) patch.width = w
      if (content) {
        const base = merge === false ? {} : ((block.content ?? {}) as Record<string, unknown>)
        const combined = { ...base, ...content }
        patch.content = (await normalizeBlockContent(ctx, brand.id, block.type as BlockType, combined)) as never
      }
      requireChange(patch)
      const [updated] = affected(await ctx.sb.from('blocks').update(patch as never).eq('id', block.id).select('id, type, width'), 'Baustein')
      return { summary: `Baustein „${BLOCK_META[updated.type as BlockType]?.label ?? updated.type}“ gespeichert.`, data: updated }
    },
  }),

  defineTool({
    name: 'move_block',
    title: 'Baustein verschieben',
    description: 'Verschiebt einen Baustein an eine andere Position derselben Seite (0 = ganz oben).',
    input: { block_id: z.string(), position: z.number().int().min(0) },
    kind: 'write',
    idempotent: true,
    async run({ block_id, position }, ctx) {
      const { block, brand } = await loadBlock(ctx, block_id)
      await ctx.requireEdit(brand)
      const all = rows(await ctx.sb.from('blocks').select('id, sort').eq('page_id', block.page_id).order('sort'))
      const others = all.filter((b) => b.id !== block.id)
      const index = Math.min(position, others.length)
      const ordered = [...others.slice(0, index), { id: block.id, sort: block.sort }, ...others.slice(index)]
      await Promise.all(
        ordered.map(async (b, i) => {
          if (b.sort === i && b.id !== block.id) return
          affected(await ctx.sb.from('blocks').update({ sort: i }).eq('id', b.id).select('id'), 'Baustein')
        }),
      )
      return { summary: `Baustein auf Position ${index} verschoben.` }
    },
  }),

  defineTool({
    name: 'delete_block',
    title: 'Baustein löschen',
    description: 'Löscht einen Baustein von einer Seite. Tipp: Vorher create_page_revision aufrufen, wenn der Stand wiederherstellbar bleiben soll.',
    input: { block_id: z.string() },
    kind: 'destructive',
    async run({ block_id }, ctx) {
      const { block, brand } = await loadBlock(ctx, block_id)
      await ctx.requireEdit(brand)
      affected(await ctx.sb.from('blocks').delete().eq('id', block.id).select('id'), 'Baustein')
      return { summary: 'Baustein gelöscht.' }
    },
  }),

  defineTool({
    name: 'replace_page_blocks',
    title: 'Alle Bausteine einer Seite ersetzen',
    description:
      'Ersetzt den gesamten Inhalt einer Seite durch die angegebenen Bausteine. Der bisherige Stand wird vorher automatisch als Version gesichert (restore_page_revision stellt ihn wieder her).',
    input: {
      brand: z.string().optional(),
      guideline: z.string().optional(),
      page: z.string().describe('Seiten-ID, Titel oder Kurz-URL'),
      blocks: z.array(blockInput).max(80),
    },
    kind: 'destructive',
    async run({ brand: bRef, guideline: gRef, page: pRef, blocks }, ctx) {
      const target = await resolvePage(ctx, { brand: bRef, guideline: gRef, page: pRef }, { kind: 'page' })
      await ctx.requireEdit(target.brand)
      // Erst prüfen, dann ersetzen – so bleibt bei einem Fehler der alte Inhalt unangetastet.
      const prepared = []
      for (const [i, b] of blocks.entries()) {
        prepared.push({
          page_id: target.page.id,
          brand_id: target.brand.id,
          type: b.type,
          width: b.width ?? 'full',
          sort: i,
          content: (await normalizeBlockContent(ctx, target.brand.id, b.type, b.content)) as never,
        })
      }
      await snapshotPage(ctx, target.page, 'Automatische Sicherung vor Ersetzen durch Assistent')
      const { error: delError } = await ctx.sb.from('blocks').delete().eq('page_id', target.page.id)
      if (delError) throw delError
      if (prepared.length > 0) {
        const { error } = await ctx.sb.from('blocks').insert(prepared)
        if (error) throw error
      }
      return { summary: `„${target.page.title}“ enthält jetzt ${prepared.length} Baustein(e). Der alte Stand ist als Version gesichert.` }
    },
  }),

  defineTool({
    name: 'list_page_revisions',
    title: 'Seitenversionen auflisten',
    description: 'Listet gespeicherte Versionen (Snapshots) einer Seite, neueste zuerst.',
    input: { brand: z.string().optional(), guideline: z.string().optional(), page: z.string() },
    kind: 'read',
    async run({ brand: bRef, guideline: gRef, page: pRef }, ctx) {
      const target = await resolvePage(ctx, { brand: bRef, guideline: gRef, page: pRef })
      const data = rows(
        await ctx.sb
          .from('page_revisions')
          .select('id, label, created_at, snapshot, author:profiles(full_name, email)')
          .eq('page_id', target.page.id)
          .order('created_at', { ascending: false })
          .limit(50),
      )
      return {
        summary: `${data.length} Version(en) von „${target.page.title}“.`,
        data: data.map((r) => ({
          id: r.id,
          label: r.label,
          at: r.created_at,
          by: r.author ? r.author.full_name || r.author.email : null,
          blocks: Array.isArray((r.snapshot as { blocks?: unknown[] })?.blocks) ? (r.snapshot as { blocks: unknown[] }).blocks.length : 0,
        })),
      }
    },
  }),

  defineTool({
    name: 'create_page_revision',
    title: 'Seitenversion sichern',
    description: 'Sichert den aktuellen Stand einer Seite als benannte Version (z. B. „Abgabe“ oder „vor Überarbeitung“).',
    input: { brand: z.string().optional(), guideline: z.string().optional(), page: z.string(), label: z.string().max(200).optional() },
    kind: 'write',
    async run({ brand: bRef, guideline: gRef, page: pRef, label }, ctx) {
      const target = await resolvePage(ctx, { brand: bRef, guideline: gRef, page: pRef })
      await ctx.requireEdit(target.brand)
      await snapshotPage(ctx, target.page, label ?? '')
      return { summary: `Version von „${target.page.title}“ gesichert.` }
    },
  }),

  defineTool({
    name: 'restore_page_revision',
    title: 'Seitenversion wiederherstellen',
    description: 'Stellt eine gespeicherte Version einer Seite wieder her. Der aktuelle Stand wird vorher automatisch gesichert.',
    input: { brand: z.string().optional(), guideline: z.string().optional(), page: z.string(), revision_id: z.string() },
    kind: 'write',
    async run({ brand: bRef, guideline: gRef, page: pRef, revision_id }, ctx) {
      const target = await resolvePage(ctx, { brand: bRef, guideline: gRef, page: pRef })
      await ctx.requireEdit(target.brand)
      const revision = row(await ctx.sb.from('page_revisions').select('*').eq('id', revision_id).eq('page_id', target.page.id).single())
      const snapshot = revision.snapshot as { title?: string; intro?: string; blocks?: Array<{ type: string; width: string; sort: number; content: unknown }> }
      await snapshotPage(ctx, target.page, 'Automatische Sicherung vor Wiederherstellung')
      const { error: delError } = await ctx.sb.from('blocks').delete().eq('page_id', target.page.id)
      if (delError) throw delError
      const blocks = snapshot.blocks ?? []
      if (blocks.length > 0) {
        const { error } = await ctx.sb.from('blocks').insert(
          blocks.map((b) => ({
            page_id: target.page.id,
            brand_id: target.brand.id,
            type: b.type,
            width: b.width,
            sort: b.sort,
            content: b.content as never,
          })),
        )
        if (error) throw error
      }
      affected(
        await ctx.sb
          .from('guideline_pages')
          .update({ title: snapshot.title ?? target.page.title, intro: snapshot.intro ?? target.page.intro })
          .eq('id', target.page.id)
          .select('id'),
        'Seite',
      )
      return { summary: `Version „${revision.label || revision.created_at}“ von „${target.page.title}“ wiederhergestellt.` }
    },
  }),
]
