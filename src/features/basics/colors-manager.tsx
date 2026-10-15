import {
  ArrowLeft,
  ArrowRight,
  MoreHorizontal,
  Palette as PaletteIcon,
  Pencil,
  Plus,
  Trash2,
  Wand2,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useBasicsMutations, usePalettes, type Color, type Palette } from '@/api/basics'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from '@/components/ui/menu'
import { EmptyState } from '@/components/ui/misc'
import { PageSpinner } from '@/components/ui/spinner'
import {
  contrastRatio,
  formatCmyk,
  hexToRgb,
  normalizeHex,
  readableTextColor,
  rgbToCmyk,
  wcagLevel,
} from '@/lib/color'
import { errorMessage, slugify } from '@/lib/utils'
import { useBrandContext } from '@/features/brand/brand-context'

interface ColorDraft {
  id?: string
  palette_id: string
  name: string
  hex: string
  token: string
  usage: string
  description: string
  cmyk: string
  pantone: string
  hks: string
  ral: string
  ncs: string
  sort: number
}

function draftFrom(color: Color): ColorDraft {
  return {
    id: color.id,
    palette_id: color.palette_id,
    name: color.name,
    hex: color.hex,
    token: color.token,
    usage: color.usage,
    description: color.description,
    cmyk: color.cmyk,
    pantone: color.pantone,
    hks: color.hks,
    ral: color.ral,
    ncs: color.ncs,
    sort: color.sort,
  }
}

