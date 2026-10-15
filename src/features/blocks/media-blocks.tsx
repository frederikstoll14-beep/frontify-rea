import { Download, ExternalLink, FileAudio, Film, Images, Link2, Plus, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAssetsByIds } from '@/api/libraries'
import { useSignedUrl } from '@/api/storage'
import { AssetPickerDialog } from '@/components/media/asset-picker'
import { downloadAsset, downloadAssetsZip, DownloadMenu } from '@/components/media/download-menu'
import { AssetPreview, backgroundClass, StorageImage } from '@/components/media/storage-image'
import { ImageField, useFileUpload } from '@/components/media/upload'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/input'
import { EmptyState, Segmented, Switch } from '@/components/ui/misc'
import type { ImageRef, PreviewBackground } from '@/lib/blocks/types'
import { genericEmbed, videoEmbed } from '@/lib/embed'
import { cn, errorMessage, formatBytes, uniqueId } from '@/lib/utils'
import { useBrandContext, useCanDownload } from '@/features/brand/brand-context'
import { AddItemButton, InlineInput, ItemControls, listOps, SettingsPanel, SettingsRow } from './editor-kit'
import type { BlockEditorProps, BlockViewProps } from './types'

const RATIOS = {
  auto: '',
  '1:1': 'aspect-square',
  '4:3': 'aspect-[4/3]',
  '16:9': 'aspect-video',
  '3:2': 'aspect-[3/2]',
  '3:4': 'aspect-[3/4]',
}

const BACKGROUND_OPTIONS: Array<{ value: PreviewBackground | 'none'; label: string }> = [
  { value: 'none', label: 'Ohne' },
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
  { value: 'brand', label: 'Marke' },
  { value: 'checker', label: 'Raster' },
]

/* ---------- Bild ---------- */

function ImageDownloadButton({ image, title }: { image: ImageRef; title: string }) {
  const [busy, setBusy] = useState(false)
  return (
    <Button
      size="sm"
      variant="outline"
      loading={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await downloadAsset({
            id: image.assetId ?? image.path,
            title: title || 'bild',
            file_path: image.path,
            file_name: image.path.split('/').pop() ?? 'bild',
            mime_type: image.mime ?? 'image/png',
            width: image.width ?? null,
            ext: image.path.split('.').pop() ?? '',
          })
        } catch (error) {
          toast.error(errorMessage(error))
        } finally {
          setBusy(false)
        }
      }}
    >
      {!busy && <Download />} Download
    </Button>
  )
}

export function ImageView({ content }: BlockViewProps<'image'>) {
  const canDownload = useCanDownload()
  if (!content.image) return null
  const ratio = RATIOS[content.ratio]
  return (
    <figure className="avoid-break">
      <div
        className={cn(
          'overflow-hidden rounded-2xl',
          backgroundClass(content.background),
          content.background !== 'none' && 'p-[4%]',
          ratio,
        )}
      >
        <StorageImage
          path={content.image.path}
          alt={content.alt || content.caption}
          fit={content.fit}
          className={cn('w-full', ratio ? 'h-full' : 'h-auto', content.background !== 'none' && 'rounded-lg')}
        />
      </div>
      {(content.caption || (content.allowDownload && canDownload)) && (
        <figcaption className="mt-2.5 flex items-start justify-between gap-3 text-sm text-muted">
          <span>{content.caption}</span>
          {content.allowDownload && canDownload && (
            <ImageDownloadButton image={content.image} title={content.caption} />
          )}
        </figcaption>
      )}
    </figure>
  )
}

