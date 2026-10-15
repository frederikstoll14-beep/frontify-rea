import { ArrowDown, ArrowUp, FileType, Pencil, Plus, Trash2, Type, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { fontFiles, useBasicsMutations, useFonts, useTextStyles, type Font, type FontFile, type TextStyle } from '@/api/basics'
import { toJson } from '@/api/client'
import { buildPath, getSignedUrl, removeFiles, uploadFile } from '@/api/storage'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { Badge, EmptyState, SectionTitle, Segmented, Switch } from '@/components/ui/misc'
import { PageSpinner } from '@/components/ui/spinner'
import { fontStack, loadUploadedFont, loadWebFonts } from '@/lib/fonts'
import { isFontFile } from '@/lib/media'
import { errorMessage, fileExtension, slugify } from '@/lib/utils'
import { useBrandContext } from '@/features/brand/brand-context'

const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900]
const WEIGHT_NAMES: Record<number, string> = {
  100: 'Thin',
  200: 'ExtraLight',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'SemiBold',
  700: 'Bold',
  800: 'ExtraBold',
  900: 'Black',
}

export function guessWeight(fileName: string): { weight: number; style: 'normal' | 'italic' } {
  const name = fileName.toLowerCase().replace(/[-_ ]/g, '')
  const style = /italic|oblique/.test(name) ? 'italic' : 'normal'
  const table: Array<[RegExp, number]> = [
    [/thin|hairline/, 100],
    [/extralight|ultralight/, 200],
    [/light/, 300],
    [/medium/, 500],
    [/semibold|demibold/, 600],
    [/extrabold|ultrabold/, 800],
    [/black|heavy/, 900],
    [/bold/, 700],
  ]
  for (const [re, weight] of table) if (re.test(name)) return { weight, style }
  return { weight: 400, style }
}

interface FontDraft {
  id?: string
  family: string
  source: 'google' | 'upload' | 'system'
  role: string
  weights: number[]
  fallback: string
  license: string
  description: string
  files: FontFile[]
  sort: number
}

