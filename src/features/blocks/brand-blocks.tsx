import { Check, CircleCheck, CircleX, Copy, Download, ExternalLink, Palette as PaletteIcon, Plus, Type, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { fontFiles, useFonts, usePalettes, useTextStyles, type Color, type Font, type TextStyle } from '@/api/basics'
import { useAssetsByIds, type Asset } from '@/api/libraries'
import { getSignedUrl } from '@/api/storage'
import { AssetPickerDialog } from '@/components/media/asset-picker'
import { DownloadMenu } from '@/components/media/download-menu'
import { AssetPreview, backgroundClass, StorageImage } from '@/components/media/storage-image'
import { ImageField } from '@/components/media/upload'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Badge, EmptyState, Segmented, Switch } from '@/components/ui/misc'
import type { ColorValueToggles, LogoItem, PreviewBackground } from '@/lib/blocks/types'
import {
  contrastRatio,
  formatCmyk,
  formatHsl,
  formatRgb,
  hexToRgb,
  readableTextColor,
  rgbToCmyk,
  rgbToHsl,
  tintScale,
  wcagLevel,
} from '@/lib/color'
import { fontStack } from '@/lib/fonts'
import { buildTokenFile, TOKEN_FORMATS, type TokenFormat } from '@/lib/tokens'
import { cn, downloadBlob, slugify, uniqueId } from '@/lib/utils'
import { useBrandContext, useCanDownload } from '@/features/brand/brand-context'
import { AddItemButton, CheckboxList, InlineInput, ItemControls, listOps, SettingsPanel, SettingsRow } from './editor-kit'
import type { BlockEditorProps, BlockViewProps } from './types'

function copy(value: string, label: string) {
  void navigator.clipboard.writeText(value)
  toast.success(`${label} kopiert`, { description: value })
}

/* ---------- Farben ---------- */

interface ColorValue {
  label: string
  value: string
}

function colorValues(color: Color, toggles: ColorValueToggles): ColorValue[] {
  const rgb = hexToRgb(color.hex)
  const list: ColorValue[] = [{ label: 'HEX', value: color.hex }]
  if (toggles.rgb) list.push({ label: 'RGB', value: formatRgb(rgb) })
  if (toggles.hsl) list.push({ label: 'HSL', value: formatHsl(rgbToHsl(rgb)) })
  if (toggles.cmyk) list.push({ label: 'CMYK', value: color.cmyk || `≈ ${formatCmyk(rgbToCmyk(rgb))}` })
  if (toggles.pantone && color.pantone) list.push({ label: 'Pantone', value: color.pantone })
  if (toggles.hks && color.hks) list.push({ label: 'HKS', value: color.hks })
  if (toggles.ral && color.ral) list.push({ label: 'RAL', value: color.ral })
  if (toggles.ncs && color.ncs) list.push({ label: 'NCS', value: color.ncs })
  return list
}

function ContrastBadges({ hex }: { hex: string }) {
  const white = contrastRatio(hex, '#FFFFFF')
  const black = contrastRatio(hex, '#000000')
  const badge = (label: string, ratio: number) => {
    const level = wcagLevel(ratio)
    return (
      <span
        title={`Kontrast ${ratio.toFixed(2)}:1 – WCAG ${level}`}
        className={cn(
          'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold',
          level === '–' ? 'border-border text-muted' : 'border-success/30 text-success',
        )}
      >
        {label} {level === '–' ? <X className="size-3" /> : level}
      </span>
    )
  }
  return (
    <div className="flex flex-wrap gap-1">
      {badge('Weiß', white)}
      {badge('Schwarz', black)}
    </div>
  )
}

