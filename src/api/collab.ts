import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, type Tables } from '@/lib/supabase'
import { check, keys, unwrap } from './client'

export type Comment = Tables<'comments'> & {
  author: Pick<Tables<'profiles'>, 'full_name' | 'email'> | null
}

export type CommentTarget = { pageId: string; assetId?: never } | { assetId: string; pageId?: never }

function targetKey(target: CommentTarget): string {
  return target.pageId ? `page:${target.pageId}` : `asset:${target.assetId}`
}

export function useComments(target: CommentTarget | null, enabled = true) {
  return useQuery({
    queryKey: keys.comments(target ? targetKey(target) : ''),
    enabled: Boolean(target) && enabled,
    queryFn: async (): Promise<Comment[]> => {
      let query = supabase
        .from('comments')
        .select('*, author:profiles(full_name, email)')
        .order('created_at', { ascending: true })
      query = target!.pageId ? query.eq('page_id', target!.pageId) : query.eq('asset_id', target!.assetId!)
      return unwrap(await query)
    },
  })
}

export function useBrandComments(brandId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: keys.brandComments(brandId ?? ''),
    enabled: Boolean(brandId) && enabled,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('comments')
          .select(
            '*, author:profiles(full_name, email), page:guideline_pages(title, slug, guideline:guidelines(slug)), asset:assets(title, library:libraries(slug))',
          )
          .eq('brand_id', brandId!)
          .is('parent_id', null)
          .order('created_at', { ascending: false })
          .limit(100),
      ),
  })
}

export function useCommentMutations(target: CommentTarget, brandId: string) {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: keys.comments(targetKey(target)) })
    qc.invalidateQueries({ queryKey: keys.brandComments(brandId) })
    qc.invalidateQueries({ queryKey: keys.activity(brandId) })
  }
  return {
    add: useMutation({
      mutationFn: async (input: {
        body: string
        parentId?: string | null
        blockId?: string | null
        posX?: number | null
        posY?: number | null
      }) =>
        check(
          await supabase.from('comments').insert({
            brand_id: brandId,
            page_id: target.pageId ?? null,
            asset_id: target.assetId ?? null,
            parent_id: input.parentId ?? null,
            block_id: input.blockId ?? null,
            body: input.body,
            pos_x: input.posX ?? null,
            pos_y: input.posY ?? null,
          }),
        ),
      onSuccess: invalidate,
    }),
    resolve: useMutation({
      mutationFn: async (input: { id: string; resolved: boolean }) =>
        check(await supabase.from('comments').update({ resolved: input.resolved }).eq('id', input.id)),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => check(await supabase.from('comments').delete().eq('id', id)),
      onSuccess: invalidate,
    }),
  }
}

export function useActivity(brandId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: keys.activity(brandId ?? ''),
    enabled: Boolean(brandId) && enabled,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('activity')
          .select('*, actor:profiles(full_name, email)')
          .eq('brand_id', brandId!)
          .order('created_at', { ascending: false })
          .limit(200),
      ),
  })
}

export function useSearch(brandId: string | undefined, query: string) {
  const q = query.trim()
  return useQuery({
    queryKey: keys.search(brandId ?? '', q),
    enabled: Boolean(brandId) && q.length >= 2,
    staleTime: 30_000,
    queryFn: async () => unwrap(await supabase.rpc('search_brand', { p_brand: brandId!, p_query: q })),
  })
}
