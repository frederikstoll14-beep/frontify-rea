import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, type Enums, type Tables, type TablesUpdate } from '@/lib/supabase'
import type { BrandHome, BrandTemplateData, BrandTheme } from '@/lib/templates/types'
import { check, keys, type JsonValue, unwrap, unwrapMaybe } from './client'

export type BrandRow = Tables<'brands'>
export type BrandRole = Enums<'brand_role'>

export interface Brand extends Omit<BrandRow, 'theme' | 'home'> {
  theme: BrandTheme
  home: BrandHome
}

export interface BrandWithAccess extends Brand {
  role: BrandRole | null
  workspace: { id: string; name: string; slug: string } | null
}

function asObject<T>(value: unknown): T {
  return (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as T
}

export function toBrand(row: BrandRow): Brand {
  return { ...row, theme: asObject<BrandTheme>(row.theme), home: asObject<BrandHome>(row.home) }
}

export function canEdit(role: BrandRole | null | undefined): boolean {
  return role === 'admin' || role === 'editor'
}

export function canAdmin(role: BrandRole | null | undefined): boolean {
  return role === 'admin'
}

/** Alle Marken, die der/die Nutzer:in sehen darf (optional pro Workspace). */
export function useBrands(workspaceId?: string, enabled = true) {
  return useQuery({
    queryKey: [...keys.brands, workspaceId ?? 'all'],
    enabled,
    queryFn: async (): Promise<Brand[]> => {
      let query = supabase.from('brands').select('*').order('updated_at', { ascending: false })
      if (workspaceId) query = query.eq('workspace_id', workspaceId)
      return unwrap(await query).map(toBrand)
    },
  })
}

export function useBrand(slug: string | undefined) {
  return useQuery({
    queryKey: keys.brand(slug ?? ''),
    enabled: Boolean(slug),
    queryFn: async (): Promise<BrandWithAccess | null> => {
      const row = unwrapMaybe(await supabase.from('brands').select('*').eq('slug', slug!).maybeSingle())
      if (!row) return null
      const [role, workspace] = await Promise.all([
        supabase.rpc('brand_role_of', { p_brand: row.id }),
        supabase.from('workspaces').select('id, name, slug').eq('id', row.workspace_id).maybeSingle(),
      ])
      return {
        ...toBrand(row),
        role: (role.data as BrandRole | null) ?? null,
        workspace: workspace.data ?? null,
      }
    },
  })
}

export function useCreateBrand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      workspaceId: string
      name: string
      orgType: string
      tagline?: string
      template: BrandTemplateData
    }) =>
      toBrand(
        unwrap(
          await supabase.rpc('create_brand', {
            p_workspace: input.workspaceId,
            p_name: input.name,
            p_org_type: input.orgType,
            p_tagline: input.tagline ?? '',
            p_template: JSON.parse(JSON.stringify(input.template)) as JsonValue,
          }),
        ),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.brands })
      qc.invalidateQueries({ queryKey: keys.workspaces })
    },
  })
}

export type BrandPatch = Omit<TablesUpdate<'brands'>, 'theme' | 'home'> & { theme?: BrandTheme; home?: BrandHome }

export function useUpdateBrand(brand: Pick<Brand, 'id' | 'slug'>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: BrandPatch) => {
      const { theme, home, ...rest } = patch
      const update: TablesUpdate<'brands'> = { ...rest }
      if (theme) update.theme = theme as JsonValue
      if (home) update.home = home as JsonValue
      return toBrand(unwrap(await supabase.from('brands').update(update).eq('id', brand.id).select().single()))
    },
    onSuccess: (next) => {
      qc.invalidateQueries({ queryKey: keys.brand(brand.slug) })
      qc.invalidateQueries({ queryKey: keys.brands })
      if (next.slug !== brand.slug) qc.invalidateQueries({ queryKey: keys.brand(next.slug) })
    },
  })
}

export function useDeleteBrand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (brand: Pick<Brand, 'id'>) => {
      // Dateien im Storage zuerst entfernen (Ordner = brand_id)
      await removeFolder(brand.id)
      check(await supabase.from('brands').delete().eq('id', brand.id))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.brands })
      qc.invalidateQueries({ queryKey: keys.workspaces })
    },
  })
}

export async function removeFolder(prefix: string): Promise<void> {
  const bucket = supabase.storage.from('brand-files')
  const { data } = await bucket.list(prefix, { limit: 1000 })
  if (!data) return
  const files: string[] = []
  for (const entry of data) {
    const path = `${prefix}/${entry.name}`
    if (entry.id === null) {
      await removeFolder(path)
    } else {
      files.push(path)
    }
  }
  if (files.length > 0) await bucket.remove(files)
}

export function useApplyTemplate(brandId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (template: BrandTemplateData) =>
      check(
        await supabase.rpc('apply_brand_template', {
          p_brand: brandId,
          p_template: JSON.parse(JSON.stringify(template)) as JsonValue,
        }),
      ),
    onSuccess: () => qc.invalidateQueries(),
  })
}
