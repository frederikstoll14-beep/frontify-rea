import { ImagePlus, Library, Trash2, Upload } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { uploadBrandFile } from '@/api/libraries'
import { Button } from '@/components/ui/button'
import type { ImageRef } from '@/lib/blocks/types'
import { cn, errorMessage } from '@/lib/utils'
import { AssetPickerDialog } from './asset-picker'
import { StorageImage } from './storage-image'

const MAX_BYTES = 50 * 1024 * 1024

export function useFileUpload(brandId: string, folder = 'blocks') {
  const [uploading, setUploading] = useState(false)
  const upload = async (file: File): Promise<ImageRef | null> => {
    if (file.size > MAX_BYTES) {
      toast.error('Die Datei ist zu groß (max. 50 MB).')
      return null
    }
    setUploading(true)
    try {
      const result = await uploadBrandFile(brandId, folder, file)
      return { path: result.path, width: result.width, height: result.height, mime: result.mime, assetId: null }
    } catch (error) {
      toast.error(`Upload fehlgeschlagen: ${errorMessage(error)}`)
      return null
    } finally {
      setUploading(false)
    }
  }
  return { upload, uploading }
}

/** Bild hochladen oder aus der Mediathek wählen. */
export function ImageField({
  brandId,
  value,
  onChange,
  accept = 'image/*',
  label = 'Bild',
  className,
  aspect = 'aspect-video',
  emptyHint,
}: {
  brandId: string
  value: ImageRef | null
  onChange: (value: ImageRef | null) => void
  accept?: string
  label?: string
  className?: string
  aspect?: string
  emptyHint?: ReactNode
}) {
  const input = useRef<HTMLInputElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const { upload, uploading } = useFileUpload(brandId)
  const [dragOver, setDragOver] = useState(false)

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    const ref = await upload(file)
    if (ref) onChange(ref)
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        className={cn(
          'relative flex items-center justify-center overflow-hidden rounded-xl border border-dashed border-border-strong bg-surface-2/60',
          aspect,
          dragOver && 'border-ring bg-accent-soft',
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          void handleFiles(e.dataTransfer.files)
        }}
      >
        {value ? (
          <StorageImage path={value.path} alt={label} fit="contain" className="h-full w-full" />
        ) : (
          <div className="flex flex-col items-center gap-1 px-4 text-center text-sm text-muted">
            <ImagePlus className="size-6" />
            <span>{uploading ? 'Lädt hoch …' : (emptyHint ?? 'Bild hierher ziehen')}</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" loading={uploading} onClick={() => input.current?.click()}>
          <Upload /> Hochladen
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
          <Library /> Aus Mediathek
        </Button>
        {value && (
          <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
            <Trash2 /> Entfernen
          </Button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <AssetPickerDialog
        brandId={brandId}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        filter={accept.startsWith('image') ? 'image' : accept.startsWith('video') ? 'video' : accept.startsWith('audio') ? 'audio' : 'all'}
        onPick={(assets) => {
          const asset = assets[0]
          if (asset) {
            onChange({
              path: asset.file_path,
              width: asset.width,
              height: asset.height,
              mime: asset.mime_type,
              assetId: asset.id,
            })
          }
        }}
      />
    </div>
  )
}