function ColorDialog({
  draft,
  palettes,
  onClose,
}: {
  draft: ColorDraft
  palettes: Palette[]
  onClose: () => void
}) {
  const { brand } = useBrandContext()
  const m = useBasicsMutations(brand.id)
  const confirm = useConfirm()
  const [value, setValue] = useState(draft)
  const [hexInput, setHexInput] = useState(draft.hex)
  const hex = normalizeHex(hexInput)
  const set = (patch: Partial<ColorDraft>) => setValue((v) => ({ ...v, ...patch }))

  const save = () => {
    if (!hex) {
      toast.error('Bitte einen gültigen HEX-Wert eingeben, z. B. #0B3C7A')
      return
    }
    if (!value.name.trim()) {
      toast.error('Bitte einen Namen eingeben')
      return
    }
    const token = value.token.trim() ? slugify(value.token) : ''
    m.saveColor.mutate(
      {
        id: value.id,
        values: {
          palette_id: value.palette_id,
          name: value.name.trim(),
          hex,
          token,
          usage: value.usage,
          description: value.description,
          cmyk: value.cmyk,
          pantone: value.pantone,
          hks: value.hks,
          ral: value.ral,
          ncs: value.ncs,
          sort: value.sort,
        },
      },
      { onSuccess: onClose, onError: (e) => toast.error(errorMessage(e)) },
    )
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={value.id ? 'Farbe bearbeiten' : 'Neue Farbe'}
      size="lg"
      footer={
        <>
          {value.id && (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              onClick={async () => {
                const ok = await confirm({ title: 'Farbe löschen?', confirmLabel: 'Löschen', danger: true })
                if (ok) m.deleteColor.mutate(value.id!, { onSuccess: onClose })
              }}
            >
              <Trash2 /> Löschen
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={save} loading={m.saveColor.isPending}>
            Speichern
          </Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[200px_1fr]">
        <div className="space-y-3">
          <div
            className="flex aspect-square items-end rounded-2xl border border-black/5 p-3 text-sm font-semibold"
            style={{ backgroundColor: hex ?? '#FFFFFF', color: hex ? readableTextColor(hex) : '#15171F' }}
          >
            {value.name || 'Farbe'}
          </div>
          {hex && (
            <div className="space-y-1 text-xs text-muted">
              <p>
                Kontrast zu Weiß: {contrastRatio(hex, '#FFFFFF').toFixed(1)}:1 (
                {wcagLevel(contrastRatio(hex, '#FFFFFF'))})
              </p>
              <p>
                Kontrast zu Schwarz: {contrastRatio(hex, '#000000').toFixed(1)}:1 (
                {wcagLevel(contrastRatio(hex, '#000000'))})
              </p>
            </div>
          )}
        </div>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input
                autoFocus
                value={value.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="z. B. Vereinsblau"
              />
            </Field>
            <Field label="HEX" error={hexInput && !hex ? 'Ungültig' : undefined}>
              <div className="flex gap-2">
                <input
                  type="color"
                  aria-label="Farbwähler"
                  value={hex ?? '#000000'}
                  onChange={(e) => setHexInput(e.target.value.toUpperCase())}
                  className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-border bg-surface p-1"
                />
                <Input
                  aria-label="HEX-Wert"
                  value={hexInput}
                  onChange={(e) => setHexInput(e.target.value)}
                  placeholder="#0B3C7A"
                  className="font-mono"
                />
              </div>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Palette">
              <Select value={value.palette_id} onChange={(e) => set({ palette_id: e.target.value })}>
                {palettes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Token-Name" hint="Für CSS/Design Tokens, z. B. primary">
              <Input
                value={value.token}
                onChange={(e) => set({ token: e.target.value })}
                onBlur={() => set({ token: value.token ? slugify(value.token) : '' })}
                placeholder={slugify(value.name || 'farbe')}
                className="font-mono"
              />
            </Field>
          </div>
          <Field label="Verwendung / Anteil" hint="z. B. Primärfarbe · ca. 60 %">
            <Input value={value.usage} onChange={(e) => set({ usage: e.target.value })} />
          </Field>
          <Field label="Beschreibung">
            <Textarea
              value={value.description}
              onChange={(e) => set({ description: e.target.value })}
              rows={2}
            />
          </Field>
          <fieldset className="space-y-3 rounded-xl border border-border p-3">
            <legend className="px-1 text-[13px] font-medium text-ink-2">Druck & Industrie</legend>
            <Field
              label="CMYK"
              hint="Verbindlicher Wert aus der Druckerei. Der Vorschlag ist nur eine Näherung."
            >
              <div className="flex gap-2">
                <Input
                  value={value.cmyk}
                  onChange={(e) => set({ cmyk: e.target.value })}
                  placeholder="100/70/0/25"
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="CMYK-Näherung berechnen"
                  disabled={!hex}
                  onClick={() => hex && set({ cmyk: formatCmyk(rgbToCmyk(hexToRgb(hex))) })}
                >
                  <Wand2 />
                </Button>
              </div>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Pantone">
                <Input
                  value={value.pantone}
                  onChange={(e) => set({ pantone: e.target.value })}
                  placeholder="2945 C"
                />
              </Field>
              <Field label="HKS">
                <Input
                  value={value.hks}
                  onChange={(e) => set({ hks: e.target.value })}
                  placeholder="HKS 43 K"
                />
              </Field>
              <Field label="RAL">
                <Input value={value.ral} onChange={(e) => set({ ral: e.target.value })} placeholder="5002" />
              </Field>
              <Field label="NCS">
                <Input
                  value={value.ncs}
                  onChange={(e) => set({ ncs: e.target.value })}
                  placeholder="S 3060-R90B"
                />
              </Field>
            </div>
          </fieldset>
        </div>
      </div>
    </Dialog>
  )
}

export function ColorsManager() {
  const { brand, canEdit } = useBrandContext()
  const { data: palettes = [], isLoading } = usePalettes(brand.id)
  const m = useBasicsMutations(brand.id)
  const confirm = useConfirm()
  const [editing, setEditing] = useState<ColorDraft | null>(null)
  const [paletteDialog, setPaletteDialog] = useState<{
    id?: string
    name: string
    description: string
  } | null>(null)

  if (isLoading) return <PageSpinner />

  const newColor = (palette: Palette) =>
    setEditing({
      palette_id: palette.id,
      name: '',
      hex: '#',
      token: '',
      usage: '',
      description: '',
      cmyk: '',
      pantone: '',
      hks: '',
      ral: '',
      ncs: '',
      sort: palette.colors.length,
    })

  const moveColor = (palette: Palette, index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= palette.colors.length) return
    const list = [...palette.colors]
    const [item] = list.splice(index, 1)
    list.splice(target, 0, item)
    m.reorderColors.mutate(list.map((c, i) => ({ id: c.id, sort: i })))
  }

  return (
    <div className="space-y-8">
      {palettes.length === 0 && (
        <EmptyState
          icon={<PaletteIcon />}
          title="Noch keine Farbpalette"
          description="Lege eine Palette an, z. B. „Primärfarben“."
          action={
            canEdit ? (
              <Button onClick={() => setPaletteDialog({ name: 'Primärfarben', description: '' })}>
                <Plus /> Palette anlegen
              </Button>
            ) : undefined
          }
        />
      )}
      {palettes.map((palette) => (
        <section key={palette.id}>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h3 className="font-brand-heading text-xl font-semibold text-ink">{palette.name}</h3>
              {palette.description && <p className="text-sm text-muted">{palette.description}</p>}
            </div>
            {canEdit && (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => newColor(palette)}>
                  <Plus /> Farbe
                </Button>
                <MenuRoot>
                  <MenuTrigger asChild>
                    <Button size="icon-sm" variant="ghost" aria-label="Palette bearbeiten">
                      <MoreHorizontal />
                    </Button>
                  </MenuTrigger>
                  <MenuContent>
                    <MenuItem
                      icon={<Pencil />}
                      onSelect={() =>
                        setPaletteDialog({
                          id: palette.id,
                          name: palette.name,
                          description: palette.description,
                        })
                      }
                    >
                      Umbenennen
                    </MenuItem>
                    <MenuItem
                      icon={<Trash2 />}
                      danger
                      onSelect={async () => {
                        const ok = await confirm({
                          title: 'Palette löschen?',
                          description: `„${palette.name}“ und ${palette.colors.length} Farben werden gelöscht.`,
                          confirmLabel: 'Löschen',
                          danger: true,
                        })
                        if (ok) m.deletePalette.mutate(palette.id)
                      }}
                    >
                      Palette löschen
                    </MenuItem>
                  </MenuContent>
                </MenuRoot>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {palette.colors.map((color, i) => (
              <div
                key={color.id}
                className="group overflow-hidden rounded-2xl border border-border bg-surface"
              >
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setEditing(draftFrom(color))}
                  className="flex aspect-square w-full items-end p-3 text-left disabled:cursor-default"
                  style={{ backgroundColor: color.hex, color: readableTextColor(color.hex) }}
                  aria-label={canEdit ? `${color.name} bearbeiten` : color.name}
                >
                  <span className="text-xs font-medium opacity-80">{color.usage}</span>
                </button>
                <div className="flex items-start justify-between gap-1 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{color.name}</p>
                    <p className="font-mono text-xs text-muted">{color.hex}</p>
                    {color.cmyk && (
                      <p className="truncate font-mono text-[11px] text-muted">CMYK {color.cmyk}</p>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        aria-label="Nach links"
                        className="rounded p-1 text-muted hover:bg-surface-2"
                        onClick={() => moveColor(palette, i, -1)}
                      >
                        <ArrowLeft className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Nach rechts"
                        className="rounded p-1 text-muted hover:bg-surface-2"
                        onClick={() => moveColor(palette, i, 1)}
                      >
                        <ArrowRight className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {canEdit && (
              <button
                type="button"
                onClick={() => newColor(palette)}
                className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border-strong text-sm text-muted hover:border-ink hover:text-ink"
              >
                <Plus className="size-5" /> Farbe
              </button>
            )}
          </div>
        </section>
      ))}
      {canEdit && palettes.length > 0 && (
        <Button variant="outline" onClick={() => setPaletteDialog({ name: '', description: '' })}>
          <Plus /> Neue Palette
        </Button>
      )}

      {editing && <ColorDialog draft={editing} palettes={palettes} onClose={() => setEditing(null)} />}

      <Dialog
        open={paletteDialog !== null}
        onOpenChange={(open) => !open && setPaletteDialog(null)}
        title={paletteDialog?.id ? 'Palette bearbeiten' : 'Neue Palette'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPaletteDialog(null)}>
              Abbrechen
            </Button>
            <Button
              disabled={!paletteDialog?.name.trim()}
              onClick={async () => {
                if (!paletteDialog) return
                try {
                  if (paletteDialog.id) {
                    await m.updatePalette.mutateAsync({
                      id: paletteDialog.id,
                      patch: { name: paletteDialog.name.trim(), description: paletteDialog.description },
                    })
                  } else {
                    const created = await m.createPalette.mutateAsync({
                      name: paletteDialog.name.trim(),
                      sort: palettes.length,
                    })
                    if (paletteDialog.description) {
                      await m.updatePalette.mutateAsync({
                        id: created.id,
                        patch: { description: paletteDialog.description },
                      })
                    }
                  }
                  setPaletteDialog(null)
                } catch (e) {
                  toast.error(errorMessage(e))
                }
              }}
            >
              Speichern
            </Button>
          </>
        }
      >
        {paletteDialog && (
          <div className="space-y-3">
            <Field label="Name">
              <Input
                autoFocus
                value={paletteDialog.name}
                onChange={(e) => setPaletteDialog({ ...paletteDialog, name: e.target.value })}
              />
            </Field>
            <Field label="Beschreibung">
              <Textarea
                value={paletteDialog.description}
                onChange={(e) => setPaletteDialog({ ...paletteDialog, description: e.target.value })}
                rows={2}
              />
            </Field>
          </div>
        )}
      </Dialog>
    </div>
  )
}
