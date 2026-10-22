import type { Tables } from './types'
import { matchByRef, type Ctx, type ScopeBrand } from './context'
import { rows } from './db'
import { ToolError } from './errors'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID.test(value.trim())
}

export type Guideline = Tables<'guidelines'>
export type GuidelinePage = Tables<'guideline_pages'>
export type Library = Tables<'libraries'>

export async function resolveGuideline(ctx: Ctx, brand: ScopeBrand, ref?: string): Promise<Guideline> {
  const list = rows(await ctx.sb.from('guidelines').select('*').eq('brand_id', brand.id).order('sort'))
  if (list.length === 0)
    throw new ToolError(`„${brand.name}“ hat noch kein Handbuch.`, 'Lege eins mit create_guideline an.')
  if (!ref) {
    if (list.length === 1) return list[0]
    throw new ToolError(
      'Bitte das Handbuch angeben (Titel, Kurz-URL oder ID).',
      `Vorhanden: ${list.map((g) => g.title).join(', ')}.`,
    )
  }
  return matchByRef(list, ref, [(g) => g.title, (g) => g.slug], 'Handbuch')
}

export interface PageTarget {
  brand: ScopeBrand
  guideline: Guideline
  page: GuidelinePage
}

/** Seite über ID – oder über Titel/Kurz-URL innerhalb eines Handbuchs. */
export async function resolvePage(
  ctx: Ctx,
  input: { brand?: string; guideline?: string; page: string },
  options: { kind?: 'page' | 'chapter' } = {},
): Promise<PageTarget> {
  if (isUuid(input.page)) {
    const found = await ctx.sb.from('guideline_pages').select('*').eq('id', input.page.trim()).maybeSingle()
    if (found.error) throw found.error
    if (!found.data) throw new ToolError('Seite nicht gefunden – oder nicht freigegeben.')
    const brand = await ctx.brandById(found.data.brand_id)
    const guideline = await ctx.sb.from('guidelines').select('*').eq('id', found.data.guideline_id).single()
    if (guideline.error) throw guideline.error
    return { brand, guideline: guideline.data, page: found.data }
  }
  const brand = await ctx.brand(input.brand)
  const guideline = await resolveGuideline(ctx, brand, input.guideline)
  const pages = rows(
    await ctx.sb.from('guideline_pages').select('*').eq('guideline_id', guideline.id).order('sort'),
  )
  const candidates = options.kind ? pages.filter((p) => p.kind === options.kind) : pages
  const page = matchByRef(
    candidates,
    input.page,
    [(p) => p.title, (p) => p.slug],
    options.kind === 'chapter' ? 'Kapitel' : 'Seite',
  )
  return { brand, guideline, page }
}

export async function resolveLibrary(ctx: Ctx, brand: ScopeBrand, ref?: string): Promise<Library> {
  const list = rows(await ctx.sb.from('libraries').select('*').eq('brand_id', brand.id).order('sort'))
  if (list.length === 0)
    throw new ToolError(`„${brand.name}“ hat noch keine Bibliothek.`, 'Lege eine mit create_library an.')
  if (!ref) {
    if (list.length === 1) return list[0]
    throw new ToolError(
      'Bitte die Bibliothek angeben (Name, Kurz-URL oder ID).',
      `Vorhanden: ${list.map((l) => l.name).join(', ')}.`,
    )
  }
  return matchByRef(list, ref, [(l) => l.name, (l) => l.slug], 'Bibliothek')
}
