import {
  Activity,
  BookOpen,
  Eye,
  FolderOpen,
  Home,
  Lock,
  Menu,
  Palette,
  PencilLine,
  Search,
  Settings,
  Share2,
  SwatchBook,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router'
import { useAuth } from '@/api/auth'
import { useBrand, type BrandWithAccess } from '@/api/brands'
import { useGuidelines } from '@/api/guidelines'
import { useLibraries } from '@/api/libraries'
import { UserMenu } from '@/components/layout/user-menu'
import { AppLogo } from '@/components/layout/app-logo'
import { StorageImage } from '@/components/media/storage-image'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/dialog'
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from '@/components/ui/menu'
import { Badge, EmptyState, Segmented, Tooltip } from '@/components/ui/misc'
import { PageSpinner } from '@/components/ui/spinner'
import { flushPendingSaves } from '@/lib/pending-saves'
import { cn, initials } from '@/lib/utils'
import { BrandProvider, useBrandContext } from './brand-context'
import { BrandTheme } from './brand-theme'
import { SearchDialog } from './search-dialog'

const ROLE_LABELS: Record<string, string> = { admin: 'Admin', editor: 'Bearbeiten', viewer: 'Ansehen' }

export function BrandMark({ brand, className }: { brand: BrandWithAccess | { name: string; logo_path: string | null }; className?: string }) {
  if (brand.logo_path) {
    return <StorageImage path={brand.logo_path} alt={brand.name} fit="contain" className={cn('size-9 rounded-lg', className)} loading="eager" />
  }
  return (
    <span className={cn('flex size-9 items-center justify-center rounded-lg bg-brand text-sm font-bold text-brand-ink', className)}>
      {initials(brand.name)}
    </span>
  )
}

function useEditModeState(brandId: string | undefined) {
  const key = `edit-mode:${brandId ?? ''}`
  const [editMode, setEditMode] = useState(false)
  useEffect(() => {
    try {
      setEditMode(sessionStorage.getItem(key) === '1')
    } catch {
      setEditMode(false)
    }
  }, [key])
  const set = async (value: boolean) => {
    if (!value) await flushPendingSaves()
    setEditMode(value)
    try {
      sessionStorage.setItem(key, value ? '1' : '0')
    } catch {
      // ignorieren
    }
  }
  return [editMode, set] as const
}

export function BrandLayout() {
  const { brandSlug } = useParams()
  const { data: brand, isLoading } = useBrand(brandSlug)
  const { user, loading: authLoading } = useAuth()
  const location = useLocation()
  const [editMode, setEditMode] = useEditModeState(brand?.id)

  useEffect(() => {
    if (brand) document.title = brand.name
  }, [brand])

  if (isLoading || authLoading) return <PageSpinner />
  if (!brand) {
    return (
      <div className="min-h-dvh bg-bg">
        <header className="border-b border-border px-4 py-3">
          <AppLogo />
        </header>
        <div className="mx-auto max-w-lg px-4 py-20">
          <EmptyState
            icon={<Lock />}
            title="Marke nicht gefunden"
            description={
              user
                ? 'Diese Marke gibt es nicht oder du hast (noch) keinen Zugriff. Bitte das Team um eine Einladung.'
                : 'Diese Marke ist nicht öffentlich. Melde dich an, wenn du eingeladen wurdest.'
            }
            action={
              user ? (
                <Button asChild variant="outline">
                  <Link to="/">Zu meinen Workspaces</Link>
                </Button>
              ) : (
                <Button asChild>
                  <Link to={`/login?weiter=${encodeURIComponent(location.pathname)}`}>Anmelden</Link>
                </Button>
              )
            }
          />
        </div>
      </div>
    )
  }

  return (
    <BrandProvider brand={brand} editMode={editMode} setEditMode={setEditMode}>
      <BrandTheme brand={brand} className="min-h-dvh bg-bg font-brand-body">
        <BrandHeader />
        <main id="inhalt">
          <Outlet />
        </main>
      </BrandTheme>
    </BrandProvider>
  )
}

function BrandHeader() {
  const { brand, basePath, canEdit, canAdmin, isMember, editMode, setEditMode } = useBrandContext()
  const { data: guidelines = [] } = useGuidelines(brand.id)
  const { data: libraries = [] } = useLibraries(brand.id)
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => setMenuOpen(false), [location.pathname])

  const navItem = 'flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors whitespace-nowrap'
  const navClass = ({ isActive }: { isActive: boolean }) =>
    cn(navItem, isActive ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')

  const libraryLinks = libraries.map((l) => ({ to: `${basePath}/bibliothek/${l.slug}`, label: l.name, count: l.asset_count }))

  const links = (
    <>
      <NavLink to={basePath} end className={navClass}>
        <Home className="size-4" /> Start
      </NavLink>
      {guidelines.map((g) => (
        <NavLink key={g.id} to={`${basePath}/g/${g.slug}`} className={navClass}>
          <BookOpen className="size-4" /> {g.title}
          {!g.is_published && <Badge tone="warning">Entwurf</Badge>}
        </NavLink>
      ))}
      <NavLink to={`${basePath}/basis`} className={navClass}>
        <SwatchBook className="size-4" /> Markenbasis
      </NavLink>
    </>
  )

  return (
    <>
      <header className="no-print sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 px-3 sm:gap-3 sm:px-4 lg:h-16 lg:px-6">
          <Button size="icon-sm" variant="ghost" className="lg:hidden" aria-label="Menü" onClick={() => setMenuOpen(true)}>
            <Menu />
          </Button>
          <Link to={basePath} className="flex min-w-0 items-center gap-2.5">
            <BrandMark brand={brand} className="size-8 lg:size-9" />
            <span className="truncate font-brand-heading text-base font-semibold text-ink lg:text-lg">{brand.name}</span>
          </Link>
          <nav className="ml-4 hidden min-w-0 items-center gap-1 overflow-x-auto lg:flex" aria-label="Hauptnavigation">
            {links}
            {libraryLinks.length > 0 && (
              <MenuRoot>
                <MenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      navItem,
                      location.pathname.includes('/bibliothek/') ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                    )}
                  >
                    <FolderOpen className="size-4" /> Bibliotheken
                  </button>
                </MenuTrigger>
                <MenuContent align="start">
                  {libraryLinks.map((l) => (
                    <MenuItem key={l.to} icon={<FolderOpen />} onSelect={() => navigate(l.to)}>
                      <span className="flex w-full justify-between gap-4">
                        {l.label} <span className="text-xs text-muted">{l.count}</span>
                      </span>
                    </MenuItem>
                  ))}
                </MenuContent>
              </MenuRoot>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
            <Tooltip content="Suchen (Strg/⌘ + K)">
              <Button size="icon-sm" variant="ghost" aria-label="Suchen" onClick={() => setSearchOpen(true)}>
                <Search />
              </Button>
            </Tooltip>
            {canEdit && (
              <Segmented
                size="sm"
                value={editMode ? 'edit' : 'view'}
                onChange={(v) => setEditMode(v === 'edit')}
                className="hidden sm:inline-flex"
                options={[
                  { value: 'view', label: <><Eye /> Ansehen</>, title: 'Ansicht wie für Leser:innen' },
                  { value: 'edit', label: <><PencilLine /> Bearbeiten</>, title: 'Inhalte bearbeiten' },
                ]}
              />
            )}
            {canEdit && (
              <Button
                size="icon-sm"
                variant={editMode ? 'primary' : 'ghost'}
                className="sm:hidden"
                aria-label={editMode ? 'Bearbeiten beenden' : 'Bearbeiten'}
                onClick={() => setEditMode(!editMode)}
              >
                <PencilLine />
              </Button>
            )}
            {canAdmin && (
              <Tooltip content="Teilen & Mitglieder">
                <Button asChild size="icon-sm" variant="ghost" aria-label="Teilen">
                  <Link to={`${basePath}/einstellungen?tab=teilen`}>
                    <Share2 />
                  </Link>
                </Button>
              </Tooltip>
            )}
            {isMember && (
              <MenuRoot>
                <MenuTrigger asChild>
                  <Button size="icon-sm" variant="ghost" aria-label="Weitere" className="hidden sm:inline-flex">
                    <Settings />
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  <MenuItem icon={<Activity />} onSelect={() => navigate(`${basePath}/aktivitaet`)}>
                    Aktivität & Feedback
                  </MenuItem>
                  {canAdmin && (
                    <MenuItem icon={<Settings />} onSelect={() => navigate(`${basePath}/einstellungen`)}>
                      Einstellungen
                    </MenuItem>
                  )}
                  {brand.workspace && (
                    <MenuItem icon={<Palette />} onSelect={() => navigate(`/w/${brand.workspace!.slug}`)}>
                      Workspace: {brand.workspace.name}
                    </MenuItem>
                  )}
                </MenuContent>
              </MenuRoot>
            )}
            <UserMenu />
          </div>
        </div>
        {editMode && (
          <div className="border-t border-accent/30 bg-accent-soft px-4 py-1.5 text-center text-xs font-medium text-accent">
            Bearbeitungsmodus – Änderungen werden automatisch gespeichert.{' '}
            <button type="button" className="underline underline-offset-2" onClick={() => setEditMode(false)}>
              Fertig
            </button>
          </div>
        )}
      </header>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen} title={brand.name} side="left" width="max-w-xs">
        <nav className="flex flex-col gap-1 p-3" aria-label="Hauptnavigation mobil">
          {links}
          {libraryLinks.length > 0 && (
            <>
              <p className="mt-3 px-3 text-[11px] font-semibold tracking-wide text-muted uppercase">Bibliotheken</p>
              {libraryLinks.map((l) => (
                <NavLink key={l.to} to={l.to} className={navClass}>
                  <FolderOpen className="size-4" /> {l.label}
                  <span className="ml-auto text-xs text-muted">{l.count}</span>
                </NavLink>
              ))}
            </>
          )}
          {isMember && (
            <>
              <p className="mt-3 px-3 text-[11px] font-semibold tracking-wide text-muted uppercase">Team</p>
              <NavLink to={`${basePath}/aktivitaet`} className={navClass}>
                <Activity className="size-4" /> Aktivität & Feedback
              </NavLink>
              {canAdmin && (
                <NavLink to={`${basePath}/einstellungen`} className={navClass}>
                  <Settings className="size-4" /> Einstellungen
                </NavLink>
              )}
            </>
          )}
          {brand.role && (
            <p className="mt-4 px-3 text-xs text-muted">
              Deine Rolle: <span className="font-medium text-ink-2">{ROLE_LABELS[brand.role]}</span>
            </p>
          )}
        </nav>
      </Sheet>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )
}
