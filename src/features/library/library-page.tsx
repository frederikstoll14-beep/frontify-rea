import {
  CheckSquare,
  Download,
  FolderInput,
  FolderOpen,
  FolderPlus,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pencil,
  Search,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import {
  LIBRARY_KINDS,
  useAssets,
  useCollections,
  useLibraries,
  useLibraryMutations,
  type Asset,
} from '@/api/libraries'
import { downloadAssetsZip } from '@/components/media/download-menu'
import { AssetPreview } from '@/components/media/storage-image'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/input'
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from '@/components/ui/menu'
import { Badge, EmptyState, Segmented } from '@/components/ui/misc'
import { PageSpinner } from '@/components/ui/spinner'
import type { PreviewBackground } from '@/lib/blocks/types'
import { isAudioMime, isImageMime, isVideoMime } from '@/lib/media'
import { cn, errorMessage, formatBytes, formatDate } from '@/lib/utils'
import { useBrandContext, useCanDownload } from '@/features/brand/brand-context'
import { AssetDetailSheet } from './asset-detail'
import { normalizeTag } from './tag-input'

type TypeFilter = 'all' | 'image' | 'vector' | 'video' | 'audio' | 'document'

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: 'Alle Typen',
  image: 'Bilder',
  vector: 'Vektor (SVG/PDF/AI/EPS)',
  video: 'Video',
  audio: 'Audio',
  document: 'Dokumente',
}

function matchesType(asset: Asset, type: TypeFilter): boolean {
  const ext = asset.ext.toLowerCase()
  switch (type) {
    case 'all':
      return true
    case 'image':
      return isImageMime(asset.mime_type) && ext !== 'svg'
    case 'vector':
      return ['svg', 'pdf', 'ai', 'eps'].includes(ext)
    case 'video':
      return isVideoMime(asset.mime_type)
    case 'audio':
      return isAudioMime(asset.mime_type)
    case 'document':
      return !isImageMime(asset.mime_type) && !isVideoMime(asset.mime_type) && !isAudioMime(asset.mime_type)
  }
}

interface UploadProgress {
  total: number
  done: number
  failed: number
}

