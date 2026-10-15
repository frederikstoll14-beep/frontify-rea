import { ArrowRight, GraduationCap, Plus, Sparkles, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { displayName, useAuth } from '@/api/auth'
import { useBrands } from '@/api/brands'
import { useCreateWorkspace, useWorkspaces } from '@/api/workspaces'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Textarea } from '@/components/ui/input'
import { Badge, Card, SectionTitle } from '@/components/ui/misc'
import { PageSpinner } from '@/components/ui/spinner'
import { errorMessage } from '@/lib/utils'
import { WORKSPACE_ROLES } from '@/features/members/members-panel'
import { BrandCard } from './brand-card'

function firstName(name: string): string {
  const parts = name.split(/\s+/).filter((part) => part && !part.endsWith('.'))
  return parts[0] ?? name
}

export function CreateWorkspaceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const create = useCreateWorkspace()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const submit = () =>
    create.mutate(
      { name: name.trim(), description },
      {
        onSuccess: (ws) => {
          onOpenChange(false)
          setName('')
          setDescription('')
          navigate(`/w/${ws.slug}`)
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    )
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Neuer Workspace"
      description="Ein Workspace bündelt mehrere Marken und ihre Mitglieder – z. B. einen Kurs, eine Agentur oder einen Verein mit Abteilungen."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={!name.trim()} loading={create.isPending}>
            Anlegen
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) submit()
        }}
      >
        <Field label="Name">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Brand Identity · WS 2026/27" maxLength={120} />
        </Field>
        <Field label="Beschreibung (optional)">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </Field>
      </form>
    </Dialog>
  )
}

export function DashboardPage() {
  const { user, profile } = useAuth()
  const { data: workspaces = [], isLoading } = useWorkspaces(user?.id)
  const { data: brands = [] } = useBrands(undefined, Boolean(user))
  const [createOpen, setCreateOpen] = useState(false)

  const workspaceIds = new Set(workspaces.map((w) => w.id))
  const sharedBrands = brands.filter((b) => !workspaceIds.has(b.workspace_id))
  const recentBrands = brands.filter((b) => workspaceIds.has(b.workspace_id)).slice(0, 6)

  return (
    <AppShell
      actions={
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus /> Workspace
        </Button>
      }
    >
      <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
        Hallo{profile ? `, ${firstName(displayName(profile))}` : ''}!
      </h1>
      <p className="mt-2 text-ink-2">Deine Workspaces und Marken auf einen Blick.</p>

      {isLoading ? (
        <PageSpinner />
      ) : workspaces.length === 0 && sharedBrands.length === 0 ? (
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Card className="p-6">
            <GraduationCap className="mb-4 size-8 text-accent" />
            <h2 className="text-lg font-semibold text-ink">Workspace anlegen</h2>
            <p className="mt-1 mb-5 text-sm text-muted">
              Für Dozierende oder Teams: Lege einen Workspace an, z. B. für deinen Kurs. Darin entstehen die Marken.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus /> Workspace anlegen
            </Button>
          </Card>
          <Card className="p-6">
            <Users className="mb-4 size-8 text-accent" />
            <h2 className="text-lg font-semibold text-ink">Einladung erhalten?</h2>
            <p className="mt-1 text-sm text-muted">
              Öffne einfach den Einladungslink, den du bekommen hast. Danach erscheint der Workspace hier.
            </p>
          </Card>
        </div>
      ) : (
        <div className="mt-10 space-y-12">
          <section>
            <SectionTitle title="Workspaces" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {workspaces.map((ws) => (
                <Link
                  key={ws.id}
                  to={`/w/${ws.slug}`}
                  className="group flex flex-col justify-between rounded-2xl border border-border bg-surface p-5 transition-shadow hover:shadow-card"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-ink">{ws.name}</h3>
                      <Badge>{WORKSPACE_ROLES.find((r) => r.value === ws.role)?.label}</Badge>
                    </div>
                    {ws.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{ws.description}</p>}
                  </div>
                  <span className="mt-4 flex items-center justify-between text-sm text-muted">
                    {ws.brand_count} {ws.brand_count === 1 ? 'Marke' : 'Marken'}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </div>
          </section>
          {recentBrands.length > 0 && (
            <section>
              <SectionTitle title="Zuletzt aktualisierte Marken" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recentBrands.map((b) => (
                  <BrandCard key={b.id} brand={b} />
                ))}
              </div>
            </section>
          )}
          {sharedBrands.length > 0 && (
            <section>
              <SectionTitle title="Mit dir geteilt" description="Marken, zu denen du direkt eingeladen wurdest." />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sharedBrands.map((b) => (
                  <BrandCard key={b.id} brand={b} />
                ))}
              </div>
            </section>
          )}
          <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
            <Sparkles className="size-6 shrink-0 text-accent" />
            <p className="flex-1 text-sm text-ink-2">
              Neu hier? Lege in einem Workspace die Vorlage <strong>„Beispiel: SV Rheinblick 1921“</strong> an und sieh dir an, wie ein fertiges
              Markenportal aussieht.
            </p>
          </Card>
        </div>
      )}
      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </AppShell>
  )
}