export function ImageEditor({ content, onChange }: BlockEditorProps<'image'>) {
  const { brand } = useBrandContext()
  return (
    <div>
      {content.image ? <ImageView content={content} block={undefined as never} /> : null}
      <SettingsPanel>
        <ImageField brandId={brand.id} value={content.image} onChange={(image) => onChange({ image })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Bildunterschrift">
            <Input value={content.caption} onChange={(e) => onChange({ caption: e.target.value })} />
          </Field>
          <Field label="Alternativtext" hint="Beschreibt das Bild für Screenreader">
            <Input value={content.alt} onChange={(e) => onChange({ alt: e.target.value })} />
          </Field>
        </div>
        <SettingsRow label="Hintergrund">
          <Segmented
            size="sm"
            value={content.background}
            onChange={(background) => onChange({ background })}
            options={BACKGROUND_OPTIONS}
          />
        </SettingsRow>
        <SettingsRow label="Format">
          <Segmented
            size="sm"
            value={content.ratio}
            onChange={(ratio) => onChange({ ratio })}
            options={[
              { value: 'auto', label: 'Original' },
              { value: '16:9', label: '16:9' },
              { value: '4:3', label: '4:3' },
              { value: '3:2', label: '3:2' },
              { value: '1:1', label: '1:1' },
            ]}
          />
        </SettingsRow>
        {content.ratio !== 'auto' && (
          <SettingsRow label="Einpassen">
            <Segmented
              size="sm"
              value={content.fit}
              onChange={(fit) => onChange({ fit })}
              options={[
                { value: 'contain', label: 'Ganz zeigen' },
                { value: 'cover', label: 'Füllen' },
              ]}
            />
          </SettingsRow>
        )}
        <Switch
          checked={content.allowDownload}
          onCheckedChange={(allowDownload) => onChange({ allowDownload })}
          label="Download anbieten"
        />
      </SettingsPanel>
    </div>
  )
}

/* ---------- Galerie ---------- */

const GALLERY_COLS = { 2: 'grid-cols-2', 3: 'grid-cols-2 md:grid-cols-3', 4: 'grid-cols-2 md:grid-cols-4' }

export function GalleryView({ content }: BlockViewProps<'gallery'>) {
  const { editMode } = useBrandContext()
  const items = content.items.filter((i) => i.image)
  if (items.length === 0) {
    return editMode ? null : (
      <EmptyState
        icon={<Images />}
        title="Noch keine Bilder"
        description="Hier entsteht die Bildwelt."
        className="py-8"
      />
    )
  }
  return (
    <div className={cn('grid gap-3', GALLERY_COLS[content.columns])}>
      {items.map((item) => (
        <figure key={item.id} className="avoid-break">
          <StorageImage
            path={item.image!.path}
            alt={item.caption}
            className={cn('w-full rounded-xl', RATIOS[content.ratio])}
          />
          {item.caption && <figcaption className="mt-1.5 text-[13px] text-muted">{item.caption}</figcaption>}
        </figure>
      ))}
    </div>
  )
}

export function GalleryEditor({ content, onChange }: BlockEditorProps<'gallery'>) {
  const { brand } = useBrandContext()
  const ops = listOps(content.items, (items) => onChange({ items }))
  const input = useRef<HTMLInputElement>(null)
  const { upload, uploading } = useFileUpload(brand.id)
  const [pickerOpen, setPickerOpen] = useState(false)

  const uploadMany = async (files: FileList | null) => {
    if (!files) return
    const added: typeof content.items = []
    for (const file of Array.from(files)) {
      const image = await upload(file)
      if (image) added.push({ id: uniqueId(), image, caption: '' })
    }
    onChange({ items: [...content.items, ...added] })
  }

  return (
    <div className="space-y-3">
      <div className={cn('grid gap-3', GALLERY_COLS[content.columns])}>
        {content.items.map((item, i) => (
          <div key={item.id} className="space-y-1.5">
            <div className="relative">
              {item.image ? (
                <StorageImage
                  path={item.image.path}
                  alt={item.caption}
                  className={cn('w-full rounded-xl', RATIOS[content.ratio])}
                />
              ) : (
                <div className={cn('rounded-xl bg-surface-2', RATIOS[content.ratio])} />
              )}
              <ItemControls
                index={i}
                count={content.items.length}
                onMove={ops.move}
                onRemove={() => ops.remove(i)}
                className="absolute top-1.5 right-1.5 rounded-lg bg-surface/90 shadow-sm"
              />
            </div>
            <InlineInput
              value={item.caption}
              onChange={(caption) => ops.update(i, { caption })}
              placeholder="Bildunterschrift"
              className="text-[13px]"
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" loading={uploading} onClick={() => input.current?.click()}>
          <Upload /> Bilder hochladen
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
          <Plus /> Aus Mediathek
        </Button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void uploadMany(e.target.files)
          e.target.value = ''
        }}
      />
      <SettingsPanel>
        <SettingsRow label="Spalten">
          <Segmented
            size="sm"
            value={String(content.columns)}
            onChange={(v) => onChange({ columns: Number(v) as 2 | 3 | 4 })}
            options={['2', '3', '4'].map((v) => ({ value: v, label: v }))}
          />
        </SettingsRow>
        <SettingsRow label="Format">
          <Segmented
            size="sm"
            value={content.ratio}
            onChange={(ratio) => onChange({ ratio })}
            options={[
              { value: '4:3', label: '4:3' },
              { value: '1:1', label: '1:1' },
              { value: '16:9', label: '16:9' },
              { value: '3:4', label: '3:4' },
            ]}
          />
        </SettingsRow>
      </SettingsPanel>
      <AssetPickerDialog
        brandId={brand.id}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        multiple
        filter="image"
        onPick={(assets) =>
          onChange({
            items: [
              ...content.items,
              ...assets.map((a) => ({
                id: uniqueId(),
                caption: a.title,
                image: {
                  path: a.file_path,
                  width: a.width,
                  height: a.height,
                  mime: a.mime_type,
                  assetId: a.id,
                },
              })),
            ],
          })
        }
      />
    </div>
  )
}

/* ---------- Video ---------- */

function VideoFile({ path }: { path: string }) {
  const { data: url } = useSignedUrl(path)
  if (!url) return <div className="aspect-video animate-pulse rounded-2xl bg-surface-2" />
  return (
    <video
      src={url}
      controls
      playsInline
      className="aspect-video w-full rounded-2xl bg-black"
      preload="metadata"
    />
  )
}

export function VideoView({ content }: BlockViewProps<'video'>) {
  const embed = content.url ? videoEmbed(content.url) : null
  if (!embed && !content.file) return null
  return (
    <figure className="avoid-break">
      {content.file ? (
        <VideoFile path={content.file.path} />
      ) : embed ? (
        <div className="aspect-video overflow-hidden rounded-2xl bg-black">
          <iframe
            src={embed.src}
            title={content.caption || `${embed.provider}-Video`}
            className="h-full w-full"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : null}
      {content.caption && <figcaption className="mt-2 text-sm text-muted">{content.caption}</figcaption>}
    </figure>
  )
}

export function VideoEditor({ content, onChange }: BlockEditorProps<'video'>) {
  const { brand } = useBrandContext()
  const input = useRef<HTMLInputElement>(null)
  const { upload, uploading } = useFileUpload(brand.id)
  const valid = !content.url || videoEmbed(content.url) !== null
  return (
    <div>
      <VideoView content={content} block={undefined as never} />
      <SettingsPanel>
        <Field
          label="YouTube- oder Vimeo-Link"
          error={valid ? undefined : 'Link nicht erkannt. Unterstützt: YouTube, Vimeo (https).'}
          hint="YouTube wird datenschutzfreundlich über youtube-nocookie.com eingebunden."
        >
          <Input
            value={content.url}
            onChange={(e) => onChange({ url: e.target.value, file: null })}
            placeholder="https://www.youtube.com/watch?v=…"
          />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">oder</span>
          <Button size="sm" variant="outline" loading={uploading} onClick={() => input.current?.click()}>
            <Film /> Videodatei hochladen (max. 50 MB)
          </Button>
          {content.file && (
            <Button size="sm" variant="ghost" onClick={() => onChange({ file: null })}>
              Datei entfernen
            </Button>
          )}
        </div>
        <Field label="Bildunterschrift">
          <Input value={content.caption} onChange={(e) => onChange({ caption: e.target.value })} />
        </Field>
      </SettingsPanel>
      <input
        ref={input}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          const ref = await upload(file)
          if (ref) onChange({ file: ref, url: '' })
        }}
      />
    </div>
  )
}

/* ---------- Audio ---------- */

function AudioFile({ path }: { path: string }) {
  const { data: url } = useSignedUrl(path)
  if (!url) return <div className="h-12 animate-pulse rounded-full bg-surface-2" />
  return <audio src={url} controls className="w-full" preload="metadata" />
}

export function AudioView({ content }: BlockViewProps<'audio'>) {
  if (!content.file) return null
  return (
    <div className="avoid-break rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand text-brand-ink">
          <FileAudio className="size-5" />
        </span>
        <div>
          <p className="font-semibold text-ink">{content.title || 'Audio'}</p>
          {content.caption && <p className="text-sm text-muted">{content.caption}</p>}
        </div>
      </div>
      <AudioFile path={content.file.path} />
    </div>
  )
}

export function AudioEditor({ content, onChange }: BlockEditorProps<'audio'>) {
  const { brand } = useBrandContext()
  const input = useRef<HTMLInputElement>(null)
  const { upload, uploading } = useFileUpload(brand.id)
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <InlineInput
        value={content.title}
        onChange={(title) => onChange({ title })}
        placeholder="Titel, z. B. Sound-Logo"
        className="font-semibold"
      />
      <InlineInput
        value={content.caption}
        onChange={(caption) => onChange({ caption })}
        placeholder="Beschreibung"
        className="text-sm text-muted"
      />
      {content.file && <AudioFile path={content.file.path} />}
      <Button size="sm" variant="outline" loading={uploading} onClick={() => input.current?.click()}>
        <Upload /> {content.file ? 'Audiodatei ersetzen' : 'Audiodatei hochladen'}
      </Button>
      <input
        ref={input}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          const ref = await upload(file)
          if (ref) onChange({ file: ref })
        }}
      />
    </div>
  )
}

