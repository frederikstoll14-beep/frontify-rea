import {
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileText,
  FileType,
  FileVideo,
  File as FileIcon,
} from 'lucide-react'
import type { Asset } from '@/api/libraries'
import { useSignedUrl } from '@/api/storage'
import type { PreviewBackground } from '@/lib/blocks/types'
import { isImageMime } from '@/lib/media'
import { cn } from '@/lib/utils'

export function StorageImage({
  path,
  alt,
  className,
  fit = 'cover',
  loading = 'lazy',
}: {
  path: string | null | undefined
  alt: string
  className?: string
  fit?: 'cover' | 'contain'
  loading?: 'lazy' | 'eager'
}) {
  const { data: url, isLoading } = useSignedUrl(path)
  if (!path) return null
  if (isLoading) return <div className={cn('animate-pulse bg-surface-2', className)} aria-hidden />
  if (!url) {
    return (
      <div className={cn('flex items-center justify-center bg-surface-2 text-muted', className)}>
        <FileImage className="size-6" aria-label="Bild nicht verfügbar" />
      </div>
    )
  }
  return (
    <img
      src={url}
      alt={alt}
      loading={loading}
      decoding="async"
      className={cn(fit === 'cover' ? 'object-cover' : 'object-contain', className)}
      draggable={false}
    />
  )
}

export function backgroundClass(bg: PreviewBackground | 'none' | undefined): string {
  switch (bg) {
    case 'dark':
      return 'bg-[#15171F]'
    case 'brand':
      return 'bg-brand'
    case 'checker':
      return 'checker'
    case 'light':
      return 'bg-[#F4F3EF]'
    default:
      return ''
  }
}

export function FileTypeIcon({
  mime,
  ext,
  className,
}: {
  mime?: string | null
  ext?: string | null
  className?: string
}) {
  const e = (ext ?? '').toLowerCase()
  const Icon = mime?.startsWith('image/')
    ? FileImage
    : mime?.startsWith('video/')
      ? FileVideo
      : mime?.startsWith('audio/')
        ? FileAudio
        : ['zip', 'rar', '7z'].includes(e)
          ? FileArchive
          : ['woff', 'woff2', 'ttf', 'otf'].includes(e)
            ? FileType
            : ['html', 'css', 'js', 'json', 'svg'].includes(e)
              ? FileCode
              : ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'key', 'txt', 'md', 'xls', 'xlsx'].includes(e)
                ? FileText
                : FileIcon
  return <Icon className={className} aria-hidden />
}

/** Vorschau eines Assets: Thumbnail, Originalbild oder Datei-Icon. */
export function AssetPreview({
  asset,
  background = 'light',
  className,
  fit = 'contain',
  preferOriginal = false,
}: {
  asset: Pick<Asset, 'title' | 'file_path' | 'thumb_path' | 'mime_type' | 'ext'>
  background?: PreviewBackground | 'none'
  className?: string
  fit?: 'cover' | 'contain'
  preferOriginal?: boolean
}) {
  const imagePath =
    preferOriginal && isImageMime(asset.mime_type)
      ? asset.file_path
      : (asset.thumb_path ?? (isImageMime(asset.mime_type) ? asset.file_path : null))
  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden',
        backgroundClass(background),
        className,
      )}
    >
      {imagePath ? (
        <StorageImage
          path={imagePath}
          alt={asset.title}
          fit={fit}
          className={cn('h-full w-full', fit === 'contain' && 'p-[8%]')}
        />
      ) : (
        <div className="flex flex-col items-center gap-2 text-muted">
          <FileTypeIcon mime={asset.mime_type} ext={asset.ext} className="size-10" />
          {asset.ext && <span className="text-xs font-semibold tracking-wide uppercase">{asset.ext}</span>}
        </div>
      )}
    </div>
  )
}
