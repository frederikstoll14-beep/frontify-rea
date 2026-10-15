import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createThumbnail, readImageSize } from '@/lib/media'
import { supabase, type Enums, type Tables, type TablesUpdate } from '@/lib/supabase'
import { fileExtension, slugify } from '@/lib/utils'
import { check, keys, unwrap } from './client'
import { buildPath, removeFiles, uploadFile } from './storage'

export type Library = Tables<'libraries'>
export type LibraryKind = Enums<'library_kind'>
export type Asset = Tables<'assets'>
export type AssetVersion = Tables<'asset_versions'>
export type Collection = Tables<'collections'> & { asset_ids: string[] }

export const LIBRARY_KINDS: Record<LibraryKind, { label: string; accept?: string }> = {
  media: { label: 'Bilder & Medien' },
  logos: { label: 'Logos', accept: '.svg,.png,.jpg,.jpeg,.webp,.pdf,.eps,.ai' },
  icons: { label: 'Icons & Grafiken', accept: '.svg,.png,.webp,.pdf' },
  documents: { label: 'Dokumente' },
  templates: { label: 'Vorlagen' },
  audio_video: { label: 'Audio & Video', accept: 'audio/*,video/*' },
}

export function useLibraries(brandId: string | undefined) {
  return useQuery({
    queryKey: keys.libraries(brandId ?? ''),
    enabled: Boolean(brandId),
    queryFn: async () => {
      const rows = unwrap(
        await supabase.from('libraries').select('*, assets(count)').eq('brand_id', brandId!).order('sort'),
      )
      return rows.map(({ assets, ...lib }) => ({
        ...lib,
        asset_count: (assets as unknown as Array<{ count: number }>)?.[0]?.count ?? 0,
      }))
    },
  })
}

export function useAssets(libraryId: string | undefined) {
  return useQuery({
    queryKey: keys.assets(libraryId ?? ''),
    enabled: Boolean(libraryId),
    queryFn: async (): Promise<Asset[]> =>
      unwrap(
        await supabase
          .from('assets')
          .select('*')
          .eq('library_id', libraryId!)
          .order('created_at', { ascending: false }),
      ),
  })
}

export function useBrandAssets(brandId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: keys.brandAssets(brandId ?? ''),
    enabled: Boolean(brandId) && enabled,
    queryFn: async (): Promise<Asset[]> =>
      unwrap(
        await supabase
          .from('assets')
          .select('*')
          .eq('brand_id', brandId!)
          .order('created_at', { ascending: false }),
      ),
  })
}

export function useAssetsByIds(ids: string[]) {
  return useQuery({
    queryKey: keys.assetsByIds(ids),
    enabled: ids.length > 0,
    queryFn: async (): Promise<Asset[]> => {
      const rows = unwrap(await supabase.from('assets').select('*').in('id', ids))
      const byId = new Map(rows.map((r) => [r.id, r]))
      return ids.map((id) => byId.get(id)).filter((a): a is Asset => Boolean(a))
    },
  })
}

export function useAssetVersions(assetId: string | undefined) {
  return useQuery({
    queryKey: keys.assetVersions(assetId ?? ''),
    enabled: Boolean(assetId),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('asset_versions')
          .select('*, author:profiles(full_name, email)')
          .eq('asset_id', assetId!)
          .order('version', { ascending: false }),
      ),
  })
}

export function useCollections(libraryId: string | undefined) {
  return useQuery({
    queryKey: keys.collections(libraryId ?? ''),
    enabled: Boolean(libraryId),
    queryFn: async (): Promise<Collection[]> => {
      const rows = unwrap(
        await supabase
          .from('collections')
          .select('*, collection_assets(asset_id)')
          .eq('library_id', libraryId!)
          .order('sort'),
      )
      return rows.map(({ collection_assets, ...c }) => ({
        ...c,
        asset_ids: collection_assets.map((ca) => ca.asset_id),
      }))
    },
  })
}

export interface UploadedFile {
  path: string
  thumbPath: string | null
  fileName: string
  mime: string
  ext: string
  size: number
  width: number | null
  height: number | null
}

/** Lädt eine Datei samt Vorschaubild in den Marken-Ordner. */
export async function uploadBrandFile(brandId: string, folder: string, file: File): Promise<UploadedFile> {
  const mime = file.type || guessMime(file.name)
  const [size, thumb] = await Promise.all([readImageSize(file), createThumbnail(file)])
  const path = await uploadFile(buildPath(brandId, folder, file.name), file, mime)
  let thumbPath: string | null = null
  if (thumb) {
    try {
      thumbPath = await uploadFile(buildPath(brandId, 'thumbs', 'thumb.webp'), thumb, 'image/webp')
    } catch {
      thumbPath = null
    }
  }
  return {
    path,
    thumbPath,
    fileName: file.name,
    mime,
    ext: fileExtension(file.name),
    size: file.size,
    width: size?.width ?? null,
    height: size?.height ?? null,
  }
}

