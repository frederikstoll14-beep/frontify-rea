import { Copy, History, Info, MessageSquare, RotateCcw, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { displayName } from '@/api/auth'
import { useComments, type Comment } from '@/api/collab'
import { useAssetVersions, useLibraries, useLibraryMutations, type Asset } from '@/api/libraries'
import { useSignedUrl } from '@/api/storage'
import { DownloadMenu } from '@/components/media/download-menu'
import { AssetPreview, backgroundClass } from '@/components/media/storage-image'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { Sheet } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { Badge, Segmented, Switch, Tabs } from '@/components/ui/misc'
import type { PreviewBackground } from '@/lib/blocks/types'
import { isImageMime } from '@/lib/media'
import { cn, errorMessage, formatBytes, formatDate, formatDateTime } from '@/lib/utils'
import { useBrandContext, useCanDownload } from '@/features/brand/brand-context'
import { CommentsPanel } from '@/features/guidelines/comments-panel'
import { TagInput } from './tag-input'

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-ink-2">{value}</dd>
    </div>
  )
}

function Pins({ comments, active, onClick }: { comments: Comment[]; active: string | null; onClick: (c: Comment) => void }) {
  return (
    <>
      {comments
        .filter((c) => c.parent_id === null && c.pos_x !== null && c.pos_y !== null && !c.resolved)
        .map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClick(c)
            }}
            className={cn(
              'absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-md',
              active === c.id ? 'scale-110 bg-ink' : 'bg-accent',
            )}
            style={{ left: `${(c.pos_x ?? 0) * 100}%`, top: `${(c.pos_y ?? 0) * 100}%` }}
            title={c.body}
          >
            {i + 1}
          </button>
        ))}
    </>
  )
}

