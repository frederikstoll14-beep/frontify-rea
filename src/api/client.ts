import type { PostgrestError } from '@supabase/supabase-js'

import type { Json } from '@/lib/database.types'

export type JsonValue = NonNullable<Json>

/** Wandelt beliebige (serialisierbare) Werte in den Json-Typ der Datenbank um. */
export function toJson(value: unknown): JsonValue {
  return (value ?? {}) as JsonValue
}

export function unwrap<T>(result: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (result.error) throw result.error
  if (result.data === null || result.data === undefined) throw new Error('Nicht gefunden')
  return result.data as NonNullable<T>
}

export function unwrapMaybe<T>(result: { data: T; error: PostgrestError | null }): T | null {
  if (result.error) throw result.error
  return result.data ?? null
}

export function check(result: { error: PostgrestError | null }): void {
  if (result.error) throw result.error
}

export const keys = {
  workspaces: ['workspaces'] as const,
  workspace: (slug: string) => ['workspace', slug] as const,
  workspaceMembers: (id: string) => ['workspace-members', id] as const,
  invitations: (workspaceId: string) => ['invitations', workspaceId] as const,
  brands: ['brands'] as const,
  brand: (slug: string) => ['brand', slug] as const,
  brandRole: (id: string) => ['brand-role', id] as const,
  brandMembers: (id: string) => ['brand-members', id] as const,
  guidelines: (brandId: string) => ['guidelines', brandId] as const,
  pages: (guidelineId: string) => ['pages', guidelineId] as const,
  brandPages: (brandId: string) => ['brand-pages', brandId] as const,
  blocks: (pageId: string) => ['blocks', pageId] as const,
  revisions: (pageId: string) => ['revisions', pageId] as const,
  palettes: (brandId: string) => ['palettes', brandId] as const,
  fonts: (brandId: string) => ['fonts', brandId] as const,
  textStyles: (brandId: string) => ['text-styles', brandId] as const,
  libraries: (brandId: string) => ['libraries', brandId] as const,
  assets: (libraryId: string) => ['assets', libraryId] as const,
  brandAssets: (brandId: string) => ['brand-assets', brandId] as const,
  assetsByIds: (ids: string[]) => ['assets-by-ids', [...ids].sort().join(',')] as const,
  assetVersions: (assetId: string) => ['asset-versions', assetId] as const,
  collections: (libraryId: string) => ['collections', libraryId] as const,
  comments: (target: string) => ['comments', target] as const,
  brandComments: (brandId: string) => ['brand-comments', brandId] as const,
  activity: (brandId: string) => ['activity', brandId] as const,
  search: (brandId: string, q: string) => ['search', brandId, q] as const,
}