/* ---------- Einbettung ---------- */

export function EmbedView({ content }: BlockViewProps<'embed'>) {
  const embed = content.url ? genericEmbed(content.url) : null
  if (!embed) return null
  return (
    <figure className="avoid-break">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface-2">
        <iframe
          src={embed.src}
          title={content.caption || embed.provider}
          style={embed.ratio ? { aspectRatio: String(embed.ratio) } : { height: content.height }}
          className="w-full"
          loading="lazy"
          allow="fullscreen; clipboard-write; encrypted-media"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation allow-forms"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <figcaption className="mt-2 flex items-center justify-between gap-3 text-sm text-muted">
        <span>{content.caption}</span>
        <a
          href={content.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 hover:text-ink"
        >
          {embed.provider} öffnen <ExternalLink className="size-3.5" />
        </a>
      </figcaption>
    </figure>
  )
}

export function EmbedEditor({ content, onChange }: BlockEditorProps<'embed'>) {
  const valid = !content.url || genericEmbed(content.url) !== null
  return (
    <div>
      <EmbedView content={content} block={undefined as never} />
      <SettingsPanel>
        <Field
          label="Link"
          error={valid ? undefined : 'Bitte einen gültigen https-Link eingeben.'}
          hint="Figma, Canva (Freigabe „Öffentlich ansehen“), Miro, Google Slides/Docs, YouTube, Vimeo, Spotify, SoundCloud …"
        >
          <div className="relative">
            <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input
              value={content.url}
              onChange={(e) => onChange({ url: e.target.value })}
              placeholder="https://"
              className="pl-9"
            />
          </div>
        </Field>
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <Field label="Bildunterschrift">
            <Input value={content.caption} onChange={(e) => onChange({ caption: e.target.value })} />
          </Field>
          <Field label="Höhe (px)">
            <Input
              type="number"
              min={200}
              max={1600}
              value={content.height}
              onChange={(e) =>
                onChange({ height: Math.min(1600, Math.max(200, Number(e.target.value) || 480)) })
              }
            />
          </Field>
        </div>
      </SettingsPanel>
    </div>
  )
}

/* ---------- Dateien & Downloads ---------- */

const ASSET_COLS = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-4',
  5: 'grid-cols-2 md:grid-cols-5',
}

