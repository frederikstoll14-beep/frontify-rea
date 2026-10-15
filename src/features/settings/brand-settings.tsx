import JSZip from 'jszip'
import {
  AlertTriangle,
  Copy,
  Download,
  ExternalLink,
  FileJson,
  FolderArchive,
  Globe,
  Lock,
  Plus,
  Trash2,
  Upload,
  Users,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useFonts, usePalettes, useTextStyles } from '@/api/basics'
import { canAdmin, useApplyTemplate, useDeleteBrand, useUpdateBrand, type BrandPatch } from '@/api/brands'
import { useGuidelines } from '@/api/guidelines'
import { useBrandAssets, useLibraries } from '@/api/libraries'
import { useBrandMembers, useRemoveBrandMember, useSetBrandRole } from '@/api/members'
import { downloadFile } from '@/api/storage'
import { ImageField } from '@/components/media/upload'
import { RichTextEditor } from '@/components/rich-text'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { Card, EmptyState, SectionTitle, Segmented, Switch, Tabs } from '@/components/ui/misc'
import { buildBrandExport, parseBrandExport, stripForeignReferences } from '@/lib/brand-export'
import { normalizeHex } from '@/lib/color'
import { supabase } from '@/lib/supabase'
import { ORG_TYPES, type BrandHome, type BrandTheme, type QuickLink } from '@/lib/templates/types'
import { downloadBlob, downloadText, errorMessage, slugify } from '@/lib/utils'
import { useBrandContext } from '@/features/brand/brand-context'
import { BRAND_ROLES, MembersPanel } from '@/features/members/members-panel'

function useSave() {
  const { brand } = useBrandContext()
  const update = useUpdateBrand(brand)
  return (patch: BrandPatch, message = 'Gespeichert') =>
    update.mutateAsync(patch).then(
      (next) => {
        toast.success(message)
        return next
      },
      (e) => {
        toast.error(errorMessage(e))
        throw e
      },
    )
}

