import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, type Tables, type TablesInsert, type TablesUpdate } from '@/lib/supabase'
import { check, keys, unwrap } from './client'

export type Palette = Tables<'color_palettes'> & { colors: Tables<'colors'>[] }
export type Color = Tables<'colors'>
export type Font = Tables<'fonts'>
export type TextStyle = Tables<'text_styles'>

export interface FontFile {
  path: string
  weight: number
  style: 'normal' | 'italic'
  format: string
  name: string
}

export function fontFiles(font: Font): FontFile[] {
  return Array.isArray(font.files) ? (font.files as unknown as FontFile[]) : []
}

export function usePalettes(brandId: string | undefined) {
  return useQuery({
    queryKey: keys.palettes(brandId ?? ''),
    enabled: Boolean(brandId),
    queryFn: async (): Promise<Palette[]> => {
      const rows = unwrap(
        await supabase.from('color_palettes').select('*, colors(*)').eq('brand_id', brandId!).order('sort'),
      )
      return rows.map((p) => ({ ...p, colors: [...p.colors].sort((a, b) => a.sort - b.sort) }))
    },
  })
}

export function useFonts(brandId: string | undefined) {
  return useQuery({
    queryKey: keys.fonts(brandId ?? ''),
    enabled: Boolean(brandId),
    queryFn: async (): Promise<Font[]> =>
      unwrap(await supabase.from('fonts').select('*').eq('brand_id', brandId!).order('sort')),
  })
}

export function useTextStyles(brandId: string | undefined) {
  return useQuery({
    queryKey: keys.textStyles(brandId ?? ''),
    enabled: Boolean(brandId),
    queryFn: async (): Promise<TextStyle[]> =>
      unwrap(await supabase.from('text_styles').select('*').eq('brand_id', brandId!).order('sort')),
  })
}

export function useBasicsMutations(brandId: string) {
  const qc = useQueryClient()
  const invalidatePalettes = () => qc.invalidateQueries({ queryKey: keys.palettes(brandId) })
  const invalidateFonts = () => qc.invalidateQueries({ queryKey: keys.fonts(brandId) })
  const invalidateStyles = () => qc.invalidateQueries({ queryKey: keys.textStyles(brandId) })

  return {
    createPalette: useMutation({
      mutationFn: async (input: { name: string; sort: number }) =>
        unwrap(
          await supabase
            .from('color_palettes')
            .insert({ brand_id: brandId, name: input.name, sort: input.sort })
            .select()
            .single(),
        ),
      onSuccess: invalidatePalettes,
    }),
    updatePalette: useMutation({
      mutationFn: async (input: { id: string; patch: TablesUpdate<'color_palettes'> }) =>
        check(await supabase.from('color_palettes').update(input.patch).eq('id', input.id)),
      onSuccess: invalidatePalettes,
    }),
    deletePalette: useMutation({
      mutationFn: async (id: string) => check(await supabase.from('color_palettes').delete().eq('id', id)),
      onSuccess: invalidatePalettes,
    }),
    saveColor: useMutation({
      mutationFn: async (input: { id?: string; values: Omit<TablesInsert<'colors'>, 'brand_id'> }) => {
        if (input.id) {
          check(await supabase.from('colors').update(input.values).eq('id', input.id))
        } else {
          check(await supabase.from('colors').insert({ ...input.values, brand_id: brandId }))
        }
      },
      onSuccess: invalidatePalettes,
    }),
    deleteColor: useMutation({
      mutationFn: async (id: string) => check(await supabase.from('colors').delete().eq('id', id)),
      onSuccess: invalidatePalettes,
    }),
    reorderColors: useMutation({
      mutationFn: async (items: Array<{ id: string; sort: number; palette_id?: string }>) => {
        await Promise.all(
          items.map(async (item) => {
            const patch: TablesUpdate<'colors'> = { sort: item.sort }
            if (item.palette_id) patch.palette_id = item.palette_id
            check(await supabase.from('colors').update(patch).eq('id', item.id))
          }),
        )
      },
      onSettled: invalidatePalettes,
    }),
    saveFont: useMutation({
      mutationFn: async (input: { id?: string; values: Omit<TablesInsert<'fonts'>, 'brand_id'> }) => {
        if (input.id) {
          check(await supabase.from('fonts').update(input.values).eq('id', input.id))
        } else {
          check(await supabase.from('fonts').insert({ ...input.values, brand_id: brandId }))
        }
      },
      onSuccess: invalidateFonts,
    }),
    deleteFont: useMutation({
      mutationFn: async (font: Font) => {
        const paths = fontFiles(font).map((f) => f.path)
        if (paths.length > 0) await supabase.storage.from('brand-files').remove(paths)
        check(await supabase.from('fonts').delete().eq('id', font.id))
      },
      onSuccess: invalidateFonts,
    }),
    saveTextStyle: useMutation({
      mutationFn: async (input: { id?: string; values: Omit<TablesInsert<'text_styles'>, 'brand_id'> }) => {
        if (input.id) {
          check(await supabase.from('text_styles').update(input.values).eq('id', input.id))
        } else {
          check(await supabase.from('text_styles').insert({ ...input.values, brand_id: brandId }))
        }
      },
      onSuccess: invalidateStyles,
    }),
    deleteTextStyle: useMutation({
      mutationFn: async (id: string) => check(await supabase.from('text_styles').delete().eq('id', id)),
      onSuccess: invalidateStyles,
    }),
    reorderTextStyles: useMutation({
      mutationFn: async (items: Array<{ id: string; sort: number }>) => {
        await Promise.all(
          items.map(async (item) => check(await supabase.from('text_styles').update({ sort: item.sort }).eq('id', item.id))),
        )
      },
      onSettled: invalidateStyles,
    }),
  }
}