export function AssetsView({ content }: BlockViewProps<'assets'>) {
  const { data: assets = [], isLoading } = useAssetsByIds(content.assetIds)
  const canDownload = useCanDownload()
  const [zipping, setZipping] = useState(false)
  if (content.assetIds.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-strong p-5">
        <p className="font-semibold text-ink">{content.title}</p>
        <p className="mt-1 text-sm text-muted">Noch keine Dateien verknüpft.</p>
      </div>
    )
  }
  const downloadable = assets.filter((a) => a.downloadable)
  return (
    <div className="avoid-break rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          {content.title && <p className="font-semibold text-ink">{content.title}</p>}
          {content.description && <p className="mt-0.5 text-sm text-muted">{content.description}</p>}
        </div>
        {content.showDownloadAll && canDownload && downloadable.length > 1 && (
          <Button
            size="sm"
            loading={zipping}
            onClick={async () => {
              setZipping(true)
              try {
                await downloadAssetsZip(downloadable, content.title || 'downloads')
              } catch (error) {
                toast.error(errorMessage(error))
              } finally {
                setZipping(false)
              }
            }}
          >
            {!zipping && <Download />} Alle als ZIP
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="h-32 animate-pulse rounded-xl bg-surface-2" />
      ) : (
        <div className={cn('grid gap-3', ASSET_COLS[content.columns])}>
          {assets.map((asset) => (
            <div key={asset.id} className="overflow-hidden rounded-xl border border-border">
              <AssetPreview asset={asset} background={content.background} className="aspect-square" />
              <div className="flex items-center justify-between gap-2 border-t border-border p-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-ink">{asset.title}</p>
                  <p className="text-[11px] text-muted uppercase">
                    {asset.ext} · {formatBytes(asset.size_bytes)}
                  </p>
                </div>
                {canDownload && (asset.downloadable || canDownload) && (
                  <DownloadMenu asset={asset} iconOnly variant="ghost" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function AssetsEditor({ content, onChange }: BlockEditorProps<'assets'>) {
  const { brand } = useBrandContext()
  const [pickerOpen, setPickerOpen] = useState(false)
  const { data: assets = [] } = useAssetsByIds(content.assetIds)
  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-2xl border border-border bg-surface p-4">
        <InlineInput
          value={content.title}
          onChange={(title) => onChange({ title })}
          placeholder="Titel, z. B. Logo-Paket"
          className="font-semibold"
        />
        <Textarea
          value={content.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Beschreibung (optional)"
          rows={2}
        />
        <div className={cn('grid gap-2', ASSET_COLS[content.columns])}>
          {assets.map((asset, i) => (
            <div key={asset.id} className="relative overflow-hidden rounded-xl border border-border">
              <AssetPreview asset={asset} background={content.background} className="aspect-square" />
              <p className="truncate border-t border-border px-2 py-1.5 text-xs">{asset.title}</p>
              <ItemControls
                index={i}
                count={assets.length}
                className="absolute top-1 right-1 rounded-lg bg-surface/90 shadow-sm"
                onMove={(from, to) => {
                  const ids = [...content.assetIds]
                  const [moved] = ids.splice(from, 1)
                  ids.splice(to, 0, moved)
                  onChange({ assetIds: ids })
                }}
                onRemove={() => onChange({ assetIds: content.assetIds.filter((id) => id !== asset.id) })}
              />
            </div>
          ))}
        </div>
        <AddItemButton onClick={() => setPickerOpen(true)}>Dateien auswählen</AddItemButton>
      </div>
      <SettingsPanel>
        <SettingsRow label="Spalten">
          <Segmented
            size="sm"
            value={String(content.columns)}
            onChange={(v) => onChange({ columns: Number(v) as 2 | 3 | 4 | 5 })}
            options={['2', '3', '4', '5'].map((v) => ({ value: v, label: v }))}
          />
        </SettingsRow>
        <SettingsRow label="Vorschau-Hintergrund">
          <Segmented
            size="sm"
            value={content.background}
            onChange={(background) => onChange({ background: background as PreviewBackground })}
            options={BACKGROUND_OPTIONS.filter((o) => o.value !== 'none')}
          />
        </SettingsRow>
        <Switch
          checked={content.showDownloadAll}
          onCheckedChange={(showDownloadAll) => onChange({ showDownloadAll })}
          label="„Alle als ZIP“ anbieten"
        />
      </SettingsPanel>
      <AssetPickerDialog
        brandId={brand.id}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        multiple
        initialSelection={content.assetIds}
        onPick={(picked) => onChange({ assetIds: picked.map((a) => a.id) })}
      />
    </div>
  )
}
