import JSZip from 'jszip'
import { Download } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { Asset } from '@/api/libraries'
import { downloadFile } from '@/api/storage'
import { Button } from '@/components/ui/button'
import { MenuContent, MenuItem, MenuLabel, MenuRoot, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { convertImage, isImageMime, type ConvertFormat } from '@/lib/media'
import { downloadBlob, errorMessage, slugify } from '@/lib/utils'

type DownloadableAsset = Pick<Asset, 'id' | 'title' | 'file_path' | 'file_name' | 'mime_type' | 'width' | 'ext'>

const SIZES = [512, 1024, 2048]

function baseName(asset: DownloadableAsset): string {
  return slugify(asset.title || asset.file_name.replace(/\.[^.]+$/, ''))
}

export async function downloadAsset(
  asset: DownloadableAsset,
  format: ConvertFormat = 'original',
  width: number | null = null,
): Promise<void> {
  const blob = await downloadFile(asset.file_path)
  if (format === 'original') {
    downloadBlob(blob, asset.file_name)
    return
  }
  const typed = blob.type ? blob : new Blob([blob], { type: asset.mime_type })
  const converted = await convertImage(typed, format, width)
  downloadBlob(converted, `${baseName(asset)}${width ? `-${width}px` : ''}.${format}`)
}

export async function downloadAssetsZip(assets: DownloadableAsset[], zipName: string): Promise<void> {
  const zip = new JSZip()
  const used = new Set<string>()
  for (const asset of assets) {
    const blob = await downloadFile(asset.file_path)
    let name = asset.file_name
    let i = 2
    while (used.has(name)) {
      name = asset.file_name.replace(/(\.[^.]+)?$/, `-${i++}$1`)
    }
    used.add(name)
    zip.file(name, blob)
  }
  const content = await zip.generateAsync({ type: 'blob' })
  downloadBlob(content, `${slugify(zipName)}.zip`)
}

/** Download-Menü mit Formatkonvertierung für Bilder und SVGs. */
export function DownloadMenu({
  asset,
  size = 'sm',
  variant = 'outline',
  label = 'Download',
  iconOnly,
}: {
  asset: DownloadableAsset
  size?: 'sm' | 'md' | 'icon-sm'
  variant?: 'outline' | 'primary' | 'ghost' | 'secondary'
  label?: string
  iconOnly?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const run = async (format: ConvertFormat, width: number | null) => {
    setBusy(true)
    try {
      await downloadAsset(asset, format, width)
    } catch (error) {
      toast.error(`Download fehlgeschlagen: ${errorMessage(error)}`)
    } finally {
      setBusy(false)
    }
  }
  const convertible = isImageMime(asset.mime_type)
  const trigger = (
    <Button size={iconOnly ? 'icon-sm' : size} variant={variant} loading={busy} aria-label={label}>
      {!busy && <Download />}
      {!iconOnly && label}
    </Button>
  )
  if (!convertible) {
    return (
      <Button
        size={iconOnly ? 'icon-sm' : size}
        variant={variant}
        loading={busy}
        aria-label={label}
        onClick={() => void run('original', null)}
      >
        {!busy && <Download />}
        {!iconOnly && label}
      </Button>
    )
  }
  const maxWidth = asset.width ?? 4096
  return (
    <MenuRoot>
      <MenuTrigger asChild>{trigger}</MenuTrigger>
      <MenuContent>
        <MenuItem onSelect={() => void run('original', null)}>
          Original <span className="text-xs text-muted uppercase">({asset.ext || 'Datei'})</span>
        </MenuItem>
        <MenuSeparator />
        {(['png', 'jpg', 'webp'] as const).map((format) => (
          <div key={format}>
            <MenuLabel>{format.toUpperCase()}</MenuLabel>
            {SIZES.filter((s) => asset.mime_type === 'image/svg+xml' || s <= maxWidth).map((w) => (
              <MenuItem key={w} onSelect={() => void run(format, w)}>
                {w} px Breite
              </MenuItem>
            ))}
            {asset.mime_type !== 'image/svg+xml' && (
              <MenuItem onSelect={() => void run(format, null)}>Originalgröße</MenuItem>
            )}
          </div>
        ))}
      </MenuContent>
    </MenuRoot>
  )
}
