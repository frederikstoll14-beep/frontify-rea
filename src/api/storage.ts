import { useQuery } from '@tanstack/react-query'
import { BUCKET, supabase } from '@/lib/supabase'
import { fileExtension, uniqueId } from '@/lib/utils'

const TTL_SECONDS = 60 * 60
const cache = new Map<string, { url: string; expires: number }>()
let pending: Map<string, Array<(url: string | null) => void>> | null = null

async function flush(batch: Map<string, Array<(url: string | null) => void>>) {
  const paths = [...batch.keys()]
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100)
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(chunk, TTL_SECONDS)
    const byPath = new Map<string, string>()
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) byPath.set(entry.path, entry.signedUrl)
    }
    for (const path of chunk) {
      const url = byPath.get(path) ?? null
      if (url) cache.set(path, { url, expires: Date.now() + (TTL_SECONDS - 120) * 1000 })
      batch.get(path)?.forEach((resolve) => resolve(url))
    }
  }
}

/** Liefert eine signierte URL; Anfragen im selben Tick werden gebündelt. */
export function getSignedUrl(path: string): Promise<string | null> {
  const hit = cache.get(path)
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.url)
  return new Promise((resolve) => {
    if (!pending) {
      pending = new Map()
      const batch = pending
      queueMicrotask(() => {
        pending = null
        flush(batch).catch(() => batch.forEach((resolvers) => resolvers.forEach((r) => r(null))))
      })
    }
    const list = pending.get(path) ?? []
    list.push(resolve)
    pending.set(path, list)
  })
}

export function useSignedUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['signed-url', path],
    enabled: Boolean(path),
    staleTime: (TTL_SECONDS - 300) * 1000,
    gcTime: TTL_SECONDS * 1000,
    queryFn: () => getSignedUrl(path!),
  })
}

export async function downloadFile(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error) throw error
  return data
}

export function buildPath(brandId: string, folder: string, fileName: string): string {
  const ext = fileExtension(fileName)
  return `${brandId}/${folder}/${uniqueId()}${ext ? `.${ext}` : ''}`
}

export async function uploadFile(path: string, file: Blob, contentType?: string): Promise<string> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: contentType ?? (file.type || 'application/octet-stream'),
    upsert: false,
    cacheControl: '3600',
  })
  if (error) throw error
  return path
}

export async function removeFiles(paths: Array<string | null | undefined>): Promise<void> {
  const list = paths.filter((p): p is string => Boolean(p))
  if (list.length === 0) return
  await supabase.storage.from(BUCKET).remove(list)
}