function GeneralTab() {
  const { brand } = useBrandContext()
  const save = useSave()
  const navigate = useNavigate()
  const [name, setName] = useState(brand.name)
  const [slug, setSlug] = useState(brand.slug)
  const [tagline, setTagline] = useState(brand.tagline)
  const [description, setDescription] = useState(brand.description)
  const [orgType, setOrgType] = useState(brand.org_type)
  const [busy, setBusy] = useState(false)

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Field label="Name der Marke">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Art der Organisation">
            <Select value={orgType} onChange={(e) => setOrgType(e.target.value)}>
              {Object.entries(ORG_TYPES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Kurz-URL" hint={`${window.location.origin}/b/${slugify(slug)}`}>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              onBlur={() => setSlug(slugify(slug))}
            />
          </Field>
        </div>
        <Field label="Claim / Tagline">
          <Input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="z. B. Gemeinsam am Rhein."
          />
        </Field>
        <Field label="Kurzbeschreibung">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </Field>
        <Button
          loading={busy}
          onClick={async () => {
            setBusy(true)
            try {
              const next = await save({
                name: name.trim() || brand.name,
                slug: slugify(slug),
                tagline,
                description,
                org_type: orgType,
              })
              if (next.slug !== brand.slug) navigate(`/b/${next.slug}/einstellungen`, { replace: true })
            } finally {
              setBusy(false)
            }
          }}
        >
          Speichern
        </Button>
      </div>
      <div className="space-y-5">
        <Field label="Logo (für Kopfzeile und Startseite)" hint="SVG oder PNG mit transparentem Hintergrund">
          <ImageField
            brandId={brand.id}
            value={brand.logo_path ? { path: brand.logo_path } : null}
            onChange={(image) => void save({ logo_path: image?.path ?? null }, 'Logo aktualisiert')}
            aspect="aspect-square"
          />
        </Field>
        <Field label="Titelbild der Startseite" hint="Querformat, mind. 1600 px breit">
          <ImageField
            brandId={brand.id}
            value={brand.cover_path ? { path: brand.cover_path } : null}
            onChange={(image) => void save({ cover_path: image?.path ?? null }, 'Titelbild aktualisiert')}
          />
        </Field>
      </div>
    </div>
  )
}

function ThemeTab() {
  const { brand } = useBrandContext()
  const save = useSave()
  const { data: palettes = [] } = usePalettes(brand.id)
  const { data: fonts = [] } = useFonts(brand.id)
  const [theme, setTheme] = useState<BrandTheme>(brand.theme)
  const colors = palettes.flatMap((p) => p.colors)
  const set = (patch: Partial<BrandTheme>) => setTheme((t) => ({ ...t, ...patch }))

  const colorField = (key: 'primary' | 'accent', label: string) => (
    <Field label={label}>
      <div className="flex gap-2">
        <input
          type="color"
          aria-label={label}
          value={normalizeHex(theme[key] ?? '') ?? '#000000'}
          onChange={(e) => set({ [key]: e.target.value.toUpperCase() })}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-border bg-surface p-1"
        />
        <Input
          value={theme[key] ?? ''}
          onChange={(e) => set({ [key]: e.target.value })}
          className="font-mono"
        />
      </div>
      {colors.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {colors.map((c) => (
            <button
              key={c.id}
              type="button"
              title={`${c.name} ${c.hex}`}
              onClick={() => set({ [key]: c.hex })}
              className="size-7 rounded-full border border-black/10"
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      )}
    </Field>
  )

  return (
    <div className="max-w-2xl space-y-5">
      <p className="text-sm text-ink-2">
        Das Portal übernimmt die Gestaltung deiner Marke: Farben aus der Markenbasis und Hausschriften für
        Überschriften und Text.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {colorField('primary', 'Primärfarbe (Flächen, Kopfbereich)')}
        {colorField('accent', 'Akzentfarbe (Buttons, Links)')}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Schrift für Überschriften" hint="Aus der Markenbasis oder ein Google-Font-Name">
          <Input
            list="brand-fonts"
            value={theme.headingFont ?? ''}
            onChange={(e) => set({ headingFont: e.target.value })}
          />
        </Field>
        <Field label="Schrift für Fließtext">
          <Input
            list="brand-fonts"
            value={theme.bodyFont ?? ''}
            onChange={(e) => set({ bodyFont: e.target.value })}
          />
        </Field>
        <datalist id="brand-fonts">
          {fonts.map((f) => (
            <option key={f.id} value={f.family} />
          ))}
        </datalist>
      </div>
      <Field label="Startseite: Kopfbereich">
        <Segmented
          value={theme.heroStyle ?? 'brand'}
          onChange={(heroStyle) => set({ heroStyle })}
          options={[
            { value: 'brand', label: 'Primärfarbe' },
            { value: 'dark', label: 'Dunkel' },
            { value: 'light', label: 'Hell' },
          ]}
        />
      </Field>
      <div
        className="overflow-hidden rounded-2xl border border-border"
        style={{ fontFamily: theme.bodyFont ? `'${theme.bodyFont}', sans-serif` : undefined }}
      >
        <div
          className="p-6"
          style={{ backgroundColor: normalizeHex(theme.primary ?? '') ?? '#15171F', color: '#fff' }}
        >
          <p
            className="text-3xl font-bold"
            style={{ fontFamily: theme.headingFont ? `'${theme.headingFont}', sans-serif` : undefined }}
          >
            {brand.name}
          </p>
          <span
            className="mt-4 inline-block rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ backgroundColor: normalizeHex(theme.accent ?? '') ?? '#D9481F' }}
          >
            Vorschau-Button
          </span>
        </div>
      </div>
      <Button onClick={() => void save({ theme })}>Erscheinungsbild speichern</Button>
    </div>
  )
}

function HomeTab() {
  const { brand } = useBrandContext()
  const save = useSave()
  const [home, setHome] = useState<BrandHome>(brand.home)
  const links = home.quickLinks ?? []
  const setLinks = (quickLinks: QuickLink[]) => setHome((h) => ({ ...h, quickLinks }))
  return (
    <div className="max-w-2xl space-y-5">
      <Field label="Begrüßungstext">
        <RichTextEditor
          value={home.welcome ?? ''}
          onChange={(welcome) => setHome((h) => ({ ...h, welcome }))}
        />
      </Field>
      <div className="space-y-2">
        <p className="text-[13px] font-medium text-ink-2">Schnellzugriff</p>
        {links.map((link, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={link.label}
              onChange={(e) =>
                setLinks(links.map((l, li) => (li === i ? { ...l, label: e.target.value } : l)))
              }
              placeholder="Beschriftung"
            />
            <Input
              value={link.url}
              onChange={(e) => setLinks(links.map((l, li) => (li === i ? { ...l, url: e.target.value } : l)))}
              placeholder="https://… oder library:logos"
            />
            <Button
              size="icon"
              variant="ghost"
              aria-label="Entfernen"
              onClick={() => setLinks(links.filter((_, li) => li !== i))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setLinks([...links, { label: '', url: '' }])}>
          <Plus /> Link
        </Button>
        <p className="text-xs text-muted">
          Interne Ziele: <code>library:SLUG</code> für eine Bibliothek, <code>page:HANDBUCH/SEITE</code> für
          eine Seite.
        </p>
      </div>
      <Switch
        checked={home.showColors ?? true}
        onCheckedChange={(showColors) => setHome((h) => ({ ...h, showColors }))}
        label="Farbleiste unter dem Kopfbereich zeigen"
      />
      <Button
        onClick={() => void save({ home: { ...home, quickLinks: links.filter((l) => l.label && l.url) } })}
      >
        Startseite speichern
      </Button>
    </div>
  )
}

function ShareTab() {
  const { brand } = useBrandContext()
  const save = useSave()
  const publicUrl = `${window.location.origin}/b/${brand.slug}`
  const [until, setUntil] = useState(brand.public_until ? brand.public_until.slice(0, 10) : '')
  useEffect(() => setUntil(brand.public_until ? brand.public_until.slice(0, 10) : ''), [brand.public_until])

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="p-5">
        <SectionTitle title="Sichtbarkeit im Workspace" />
        <Segmented
          value={brand.visibility}
          onChange={(visibility) => void save({ visibility })}
          options={[
            {
              value: 'workspace',
              label: (
                <>
                  <Users /> Alle im Workspace
                </>
              ),
            },
            {
              value: 'private',
              label: (
                <>
                  <Lock /> Nur Mitglieder der Marke
                </>
              ),
            },
          ]}
        />
        <p className="mt-2 text-sm text-muted">
          {brand.visibility === 'workspace'
            ? 'Alle Mitglieder des Workspaces (z. B. der ganze Kurs) können die Marke ansehen und kommentieren.'
            : 'Nur ausdrücklich eingeladene Personen und Workspace-Admins sehen die Marke.'}
        </p>
      </Card>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <Globe className="size-5" /> Öffentlicher Freigabelink
            </h3>
            <p className="mt-1 text-sm text-muted">
              Jede Person mit dem Link kann das Portal ohne Konto ansehen – ideal für Präsentation, Jury oder
              Auftraggeber. Kommentare, Mitglieder und Verlauf bleiben privat.
            </p>
          </div>
          <Switch
            checked={brand.is_public}
            onCheckedChange={(is_public) =>
              void save({ is_public }, is_public ? 'Freigabe aktiv' : 'Freigabe beendet')
            }
          />
        </div>
        {brand.is_public && (
          <div className="mt-4 space-y-4">
            <div className="flex gap-2">
              <Input
                readOnly
                value={publicUrl}
                onFocus={(e) => e.target.select()}
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(publicUrl)
                  toast.success('Link kopiert')
                }}
              >
                <Copy /> Kopieren
              </Button>
              <Button asChild variant="ghost" size="icon" aria-label="Öffnen">
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink />
                </a>
              </Button>
            </div>
            <Switch
              checked={brand.public_downloads}
              onCheckedChange={(public_downloads) => void save({ public_downloads })}
              label="Downloads für Gäste erlauben"
              description="Logos, Dateien und Token-Exporte herunterladen"
            />
            <Field label="Freigabe automatisch beenden am" hint="Leer lassen für unbegrenzt">
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                  className="w-48"
                />
                <Button
                  variant="outline"
                  onClick={() =>
                    void save({ public_until: until ? new Date(`${until}T23:59:59`).toISOString() : null })
                  }
                >
                  Übernehmen
                </Button>
              </div>
            </Field>
            {brand.public_until && new Date(brand.public_until) < new Date() && (
              <p className="flex items-center gap-2 text-sm text-danger">
                <AlertTriangle className="size-4" /> Die Freigabe ist abgelaufen.
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

function MembersTab() {
  const { brand } = useBrandContext()
  const { data: members = [] } = useBrandMembers(brand.id)
  const setRole = useSetBrandRole(brand.id)
  const remove = useRemoveBrandMember(brand.id)
  if (!brand.workspace) return <EmptyState title="Kein Zugriff auf den Workspace" />
  return (
    <div className="max-w-3xl">
      <p className="mb-5 text-sm text-ink-2">
        Workspace-Admins (z. B. Dozierende) haben automatisch Admin-Rechte auf alle Marken. Hier lädst du
        weitere Personen gezielt zu dieser Marke ein – sie sehen dann nur diese Marke.
      </p>
      <MembersPanel
        workspaceId={brand.workspace.id}
        brandId={brand.id}
        members={members}
        roles={BRAND_ROLES}
        canManage={canAdmin(brand.role)}
        scopeLabel={brand.name}
        onRoleChange={(userId, role) =>
          setRole.mutate(
            { userId, role: role as 'admin' | 'editor' | 'viewer' },
            { onError: (e) => toast.error(errorMessage(e)) },
          )
        }
        onRemove={(userId) => remove.mutate(userId, { onError: (e) => toast.error(errorMessage(e)) })}
      />
    </div>
  )
}

function DataTab() {
  const { brand } = useBrandContext()
  const { data: palettes = [] } = usePalettes(brand.id)
  const { data: fonts = [] } = useFonts(brand.id)
  const { data: styles = [] } = useTextStyles(brand.id)
  const { data: libraries = [] } = useLibraries(brand.id)
  const { data: guidelines = [] } = useGuidelines(brand.id)
  const { data: assets = [] } = useBrandAssets(brand.id)
  const apply = useApplyTemplate(brand.id)
  const confirm = useConfirm()
  const importInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'json' | 'zip' | 'import' | null>(null)

  const exportJson = async () => {
    setBusy('json')
    try {
      const guidelineIds = guidelines.map((g) => g.id)
      const { data: pages, error } = await supabase
        .from('guideline_pages')
        .select('*')
        .in('guideline_id', guidelineIds)
      if (error) throw error
      const pageIds = (pages ?? []).map((p) => p.id)
      const { data: blocks, error: blockError } = pageIds.length
        ? await supabase.from('blocks').select('page_id, type, width, sort, content').in('page_id', pageIds)
        : { data: [], error: null }
      if (blockError) throw blockError
      const file = buildBrandExport({
        brand,
        palettes,
        fonts,
        textStyles: styles.map((s) => ({
          ...s,
          font_size: Number(s.font_size),
          line_height: Number(s.line_height),
          letter_spacing: Number(s.letter_spacing),
        })),
        libraries,
        guidelines,
        pages: pages ?? [],
        blocks: blocks ?? [],
      })
      downloadText(
        JSON.stringify(file, null, 2),
        `${brand.slug}-brandbench-${new Date().toISOString().slice(0, 10)}.json`,
        'application/json',
      )
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const exportZip = async () => {
    setBusy('zip')
    try {
      const zip = new JSZip()
      const byLibrary = new Map(libraries.map((l) => [l.id, slugify(l.name)]))
      let count = 0
      for (const asset of assets) {
        const blob = await downloadFile(asset.file_path)
        zip.file(`${byLibrary.get(asset.library_id) ?? 'dateien'}/${asset.file_name}`, blob)
        count++
      }
      if (count === 0) {
        toast.info('Noch keine Dateien in den Bibliotheken')
        return
      }
      downloadBlob(await zip.generateAsync({ type: 'blob' }), `${brand.slug}-dateien.zip`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const importJson = async (file: File) => {
    try {
      const parsed = parseBrandExport(await file.text())
      const ok = await confirm({
        title: 'Inhalte importieren?',
        description: `„${parsed.source.name}“ wird zu dieser Marke hinzugefügt (Handbücher, Farben, Schriften, Bibliotheken). Bestehende Inhalte bleiben erhalten. Bilder aus anderen Marken werden nicht übernommen.`,
        confirmLabel: 'Importieren',
      })
      if (!ok) return
      setBusy('import')
      const data =
        parsed.source.brandId === brand.id ? parsed.data : stripForeignReferences(parsed.data, brand.id)
      await apply.mutateAsync({ ...data, theme: undefined, home: undefined })
      toast.success('Import abgeschlossen')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <Card className="p-5">
        <FileJson className="mb-3 size-6 text-muted" />
        <h3 className="font-semibold text-ink">Struktur & Inhalte exportieren</h3>
        <p className="mt-1 mb-4 text-sm text-muted">
          JSON-Datei mit Handbüchern, Bausteinen, Farben und Schriften. Als Backup oder Vorlage für andere
          Marken.
        </p>
        <Button variant="outline" loading={busy === 'json'} onClick={() => void exportJson()}>
          <Download /> JSON exportieren
        </Button>
      </Card>
      <Card className="p-5">
        <FolderArchive className="mb-3 size-6 text-muted" />
        <h3 className="font-semibold text-ink">Alle Dateien herunterladen</h3>
        <p className="mt-1 mb-4 text-sm text-muted">
          {assets.length} Dateien aus allen Bibliotheken als ZIP, nach Bibliothek sortiert.
        </p>
        <Button variant="outline" loading={busy === 'zip'} onClick={() => void exportZip()}>
          <Download /> ZIP erstellen
        </Button>
      </Card>
      <Card className="p-5 sm:col-span-2">
        <Upload className="mb-3 size-6 text-muted" />
        <h3 className="font-semibold text-ink">Aus Datei importieren</h3>
        <p className="mt-1 mb-4 text-sm text-muted">
          Spielt eine exportierte JSON-Datei in diese Marke ein – z. B. eine Vorlage der Dozierenden oder ein
          Backup.
        </p>
        <Button variant="outline" loading={busy === 'import'} onClick={() => importInput.current?.click()}>
          <Upload /> JSON importieren
        </Button>
        <input
          ref={importInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void importJson(file)
          }}
        />
      </Card>
    </div>
  )
}

function DangerTab() {
  const { brand } = useBrandContext()
  const remove = useDeleteBrand()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [typed, setTyped] = useState('')
  return (
    <Card className="max-w-2xl border-danger/40 p-5">
      <h3 className="text-lg font-semibold text-danger">Marke löschen</h3>
      <p className="mt-1 text-sm text-ink-2">
        Löscht die Marke mit allen Handbüchern, Dateien, Kommentaren und Versionen endgültig. Exportiere
        vorher ein Backup.
      </p>
      <Field label={`Zur Bestätigung „${brand.name}“ eingeben`} className="mt-4">
        <Input value={typed} onChange={(e) => setTyped(e.target.value)} />
      </Field>
      <Button
        variant="danger"
        className="mt-4"
        disabled={typed !== brand.name}
        loading={remove.isPending}
        onClick={async () => {
          const ok = await confirm({
            title: 'Wirklich endgültig löschen?',
            confirmLabel: 'Endgültig löschen',
            danger: true,
          })
          if (!ok) return
          remove.mutate(brand, {
            onSuccess: () => {
              toast.success('Marke gelöscht')
              navigate(brand.workspace ? `/w/${brand.workspace.slug}` : '/')
            },
            onError: (e) => toast.error(errorMessage(e)),
          })
        }}
      >
        <Trash2 /> Marke löschen
      </Button>
    </Card>
  )
}

const TABS = [
  { value: 'allgemein', label: 'Allgemein' },
  { value: 'erscheinungsbild', label: 'Erscheinungsbild' },
  { value: 'startseite', label: 'Startseite' },
  { value: 'teilen', label: 'Teilen' },
  { value: 'mitglieder', label: 'Mitglieder' },
  { value: 'daten', label: 'Export & Import' },
  { value: 'loeschen', label: 'Löschen' },
]

export function BrandSettingsPage() {
  const { brand, canAdmin: isAdmin } = useBrandContext()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'allgemein'
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <EmptyState
          icon={<Lock />}
          title="Nur für Admins"
          description="Einstellungen können nur Admins dieser Marke ändern."
        />
      </div>
    )
  }
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold tracking-[0.12em] text-brand-accent-text uppercase">
        Einstellungen
      </p>
      <h1 className="mt-1 mb-6 font-brand-heading text-3xl font-bold text-ink">{brand.name}</h1>
      <Tabs value={tab} onValueChange={(value) => setParams({ tab: value })} items={TABS} className="mb-6" />
      {tab === 'allgemein' && <GeneralTab key={brand.updated_at} />}
      {tab === 'erscheinungsbild' && <ThemeTab />}
      {tab === 'startseite' && <HomeTab />}
      {tab === 'teilen' && <ShareTab />}
      {tab === 'mitglieder' && <MembersTab />}
      {tab === 'daten' && <DataTab />}
      {tab === 'loeschen' && <DangerTab />}
    </div>
  )
}