const MIME_BY_EXT: Record<string, string> = {
  svg: 'image/svg+xml',
  ai: 'application/postscript',
  eps: 'application/postscript',
  pdf: 'application/pdf',
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
  indd: 'application/x-indesign',
  psd: 'image/vnd.adobe.photoshop',
}

function guessMime(name: string): string {
  return MIME_BY_EXT[fileExtension(name)] ?? 'application/octet-stream'
}

function titleFromFileName(name: string): string {
  const base = name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim()
  return base.length > 0 ? base.slice(0, 200) : 'Datei'
}

export function useLibraryMutations(brandId: string) {
  const qc = useQueryClient()
  const invalidate = (libraryId?: string) => {
    qc.invalidateQueries({ queryKey: keys.libraries(brandId) })
    qc.invalidateQueries({ queryKey: keys.brandAssets(brandId) })
    qc.invalidateQueries({ queryKey: ['assets-by-ids'] })
    if (libraryId) qc.invalidateQueries({ queryKey: keys.assets(libraryId) })
  }

  return {
    createLibrary: useMutation({
      mutationFn: async (input: { name: string; kind: LibraryKind; existing: Library[] }) => {
        const base = slugify(input.name)
        let slug = base
        let i = 2
        while (input.existing.some((l) => l.slug === slug)) slug = `${base}-${i++}`
        return unwrap(
          await supabase
            .from('libraries')
            .insert({
              brand_id: brandId,
              name: input.name,
              kind: input.kind,
              slug,
              sort: input.existing.length,
            })
            .select()
            .single(),
        )
      },
      onSuccess: () => invalidate(),
    }),
    updateLibrary: useMutation({
      mutationFn: async (input: { id: string; patch: TablesUpdate<'libraries'> }) =>
        check(await supabase.from('libraries').update(input.patch).eq('id', input.id)),
      onSuccess: () => invalidate(),
    }),
    deleteLibrary: useMutation({
      mutationFn: async (library: Library) => {
        const assets = unwrap(
          await supabase.from('assets').select('id, file_path, thumb_path').eq('library_id', library.id),
        )
        const versions = unwrap(
          await supabase
            .from('asset_versions')
            .select('file_path, thumb_path')
            .in(
              'asset_id',
              assets.map((a) => a.id),
            ),
        )
        await removeFiles([
          ...assets.flatMap((a) => [a.file_path, a.thumb_path]),
          ...versions.flatMap((v) => [v.file_path, v.thumb_path]),
        ])
        check(await supabase.from('libraries').delete().eq('id', library.id))
      },
      onSuccess: () => invalidate(),
    }),
    uploadAsset: useMutation({
      mutationFn: async (input: { libraryId: string; file: File; tags?: string[] }) => {
        const uploaded = await uploadBrandFile(brandId, 'assets', input.file)
        return unwrap(
          await supabase
            .from('assets')
            .insert({
              library_id: input.libraryId,
              brand_id: brandId,
              title: titleFromFileName(input.file.name),
              file_path: uploaded.path,
              thumb_path: uploaded.thumbPath,
              file_name: uploaded.fileName,
              mime_type: uploaded.mime,
              ext: uploaded.ext,
              size_bytes: uploaded.size,
              width: uploaded.width,
              height: uploaded.height,
              tags: input.tags ?? [],
            })
            .select()
            .single(),
        )
      },
      onSuccess: (asset) => invalidate(asset.library_id),
    }),
    updateAsset: useMutation({
      mutationFn: async (input: { id: string; patch: TablesUpdate<'assets'> }) =>
        unwrap(await supabase.from('assets').update(input.patch).eq('id', input.id).select().single()),
      onSuccess: (asset, input) => {
        invalidate(asset.library_id)
        if (input.patch.library_id) invalidate()
      },
    }),
    replaceAsset: useMutation({
      mutationFn: async (input: { asset: Asset; file: File; note: string }) => {
        const { asset } = input
        // Bisherige Datei als Version archivieren
        check(
          await supabase.from('asset_versions').insert({
            asset_id: asset.id,
            brand_id: brandId,
            version: asset.version,
            file_path: asset.file_path,
            thumb_path: asset.thumb_path,
            file_name: asset.file_name,
            mime_type: asset.mime_type,
            size_bytes: asset.size_bytes,
            width: asset.width,
            height: asset.height,
            note: input.note,
          }),
        )
        const uploaded = await uploadBrandFile(brandId, 'assets', input.file)
        return unwrap(
          await supabase
            .from('assets')
            .update({
              file_path: uploaded.path,
              thumb_path: uploaded.thumbPath,
              file_name: uploaded.fileName,
              mime_type: uploaded.mime,
              ext: uploaded.ext,
              size_bytes: uploaded.size,
              width: uploaded.width,
              height: uploaded.height,
              version: asset.version + 1,
            })
            .eq('id', asset.id)
            .select()
            .single(),
        )
      },
      onSuccess: (asset) => {
        invalidate(asset.library_id)
        qc.invalidateQueries({ queryKey: keys.assetVersions(asset.id) })
      },
    }),
    restoreVersion: useMutation({
      mutationFn: async (input: { asset: Asset; version: AssetVersion }) => {
        const { asset, version } = input
        check(
          await supabase.from('asset_versions').insert({
            asset_id: asset.id,
            brand_id: brandId,
            version: asset.version,
            file_path: asset.file_path,
            thumb_path: asset.thumb_path,
            file_name: asset.file_name,
            mime_type: asset.mime_type,
            size_bytes: asset.size_bytes,
            width: asset.width,
            height: asset.height,
            note: `Ersetzt durch Wiederherstellung von Version ${version.version}`,
          }),
        )
        return unwrap(
          await supabase
            .from('assets')
            .update({
              file_path: version.file_path,
              thumb_path: version.thumb_path,
              file_name: version.file_name,
              mime_type: version.mime_type,
              ext: fileExtension(version.file_name),
              size_bytes: version.size_bytes,
              width: version.width,
              height: version.height,
              version: asset.version + 1,
            })
            .eq('id', asset.id)
            .select()
            .single(),
        )
      },
      onSuccess: (asset) => {
        invalidate(asset.library_id)
        qc.invalidateQueries({ queryKey: keys.assetVersions(asset.id) })
      },
    }),
    deleteAssets: useMutation({
      mutationFn: async (assets: Asset[]) => {
        const ids = assets.map((a) => a.id)
        const versions = unwrap(
          await supabase.from('asset_versions').select('file_path, thumb_path').in('asset_id', ids),
        )
        // Dateien, die noch von Bausteinen genutzt werden könnten, bleiben nicht referenziert zurück → entfernen
        await removeFiles([
          ...assets.flatMap((a) => [a.file_path, a.thumb_path]),
          ...versions.flatMap((v) => [v.file_path, v.thumb_path]),
        ])
        check(await supabase.from('assets').delete().in('id', ids))
        return assets[0]?.library_id
      },
      onSuccess: (libraryId) => invalidate(libraryId),
    }),
    createCollection: useMutation({
      mutationFn: async (input: { libraryId: string; name: string; sort: number }) =>
        unwrap(
          await supabase
            .from('collections')
            .insert({ library_id: input.libraryId, brand_id: brandId, name: input.name, sort: input.sort })
            .select()
            .single(),
        ),
      onSuccess: (c) => qc.invalidateQueries({ queryKey: keys.collections(c.library_id) }),
    }),
    renameCollection: useMutation({
      mutationFn: async (input: { collection: Collection; name: string }) =>
        check(await supabase.from('collections').update({ name: input.name }).eq('id', input.collection.id)),
      onSuccess: (_r, input) =>
        qc.invalidateQueries({ queryKey: keys.collections(input.collection.library_id) }),
    }),
    deleteCollection: useMutation({
      mutationFn: async (collection: Collection) =>
        check(await supabase.from('collections').delete().eq('id', collection.id)),
      onSuccess: (_r, c) => qc.invalidateQueries({ queryKey: keys.collections(c.library_id) }),
    }),
    toggleInCollection: useMutation({
      mutationFn: async (input: { collection: Collection; assetIds: string[]; add: boolean }) => {
        if (input.add) {
          check(
            await supabase.from('collection_assets').upsert(
              input.assetIds.map((asset_id) => ({
                collection_id: input.collection.id,
                asset_id,
                brand_id: brandId,
              })),
              { onConflict: 'collection_id,asset_id', ignoreDuplicates: true },
            ),
          )
        } else {
          check(
            await supabase
              .from('collection_assets')
              .delete()
              .eq('collection_id', input.collection.id)
              .in('asset_id', input.assetIds),
          )
        }
      },
      onSuccess: (_r, input) =>
        qc.invalidateQueries({ queryKey: keys.collections(input.collection.library_id) }),
    }),
  }
}
