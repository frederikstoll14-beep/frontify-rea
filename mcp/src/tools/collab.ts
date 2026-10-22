import { z } from 'zod'
import { page as pageRange, affected, row, rows } from '../db'
import { ToolError } from '../errors'
import { resolvePage, isUuid } from '../resolve'
import { defineTool } from '../tool'

type CommentRow = {
  id: string
  parent_id: string | null
  body: string
  resolved: boolean
  pos_x: number | null
  pos_y: number | null
  block_id: string | null
  created_at: string
  author: { full_name: string; email: string } | null
}

function present(c: CommentRow) {
  return {
    id: c.id,
    parent_id: c.parent_id,
    by: c.author ? c.author.full_name || c.author.email : null,
    at: c.created_at,
    body: c.body,
    resolved: c.resolved,
    block_id: c.block_id,
    pin: c.pos_x !== null && c.pos_y !== null ? { x: c.pos_x, y: c.pos_y } : null,
  }
}

export const collabTools = [
  defineTool({
    name: 'list_comments',
    title: 'Kommentare lesen',
    description:
      'Liest Kommentare: zu einer Seite (page), zu einer Datei (asset_id) oder – ohne beides – die neuesten Kommentar-Threads der ganzen Marke (Feedback-Übersicht). Antworten stehen mit parent_id beim jeweiligen Thread.',
    input: {
      brand: z.string().optional(),
      guideline: z.string().optional(),
      page: z.string().optional().describe('Seiten-ID, Titel oder Kurz-URL'),
      asset_id: z.string().optional(),
      include_resolved: z.boolean().optional().describe('Auch erledigte Kommentare (Standard: ja bei Seite/Datei, nein bei Marken-Übersicht)'),
      limit: z.number().int().min(1).max(200).optional(),
    },
    kind: 'read',
    async run({ brand: bRef, guideline: gRef, page, asset_id, include_resolved, limit }, ctx) {
      const select = '*, author:profiles(full_name, email)'
      if (page) {
        const target = await resolvePage(ctx, { brand: bRef, guideline: gRef, page })
        const data = rows(await ctx.sb.from('comments').select(select).eq('page_id', target.page.id).order('created_at'))
        const list = (data as unknown as CommentRow[]).filter((c) => include_resolved !== false || !c.resolved)
        return { summary: `${list.length} Kommentar(e) auf „${target.page.title}“.`, data: list.map(present) }
      }
      if (asset_id) {
        if (!isUuid(asset_id)) throw new ToolError('asset_id muss eine ID sein.')
        const asset = row(await ctx.sb.from('assets').select('id, title, brand_id').eq('id', asset_id).single())
        await ctx.brandById(asset.brand_id)
        const data = rows(await ctx.sb.from('comments').select(select).eq('asset_id', asset.id).order('created_at'))
        const list = (data as unknown as CommentRow[]).filter((c) => include_resolved !== false || !c.resolved)
        return { summary: `${list.length} Kommentar(e) zu „${asset.title}“.`, data: list.map(present) }
      }
      const brand = await ctx.brand(bRef)
      const p = pageRange(limit, 0, 200, 40)
      let q = ctx.sb
        .from('comments')
        .select(`${select}, page:guideline_pages(id, title, slug), asset:assets(id, title)`)
        .eq('brand_id', brand.id)
        .is('parent_id', null)
        .order('created_at', { ascending: false })
        .range(p.from, p.to)
      if (!include_resolved) q = q.eq('resolved', false)
      const data = rows(await q)
      return {
        summary: `${data.length} Kommentar-Thread(s) in „${brand.name}“.`,
        data: (data as unknown as Array<CommentRow & { page: { id: string; title: string } | null; asset: { id: string; title: string } | null }>).map((c) => ({
          ...present(c),
          on: c.page ? { page_id: c.page.id, title: c.page.title } : c.asset ? { asset_id: c.asset.id, title: c.asset.title } : null,
        })),
      }
    },
  }),

  defineTool({
    name: 'add_comment',
    title: 'Kommentar schreiben',
    description:
      'Schreibt einen Kommentar zu einer Seite (page) oder Datei (asset_id), optional als Antwort (parent_id), zu einem Baustein (block_id) oder als Pin im Bild (pos_x/pos_y zwischen 0 und 1). Kommentieren dürfen alle Mitglieder, auch mit Leserolle.',
    input: {
      brand: z.string().optional(),
      guideline: z.string().optional(),
      page: z.string().optional(),
      asset_id: z.string().optional(),
      body: z.string().min(1).max(4000),
      parent_id: z.string().optional().describe('ID des Kommentars, auf den geantwortet wird'),
      block_id: z.string().optional(),
      pos_x: z.number().min(0).max(1).optional(),
      pos_y: z.number().min(0).max(1).optional(),
    },
    kind: 'write',
    async run({ brand: bRef, guideline: gRef, page, asset_id, body, parent_id, block_id, pos_x, pos_y }, ctx) {
      if (!!page === !!asset_id) throw new ToolError('Bitte genau eines angeben: page oder asset_id.')
      await ctx.assertWriteAllowed()
      let brandId: string
      let pageId: string | null = null
      let assetId: string | null = null
      if (page) {
        const target = await resolvePage(ctx, { brand: bRef, guideline: gRef, page })
        brandId = target.brand.id
        pageId = target.page.id
      } else {
        if (!isUuid(asset_id!)) throw new ToolError('asset_id muss eine ID sein.')
        const asset = row(await ctx.sb.from('assets').select('id, brand_id').eq('id', asset_id!).single())
        brandId = (await ctx.brandById(asset.brand_id)).id
        assetId = asset.id
      }
      const created = row(
        await ctx.sb
          .from('comments')
          .insert({
            brand_id: brandId,
            page_id: pageId,
            asset_id: assetId,
            parent_id: parent_id ?? null,
            block_id: block_id ?? null,
            body: body.trim(),
            pos_x: pos_x ?? null,
            pos_y: pos_y ?? null,
          })
          .select('id')
          .single(),
      )
      return { summary: 'Kommentar geschrieben.', data: created }
    },
  }),

  defineTool({
    name: 'resolve_comment',
    title: 'Kommentar erledigen',
    description: 'Markiert einen Kommentar als erledigt (oder wieder als offen). Möglich für den Autor und für Bearbeitende.',
    input: { comment_id: z.string(), resolved: z.boolean().default(true) },
    kind: 'write',
    idempotent: true,
    async run({ comment_id, resolved }, ctx) {
      await ctx.assertWriteAllowed()
      affected(await ctx.sb.from('comments').update({ resolved }).eq('id', comment_id).select('id'), 'Kommentar')
      return { summary: resolved ? 'Kommentar als erledigt markiert.' : 'Kommentar wieder geöffnet.' }
    },
  }),

  defineTool({
    name: 'delete_comment',
    title: 'Kommentar löschen',
    description: 'Löscht einen Kommentar samt Antworten. Möglich für den Autor und für Admins der Marke.',
    input: { comment_id: z.string() },
    kind: 'destructive',
    async run({ comment_id }, ctx) {
      await ctx.assertWriteAllowed()
      affected(await ctx.sb.from('comments').delete().eq('id', comment_id).select('id'), 'Kommentar')
      return { summary: 'Kommentar gelöscht.' }
    },
  }),
]
