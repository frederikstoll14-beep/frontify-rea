import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Images,
  LayoutGrid,
  LayoutTemplate,
  Palette,
  Rocket,
  Share2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Dialog as D } from 'radix-ui'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { useAuth } from '@/api/auth'
import { markTourSeen, readLocalTourVersion } from '@/api/onboarding'
import { LogoMark } from '@/components/layout/app-logo'
import { Button } from '@/components/ui/button'
import { APP_NAME } from '@/lib/app'
import { hasSeenTour, isTourRoute } from '@/lib/onboarding'
import { cn } from '@/lib/utils'

interface TourStep {
  title: string
  text: string
  icon?: LucideIcon
  chips: string[]
}

const STEPS: TourStep[] = [
  {
    title: `Willkommen bei ${APP_NAME}`,
    text: `${APP_NAME} ist die Werkbank für deine Marke. Hier legst du eine komplette Markenidentität an einem Ort ab und teilst sie mit allen, die mit ihr arbeiten. Die Tour dauert etwa eine Minute.`,
    chips: ['Markenhandbuch', 'Farben & Schriften', 'Logos & Dateien', 'Teilen'],
  },
  {
    title: 'Workspaces',
    text: 'Ein Workspace ist euer gemeinsamer Arbeitsbereich, zum Beispiel für ein Team, eine Agentur, einen Verein oder ein Projekt. Darin liegen beliebig viele Marken.',
    icon: LayoutGrid,
    chips: ['Owner', 'Admin', 'Mitglied'],
  },
  {
    title: 'Marken & Vorlagen',
    text: 'Jede Marke bekommt ein eigenes Portal mit Startseite, Markenhandbuch und Bibliotheken. Starte leer oder mit einer Vorlage, dann sind die wichtigsten Kapitel schon vorbereitet.',
    icon: LayoutTemplate,
    chips: ['Unternehmen', 'Verein', 'Verband', 'Organisation', 'Leer'],
  },
  {
    title: 'Markenhandbuch',
    text: 'Gestaltungsregeln ordnest du in Kapiteln und Seiten. Mit „Bearbeiten“ fügst du über „+“ Bausteine hinzu und ziehst sie in die richtige Reihenfolge.',
    icon: BookOpen,
    chips: ['Text', 'Farben', 'Logos', 'Do & Don’t', 'Bilder', 'Video', 'Downloads'],
  },
  {
    title: 'Markenbasis',
    text: 'Farben und Schriften pflegst du einmal zentral, alle Seiten greifen darauf zu. Farbwerte gibt es in HEX, RGB, CMYK und Pantone, als Design-Tokens lassen sie sich direkt exportieren.',
    icon: Palette,
    chips: ['CSS', 'SCSS', 'JSON', 'Tailwind', 'Adobe .ase'],
  },
  {
    title: 'Bibliotheken',
    text: 'Logos, Bilder, Vorlagen und Dokumente liegen in Bibliotheken. Mit Tags und Suche findest du alles schnell wieder, Downloads gehen mit einem Klick.',
    icon: Images,
    chips: ['Logos', 'Bilder', 'Vorlagen', 'Dokumente'],
  },
  {
    title: 'Zusammenarbeiten & teilen',
    text: 'Lade Personen per E-Mail oder Einladungslink ein und vergib Rollen. Kommentare, Versionsverlauf und Aktivität zeigen, wer was geändert hat. Nach außen teilst du die Marke per öffentlichem Link, auf Wunsch mit Ablaufdatum, oder als PDF.',
    icon: Share2,
    chips: ['Admin', 'Bearbeiten', 'Ansehen', 'Öffentlicher Link', 'PDF'],
  },
  {
    title: 'Los geht’s',
    text: 'Lege einen Workspace und deine erste Marke an. Im Markenportal öffnet Strg + K (Mac: ⌘ + K) die Suche. Diese Tour findest du jederzeit im Konto-Menü unter „Produkttour“.',
    icon: Rocket,
    chips: [],
  },
]

const TourContext = createContext<{ openTour: () => void }>({ openTour: () => {} })

export function useProductTour() {
  return useContext(TourContext)
}

/** Öffnet die Tour beim ersten Login automatisch und stellt `openTour` für Menü und Konto bereit. */
export function TourProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const autoOpened = useRef<string | null>(null)

  useEffect(() => {
    if (loading || !user || autoOpened.current === user.id || !isTourRoute(pathname)) return
    if (hasSeenTour(user.user_metadata, readLocalTourVersion(user.id))) return
    autoOpened.current = user.id
    setOpen(true)
  }, [loading, user, pathname])

  const close = useCallback(() => {
    setOpen(false)
    if (user) void markTourSeen(user.id)
  }, [user])

  // Erst nach dem Schließen eines Menüs öffnen, sonst bleibt dessen Fokus-Sperre aktiv.
  const openTour = useCallback(() => window.setTimeout(() => setOpen(true), 0), [])

  return (
    <TourContext.Provider value={{ openTour }}>
      {children}
      {open && <TourDialog onClose={close} />}
    </TourContext.Provider>
  )
}

function TourDialog({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0)
  const step = STEPS[index]
  const last = index === STEPS.length - 1
  const Icon = step.icon

  const go = (delta: number) => setIndex((i) => Math.min(STEPS.length - 1, Math.max(0, i + delta)))

  return (
    <D.Root open onOpenChange={(next) => !next && onClose()}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-overlay" />
        <D.Content
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') go(1)
            if (e.key === 'ArrowLeft') go(-1)
          }}
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl bg-surface shadow-card outline-none',
            'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
          )}
        >
          <div className="relative flex h-40 shrink-0 items-center justify-center bg-surface-2">
            {Icon ? (
              <span className="flex size-20 items-center justify-center rounded-2xl bg-ink text-bg shadow-card">
                <Icon className="size-10" strokeWidth={1.75} />
              </span>
            ) : (
              <LogoMark className="size-20 shadow-card" />
            )}
            <D.Close
              className="absolute top-3 right-3 rounded-md p-1.5 text-muted hover:bg-surface hover:text-ink"
              aria-label="Tour schließen"
            >
              <X className="size-5" />
            </D.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-2">
            <p className="text-xs font-semibold tracking-wide text-accent uppercase">
              Produkttour · Schritt {index + 1} von {STEPS.length}
            </p>
            <D.Title className="mt-1.5 font-display text-2xl font-semibold text-ink">{step.title}</D.Title>
            <D.Description className="mt-2 text-[15px] leading-relaxed text-ink-2">{step.text}</D.Description>
            {step.chips.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Stichworte">
                {step.chips.map((chip) => (
                  <li
                    key={chip}
                    className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-2"
                  >
                    {chip}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center gap-2 px-6 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="mr-auto flex gap-1.5" aria-hidden>
              {STEPS.map((s, i) => (
                <span
                  key={s.title}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i === index ? 'w-5 bg-accent' : 'w-1.5 bg-border-strong',
                  )}
                />
              ))}
            </div>
            {index === 0 ? (
              <Button variant="ghost" size="sm" onClick={onClose}>
                Überspringen
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => go(-1)}>
                <ChevronLeft /> Zurück
              </Button>
            )}
            {last ? (
              <Button size="sm" onClick={onClose}>
                Los geht’s
              </Button>
            ) : (
              <Button size="sm" onClick={() => go(1)}>
                Weiter <ChevronRight />
              </Button>
            )}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