function FontDialog({ draft, onClose }: { draft: FontDraft; onClose: () => void }) {
  const { brand } = useBrandContext()
  const m = useBasicsMutations(brand.id)
  const [value, setValue] = useState(draft)
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const set = (patch: Partial<FontDraft>) => setValue((v) => ({ ...v, ...patch }))

  useEffect(() => {
    if (value.source === 'google' && value.family.trim().length > 2) {
      const t = setTimeout(() => loadWebFonts([{ family: value.family.trim(), weights: value.weights }]), 400)
      return () => clearTimeout(t)
    }
  }, [value.family, value.source, value.weights])

  useEffect(() => {
    if (value.source === 'upload' && value.files.length > 0 && value.family.trim()) {
      void loadUploadedFont({ family: value.family.trim() }, value.files, getSignedUrl)
    }
  }, [value.files, value.family, value.source])

  const uploadFonts = async (files: FileList | null) => {
    if (!files) return
    setUploading(true)
    const added: FontFile[] = []
    try {
      for (const file of Array.from(files)) {
        if (!isFontFile(file.name)) {
          toast.error(`${file.name}: nur WOFF2, WOFF, TTF oder OTF`)
          continue
        }
        const ext = fileExtension(file.name)
        const path = await uploadFile(buildPath(brand.id, 'fonts', file.name), file, `font/${ext === 'otf' ? 'otf' : ext}`)
        const guess = guessWeight(file.name)
        added.push({ path, name: file.name, format: ext, ...guess })
      }
      const weights = [...new Set([...value.weights, ...added.map((f) => f.weight)])].sort((a, b) => a - b)
      set({ files: [...value.files, ...added], weights })
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setUploading(false)
    }
  }

  const save = () => {
    if (!value.family.trim()) {
      toast.error('Bitte den Namen der Schriftfamilie eingeben')
      return
    }
    m.saveFont.mutate(
      {
        id: value.id,
        values: {
          family: value.family.trim(),
          source: value.source,
          role: value.role,
          weights: value.weights.length > 0 ? value.weights : [400],
          fallback: value.fallback || 'sans-serif',
          license: value.license,
          description: value.description,
          files: toJson(value.source === 'upload' ? value.files : []),
          sort: value.sort,
        },
      },
      { onSuccess: onClose, onError: (e) => toast.error(errorMessage(e)) },
    )
  }

  const family = fontStack(value.family, value.fallback)

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={value.id ? 'Schrift bearbeiten' : 'Neue Schrift'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={save} loading={m.saveFont.isPending}>
            Speichern
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Segmented
          value={value.source}
          onChange={(source) => set({ source })}
          options={[
            { value: 'google', label: 'Web-Font (Google Fonts)' },
            { value: 'upload', label: 'Eigene Dateien' },
            { value: 'system', label: 'Systemschrift' },
          ]}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Schriftfamilie"
            hint={
              value.source === 'google'
                ? 'Exakter Name wie auf fonts.google.com, z. B. Barlow Condensed'
                : value.source === 'system'
                  ? 'z. B. Arial, Georgia'
                  : 'Name, unter dem die Schrift verwendet wird'
            }
          >
            <Input autoFocus value={value.family} onChange={(e) => set({ family: e.target.value })} />
          </Field>
          <Field label="Rolle" hint="z. B. Headline, Text, Akzent">
            <Input value={value.role} onChange={(e) => set({ role: e.target.value })} />
          </Field>
        </div>
        <div className="rounded-2xl border border-border bg-surface-2/50 p-4">
          <p className="text-4xl leading-tight text-ink" style={{ fontFamily: family }}>
            {value.family || 'Schriftvorschau'}
          </p>
          <p className="mt-1 text-lg text-ink-2" style={{ fontFamily: family }}>
            Franz jagt im komplett verwahrlosten Taxi quer durch Bayern. 0123456789
          </p>
        </div>
        {value.source === 'upload' && (
          <div className="space-y-2">
            <p className="text-[13px] font-medium text-ink-2">Schriftdateien (WOFF2 empfohlen)</p>
            <ul className="space-y-1.5">
              {value.files.map((file, i) => (
                <li key={file.path} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <FileType className="size-4 text-muted" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <Select
                    value={String(file.weight)}
                    onChange={(e) =>
                      set({ files: value.files.map((f, fi) => (fi === i ? { ...f, weight: Number(e.target.value) } : f)) })
                    }
                    className="h-8 w-36"
                    aria-label="Schriftschnitt"
                  >
                    {WEIGHTS.map((w) => (
                      <option key={w} value={w}>
                        {w} {WEIGHT_NAMES[w]}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={file.style}
                    onChange={(e) =>
                      set({
                        files: value.files.map((f, fi) => (fi === i ? { ...f, style: e.target.value as 'normal' | 'italic' } : f)),
                      })
                    }
                    className="h-8 w-28"
                    aria-label="Stil"
                  >
                    <option value="normal">Normal</option>
                    <option value="italic">Kursiv</option>
                  </Select>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Datei entfernen"
                    onClick={() => {
                      void removeFiles([file.path])
                      set({ files: value.files.filter((_, fi) => fi !== i) })
                    }}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
            <Button size="sm" variant="outline" loading={uploading} onClick={() => fileInput.current?.click()}>
              <Upload /> Dateien hochladen
            </Button>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept=".woff2,.woff,.ttf,.otf"
              className="hidden"
              onChange={(e) => {
                void uploadFonts(e.target.files)
                e.target.value = ''
              }}
            />
            <p className="text-xs text-muted">Achte auf die Lizenz: Viele Schriften dürfen nicht weitergegeben werden.</p>
          </div>
        )}
        <Field label="Schnitte">
          <div className="flex flex-wrap gap-1.5">
            {WEIGHTS.map((w) => {
              const active = value.weights.includes(w)
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() =>
                    set({ weights: active ? value.weights.filter((x) => x !== w) : [...value.weights, w].sort((a, b) => a - b) })
                  }
                  className={`rounded-lg border px-2.5 py-1 text-sm ${active ? 'border-ink bg-ink text-bg' : 'border-border text-ink-2'}`}
                  style={{ fontFamily: family, fontWeight: w }}
                >
                  {w}
                </button>
              )
            })}
          </div>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ersatzschrift" hint="Für Office oder wenn die Schrift fehlt">
            <Input value={value.fallback} onChange={(e) => set({ fallback: e.target.value })} placeholder="Arial, sans-serif" />
          </Field>
          <Field label="Lizenz">
            <Input value={value.license} onChange={(e) => set({ license: e.target.value })} placeholder="SIL Open Font License" />
          </Field>
        </div>
        <Field label="Beschreibung">
          <Textarea value={value.description} onChange={(e) => set({ description: e.target.value })} rows={2} />
        </Field>
      </div>
    </Dialog>
  )
}

interface StyleDraft {
  id?: string
  name: string
  token: string
  font_family: string
  font_weight: number
  font_size: number
  line_height: number
  letter_spacing: number
  text_transform: string
  italic: boolean
  sample: string
  usage: string
  sort: number
}

function StyleDialog({ draft, fonts, onClose }: { draft: StyleDraft; fonts: Font[]; onClose: () => void }) {
  const { brand } = useBrandContext()
  const m = useBasicsMutations(brand.id)
  const confirm = useConfirm()
  const [value, setValue] = useState(draft)
  const set = (patch: Partial<StyleDraft>) => setValue((v) => ({ ...v, ...patch }))
  const font = fonts.find((f) => f.family === value.font_family)

  const save = () => {
    if (!value.name.trim() || !value.font_family) {
      toast.error('Name und Schrift sind Pflicht')
      return
    }
    m.saveTextStyle.mutate(
      {
        id: value.id,
        values: {
          name: value.name.trim(),
          token: value.token ? slugify(value.token) : '',
          font_family: value.font_family,
          font_weight: value.font_weight,
          font_size: value.font_size,
          line_height: value.line_height,
          letter_spacing: value.letter_spacing,
          text_transform: value.text_transform,
          italic: value.italic,
          sample: value.sample,
          usage: value.usage,
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
      title={value.id ? 'Textstil bearbeiten' : 'Neuer Textstil'}
      size="lg"
      footer={
        <>
          {value.id && (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              onClick={async () => {
                const ok = await confirm({ title: 'Textstil löschen?', confirmLabel: 'Löschen', danger: true })
                if (ok) m.deleteTextStyle.mutate(value.id!, { onSuccess: onClose })
              }}
            >
              <Trash2 /> Löschen
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={save} loading={m.saveTextStyle.isPending}>
            Speichern
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface-2/50 p-4">
          <p
            className="break-words text-ink"
            style={{
              fontFamily: fontStack(value.font_family, font?.fallback),
              fontWeight: value.font_weight,
              fontSize: `${Math.min(value.font_size, 96)}px`,
              lineHeight: value.line_height,
              letterSpacing: `${value.letter_spacing}em`,
              textTransform: value.text_transform as 'none',
              fontStyle: value.italic ? 'italic' : 'normal',
            }}
          >
            {value.sample || value.name || 'Beispieltext'}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <Input autoFocus value={value.name} onChange={(e) => set({ name: e.target.value })} placeholder="z. B. Headline 1" />
          </Field>
          <Field label="Token-Name">
            <Input value={value.token} onChange={(e) => set({ token: e.target.value })} placeholder={slugify(value.name || 'h1')} className="font-mono" />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Schrift">
            <Select value={value.font_family} onChange={(e) => set({ font_family: e.target.value })}>
              <option value="">Bitte wählen</option>
              {fonts.map((f) => (
                <option key={f.id} value={f.family}>
                  {f.family}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Schnitt">
            <Select value={String(value.font_weight)} onChange={(e) => set({ font_weight: Number(e.target.value) })}>
              {(font?.weights.length ? font.weights : WEIGHTS).map((w) => (
                <option key={w} value={w}>
                  {w} {WEIGHT_NAMES[w]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Schreibweise">
            <Select value={value.text_transform} onChange={(e) => set({ text_transform: e.target.value })}>
              <option value="none">Normal</option>
              <option value="uppercase">VERSALIEN</option>
              <option value="lowercase">gemeine</option>
              <option value="capitalize">Kapitälchen-Stil</option>
            </Select>
          </Field>
          <Field label="Größe (px)">
            <Input type="number" min={6} max={400} value={value.font_size} onChange={(e) => set({ font_size: Number(e.target.value) || 16 })} />
          </Field>
          <Field label="Zeilenhöhe">
            <Input
              type="number"
              step={0.05}
              min={0.7}
              max={3}
              value={value.line_height}
              onChange={(e) => set({ line_height: Number(e.target.value) || 1.4 })}
            />
          </Field>
          <Field label="Laufweite (em)">
            <Input
              type="number"
              step={0.01}
              min={-0.2}
              max={0.5}
              value={value.letter_spacing}
              onChange={(e) => set({ letter_spacing: Number(e.target.value) || 0 })}
            />
          </Field>
        </div>
        <Switch checked={value.italic} onCheckedChange={(italic) => set({ italic })} label="Kursiv" />
        <Field label="Beispieltext">
          <Input value={value.sample} onChange={(e) => set({ sample: e.target.value })} />
        </Field>
        <Field label="Verwendung">
          <Input value={value.usage} onChange={(e) => set({ usage: e.target.value })} placeholder="z. B. Seitentitel, Plakat-Headlines" />
        </Field>
      </div>
    </Dialog>
  )
}

export function TypographyManager() {
  const { brand, canEdit } = useBrandContext()
  const { data: fonts = [], isLoading } = useFonts(brand.id)
  const { data: styles = [] } = useTextStyles(brand.id)
  const m = useBasicsMutations(brand.id)
  const confirm = useConfirm()
  const [fontDraft, setFontDraft] = useState<FontDraft | null>(null)
  const [styleDraft, setStyleDraft] = useState<StyleDraft | null>(null)

  if (isLoading) return <PageSpinner />

  const moveStyle = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= styles.length) return
    const list = [...styles]
    const [item] = list.splice(index, 1)
    list.splice(target, 0, item)
    m.reorderTextStyles.mutate(list.map((s, i) => ({ id: s.id, sort: i })))
  }

  const editStyle = (s: TextStyle) =>
    setStyleDraft({
      id: s.id,
      name: s.name,
      token: s.token,
      font_family: s.font_family,
      font_weight: s.font_weight,
      font_size: Number(s.font_size),
      line_height: Number(s.line_height),
      letter_spacing: Number(s.letter_spacing),
      text_transform: s.text_transform,
      italic: s.italic,
      sample: s.sample,
      usage: s.usage,
      sort: s.sort,
    })

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle
          title="Schriften"
          description="Web-Fonts werden DSGVO-freundlich über Bunny Fonts (EU) geladen."
          action={
            canEdit ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setFontDraft({
                    family: '',
                    source: 'google',
                    role: '',
                    weights: [400, 700],
                    fallback: 'sans-serif',
                    license: '',
                    description: '',
                    files: [],
                    sort: fonts.length,
                  })
                }
              >
                <Plus /> Schrift
              </Button>
            ) : undefined
          }
        />
        {fonts.length === 0 ? (
          <EmptyState icon={<Type />} title="Noch keine Schriften" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {fonts.map((font) => (
              <div key={font.id} className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-surface p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {font.role && <Badge>{font.role}</Badge>}
                    <span className="text-xs text-muted">
                      {font.source === 'google' ? 'Web-Font' : font.source === 'upload' ? `${fontFiles(font).length} Datei(en)` : 'System'}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-3xl text-ink" style={{ fontFamily: fontStack(font.family, font.fallback) }}>
                    {font.family}
                  </p>
                  <p className="mt-1 text-xs text-muted">Schnitte: {font.weights.join(', ')}</p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Bearbeiten"
                      onClick={() =>
                        setFontDraft({
                          id: font.id,
                          family: font.family,
                          source: font.source as FontDraft['source'],
                          role: font.role,
                          weights: font.weights,
                          fallback: font.fallback,
                          license: font.license,
                          description: font.description,
                          files: fontFiles(font),
                          sort: font.sort,
                        })
                      }
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Löschen"
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Schrift löschen?',
                          description: 'Textstile mit dieser Schrift bleiben bestehen, nutzen aber die Ersatzschrift.',
                          confirmLabel: 'Löschen',
                          danger: true,
                        })
                        if (ok) m.deleteFont.mutate(font)
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle
          title="Textstile"
          description="Typografische Hierarchie von Display bis Bildunterschrift."
          action={
            canEdit && fonts.length > 0 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setStyleDraft({
                    name: '',
                    token: '',
                    font_family: fonts[0]?.family ?? '',
                    font_weight: 400,
                    font_size: 16,
                    line_height: 1.5,
                    letter_spacing: 0,
                    text_transform: 'none',
                    italic: false,
                    sample: '',
                    usage: '',
                    sort: styles.length,
                  })
                }
              >
                <Plus /> Textstil
              </Button>
            ) : undefined
          }
        />
        {styles.length === 0 ? (
          <EmptyState title="Noch keine Textstile" description={fonts.length === 0 ? 'Lege zuerst eine Schrift an.' : undefined} />
        ) : (
          <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {styles.map((s, i) => {
              const font = fonts.find((f) => f.family === s.font_family)
              return (
                <div key={s.id} className="flex items-center gap-4 px-4 py-4">
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-ink"
                      style={{
                        fontFamily: fontStack(s.font_family, font?.fallback),
                        fontWeight: s.font_weight,
                        fontSize: `${Math.min(Number(s.font_size), 56)}px`,
                        lineHeight: 1.2,
                        letterSpacing: `${s.letter_spacing}em`,
                        textTransform: s.text_transform as 'none',
                        fontStyle: s.italic ? 'italic' : 'normal',
                      }}
                    >
                      {s.sample || s.name}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      <span className="font-semibold text-ink-2">{s.name}</span> · {s.font_family} {s.font_weight} · {Number(s.font_size)} px /{' '}
                      {Number(s.line_height)}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0">
                      <Button size="icon-sm" variant="ghost" aria-label="Nach oben" disabled={i === 0} onClick={() => moveStyle(i, -1)}>
                        <ArrowUp />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Nach unten"
                        disabled={i === styles.length - 1}
                        onClick={() => moveStyle(i, 1)}
                      >
                        <ArrowDown />
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label="Bearbeiten" onClick={() => editStyle(s)}>
                        <Pencil />
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {fontDraft && <FontDialog draft={fontDraft} onClose={() => setFontDraft(null)} />}
      {styleDraft && <StyleDialog draft={styleDraft} fonts={fonts} onClose={() => setStyleDraft(null)} />}
    </div>
  )
}
