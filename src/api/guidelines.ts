import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { withDefaults, type BlockContentMap, type BlockType, type BlockWidth } from '@/lib/blocks/types'
import { supabase, type Tables, type TablesUpdate } from '@/lib/supabase'
import { slugify } from '@/lib/utils'
import { check, keys, type JsonValue, unwrap } from './client'

export type Guideline = Tables<'guidelines'>
export type GuidelinePage = Tables<'guideline_pages'>
export type PageRevision = Tables<'page_revisions'>

export interface Block<T extends BlockType = BlockType>
  extends Omit<Tables<'blocks'>, 'type' | 'content' | 'width'> {
  type: T
  width: BlockWidth
  content: BlockContentMap[T]
}

export function toBlock(row: Tables<'blocks'>): Block | null {
  const type = row.type as BlockType
  try {
    return { ...row, type, width: row.width as BlockWidth, content: withDefaults(type, row.content) } as Block
  } catch {
    return null
  }
}

export function useGuidelines(brandId: string | undefined) {
  return useQuery({
    queryKey: keys.guidelines(brandId ?? ''),
    enabled: Boolean(brandId),
    queryFn: async (): Promise<Guideline[]> =>
      unwrap(await supabase.from('guidelines').select('*').eq('brand_id', brandId!).order('sort')),
  })
}

export function usePages(guidelineId: string | undefined) {
  return useQuery({
    queryKey: keys.pages(guidelineId ?? ''),
    enabled: Boolean(guidelineId),
    queryFn: async (): Promise<GuidelinePage[]> =>
      unwrap(
        await supabase.from('guideline_pages').select('*').eq('guideline_id', guidelineId!).order('sort'),
      ),
  })
}

/** Alle Seiten einer Marke (für Startseite, Link-Auswahl, Druck). */
export function useBrandPages(brandId: string | undefined) {
  return useQuery({
    queryKey: keys.brandPages(brandId ?? ''),
    enabled: Boolean(brandId),
    queryFn: async (): Promise<GuidelinePage[]> =>
      unwrap(
        await supabase
          .from('guideline_pages')
          .select('*')
          .eq('brand_id', brandId!)
          .order('updated_at', { ascending: false }),
      ),
  })
}

export interface NavChapter {
  chapter: GuidelinePage | null
  pages: GuidelinePage[]
}

/** Baut die Sidebar-Struktur: Seiten ohne Kapitel zuerst, dann Kapitel mit ihren Seiten. */
export function buildNav(pages: GuidelinePage[]): NavChapter[] {
  const sorted = [...pages].sort((a, b) => a.sort - b.sort)
  const result: NavChapter[] = []
  let loose: NavChapter | null = null
  for (const item of sorted.filter((p) => p.parent_id === null)) {
    if (item.kind === 'chapter') {
      loose = null
      result.push({ chapter: item, pages: sorted.filter((p) => p.parent_id === item.id) })
    } else {
      if (!loose) {
        loose = { chapter: null, pages: [] }
        result.push(loose)
      }
      loose.pages.push(item)
    }
  }
  return result
}

export function flattenNav(nav: NavChapter[]): GuidelinePage[] {
  return nav.flatMap((group) => group.pages)
}

export function useCreateGuideline(brandId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { title: string; description?: string; existing: Guideline[] }) => {
      const base = slugify(input.title)
      let slug = base
      let i = 2
      while (input.existing.some((g) => g.slug === slug)) slug = `${base}-${i++}`
      const guideline = unwrap(
        await supabase
          .from('guidelines')
          .insert({
            brand_id: brandId,
            title: input.title,
            slug,
            description: input.description ?? '',
            sort: input.existing.length,
          })
          .select()
          .single(),
      )
      unwrap(
        await supabase
          .from('guideline_pages')
          .insert({
            guideline_id: guideline.id,
            brand_id: brandId,
            kind: 'page',
            title: 'Einführung',
            slug: 'einfuehrung',
          })
          .select()
          .single(),
      )
      return guideline
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.guidelines(brandId) }),
  })
}

export function useUpdateGuideline(brandId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; patch: TablesUpdate<'guidelines'> }) =>
      unwrap(await supabase.from('guidelines').update(input.patch).eq('id', input.id).select().single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.guidelines(brandId) }),
  })
}

export function useDeleteGuideline(brandId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => check(await supabase.from('guidelines').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.guidelines(brandId) }),
  })
}

function uniquePageSlug(title: string, pages: GuidelinePage[]): string {
  const base = slugify(title)
  let slug = base
  let i = 2
  while (pages.some((p) => p.slug === slug)) slug = `${base}-${i++}`
  return slug
}

export function useCreatePage(guidelineId: string, brandId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      title: string
      kind: 'chapter' | 'page'
      parentId: string | null
      pages: GuidelinePage[]
    }) => {
      const siblings = input.pages.filter((p) => p.parent_id === input.parentId)
      const sort = siblings.length > 0 ? Math.max(...siblings.map((p) => p.sort)) + 1 : 0
      return unwrap(
        await supabase
          .from('guideline_pages')
          .insert({
            guideline_id: guidelineId,
            brand_id: brandId,
            parent_id: input.parentId,
            kind: input.kind,
            title: input.title,
            slug: uniquePageSlug(input.title, input.pages),
            sort,
          })
          .select()
          .single(),
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.pages(guidelineId) })
      qc.invalidateQueries({ queryKey: keys.brandPages(brandId) })
    },
  })
}

