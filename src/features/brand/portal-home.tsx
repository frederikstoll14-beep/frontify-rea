import { ArrowRight, ArrowUpRight, BookOpen, Clock, FolderOpen, PencilLine, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { usePalettes } from '@/api/basics'
import { useBrandPages, useCreateGuideline, useGuidelines } from '@/api/guidelines'
import { LIBRARY_KINDS, useLibraries, useLibraryMutations, type LibraryKind } from '@/api/libraries'
import { StorageImage } from '@/components/media/storage-image'
import { RichText } from '@/components/rich-text-view'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/input'
import { Badge } from '@/components/ui/misc'
import { readableTextColor } from '@/lib/color'
import { ORG_TYPES, type OrgType } from '@/lib/templates/types'
import { cn, errorMessage, timeAgo } from '@/lib/utils'
import { resolveQuickLink } from '@/lib/links'
import { useBrandContext } from './brand-context'
import { BrandMark } from './brand-layout'
import { brandColors } from './brand-theme'

export function PortalHome() {
  const { brand, basePath, canEdit, canAdmin, isMember, editMode } = useBrandContext()
  const { data: guidelines = [] } = useGuidelines(brand.id)
  const { data: libraries = [] } = useLibraries(brand.id)
  const { data: palettes = [] } = usePalettes(brand.id)
  const { data: pages = [] } = useBrandPages(isMember ? brand.id : undefined)
  const createGuideline = useCreateGuideline(brand.id)
  const [newOpen, setNewOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [libraryName, setLibraryName] = useState('')
  const [libraryKind, setLibraryKind] = useState<LibraryKind>('media')
  const libraryMutations = useLibraryMutations(brand.id)
  const navigate = useNavigate()

  const colors = brandColors(brand)
  const heroStyle = brand.theme.heroStyle ?? 'brand'
  const heroBg = heroStyle === 'dark' ? '#15171F' : heroStyle === 'light' ? 'var(--surface)' : colors.primary
  const heroInk =
    heroStyle === 'light'
      ? 'var(--ink)'
      : heroStyle === 'dark'
        ? '#FFFFFF'
        : readableTextColor(colors.primary)
  const allColors = palettes.flatMap((p) => p.colors)
  const firstGuideline = guidelines[0]
  const recent = pages.filter((p) => p.kind === 'page').slice(0, 6)
  const guidelineSlugById = new Map(guidelines.map((g) => [g.id, g.slug]))

  return (
    <div className="pb-20">
      <section
        className="relative isolate overflow-hidden"
        style={{ backgroundColor: heroBg, color: heroInk }}
      >
        {brand.cover_path && (
          <>
            <StorageImage
              path={brand.cover_path}
              alt=""
              className="absolute inset-0 -z-10 h-full w-full"
              loading="eager"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/35 to-black/10" />
          </>
        )}
        <div
          className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 pt-14 pb-12 sm:px-6 sm:pt-20 sm:pb-16 lg:px-8"
          style={brand.cover_path ? { color: '#FFFFFF' } : undefined}
        >
          <div className="flex items-center gap-3">
            <BrandMark brand={brand} onColor className="size-14 rounded-2xl text-lg shadow-sm sm:size-16" />
            <Badge className="bg-white/15 text-current backdrop-blur">
              {ORG_TYPES[brand.org_type as OrgType] ?? brand.org_type}
            </Badge>
          </div>
          <div className="max-w-3xl">
            <h1 className="font-brand-heading text-4xl leading-[1.05] font-bold text-balance sm:text-6xl">
              {brand.name}
            </h1>
            {brand.tagline && (
              <p className="mt-4 text-lg text-pretty opacity-85 sm:text-xl">{brand.tagline}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {firstGuideline && (
              <Link
                to={`${basePath}/g/${firstGuideline.slug}`}
                className="inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold shadow-sm transition-opacity hover:opacity-90"
                style={{ backgroundColor: colors.accent, color: colors.accentInk }}
              >
                Zum Markenhandbuch <ArrowRight className="size-4" />
              </Link>
            )}
            {libraries[0] && (
              <Link
                to={`${basePath}/bibliothek/${libraries[0].slug}`}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-current/30 px-5 text-sm font-semibold backdrop-blur hover:bg-white/10"
              >
                <FolderOpen className="size-4" /> Downloads
              </Link>
            )}
          </div>
        </div>
        {(brand.home.showColors ?? true) && allColors.length > 0 && (
          <div className="flex h-3">
            {allColors.map((c) => (
              <span
                key={c.id}
                className="flex-1"
                style={{ backgroundColor: c.hex }}
                title={`${c.name} ${c.hex}`}
              />
            ))}
          </div>
        )}
      </section>

      <div className="mx-auto max-w-[1200px] space-y-14 px-4 pt-10 sm:px-6 lg:px-8">
        {(brand.home.welcome || editMode) && (
          <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div>
              {brand.home.welcome ? (
                <RichText
                  html={
                    brand.home.welcome.includes('<') ? brand.home.welcome : `<p>${brand.home.welcome}</p>`
                  }
                  className="text-lg"
                />
              ) : (
                <p className="text-muted">Noch kein Begrüßungstext.</p>
              )}
              {brand.description && <p className="mt-4 text-[15px] text-ink-2">{brand.description}</p>}
              {editMode && canAdmin && (
                <Button asChild size="sm" variant="outline" className="mt-4">
                  <Link to={`${basePath}/einstellungen?tab=startseite`}>
                    <PencilLine /> Startseite anpassen
                  </Link>
                </Button>
              )}
            </div>
            {(brand.home.quickLinks?.length ?? 0) > 0 && (
              <aside className="rounded-2xl border border-border bg-surface p-4">
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
                  Schnellzugriff
                </p>
                <ul className="space-y-1">
                  {brand.home.quickLinks!.map((link, i) => {
                    const target = resolveQuickLink(link.url, basePath)
                    if (!target) return null
                    const className =
                      'flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-ink hover:bg-surface-2'
                    return (
                      <li key={i}>
                        {target.external ? (
                          <a href={target.to} target="_blank" rel="noopener noreferrer" className={className}>
                            {link.label} <ArrowUpRight className="size-4 text-muted" />
                          </a>
                        ) : (
                          <Link to={target.to} className={className}>
                            {link.label} <ArrowRight className="size-4 text-muted" />
                          </Link>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </aside>
            )}
          </section>
        )}

        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-brand-heading text-2xl font-semibold text-ink">Markenhandbücher</h2>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setNewOpen(true)}>
                <Plus /> Neues Handbuch
              </Button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guidelines.map((g) => (
              <Link
                key={g.id}
                to={`${basePath}/g/${g.slug}`}
                className="group flex flex-col justify-between rounded-2xl border border-border bg-surface p-5 transition-shadow hover:shadow-card"
              >
                <div>
                  <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-brand text-brand-ink">
                    <BookOpen className="size-5" />
                  </span>
                  <h3 className="font-brand-heading text-xl font-semibold text-ink">{g.title}</h3>
                  {g.description && <p className="mt-1 text-sm text-muted">{g.description}</p>}
                </div>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink group-hover:gap-2.5">
                  Öffnen <ArrowRight className="size-4 transition-all" />
                  {!g.is_published && <Badge tone="warning">Entwurf</Badge>}
                </span>
              </Link>
            ))}
            {guidelines.length === 0 && <p className="text-sm text-muted">Noch kein Markenhandbuch.</p>}
          </div>
        </section>

        {(libraries.length > 0 || canEdit) && (
          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-brand-heading text-2xl font-semibold text-ink">Bibliotheken</h2>
              {canEdit && (
                <Button size="sm" variant="outline" onClick={() => setLibraryOpen(true)}>
                  <Plus /> Neue Bibliothek
                </Button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {libraries.map((l) => (
                <Link
                  key={l.id}
                  to={`${basePath}/bibliothek/${l.slug}`}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition-shadow hover:shadow-card"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink">
                    <FolderOpen className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{l.name}</span>
                    <span className="block truncate text-[13px] text-muted">
                      {l.asset_count} {l.asset_count === 1 ? 'Datei' : 'Dateien'} ·{' '}
                      {LIBRARY_KINDS[l.kind].label}
                    </span>
                  </span>
                  <ArrowRight className="size-4 text-muted" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {isMember && recent.length > 0 && (
          <section>
            <h2 className="mb-4 font-brand-heading text-2xl font-semibold text-ink">Zuletzt bearbeitet</h2>
            <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
              {recent.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`${basePath}/g/${guidelineSlugById.get(p.guideline_id) ?? ''}/${p.slug}`}
                    className={cn('flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2')}
                  >
                    <span className="truncate font-medium text-ink">{p.title}</span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                      <Clock className="size-3.5" /> {timeAgo(p.updated_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <Dialog
        open={newOpen}
        onOpenChange={setNewOpen}
        title="Neues Markenhandbuch"
        description="Z. B. ein eigenes Handbuch für Social Media, eine Sub-Marke oder ein Event."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>
              Abbrechen
            </Button>
            <Button
              loading={createGuideline.isPending}
              disabled={!newTitle.trim()}
              onClick={() =>
                createGuideline.mutate(
                  { title: newTitle.trim(), existing: guidelines },
                  {
                    onSuccess: () => {
                      setNewOpen(false)
                      setNewTitle('')
                      toast.success('Markenhandbuch angelegt')
                    },
                    onError: (e) => toast.error(errorMessage(e)),
                  },
                )
              }
            >
              Anlegen
            </Button>
          </>
        }
      >
        <Field label="Titel">
          <Input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="z. B. Social-Media-Guide"
          />
        </Field>
      </Dialog>
      <Dialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        title="Neue Bibliothek"
        description="Z. B. für Sponsorenlogos, Pressefotos, Trikot-Entwürfe oder Social-Media-Vorlagen."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setLibraryOpen(false)}>
              Abbrechen
            </Button>
            <Button
              disabled={!libraryName.trim()}
              loading={libraryMutations.createLibrary.isPending}
              onClick={() =>
                libraryMutations.createLibrary.mutate(
                  { name: libraryName.trim(), kind: libraryKind, existing: libraries },
                  {
                    onSuccess: (library) => {
                      setLibraryOpen(false)
                      setLibraryName('')
                      navigate(`${basePath}/bibliothek/${library.slug}`)
                    },
                    onError: (e) => toast.error(errorMessage(e)),
                  },
                )
              }
            >
              Anlegen
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Name">
            <Input
              autoFocus
              value={libraryName}
              onChange={(e) => setLibraryName(e.target.value)}
              maxLength={120}
            />
          </Field>
          <Field label="Art" hint="Bestimmt die erlaubten Dateitypen beim Upload">
            <Select value={libraryKind} onChange={(e) => setLibraryKind(e.target.value as LibraryKind)}>
              {(Object.keys(LIBRARY_KINDS) as LibraryKind[]).map((kind) => (
                <option key={kind} value={kind}>
                  {LIBRARY_KINDS[kind].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Dialog>
    </div>
  )
}
