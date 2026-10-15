import { BookOpen, ChevronDown, ListTree, Printer } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, Outlet, useNavigate, useOutletContext, useParams } from 'react-router'
import {
  buildNav,
  flattenNav,
  useGuidelines,
  usePages,
  type Guideline,
  type GuidelinePage,
} from '@/api/guidelines'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/dialog'
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from '@/components/ui/menu'
import { EmptyState, PageSpinnerFallback } from './fallbacks'
import { useBrandContext } from '@/features/brand/brand-context'
import { GuidelineNav } from './guideline-nav'
import { GuidelineMenu } from './guideline-settings'

export interface GuidelineOutletContext {
  guideline: Guideline
  pages: GuidelinePage[]
}

export function useGuidelineOutlet(): GuidelineOutletContext {
  return useOutletContext<GuidelineOutletContext>()
}

export function GuidelineLayout() {
  const { guidelineSlug } = useParams()
  const { brand, basePath, canEdit, editMode } = useBrandContext()
  const { data: guidelines = [], isLoading } = useGuidelines(brand.id)
  const guideline = guidelines.find((g) => g.slug === guidelineSlug)
  const { data: pages = [], isLoading: loadingPages } = usePages(guideline?.id)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()

  if (isLoading || (guideline && loadingPages)) return <PageSpinnerFallback />
  if (!guideline) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          icon={<BookOpen />}
          title="Markenhandbuch nicht gefunden"
          description="Vielleicht wurde es umbenannt oder ist (noch) nicht veröffentlicht."
          action={
            <Button asChild variant="outline">
              <Link to={basePath}>Zur Startseite</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const switcher =
    guidelines.length > 1 ? (
      <MenuRoot>
        <MenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-surface/70"
          >
            <span className="min-w-0">
              <span className="block text-[11px] font-medium text-muted">Markenhandbuch</span>
              <span className="block truncate font-semibold text-ink">{guideline.title}</span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted" />
          </button>
        </MenuTrigger>
        <MenuContent align="start">
          {guidelines.map((g) => (
            <MenuItem key={g.id} icon={<BookOpen />} onSelect={() => navigate(`${basePath}/g/${g.slug}`)}>
              {g.title} {!g.is_published && '(Entwurf)'}
            </MenuItem>
          ))}
        </MenuContent>
      </MenuRoot>
    ) : (
      <div className="px-2.5 py-2">
        <span className="block text-[11px] font-medium text-muted">Markenhandbuch</span>
        <span className="block truncate font-semibold text-ink">{guideline.title}</span>
      </div>
    )

  const sidebar = (onNavigate?: () => void) => (
    <div className="space-y-4">
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">{switcher}</div>
        {editMode && <GuidelineMenu guideline={guideline} />}
      </div>
      {!guideline.is_published && (
        <p className="rounded-lg bg-warning-soft px-2.5 py-1.5 text-xs text-warning">
          Entwurf – nur für Bearbeitende sichtbar
        </p>
      )}
      <GuidelineNav guideline={guideline} pages={pages} onNavigate={onNavigate} />
      <div className="border-t border-border pt-3">
        <Button asChild size="sm" variant="ghost" className="w-full justify-start">
          <Link to={`${basePath}/drucken/${guideline.slug}`} target="_blank">
            <Printer /> Als PDF drucken
          </Link>
        </Button>
      </div>
    </div>
  )

  return (
    <div className="mx-auto flex w-full max-w-[1440px] gap-0 lg:gap-6 lg:px-6">
      <aside className="no-print sticky top-16 hidden h-[calc(100dvh-4rem)] w-64 shrink-0 overflow-y-auto py-6 pr-1 lg:block">
        {sidebar()}
      </aside>
      <div className="min-w-0 flex-1">
        <div className="no-print sticky top-14 z-20 flex items-center gap-2 border-b border-border bg-bg/95 px-4 py-2 backdrop-blur lg:hidden">
          <Button size="sm" variant="outline" onClick={() => setDrawerOpen(true)}>
            <ListTree /> Inhalt
          </Button>
          <span className="truncate text-sm font-medium text-ink-2">{guideline.title}</span>
        </div>
        {pages.length === 0 && !canEdit ? (
          <div className="px-4 py-16">
            <EmptyState title="Noch keine Inhalte" description="Dieses Markenhandbuch ist noch leer." />
          </div>
        ) : (
          <Outlet context={{ guideline, pages } satisfies GuidelineOutletContext} />
        )}
      </div>
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen} title="Inhalt" side="left" width="max-w-xs">
        <div className="p-3">{sidebar(() => setDrawerOpen(false))}</div>
      </Sheet>
    </div>
  )
}

export function GuidelineIndex() {
  const { guideline, pages } = useGuidelineOutlet()
  const { basePath, canEdit } = useBrandContext()
  const first = flattenNav(buildNav(pages))[0]
  if (first) return <Navigate to={`${basePath}/g/${guideline.slug}/${first.slug}`} replace />
  return (
    <div className="px-4 py-16">
      <EmptyState
        icon={<BookOpen />}
        title="Noch keine Seiten"
        description={
          canEdit
            ? 'Schalte oben auf „Bearbeiten“ und lege links die erste Seite an.'
            : 'Hier entsteht bald etwas.'
        }
      />
    </div>
  )
}