export function useUpdatePage(guidelineId: string, brandId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; patch: TablesUpdate<'guideline_pages'> }) =>
      unwrap(await supabase.from('guideline_pages').update(input.patch).eq('id', input.id).select().single()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.pages(guidelineId) })
      if (brandId) qc.invalidateQueries({ queryKey: keys.brandPages(brandId) })
    },
  })
}

export function useDeletePage(guidelineId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => check(await supabase.from('guideline_pages').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.pages(guidelineId) }),
  })
}

/** Speichert eine neue Reihenfolge (und optional Eltern-Zuordnung) für mehrere Seiten. */
export function useReorderPages(guidelineId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (items: Array<{ id: string; sort: number; parent_id?: string | null }>) => {
      await Promise.all(
        items.map(async (item) => {
          const patch: TablesUpdate<'guideline_pages'> = { sort: item.sort }
          if (item.parent_id !== undefined) patch.parent_id = item.parent_id
          check(await supabase.from('guideline_pages').update(patch).eq('id', item.id))
        }),
      )
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.pages(guidelineId) }),
  })
}

export function useBlocks(pageId: string | undefined) {
  return useQuery({
    queryKey: keys.blocks(pageId ?? ''),
    enabled: Boolean(pageId),
    queryFn: async (): Promise<Block[]> => {
      const rows = unwrap(await supabase.from('blocks').select('*').eq('page_id', pageId!).order('sort'))
      return rows.map(toBlock).filter((b): b is Block => b !== null)
    },
  })
}

/** Alle Blöcke einer Guideline (für Druckansicht). */
export async function fetchGuidelineBlocks(pageIds: string[]): Promise<Block[]> {
  if (pageIds.length === 0) return []
  const rows = unwrap(await supabase.from('blocks').select('*').in('page_id', pageIds).order('sort'))
  return rows.map(toBlock).filter((b): b is Block => b !== null)
}

export async function insertBlock(input: {
  pageId: string
  brandId: string
  type: BlockType
  content: unknown
  width?: BlockWidth
  sort: number
}): Promise<Block> {
  const row = unwrap(
    await supabase
      .from('blocks')
      .insert({
        page_id: input.pageId,
        brand_id: input.brandId,
        type: input.type,
        content: input.content as JsonValue,
        width: input.width ?? 'full',
        sort: input.sort,
      })
      .select()
      .single(),
  )
  const block = toBlock(row)
  if (!block) throw new Error('Unbekannter Bausteintyp')
  return block
}

export async function updateBlock(
  id: string,
  patch: { content?: unknown; width?: BlockWidth; sort?: number },
) {
  const update: TablesUpdate<'blocks'> = {}
  if (patch.content !== undefined) update.content = patch.content as JsonValue
  if (patch.width !== undefined) update.width = patch.width
  if (patch.sort !== undefined) update.sort = patch.sort
  check(await supabase.from('blocks').update(update).eq('id', id))
}

export async function deleteBlock(id: string) {
  check(await supabase.from('blocks').delete().eq('id', id))
}

export async function saveBlockOrder(blocks: Array<{ id: string; sort: number }>) {
  await Promise.all(blocks.map((b) => updateBlock(b.id, { sort: b.sort })))
}

export function useRevisions(pageId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: keys.revisions(pageId ?? ''),
    enabled: Boolean(pageId) && enabled,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('page_revisions')
          .select('*, author:profiles(full_name, email)')
          .eq('page_id', pageId!)
          .order('created_at', { ascending: false }),
      ),
  })
}

export interface RevisionSnapshot {
  title: string
  intro: string
  blocks: Array<{ type: string; width: string; sort: number; content: unknown }>
}

export function useCreateRevision(pageId: string, brandId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { label: string; page: GuidelinePage; blocks: Block[] }) => {
      const snapshot: RevisionSnapshot = {
        title: input.page.title,
        intro: input.page.intro,
        blocks: input.blocks.map((b) => ({ type: b.type, width: b.width, sort: b.sort, content: b.content })),
      }
      return unwrap(
        await supabase
          .from('page_revisions')
          .insert({
            page_id: pageId,
            brand_id: brandId,
            label: input.label,
            snapshot: snapshot as unknown as JsonValue,
          })
          .select()
          .single(),
      )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.revisions(pageId) }),
  })
}

/** Stellt eine Version wieder her. Vorher wird der aktuelle Stand automatisch gesichert. */
export async function restoreRevision(input: {
  page: GuidelinePage
  current: Block[]
  revision: PageRevision
}): Promise<void> {
  const backup: RevisionSnapshot = {
    title: input.page.title,
    intro: input.page.intro,
    blocks: input.current.map((b) => ({ type: b.type, width: b.width, sort: b.sort, content: b.content })),
  }
  check(
    await supabase.from('page_revisions').insert({
      page_id: input.page.id,
      brand_id: input.page.brand_id,
      label: 'Automatische Sicherung vor Wiederherstellung',
      snapshot: backup as unknown as JsonValue,
    }),
  )
  const snapshot = input.revision.snapshot as unknown as RevisionSnapshot
  check(await supabase.from('blocks').delete().eq('page_id', input.page.id))
  if (snapshot.blocks.length > 0) {
    check(
      await supabase.from('blocks').insert(
        snapshot.blocks.map((b) => ({
          page_id: input.page.id,
          brand_id: input.page.brand_id,
          type: b.type,
          width: b.width,
          sort: b.sort,
          content: b.content as JsonValue,
        })),
      ),
    )
  }
  check(
    await supabase
      .from('guideline_pages')
      .update({ title: snapshot.title, intro: snapshot.intro })
      .eq('id', input.page.id),
  )
}