export function LibraryPage() {
  const { librarySlug } = useParams()
  const { brand, basePath, canEdit } = useBrandContext()
  const canDownload = useCanDownload()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { data: libraries = [], isLoading: loadingLibraries } = useLibraries(brand.id)
  const library = libraries.find((l) => l.slug === librarySlug)
  const { data: assets = [], isLoading } = useAssets(library?.id)
  const { data: collections = [] } = useCollections(library?.id)
  const m = useLibraryMutations(brand.id)
  const confirm = useConfirm()
  const fileInput = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  const [type, setType] = useState<TypeFilter>('all')
  const [tag, setTag] = useState<string | null>(null)
  const [collectionId, setCollectionId] = useState<string | null>(null)
  const [sort, setSort] = useState<'new' | 'name'>('new')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [background, setBackground] = useState<PreviewBackground>(
    library?.kind === 'logos' ? 'checker' : 'light',
  )
  const [selected, setSelected] = useState<string[]>([])
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [dialog, setDialog] = useState<'collection' | 'tag' | 'rename' | null>(null)
  const [dialogValue, setDialogValue] = useState('')
  const [zipping, setZipping] = useState(false)

  const assetId = params.get('asset')
  const openAsset = assets.find((a) => a.id === assetId) ?? null

  const allTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of assets) for (const t of a.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
  }, [assets])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const collection = collections.find((c) => c.id === collectionId)
    const list = assets.filter((a) => {
      if (collection && !collection.asset_ids.includes(a.id)) return false
      if (tag && !a.tags.includes(tag)) return false
      if (!matchesType(a, type)) return false
      if (!q) return true
      return [a.title, a.description, a.file_name, a.copyright, ...a.tags].some((s) =>
        s.toLowerCase().includes(q),
      )
    })
    return sort === 'name' ? [...list].sort((a, b) => a.title.localeCompare(b.title, 'de')) : list
  }, [assets, collections, collectionId, tag, type, query, sort])

  if (loadingLibraries) return <PageSpinner />
  if (!library) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <EmptyState
          icon={<FolderOpen />}
          title="Bibliothek nicht gefunden"
          action={
            <Button asChild variant="outline">
              <Link to={basePath}>Zur Startseite</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const selectedAssets = assets.filter((a) => selected.includes(a.id))
  const toggleSelect = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files)
    if (list.length === 0) return
    const tooBig = list.filter((f) => f.size > 50 * 1024 * 1024)
    if (tooBig.length > 0) toast.error(`${tooBig.length} Datei(en) über 50 MB übersprungen.`)
    const queue = list.filter((f) => f.size <= 50 * 1024 * 1024)
    setProgress({ total: queue.length, done: 0, failed: 0 })
    let done = 0
    let failed = 0
    // max. 3 parallele Uploads
    const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
      while (queue.length > 0) {
        const file = queue.shift()!
        try {
          await m.uploadAsset.mutateAsync({ libraryId: library.id, file })
          done++
        } catch (error) {
          failed++
          toast.error(`${file.name}: ${errorMessage(error)}`)
        }
        setProgress({ total: done + failed + queue.length, done, failed })
      }
    })
    await Promise.all(workers)
    setProgress(null)
    if (done > 0) toast.success(`${done} Datei(en) hochgeladen`)
  }

  const submitDialog = async () => {
    const value = dialogValue.trim()
    if (!value) return
    try {
      if (dialog === 'collection') {
        const collection = await m.createCollection.mutateAsync({
          libraryId: library.id,
          name: value,
          sort: collections.length,
        })
        if (selected.length > 0) {
          await m.toggleInCollection.mutateAsync({
            collection: { ...collection, asset_ids: [] },
            assetIds: selected,
            add: true,
          })
        }
        toast.success('Sammlung angelegt')
      } else if (dialog === 'tag') {
        const t = normalizeTag(value)
        await Promise.all(
          selectedAssets.map((a) =>
            a.tags.includes(t)
              ? null
              : m.updateAsset.mutateAsync({ id: a.id, patch: { tags: [...a.tags, t] } }),
          ),
        )
        toast.success(`Tag „${t}“ vergeben`)
      } else if (dialog === 'rename') {
        await m.updateLibrary.mutateAsync({ id: library.id, patch: { name: value } })
      }
      setDialog(null)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const openDialog = (kind: 'collection' | 'tag' | 'rename') => {
    setDialogValue(kind === 'rename' ? library.name : '')
    setDialog(kind)
  }

  return (
    <div
      className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8"
      onDragOver={(e) => {
        if (!canEdit || !e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false)
      }}
      onDrop={(e) => {
        if (!canEdit) return
        e.preventDefault()
        setDragOver(false)
        void uploadFiles(e.dataTransfer.files)
      }}
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-brand-accent-text uppercase">
            Bibliothek · {LIBRARY_KINDS[library.kind].label}
          </p>
          <h1 className="mt-1 font-brand-heading text-3xl font-bold text-ink sm:text-4xl">{library.name}</h1>
          {library.description && <p className="mt-1 text-ink-2">{library.description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <>
              <Button onClick={() => fileInput.current?.click()} loading={progress !== null}>
                <Upload /> Hochladen
              </Button>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept={LIBRARY_KINDS[library.kind].accept}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) void uploadFiles(e.target.files)
                  e.target.value = ''
                }}
              />
              <MenuRoot>
                <MenuTrigger asChild>
                  <Button size="icon" variant="outline" aria-label="Bibliothek verwalten">
                    <MoreHorizontal />
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  <MenuItem icon={<Pencil />} onSelect={() => openDialog('rename')}>
                    Umbenennen
                  </MenuItem>
                  <MenuItem icon={<FolderPlus />} onSelect={() => openDialog('collection')}>
                    Neue Sammlung
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem
                    icon={<Trash2 />}
                    danger
                    onSelect={async () => {
                      const ok = await confirm({
                        title: 'Bibliothek löschen?',
                        description: `„${library.name}“ und alle ${assets.length} Dateien werden dauerhaft gelöscht.`,
                        confirmLabel: 'Endgültig löschen',
                        danger: true,
                      })
                      if (!ok) return
                      m.deleteLibrary.mutate(library, {
                        onSuccess: () => navigate(basePath),
                        onError: (e) => toast.error(errorMessage(e)),
                      })
                    }}
                  >
                    Bibliothek löschen
                  </MenuItem>
                </MenuContent>
              </MenuRoot>
            </>
          )}
        </div>
      </header>

      {progress && (
        <div className="mb-4 rounded-xl border border-border bg-surface p-3" role="status">
          <div className="mb-2 flex justify-between text-sm">
            <span>
              Lädt hoch … {progress.done} von {progress.total}
            </span>
            {progress.failed > 0 && <span className="text-danger">{progress.failed} fehlgeschlagen</span>}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full bg-accent transition-all"
              style={{
                width: `${progress.total ? ((progress.done + progress.failed) / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`In ${assets.length} Dateien suchen …`}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={type} onChange={(e) => setType(e.target.value as TypeFilter)} className="w-auto">
            {(Object.keys(TYPE_LABELS) as TypeFilter[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as 'new' | 'name')} className="w-auto">
            <option value="new">Neueste zuerst</option>
            <option value="name">Name A–Z</option>
          </Select>
          <Segmented
            size="sm"
            value={background}
            onChange={setBackground}
            options={[
              { value: 'light', label: 'Hell' },
              { value: 'dark', label: 'Dunkel' },
              { value: 'checker', label: 'Raster' },
            ]}
          />
          <Segmented
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: 'grid', label: <LayoutGrid />, title: 'Raster' },
              { value: 'list', label: <List />, title: 'Liste' },
            ]}
          />
        </div>
      </div>

      {(collections.length > 0 || allTags.length > 0) && (
        <div className="mb-5 space-y-2">
          {collections.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium text-muted">Sammlungen:</span>
              {collections.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCollectionId(collectionId === c.id ? null : c.id)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium',
                    collectionId === c.id
                      ? 'border-ink bg-ink text-bg'
                      : 'border-border bg-surface text-ink-2 hover:border-border-strong',
                  )}
                >
                  {c.name} <span className="opacity-60">{c.asset_ids.length}</span>
                </button>
              ))}
              {collectionId && canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const c = collections.find((x) => x.id === collectionId)
                    if (!c) return
                    const ok = await confirm({
                      title: 'Sammlung löschen?',
                      description: 'Die Dateien bleiben erhalten.',
                      confirmLabel: 'Löschen',
                      danger: true,
                    })
                    if (ok) {
                      m.deleteCollection.mutate(c)
                      setCollectionId(null)
                    }
                  }}
                >
                  <Trash2 /> Sammlung löschen
                </Button>
              )}
            </div>
          )}
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium text-muted">Tags:</span>
              {allTags.slice(0, 24).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTag(tag === t ? null : t)}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-medium',
                    tag === t ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink-2 hover:bg-border',
                  )}
                >
                  #{t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selected.length > 0 && (
        <div className="sticky top-[4.5rem] z-20 mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-2 pl-4 shadow-card">
          <span className="text-sm font-medium">{selected.length} ausgewählt</span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {canDownload && (
              <Button
                size="sm"
                loading={zipping}
                onClick={async () => {
                  setZipping(true)
                  try {
                    await downloadAssetsZip(selectedAssets, `${brand.slug}-${library.slug}`)
                  } catch (e) {
                    toast.error(errorMessage(e))
                  } finally {
                    setZipping(false)
                  }
                }}
              >
                {!zipping && <Download />} ZIP
              </Button>
            )}
            {canEdit && (
              <>
                <Button size="sm" variant="outline" onClick={() => openDialog('tag')}>
                  <Tag /> Tag
                </Button>
                <MenuRoot>
                  <MenuTrigger asChild>
                    <Button size="sm" variant="outline">
                      <FolderInput /> Ablegen
                    </Button>
                  </MenuTrigger>
                  <MenuContent>
                    {collections.map((c) => (
                      <MenuItem
                        key={c.id}
                        onSelect={() =>
                          m.toggleInCollection.mutate(
                            { collection: c, assetIds: selected, add: true },
                            { onSuccess: () => toast.success(`Zu „${c.name}“ hinzugefügt`) },
                          )
                        }
                      >
                        In Sammlung „{c.name}“
                      </MenuItem>
                    ))}
                    {collectionId && (
                      <MenuItem
                        onSelect={() => {
                          const c = collections.find((x) => x.id === collectionId)
                          if (c)
                            m.toggleInCollection.mutate({ collection: c, assetIds: selected, add: false })
                        }}
                      >
                        Aus aktueller Sammlung entfernen
                      </MenuItem>
                    )}
                    <MenuItem icon={<FolderPlus />} onSelect={() => openDialog('collection')}>
                      Neue Sammlung …
                    </MenuItem>
                    {libraries.length > 1 && (
                      <MenuSub>
                        <MenuSubTrigger>In andere Bibliothek</MenuSubTrigger>
                        <MenuSubContent>
                          {libraries
                            .filter((l) => l.id !== library.id)
                            .map((l) => (
                              <MenuItem
                                key={l.id}
                                onSelect={async () => {
                                  await Promise.all(
                                    selected.map((id) =>
                                      m.updateAsset.mutateAsync({ id, patch: { library_id: l.id } }),
                                    ),
                                  )
                                  setSelected([])
                                  toast.success(`Nach „${l.name}“ verschoben`)
                                }}
                              >
                                {l.name}
                              </MenuItem>
                            ))}
                        </MenuSubContent>
                      </MenuSub>
                    )}
                  </MenuContent>
                </MenuRoot>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-danger"
                  onClick={async () => {
                    const ok = await confirm({
                      title: `${selected.length} Datei(en) löschen?`,
                      description: 'Die Dateien und ihre Versionen werden dauerhaft gelöscht.',
                      confirmLabel: 'Löschen',
                      danger: true,
                    })
                    if (!ok) return
                    m.deleteAssets.mutate(selectedAssets, {
                      onSuccess: () => {
                        setSelected([])
                        toast.success('Gelöscht')
                      },
                      onError: (e) => toast.error(errorMessage(e)),
                    })
                  }}
                >
                  <Trash2 />
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelected(visible.map((a) => a.id))}>
              <CheckSquare /> Alle
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Auswahl aufheben"
              onClick={() => setSelected([])}
            >
              <X />
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <PageSpinner />
      ) : assets.length === 0 ? (
        <EmptyState
          icon={<Upload />}
          title="Noch keine Dateien"
          description={
            canEdit
              ? 'Ziehe Dateien hierher oder klicke auf „Hochladen“. Bis 50 MB pro Datei.'
              : 'Hier liegen bald Dateien.'
          }
          action={
            canEdit ? (
              <Button onClick={() => fileInput.current?.click()}>
                <Upload /> Dateien auswählen
              </Button>
            ) : undefined
          }
          className={cn(dragOver && 'border-accent bg-accent-soft')}
        />
      ) : visible.length === 0 ? (
        <EmptyState title="Keine Treffer" description="Passe Suche oder Filter an." />
      ) : view === 'grid' ? (
        <div
          className={cn(
            'grid grid-cols-2 gap-3 rounded-2xl sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6',
            dragOver && 'outline-2 outline-offset-4 outline-accent outline-dashed',
          )}
        >
          {visible.map((asset) => {
            const isSelected = selected.includes(asset.id)
            const expired = asset.expires_at ? new Date(asset.expires_at) < new Date() : false
            return (
              <div
                key={asset.id}
                className={cn(
                  'group relative overflow-hidden rounded-xl border bg-surface transition-shadow hover:shadow-card',
                  isSelected ? 'border-ink ring-2 ring-ink' : 'border-border',
                )}
              >
                <button
                  type="button"
                  className="block w-full text-left"
                  onClick={() => setParams({ asset: asset.id })}
                >
                  <AssetPreview asset={asset} background={background} className="aspect-square" />
                  <div className="border-t border-border px-3 py-2.5">
                    <p className="truncate text-[13px] font-medium text-ink">{asset.title}</p>
                    <p className="flex items-center gap-1.5 text-[11px] text-muted uppercase">
                      {asset.ext} · {formatBytes(asset.size_bytes)}
                      {asset.version > 1 && <span className="normal-case">· v{asset.version}</span>}
                    </p>
                  </div>
                </button>
                {expired && (
                  <Badge tone="danger" className="absolute bottom-14 left-2">
                    Abgelaufen
                  </Badge>
                )}
                <button
                  type="button"
                  aria-label={isSelected ? 'Abwählen' : 'Auswählen'}
                  aria-pressed={isSelected}
                  onClick={() => toggleSelect(asset.id)}
                  className={cn(
                    'absolute top-2 left-2 flex size-6 items-center justify-center rounded-md border-2 bg-surface/90 transition-opacity',
                    isSelected
                      ? 'border-ink bg-ink text-bg opacity-100'
                      : 'border-border-strong opacity-0 group-hover:opacity-100 focus:opacity-100',
                    selected.length > 0 && 'opacity-100',
                  )}
                >
                  {isSelected && <CheckSquare className="size-3.5" />}
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs text-muted">
              <tr>
                <th className="w-10 px-3 py-2" />
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Tags</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Format</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Größe</th>
                <th className="hidden px-3 py-2 font-medium lg:table-cell">Hochgeladen</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((asset) => (
                <tr key={asset.id} className="border-t border-border hover:bg-surface-2/60">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(asset.id)}
                      onChange={() => toggleSelect(asset.id)}
                      aria-label={`${asset.title} auswählen`}
                      className="size-4 accent-[var(--ink)]"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setParams({ asset: asset.id })}
                      className="flex items-center gap-3 text-left"
                    >
                      <AssetPreview
                        asset={asset}
                        background={background}
                        className="size-10 shrink-0 rounded-lg"
                      />
                      <span className="font-medium text-ink">{asset.title}</span>
                    </button>
                  </td>
                  <td className="hidden px-3 py-2 md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {asset.tags.slice(0, 4).map((t) => (
                        <Badge key={t}>{t}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="hidden px-3 py-2 text-muted uppercase sm:table-cell">{asset.ext}</td>
                  <td className="hidden px-3 py-2 text-muted sm:table-cell">
                    {formatBytes(asset.size_bytes)}
                  </td>
                  <td className="hidden px-3 py-2 text-muted lg:table-cell">
                    {formatDate(asset.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openAsset && <AssetDetailSheet asset={openAsset} onClose={() => setParams({})} />}

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        title={
          dialog === 'collection'
            ? 'Neue Sammlung'
            : dialog === 'tag'
              ? 'Tag vergeben'
              : 'Bibliothek umbenennen'
        }
        description={
          dialog === 'collection' && selected.length > 0
            ? `${selected.length} ausgewählte Datei(en) werden hinzugefügt.`
            : dialog === 'tag'
              ? `Für ${selected.length} Datei(en)`
              : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Abbrechen
            </Button>
            <Button onClick={() => void submitDialog()} disabled={!dialogValue.trim()}>
              Speichern
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submitDialog()
          }}
        >
          <Field label={dialog === 'tag' ? 'Tag' : 'Name'}>
            <Input
              autoFocus
              value={dialogValue}
              onChange={(e) => setDialogValue(e.target.value)}
              maxLength={120}
            />
          </Field>
        </form>
      </Dialog>
    </div>
  )
}