function ColorCard({ color, content }: { color: Color; content: BlockViewProps<'colors'>['content'] }) {
  const ink = readableTextColor(color.hex)
  return (
    <div className="avoid-break overflow-hidden rounded-2xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => copy(color.hex, color.name)}
        className="group relative flex aspect-[4/3] w-full items-end p-3 text-left"
        style={{ backgroundColor: color.hex, color: ink }}
        aria-label={`${color.name} ${color.hex} kopieren`}
      >
        {color.usage && <span className="text-xs font-medium opacity-80">{color.usage}</span>}
        <Copy className="absolute top-3 right-3 size-4 opacity-0 transition-opacity group-hover:opacity-80" />
      </button>
      <div className="space-y-2 p-3.5">
        <p className="font-semibold text-ink">{color.name}</p>
        <dl className="space-y-0.5 text-[13px]">
          {colorValues(color, content.values).map((v) => (
            <button
              key={v.label}
              type="button"
              onClick={() => copy(v.value, `${color.name} ${v.label}`)}
              className="flex w-full justify-between gap-3 rounded px-1 -mx-1 py-0.5 text-left hover:bg-surface-2"
            >
              <dt className="text-muted">{v.label}</dt>
              <dd className="text-right font-mono text-[12px] break-all text-ink-2 tabular-nums">{v.value}</dd>
            </button>
          ))}
        </dl>
        {color.description && <p className="text-xs leading-relaxed text-muted">{color.description}</p>}
        {content.showContrast && <ContrastBadges hex={color.hex} />}
        {content.showScale && (
          <div className="flex overflow-hidden rounded-md">
            {tintScale(color.hex).map((s) => (
              <button
                key={s.step}
                type="button"
                title={`${s.step}: ${s.hex}`}
                onClick={() => copy(s.hex, `${color.name} ${s.step}`)}
                className="h-6 flex-1"
                style={{ backgroundColor: s.hex }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ColorRow({ color, content }: { color: Color; content: BlockViewProps<'colors'>['content'] }) {
  return (
    <div className="avoid-break flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={() => copy(color.hex, color.name)}
        className="h-14 w-full shrink-0 rounded-xl border border-black/5 sm:w-24"
        style={{ backgroundColor: color.hex }}
        aria-label={`${color.name} kopieren`}
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">
          {color.name} {color.usage && <span className="ml-1 text-xs font-normal text-muted">{color.usage}</span>}
        </p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          {colorValues(color, content.values).map((v) => (
            <button
              key={v.label}
              type="button"
              onClick={() => copy(v.value, `${color.name} ${v.label}`)}
              className="hover:text-ink"
            >
              <span className="text-muted">{v.label}</span> <span className="font-mono text-ink-2">{v.value}</span>
            </button>
          ))}
        </div>
      </div>
      {content.showContrast && <ContrastBadges hex={color.hex} />}
    </div>
  )
}

export function ColorsView({ content }: BlockViewProps<'colors'>) {
  const { brand, basePath, canEdit } = useBrandContext()
  const { data: palettes = [], isLoading } = usePalettes(brand.id)
  const shown = content.paletteIds.length > 0 ? palettes.filter((p) => content.paletteIds.includes(p.id)) : palettes
  if (isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />
  if (shown.every((p) => p.colors.length === 0)) {
    return (
      <EmptyState
        icon={<PaletteIcon />}
        title="Noch keine Farben"
        description="Farben werden zentral in der Markenbasis gepflegt."
        action={
          canEdit ? (
            <Button asChild size="sm" variant="outline">
              <Link to={`${basePath}/basis?tab=farben`}>Farben anlegen</Link>
            </Button>
          ) : undefined
        }
      />
    )
  }
  if (content.layout === 'strip') {
    const all = shown.flatMap((p) => p.colors)
    return (
      <div className="flex h-28 overflow-hidden rounded-2xl border border-border sm:h-36">
        {all.map((color) => (
          <button
            key={color.id}
            type="button"
            onClick={() => copy(color.hex, color.name)}
            className="group flex min-w-0 flex-1 flex-col justify-end p-2.5 text-left sm:p-3"
            style={{ backgroundColor: color.hex, color: readableTextColor(color.hex) }}
          >
            <span className="truncate text-xs font-semibold sm:text-sm">{color.name}</span>
            <span className="truncate font-mono text-[10px] opacity-75 sm:text-xs">{color.hex}</span>
          </button>
        ))}
      </div>
    )
  }
  return (
    <div className="space-y-8">
      {shown.map((palette) =>
        palette.colors.length === 0 ? null : (
          <section key={palette.id}>
            {shown.length > 1 || palette.description ? (
              <div className="mb-3">
                <h4 className="font-brand-heading text-lg font-semibold text-ink">{palette.name}</h4>
                {palette.description && <p className="text-sm text-muted">{palette.description}</p>}
              </div>
            ) : null}
            {content.layout === 'list' ? (
              <div className="divide-y divide-border rounded-2xl border border-border bg-surface px-4">
                {palette.colors.map((c) => (
                  <ColorRow key={c.id} color={c} content={content} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                {palette.colors.map((c) => (
                  <ColorCard key={c.id} color={c} content={content} />
                ))}
              </div>
            )}
          </section>
        ),
      )}
    </div>
  )
}

const VALUE_LABELS: Record<keyof ColorValueToggles, string> = {
  rgb: 'RGB',
  hsl: 'HSL',
  cmyk: 'CMYK',
  pantone: 'Pantone',
  hks: 'HKS',
  ral: 'RAL',
  ncs: 'NCS',
}

export function ColorsEditor(props: BlockEditorProps<'colors'>) {
  const { content, onChange } = props
  const { brand, basePath } = useBrandContext()
  const { data: palettes = [] } = usePalettes(brand.id)
  return (
    <div>
      <ColorsView {...props} />
      <SettingsPanel>
        <SettingsRow label="Paletten">
          <CheckboxList
            items={palettes.map((p) => ({ id: p.id, label: p.name }))}
            selected={content.paletteIds}
            onChange={(paletteIds) => onChange({ paletteIds })}
            emptyLabel="Alle Paletten"
          />
        </SettingsRow>
        <SettingsRow label="Darstellung">
          <Segmented
            size="sm"
            value={content.layout}
            onChange={(layout) => onChange({ layout })}
            options={[
              { value: 'cards', label: 'Karten' },
              { value: 'list', label: 'Liste' },
              { value: 'strip', label: 'Streifen' },
            ]}
          />
        </SettingsRow>
        {content.layout !== 'strip' && (
          <>
            <SettingsRow label="Farbwerte">
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(VALUE_LABELS) as Array<keyof ColorValueToggles>).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onChange({ values: { ...content.values, [key]: !content.values[key] } })}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs font-medium',
                      content.values[key] ? 'border-ink bg-ink text-bg' : 'border-border bg-surface text-ink-2',
                    )}
                  >
                    {VALUE_LABELS[key]}
                  </button>
                ))}
              </div>
            </SettingsRow>
            <Switch
              checked={content.showContrast}
              onCheckedChange={(showContrast) => onChange({ showContrast })}
              label="Kontrast (WCAG) anzeigen"
              description="Lesbarkeit von weißer und schwarzer Schrift auf der Farbe"
            />
            <Switch
              checked={content.showScale}
              onCheckedChange={(showScale) => onChange({ showScale })}
              label="Abstufungen anzeigen"
              description="Hellere und dunklere Varianten für digitale Anwendungen"
            />
          </>
        )}
        <Link to={`${basePath}/basis?tab=farben`} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent">
          <PaletteIcon className="size-4" /> Farben in der Markenbasis bearbeiten
        </Link>
      </SettingsPanel>
    </div>
  )
}

/* ---------- Typografie ---------- */

function FontCard({ font, sample }: { font: Font; sample: string }) {
  const canDownload = useCanDownload()
  const files = fontFiles(font)
  const family = fontStack(font.family, font.fallback)
  const downloadFonts = async () => {
    for (const file of files) {
      const url = await getSignedUrl(file.path)
      if (!url) continue
      const response = await fetch(url)
      downloadBlob(await response.blob(), file.name)
    }
  }
  return (
    <div className="avoid-break overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-end justify-between gap-4 bg-surface-2/60 px-5 pt-6 pb-4">
        <span className="text-7xl leading-none text-ink sm:text-8xl" style={{ fontFamily: family }}>
          Aa
        </span>
        <div className="text-right">
          {font.role && <Badge>{font.role}</Badge>}
          <p className="mt-2 text-xs text-muted">{font.source === 'google' ? 'Web-Font' : font.source === 'upload' ? 'Eigene Datei' : 'Systemschrift'}</p>
        </div>
      </div>
      <div className="space-y-3 p-5">
        <div>
          <p className="text-xl font-semibold text-ink" style={{ fontFamily: family }}>
            {font.family}
          </p>
          {font.description && <p className="mt-1 text-sm text-muted">{font.description}</p>}
        </div>
        <p className="text-lg leading-snug text-ink-2" style={{ fontFamily: family }}>
          {sample}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[...font.weights].sort((a, b) => a - b).map((w) => (
            <span
              key={w}
              className="rounded-md border border-border px-2 py-1 text-sm text-ink"
              style={{ fontFamily: family, fontWeight: w }}
            >
              {w}
            </span>
          ))}
        </div>
        <p className="text-[13px] break-all text-muted" style={{ fontFamily: family }}>
          ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz ÄÖÜ äöüß 0123456789 !?&€@
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted">
          <span>
            Ersatzschrift: <span className="text-ink-2">{font.fallback}</span>
            {font.license && <> · {font.license}</>}
          </span>
          {canDownload && files.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => void downloadFonts()}>
              <Download /> Schriftdateien
            </Button>
          )}
          {font.source === 'google' && (
            <a
              href={`https://fonts.google.com/specimen/${font.family.replace(/\s+/g, '+')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-accent"
            >
              Bezugsquelle <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function TextStyleRow({ style, fonts }: { style: TextStyle; fonts: Font[] }) {
  const font = fonts.find((f) => f.family === style.font_family)
  return (
    <div className="avoid-break grid gap-3 py-5 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
      <p
        className="min-w-0 break-words text-ink"
        style={{
          fontFamily: fontStack(style.font_family, font?.fallback),
          fontWeight: style.font_weight,
          fontSize: `clamp(14px, ${style.font_size}px, ${Math.max(style.font_size * 0.6, 14) / 16 + 'rem'} + 4vw)`,
          lineHeight: style.line_height,
          letterSpacing: `${style.letter_spacing}em`,
          textTransform: style.text_transform as 'none',
          fontStyle: style.italic ? 'italic' : 'normal',
        }}
      >
        {style.sample || style.name}
      </p>
      <div className="text-[13px]">
        <p className="font-semibold text-ink">{style.name}</p>
        <p className="mt-0.5 text-muted">
          {style.font_family} · {style.font_weight}
        </p>
        <p className="text-muted tabular-nums">
          {style.font_size} px / {style.line_height} · {style.letter_spacing} em
          {style.text_transform !== 'none' && ` · ${style.text_transform}`}
        </p>
        {style.usage && <p className="mt-1 text-ink-2">{style.usage}</p>}
      </div>
    </div>
  )
}

export function TypographyView({ content }: BlockViewProps<'typography'>) {
  const { brand, basePath, canEdit } = useBrandContext()
  const { data: fonts = [], isLoading: loadingFonts } = useFonts(brand.id)
  const { data: styles = [], isLoading: loadingStyles } = useTextStyles(brand.id)
  if (loadingFonts || loadingStyles) return <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />
  const shownFonts = content.fontIds.length > 0 ? fonts.filter((f) => content.fontIds.includes(f.id)) : fonts
  const shownStyles = content.styleIds.length > 0 ? styles.filter((s) => content.styleIds.includes(s.id)) : styles
  const showFonts = content.mode !== 'styles'
  const showStyles = content.mode !== 'fonts'
  if ((!showFonts || shownFonts.length === 0) && (!showStyles || shownStyles.length === 0)) {
    return (
      <EmptyState
        icon={<Type />}
        title="Noch keine Schriften"
        description="Schriften und Textstile werden in der Markenbasis gepflegt."
        action={
          canEdit ? (
            <Button asChild size="sm" variant="outline">
              <Link to={`${basePath}/basis?tab=typografie`}>Schriften anlegen</Link>
            </Button>
          ) : undefined
        }
      />
    )
  }
  return (
    <div className="space-y-8">
      {showFonts && shownFonts.length > 0 && (
        <div className={cn('grid gap-4', shownFonts.length > 1 && 'lg:grid-cols-2')}>
          {shownFonts.map((font) => (
            <FontCard key={font.id} font={font} sample={content.sampleText} />
          ))}
        </div>
      )}
      {showStyles && shownStyles.length > 0 && (
        <div className="divide-y divide-border rounded-2xl border border-border bg-surface px-5">
          {shownStyles.map((style) => (
            <TextStyleRow key={style.id} style={style} fonts={fonts} />
          ))}
        </div>
      )}
    </div>
  )
}

export function TypographyEditor(props: BlockEditorProps<'typography'>) {
  const { content, onChange } = props
  const { brand, basePath } = useBrandContext()
  const { data: fonts = [] } = useFonts(brand.id)
  const { data: styles = [] } = useTextStyles(brand.id)
  return (
    <div>
      <TypographyView {...props} />
      <SettingsPanel>
        <SettingsRow label="Anzeigen">
          <Segmented
            size="sm"
            value={content.mode}
            onChange={(mode) => onChange({ mode })}
            options={[
              { value: 'both', label: 'Schriften & Stile' },
              { value: 'fonts', label: 'Schriften' },
              { value: 'styles', label: 'Textstile' },
            ]}
          />
        </SettingsRow>
        {content.mode !== 'styles' && (
          <SettingsRow label="Schriften">
            <CheckboxList
              items={fonts.map((f) => ({ id: f.id, label: f.family }))}
              selected={content.fontIds}
              onChange={(fontIds) => onChange({ fontIds })}
            />
          </SettingsRow>
        )}
        {content.mode !== 'fonts' && (
          <SettingsRow label="Textstile">
            <CheckboxList
              items={styles.map((s) => ({ id: s.id, label: s.name }))}
              selected={content.styleIds}
              onChange={(styleIds) => onChange({ styleIds })}
            />
          </SettingsRow>
        )}
        <div className="space-y-1.5">
          <span className="text-[13px] font-medium text-ink-2">Beispieltext</span>
          <Input value={content.sampleText} onChange={(e) => onChange({ sampleText: e.target.value })} />
        </div>
        <Link
          to={`${basePath}/basis?tab=typografie`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent"
        >
          <Type className="size-4" /> Schriften in der Markenbasis bearbeiten
        </Link>
      </SettingsPanel>
    </div>
  )
}

/* ---------- Logos ---------- */

const BACKGROUNDS: Array<{ value: PreviewBackground; label: string }> = [
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
  { value: 'brand', label: 'Marke' },
  { value: 'checker', label: 'Transparent' },
]

const GRID_COLS = { 1: 'grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'grid-cols-2 lg:grid-cols-4' }

function LogoTile({ item, asset, allowDownload }: { item: LogoItem; asset: Asset | undefined; allowDownload: boolean }) {
  const canDownload = useCanDownload(asset)
  return (
    <figure className="avoid-break overflow-hidden rounded-2xl border border-border bg-surface">
      {asset ? (
        <AssetPreview asset={asset} background={item.background} className="aspect-[4/3]" preferOriginal />
      ) : item.image ? (
        <div className={cn('flex aspect-[4/3] items-center justify-center p-[8%]', backgroundClass(item.background))}>
          <StorageImage path={item.image.path} alt={item.label} fit="contain" className="h-full w-full" />
        </div>
      ) : (
        <div className={cn('aspect-[4/3]', backgroundClass(item.background))} />
      )}
      {(item.label || item.description || (allowDownload && asset)) && (
        <figcaption className="flex items-start justify-between gap-3 p-3.5">
          <div className="min-w-0">
            {item.label && <p className="font-semibold text-ink">{item.label}</p>}
            {item.description && <p className="mt-0.5 text-[13px] text-muted">{item.description}</p>}
          </div>
          {allowDownload && asset && canDownload && <DownloadMenu asset={asset} iconOnly variant="outline" />}
        </figcaption>
      )}
    </figure>
  )
}

export function LogosView({ content }: BlockViewProps<'logos'>) {
  const ids = content.items.map((i) => i.assetId).filter((id): id is string => Boolean(id))
  const { data: assets = [] } = useAssetsByIds(ids)
  const byId = new Map(assets.map((a) => [a.id, a]))
  if (content.items.length === 0) {
    return <EmptyState title="Noch keine Logos" description="Füge im Bearbeitungsmodus Logo-Varianten hinzu." />
  }
  return (
    <div className={cn('grid gap-4', GRID_COLS[content.columns])}>
      {content.items.map((item) => (
        <LogoTile
          key={item.id}
          item={item}
          asset={item.assetId ? byId.get(item.assetId) : undefined}
          allowDownload={content.allowDownload}
        />
      ))}
    </div>
  )
}

export function LogosEditor({ content, onChange }: BlockEditorProps<'logos'>) {
  const { brand } = useBrandContext()
  const [pickerOpen, setPickerOpen] = useState(false)
  const ids = content.items.map((i) => i.assetId).filter((id): id is string => Boolean(id))
  const { data: assets = [] } = useAssetsByIds(ids)
  const byId = new Map(assets.map((a) => [a.id, a]))
  const ops = listOps(content.items, (items) => onChange({ items }))
  return (
    <div className="space-y-3">
      {content.items.map((item, i) => {
        const asset = item.assetId ? byId.get(item.assetId) : undefined
        return (
          <div key={item.id} className="grid gap-3 rounded-2xl border border-border bg-surface p-3 sm:grid-cols-[180px_1fr]">
            {asset ? (
              <AssetPreview asset={asset} background={item.background} className="aspect-[4/3] rounded-xl" preferOriginal />
            ) : (
              <ImageField
                brandId={brand.id}
                value={item.image}
                onChange={(image) => ops.update(i, { image })}
                aspect="aspect-[4/3]"
              />
            )}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={item.label}
                  onChange={(e) => ops.update(i, { label: e.target.value })}
                  placeholder="Bezeichnung, z. B. Hauptlogo farbig"
                />
                <ItemControls index={i} count={content.items.length} onMove={ops.move} onRemove={() => ops.remove(i)} />
              </div>
              <Textarea
                value={item.description}
                onChange={(e) => ops.update(i, { description: e.target.value })}
                placeholder="Einsatzbereich (optional)"
                rows={2}
              />
              <Segmented
                size="sm"
                value={item.background}
                onChange={(background) => ops.update(i, { background })}
                options={BACKGROUNDS}
              />
            </div>
          </div>
        )
      })}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
          <Plus /> Logos aus Bibliothek
        </Button>
        <AddItemButton
          onClick={() =>
            ops.add({ id: uniqueId(), assetId: null, image: null, label: '', description: '', background: 'light' })
          }
        >
          Eigenes Bild
        </AddItemButton>
      </div>
      <SettingsPanel>
        <SettingsRow label="Spalten">
          <Segmented
            size="sm"
            value={String(content.columns)}
            onChange={(v) => onChange({ columns: Number(v) as 1 | 2 | 3 | 4 })}
            options={['1', '2', '3', '4'].map((v) => ({ value: v, label: v }))}
          />
        </SettingsRow>
        <Switch
          checked={content.allowDownload}
          onCheckedChange={(allowDownload) => onChange({ allowDownload })}
          label="Download anbieten"
          description="Nur für Logos aus der Bibliothek (mit Formatumwandlung)"
        />
      </SettingsPanel>
      <AssetPickerDialog
        brandId={brand.id}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        multiple
        onPick={(picked) =>
          onChange({
            items: [
              ...content.items,
              ...picked.map<LogoItem>((a) => ({
                id: uniqueId(),
                assetId: a.id,
                image: null,
                label: a.title,
                description: a.description,
                background: 'light',
              })),
            ],
          })
        }
      />
    </div>
  )
}

/* ---------- Do & Don't ---------- */

const DD_COLS = { 1: 'grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3' }

export function DosDontsView({ content }: BlockViewProps<'dos_donts'>) {
  return (
    <div className={cn('grid gap-4', DD_COLS[content.columns])}>
      {content.items.map((item) => {
        const isDo = item.kind === 'do'
        return (
          <div
            key={item.id}
            className={cn(
              'avoid-break overflow-hidden rounded-2xl border-2 bg-surface',
              isDo ? 'border-success/40' : 'border-danger/40',
            )}
          >
            {item.image && (
              <div className="relative aspect-[4/3] bg-surface-2">
                <StorageImage path={item.image.path} alt={item.title} fit="contain" className="h-full w-full" />
                {!isDo && (
                  <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
                    <line x1="0" y1="100%" x2="100%" y2="0" stroke="var(--danger)" strokeWidth="3" opacity="0.7" />
                  </svg>
                )}
              </div>
            )}
            <div className="flex gap-3 p-4">
              {isDo ? (
                <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-label="Richtig" />
              ) : (
                <CircleX className="mt-0.5 size-5 shrink-0 text-danger" aria-label="Falsch" />
              )}
              <div className="min-w-0">
                {item.title && <p className="font-semibold text-ink">{item.title}</p>}
                {item.text && <p className="mt-0.5 text-[15px] whitespace-pre-line text-ink-2">{item.text}</p>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function DosDontsEditor({ content, onChange }: BlockEditorProps<'dos_donts'>) {
  const { brand } = useBrandContext()
  const ops = listOps(content.items, (items) => onChange({ items }))
  return (
    <div className="space-y-3">
      <div className={cn('grid gap-3', DD_COLS[content.columns])}>
        {content.items.map((item, i) => (
          <div
            key={item.id}
            className={cn(
              'space-y-2 rounded-2xl border-2 bg-surface p-3',
              item.kind === 'do' ? 'border-success/40' : 'border-danger/40',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <Segmented
                size="sm"
                value={item.kind}
                onChange={(kind) => ops.update(i, { kind })}
                options={[
                  { value: 'do', label: <><Check /> Do</> },
                  { value: 'dont', label: <><X /> Don’t</> },
                ]}
              />
              <ItemControls index={i} count={content.items.length} onMove={ops.move} onRemove={() => ops.remove(i)} />
            </div>
            <ImageField brandId={brand.id} value={item.image} onChange={(image) => ops.update(i, { image })} aspect="aspect-[4/3]" emptyHint="Bild optional" />
            <InlineInput value={item.title} onChange={(title) => ops.update(i, { title })} placeholder="Titel" className="font-semibold" />
            <InlineInput
              multiline
              value={item.text}
              onChange={(text) => ops.update(i, { text })}
              placeholder="Erklärung"
              className="text-[15px] text-ink-2"
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <AddItemButton onClick={() => ops.add({ id: uniqueId(), kind: 'do', title: '', text: '', image: null })}>Do</AddItemButton>
        <AddItemButton onClick={() => ops.add({ id: uniqueId(), kind: 'dont', title: '', text: '', image: null })}>
          Don’t
        </AddItemButton>
      </div>
      <SettingsPanel>
        <SettingsRow label="Spalten">
          <Segmented
            size="sm"
            value={String(content.columns)}
            onChange={(v) => onChange({ columns: Number(v) as 1 | 2 | 3 })}
            options={['1', '2', '3'].map((v) => ({ value: v, label: v }))}
          />
        </SettingsRow>
      </SettingsPanel>
    </div>
  )
}

/* ---------- Karten ---------- */

const CARD_COLS = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }
const CARD_RATIO = { square: 'aspect-square', landscape: 'aspect-[16/10]', portrait: 'aspect-[3/4]' }
const CARD_STYLE = {
  plain: 'bg-transparent',
  filled: 'bg-surface border border-border',
  outline: 'border-2 border-brand bg-surface',
}

function CardLink({ link, children, className }: { link: string; children: React.ReactNode; className: string }) {
  const { basePath } = useBrandContext()
  if (!link) return <div className={className}>{children}</div>
  if (/^https?:\/\//.test(link)) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer" className={cn(className, 'transition-shadow hover:shadow-card')}>
        {children}
      </a>
    )
  }
  const to = link.startsWith('/') ? link : `${basePath}/${link}`
  return (
    <Link to={to} className={cn(className, 'transition-shadow hover:shadow-card')}>
      {children}
    </Link>
  )
}

export function CardsView({ content }: BlockViewProps<'cards'>) {
  return (
    <div className={cn('grid gap-4', CARD_COLS[content.columns])}>
      {content.items.map((item) => (
        <CardLink key={item.id} link={item.link} className={cn('avoid-break block overflow-hidden rounded-2xl', CARD_STYLE[content.style])}>
          {item.image && (
            <StorageImage path={item.image.path} alt={item.title} className={cn('w-full', CARD_RATIO[content.imageRatio])} />
          )}
          <div className={cn(content.style === 'plain' ? 'pt-3' : 'p-4 sm:p-5')}>
            {item.title && <p className="font-brand-heading text-lg font-semibold text-ink">{item.title}</p>}
            {item.text && <p className="mt-1 text-[15px] leading-relaxed whitespace-pre-line text-ink-2">{item.text}</p>}
          </div>
        </CardLink>
      ))}
    </div>
  )
}

export function CardsEditor({ content, onChange }: BlockEditorProps<'cards'>) {
  const { brand } = useBrandContext()
  const ops = listOps(content.items, (items) => onChange({ items }))
  const [showImages, setShowImages] = useState(content.items.some((i) => i.image))
  return (
    <div className="space-y-3">
      <div className={cn('grid gap-3', CARD_COLS[content.columns])}>
        {content.items.map((item, i) => (
          <div key={item.id} className={cn('space-y-2 rounded-2xl p-3', CARD_STYLE[content.style === 'plain' ? 'filled' : content.style])}>
            <div className="flex justify-end">
              <ItemControls index={i} count={content.items.length} onMove={ops.move} onRemove={() => ops.remove(i)} />
            </div>
            {showImages && (
              <ImageField brandId={brand.id} value={item.image} onChange={(image) => ops.update(i, { image })} aspect={CARD_RATIO[content.imageRatio]} />
            )}
            <InlineInput
              value={item.title}
              onChange={(title) => ops.update(i, { title })}
              placeholder="Titel"
              className="font-brand-heading text-lg font-semibold"
            />
            <InlineInput
              multiline
              value={item.text}
              onChange={(text) => ops.update(i, { text })}
              placeholder="Text"
              className="text-[15px] text-ink-2"
            />
            <Input
              value={item.link}
              onChange={(e) => ops.update(i, { link: e.target.value })}
              placeholder="Link (optional): https://… oder g/markenhandbuch/werte"
              className="h-8 text-xs"
            />
          </div>
        ))}
      </div>
      <AddItemButton onClick={() => ops.add({ id: uniqueId(), title: '', text: '', image: null, link: '' })}>Karte hinzufügen</AddItemButton>
      <SettingsPanel>
        <SettingsRow label="Spalten">
          <Segmented
            size="sm"
            value={String(content.columns)}
            onChange={(v) => onChange({ columns: Number(v) as 2 | 3 | 4 })}
            options={['2', '3', '4'].map((v) => ({ value: v, label: v }))}
          />
        </SettingsRow>
        <SettingsRow label="Stil">
          <Segmented
            size="sm"
            value={content.style}
            onChange={(style) => onChange({ style })}
            options={[
              { value: 'filled', label: 'Fläche' },
              { value: 'outline', label: 'Rahmen' },
              { value: 'plain', label: 'Schlicht' },
            ]}
          />
        </SettingsRow>
        <Switch checked={showImages} onCheckedChange={setShowImages} label="Bilder verwenden" />
        {showImages && (
          <SettingsRow label="Bildformat">
            <Segmented
              size="sm"
              value={content.imageRatio}
              onChange={(imageRatio) => onChange({ imageRatio })}
              options={[
                { value: 'landscape', label: 'Quer' },
                { value: 'square', label: 'Quadrat' },
                { value: 'portrait', label: 'Hoch' },
              ]}
            />
          </SettingsRow>
        )}
      </SettingsPanel>
    </div>
  )
}

/* ---------- Farb- & Token-Export ---------- */

export function useTokenSource() {
  const { brand } = useBrandContext()
  const { data: palettes = [] } = usePalettes(brand.id)
  const { data: fonts = [] } = useFonts(brand.id)
  const { data: styles = [] } = useTextStyles(brand.id)
  return {
    brandName: brand.name,
    palettes: palettes.map((p) => ({ name: p.name, colors: p.colors })),
    fonts,
    textStyles: styles,
  }
}

export function DownloadKitView({ content }: BlockViewProps<'download_kit'>) {
  const source = useTokenSource()
  const { brand } = useBrandContext()
  const canDownload = useCanDownload()
  const download = (format: TokenFormat) => {
    const meta = TOKEN_FORMATS[format]
    downloadBlob(buildTokenFile(format, source), `${slugify(brand.name)}-${meta.file}`)
  }
  if (!canDownload) return null
  return (
    <div className="avoid-break rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-ink">
          <PaletteIcon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-ink">{content.title}</p>
          {content.description && <p className="mt-0.5 text-sm text-muted">{content.description}</p>}
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {content.formats.map((format) => (
          <button
            key={format}
            type="button"
            onClick={() => download(format)}
            className="flex items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-2.5 text-left hover:border-border-strong hover:bg-surface-2"
          >
            <span>
              <span className="block text-sm font-semibold text-ink">{TOKEN_FORMATS[format].label}</span>
              <span className="block text-xs text-muted">{TOKEN_FORMATS[format].hint}</span>
            </span>
            <Download className="size-4 shrink-0 text-muted" />
          </button>
        ))}
      </div>
    </div>
  )
}

export function DownloadKitEditor(props: BlockEditorProps<'download_kit'>) {
  const { content, onChange } = props
  return (
    <div>
      <div className="space-y-2 rounded-2xl border border-border bg-surface p-4">
        <InlineInput value={content.title} onChange={(title) => onChange({ title })} placeholder="Titel" className="font-semibold" />
        <InlineInput
          value={content.description}
          onChange={(description) => onChange({ description })}
          placeholder="Beschreibung (optional)"
          className="text-sm text-muted"
        />
      </div>
      <SettingsPanel>
        <SettingsRow label="Formate">
          <CheckboxList
            items={(Object.keys(TOKEN_FORMATS) as TokenFormat[]).map((f) => ({ id: f, label: TOKEN_FORMATS[f].label }))}
            selected={content.formats}
            onChange={(formats) =>
              onChange({ formats: (formats.length === 0 ? Object.keys(TOKEN_FORMATS) : formats) as TokenFormat[] })
            }
            emptyLabel="Alle"
          />
        </SettingsRow>
        <p className="text-xs text-muted">Die Dateien werden live aus Farben, Schriften und Textstilen der Markenbasis erzeugt.</p>
      </SettingsPanel>
    </div>
  )
}