export function AssetDetailSheet({ asset, onClose }: { asset: Asset | null; onClose: () => void }) {
  const { brand, canEdit, isMember } = useBrandContext()
  const canDownload = useCanDownload(asset)
  const m = useLibraryMutations(brand.id)
  const { data: libraries = [] } = useLibraries(brand.id)
  const { data: versions = [] } = useAssetVersions(canEdit || isMember ? asset?.id : undefined)
  const { data: comments = [] } = useComments(asset ? { assetId: asset.id } : null, isMember)
  const confirm = useConfirm()
  const [tab, setTab] = useState('info')
  const [bg, setBg] = useState<PreviewBackground>('light')
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null)
  const [activePin, setActivePin] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<Asset>>({})
  const replaceInput = useRef<HTMLInputElement>(null)
  const [versionNote, setVersionNote] = useState('')

  useEffect(() => {
    setDraft({})
    setPin(null)
    setTab('info')
  }, [asset?.id])

  if (!asset) return null
  const value = { ...asset, ...draft }
  const dirty = Object.keys(draft).length > 0
  const isImage = isImageMime(asset.mime_type)
  const expired = asset.expires_at ? new Date(asset.expires_at) < new Date() : false

  const save = () => {
    m.updateAsset.mutate(
      {
        id: asset.id,
        patch: {
          title: value.title.trim() || asset.title,
          description: value.description,
          tags: value.tags,
          copyright: value.copyright,
          license_note: value.license_note,
          expires_at: value.expires_at || null,
          downloadable: value.downloadable,
          library_id: value.library_id,
        },
      },
      {
        onSuccess: () => {
          setDraft({})
          toast.success('Gespeichert')
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    )
  }

  const tabs = [
    { value: 'info', label: <span className="inline-flex items-center gap-1.5"><Info className="size-4" /> Details</span> },
    ...(isMember
      ? [
          {
            value: 'comments',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <MessageSquare className="size-4" /> Feedback
                {comments.filter((c) => !c.parent_id && !c.resolved).length > 0 && (
                  <Badge tone="accent">{comments.filter((c) => !c.parent_id && !c.resolved).length}</Badge>
                )}
              </span>
            ),
          },
          { value: 'versions', label: <span className="inline-flex items-center gap-1.5"><History className="size-4" /> Versionen</span> },
        ]
      : []),
  ]

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()} title={asset.title} width="max-w-5xl">
      <div className="grid min-h-full lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="border-b border-border p-4 lg:border-r lg:border-b-0">
          <div
            className={cn(
              'relative overflow-hidden rounded-2xl',
              backgroundClass(bg),
              tab === 'comments' && isImage && 'cursor-crosshair',
            )}
            onClick={(e) => {
              if (tab !== 'comments' || !isImage) return
              const rect = e.currentTarget.getBoundingClientRect()
              setPin({
                x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
                y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
              })
            }}
          >
            {asset.mime_type.startsWith('video/') ? (
              <AssetVideo asset={asset} />
            ) : (
              <AssetPreview asset={asset} background="none" className="aspect-[4/3] max-h-[65vh] w-full" preferOriginal />
            )}
            {isImage && <Pins comments={comments} active={activePin} onClick={(c) => { setActivePin(c.id); setTab('comments') }} />}
            {pin && (
              <span
                className="pointer-events-none absolute size-7 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full border-2 border-white bg-ink shadow-md"
                style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
              />
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <Segmented
              size="sm"
              value={bg}
              onChange={setBg}
              options={[
                { value: 'light', label: 'Hell' },
                { value: 'dark', label: 'Dunkel' },
                { value: 'brand', label: 'Marke' },
                { value: 'checker', label: 'Raster' },
              ]}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const url = `${window.location.origin}${window.location.pathname}?asset=${asset.id}`
                  void navigator.clipboard.writeText(url)
                  toast.success('Link kopiert')
                }}
              >
                <Copy /> Link
              </Button>
              {canDownload && <DownloadMenu asset={asset} variant="primary" />}
            </div>
          </div>
          {tab === 'comments' && isImage && (
            <p className="mt-2 text-xs text-muted">Tipp: Klicke ins Bild, um eine Stelle für deinen Kommentar zu markieren.</p>
          )}
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="px-4 pt-2">
            <Tabs value={tab} onValueChange={setTab} items={tabs} />
          </div>

          {tab === 'info' && (
            <div className="space-y-4 p-4">
              {canEdit ? (
                <>
                  <Field label="Titel">
                    <Input value={value.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
                  </Field>
                  <Field label="Beschreibung">
                    <Textarea
                      value={value.description}
                      onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                      rows={3}
                    />
                  </Field>
                  <Field label="Tags" hint="Enter oder Komma zum Hinzufügen">
                    <TagInput value={value.tags} onChange={(tags) => setDraft((d) => ({ ...d, tags }))} />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Copyright / Urheber:in">
                      <Input value={value.copyright} onChange={(e) => setDraft((d) => ({ ...d, copyright: e.target.value }))} placeholder="Foto: …" />
                    </Field>
                    <Field label="Nutzbar bis">
                      <Input
                        type="date"
                        value={value.expires_at ?? ''}
                        onChange={(e) => setDraft((d) => ({ ...d, expires_at: e.target.value || null }))}
                      />
                    </Field>
                  </div>
                  <Field label="Lizenz / Nutzungsrechte">
                    <Textarea
                      value={value.license_note}
                      onChange={(e) => setDraft((d) => ({ ...d, license_note: e.target.value }))}
                      rows={2}
                      placeholder="z. B. nur für Vereinskommunikation, nicht für Werbung"
                    />
                  </Field>
                  <Field label="Bibliothek">
                    <Select value={value.library_id} onChange={(e) => setDraft((d) => ({ ...d, library_id: e.target.value }))}>
                      {libraries.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Switch
                    checked={value.downloadable}
                    onCheckedChange={(downloadable) => setDraft((d) => ({ ...d, downloadable }))}
                    label="Download für Leser:innen erlauben"
                    description="Bearbeitende können immer herunterladen."
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={save} disabled={!dirty} loading={m.updateAsset.isPending}>
                      Speichern
                    </Button>
                    {dirty && (
                      <Button variant="ghost" onClick={() => setDraft({})}>
                        Verwerfen
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  {asset.description && <p className="text-sm text-ink-2">{asset.description}</p>}
                  {asset.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {asset.tags.map((t) => (
                        <Badge key={t}>{t}</Badge>
                      ))}
                    </div>
                  )}
                  {asset.license_note && (
                    <p className="rounded-xl bg-warning-soft p-3 text-sm text-ink-2">
                      <span className="font-semibold">Nutzung: </span>
                      {asset.license_note}
                    </p>
                  )}
                </div>
              )}
              <dl className="divide-y divide-border border-t border-border pt-2">
                <MetaRow label="Datei" value={<span className="break-all">{asset.file_name}</span>} />
                <MetaRow label="Format" value={<span className="uppercase">{asset.ext || asset.mime_type}</span>} />
                <MetaRow label="Größe" value={formatBytes(asset.size_bytes)} />
                {asset.width && asset.height && <MetaRow label="Abmessungen" value={`${asset.width} × ${asset.height} px`} />}
                <MetaRow label="Version" value={asset.version} />
                <MetaRow label="Hochgeladen" value={formatDateTime(asset.created_at)} />
                {asset.copyright && <MetaRow label="Copyright" value={asset.copyright} />}
                {asset.expires_at && (
                  <MetaRow
                    label="Nutzbar bis"
                    value={<span className={cn(expired && 'font-semibold text-danger')}>{formatDate(asset.expires_at)}{expired && ' (abgelaufen)'}</span>}
                  />
                )}
              </dl>
              {canEdit && (
                <Button
                  variant="ghost"
                  className="text-danger"
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Datei löschen?',
                      description: `„${asset.title}“ wird mit allen Versionen dauerhaft gelöscht. Bausteine, die sie verwenden, zeigen sie dann nicht mehr an.`,
                      confirmLabel: 'Löschen',
                      danger: true,
                    })
                    if (!ok) return
                    m.deleteAssets.mutate([asset], {
                      onSuccess: () => {
                        toast.success('Gelöscht')
                        onClose()
                      },
                      onError: (e) => toast.error(errorMessage(e)),
                    })
                  }}
                >
                  <Trash2 /> Datei löschen
                </Button>
              )}
            </div>
          )}

          {tab === 'comments' && (
            <div className="min-h-[420px] flex-1">
              <CommentsPanel
                target={{ assetId: asset.id }}
                pin={pin}
                onClearPin={() => setPin(null)}
                onPinClick={(c) => setActivePin(c.id)}
              />
            </div>
          )}

          {tab === 'versions' && (
            <div className="space-y-4 p-4">
              {canEdit && (
                <div className="space-y-2 rounded-xl border border-border p-3">
                  <p className="text-sm font-medium text-ink">Neue Version hochladen</p>
                  <p className="text-xs text-muted">
                    Die Datei wird ersetzt, Verknüpfungen in Bausteinen bleiben erhalten. Die bisherige Datei bleibt als Version gespeichert.
                  </p>
                  <Input value={versionNote} onChange={(e) => setVersionNote(e.target.value)} placeholder="Was hat sich geändert? (optional)" />
                  <Button size="sm" loading={m.replaceAsset.isPending} onClick={() => replaceInput.current?.click()}>
                    <Upload /> Datei auswählen
                  </Button>
                  <input
                    ref={replaceInput}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      if (!file) return
                      m.replaceAsset.mutate(
                        { asset, file, note: versionNote },
                        {
                          onSuccess: () => {
                            setVersionNote('')
                            toast.success('Neue Version gespeichert')
                          },
                          onError: (err) => toast.error(errorMessage(err)),
                        },
                      )
                    }}
                  />
                </div>
              )}
              <ul className="space-y-2">
                <li className="rounded-xl border border-ink/20 bg-surface-2/60 p-3 text-sm">
                  <span className="font-semibold text-ink">Version {asset.version}</span> · aktuell · {asset.file_name}
                </li>
                {versions.map((v) => (
                  <li key={v.id} className="flex items-start justify-between gap-3 rounded-xl border border-border p-3">
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold text-ink">Version {v.version}</p>
                      <p className="truncate text-xs text-muted">
                        {v.file_name} · {formatBytes(v.size_bytes)} · {formatDateTime(v.created_at)}
                      </p>
                      <p className="text-xs text-muted">{displayName(v.author)}</p>
                      {v.note && <p className="mt-1 text-xs text-ink-2">{v.note}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {canDownload && (
                        <DownloadMenu
                          asset={{ ...asset, file_path: v.file_path, file_name: v.file_name, mime_type: v.mime_type, width: v.width }}
                          iconOnly
                          variant="ghost"
                        />
                      )}
                      {canEdit && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Wiederherstellen"
                          onClick={() =>
                            m.restoreVersion.mutate(
                              { asset, version: v },
                              {
                                onSuccess: () => toast.success(`Version ${v.version} wiederhergestellt`),
                                onError: (err) => toast.error(errorMessage(err)),
                              },
                            )
                          }
                        >
                          <RotateCcw />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
                {versions.length === 0 && <p className="text-sm text-muted">Noch keine früheren Versionen.</p>}
              </ul>
            </div>
          )}
        </div>
      </div>
      <button type="button" className="sr-only" onClick={onClose}>
        <X /> Schließen
      </button>
    </Sheet>
  )
}

function AssetVideo({ asset }: { asset: Asset }) {
  const { data: url } = useSignedUrl(asset.file_path)
  if (!url) return <div className="aspect-video animate-pulse bg-surface-2" />
  return <video src={url} controls playsInline className="aspect-video w-full bg-black" />
}
