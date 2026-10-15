import { Check, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useBrandAssets, useLibraries, type Asset } from '@/api/libraries'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input, Select } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/misc'
import { isAudioMime, isImageMime, isVideoMime } from '@/lib/media'
import { cn } from '@/lib/utils'
import { AssetPreview } from './storage-image'

export function AssetPickerDialog({
  brandId,
  open,
  onOpenChange,
  onPick,
  multiple = false,
  filter = 'all',
  initialSelection = [],
}: {
  brandId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (assets: Asset[]) => void
  multiple?: boolean
  filter?: 'all' | 'image' | 'video' | 'audio'
  initialSelection?: string[]
}) {
  const { data: assets = [], isLoading } = useBrandAssets(brandId, open)
  const { data: libraries = [] } = useLibraries(brandId)
  const [query, setQuery] = useState('')
  const [libraryId, setLibraryId] = useState('')
  const [selected, setSelected] = useState<string[]>(initialSelection)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return assets.filter((a) => {
      if (libraryId && a.library_id !== libraryId) return false
      if (filter === 'image' && !isImageMime(a.mime_type)) return false
      if (filter === 'video' && !isVideoMime(a.mime_type)) return false
      if (filter === 'audio' && !isAudioMime(a.mime_type)) return false
      if (!q) return true
      return (
        a.title.toLowerCase().includes(q) ||
        a.file_name.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [assets, query, libraryId, filter])

  const toggle = (asset: Asset) => {
    if (!multiple) {
      onPick([asset])
      onOpenChange(false)
      return
    }
    setSelected((prev) => (prev.includes(asset.id) ? prev.filter((id) => id !== asset.id) : [...prev, asset.id]))
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setSelected(initialSelection)
        onOpenChange(next)
      }}
      title={multiple ? 'Assets auswählen' : 'Asset auswählen'}
      description="Aus allen Bibliotheken dieser Marke"
      size="xl"
      footer={
        multiple ? (
          <>
            <span className="mr-auto self-center text-sm text-muted">{selected.length} ausgewählt</span>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={() => {
                const byId = new Map(assets.map((a) => [a.id, a]))
                onPick(selected.map((id) => byId.get(id)).filter((a): a is Asset => Boolean(a)))
                onOpenChange(false)
              }}
            >
              Übernehmen
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Suchen …" className="pl-9" autoFocus />
        </div>
        <Select value={libraryId} onChange={(e) => setLibraryId(e.target.value)} className="sm:w-56">
          <option value="">Alle Bibliotheken</option>
          {libraries.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </div>
      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted">Lädt …</p>
      ) : visible.length === 0 ? (
        <EmptyState
          title="Keine passenden Assets"
          description="Lade zuerst Dateien in eine Bibliothek hoch – oder nutze „Hochladen“."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {visible.map((asset) => {
            const isSelected = selected.includes(asset.id)
            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => toggle(asset)}
                className={cn(
                  'group relative overflow-hidden rounded-xl border bg-surface text-left transition-shadow hover:shadow-card',
                  isSelected ? 'border-ink ring-2 ring-ink' : 'border-border',
                )}
              >
                <AssetPreview asset={asset} className="aspect-square" />
                <div className="truncate border-t border-border px-2.5 py-2 text-xs font-medium">{asset.title}</div>
                {isSelected && (
                  <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-ink text-bg">
                    <Check className="size-4" />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </Dialog>
  )
}
