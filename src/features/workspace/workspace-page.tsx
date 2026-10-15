import { LogOut, Plus, Settings, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useBrands } from '@/api/brands'
import {
  useDeleteWorkspace,
  useLeaveWorkspace,
  useRemoveWorkspaceMember,
  useSetWorkspaceRole,
  useUpdateWorkspace,
  useWorkspace,
  useWorkspaceMembers,
  type WorkspaceRole,
} from '@/api/workspaces'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { Field, Input, Textarea } from '@/components/ui/input'
import { Card, EmptyState, Tabs } from '@/components/ui/misc'
import { PageSpinner } from '@/components/ui/spinner'
import { errorMessage } from '@/lib/utils'
import { MembersPanel, WORKSPACE_ROLES } from '@/features/members/members-panel'
import { BrandCard } from './brand-card'
import { CreateBrandDialog } from './create-brand-dialog'

export function WorkspacePage() {
  const { workspaceSlug } = useParams()
  const { data: workspace, isLoading } = useWorkspace(workspaceSlug)
  const { data: brands = [], isLoading: loadingBrands } = useBrands(workspace?.id, Boolean(workspace))
  const { data: members = [] } = useWorkspaceMembers(workspace?.id)
  const setRole = useSetWorkspaceRole(workspace?.id ?? '')
  const removeMember = useRemoveWorkspaceMember(workspace?.id ?? '')
  const update = useUpdateWorkspace()
  const remove = useDeleteWorkspace()
  const leave = useLeaveWorkspace()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'marken'
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (workspace) {
      setName(workspace.name)
      setDescription(workspace.description)
      document.title = workspace.name
    }
  }, [workspace])

  if (isLoading) return <PageSpinner />
  if (!workspace || !workspace.role) {
    return (
      <AppShell>
        <EmptyState
          title="Workspace nicht gefunden"
          description="Es gibt ihn nicht oder du bist kein Mitglied."
          action={
            <Button asChild variant="outline">
              <Link to="/">Zur Übersicht</Link>
            </Button>
          }
        />
      </AppShell>
    )
  }

  const isAdmin = workspace.role === 'owner' || workspace.role === 'admin'

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/" className="text-sm text-muted hover:text-ink">
            Workspaces
          </Link>
          <h1 className="mt-1 font-display text-3xl font-semibold text-ink sm:text-4xl">{workspace.name}</h1>
          {workspace.description && <p className="mt-1 text-ink-2">{workspace.description}</p>}
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus /> Neue Marke
        </Button>
      </div>
      <Tabs
        value={tab}
        onValueChange={(value) => setParams({ tab: value })}
        className="mb-6"
        items={[
          { value: 'marken', label: `Marken (${brands.length})` },
          { value: 'mitglieder', label: `Mitglieder (${members.length})` },
          { value: 'einstellungen', label: 'Einstellungen' },
        ]}
      />

      {tab === 'marken' &&
        (loadingBrands ? (
          <PageSpinner />
        ) : brands.length === 0 ? (
          <EmptyState
            title="Noch keine Marken"
            description="Lege die erste Marke an – mit einer Vorlage für Verein, Unternehmen oder Verband."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus /> Marke anlegen
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {brands.map((b) => (
              <BrandCard key={b.id} brand={b} />
            ))}
          </div>
        ))}

      {tab === 'mitglieder' && (
        <div className="max-w-3xl">
          <p className="mb-5 text-sm text-ink-2">
            Workspace-Mitglieder können eigene Marken anlegen und alle Marken mit Sichtbarkeit „Workspace“ ansehen und kommentieren.
            Admins (z. B. Dozierende) haben auf alle Marken Admin-Rechte.
          </p>
          <MembersPanel
            workspaceId={workspace.id}
            members={members}
            roles={workspace.role === 'owner' ? WORKSPACE_ROLES : WORKSPACE_ROLES.filter((r) => r.value !== 'owner')}
            canManage={isAdmin}
            scopeLabel={workspace.name}
            onRoleChange={(userId, role) =>
              setRole.mutate({ userId, role: role as WorkspaceRole }, { onError: (e) => toast.error(errorMessage(e)) })
            }
            onRemove={(userId) => removeMember.mutate(userId, { onError: (e) => toast.error(errorMessage(e)) })}
          />
        </div>
      )}

      {tab === 'einstellungen' && (
        <div className="max-w-2xl space-y-6">
          {isAdmin && (
            <Card className="space-y-4 p-5">
              <h2 className="flex items-center gap-2 font-semibold text-ink">
                <Settings className="size-4" /> Allgemein
              </h2>
              <Field label="Name">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Beschreibung">
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </Field>
              <Button
                loading={update.isPending}
                onClick={() =>
                  update.mutate(
                    { id: workspace.id, name: name.trim() || workspace.name, description },
                    { onSuccess: () => toast.success('Gespeichert'), onError: (e) => toast.error(errorMessage(e)) },
                  )
                }
              >
                Speichern
              </Button>
            </Card>
          )}
          {workspace.role !== 'owner' && (
            <Card className="p-5">
              <h2 className="font-semibold text-ink">Workspace verlassen</h2>
              <p className="mt-1 mb-4 text-sm text-muted">Du verlierst den Zugriff auf alle Marken in diesem Workspace.</p>
              <Button
                variant="outline"
                onClick={async () => {
                  const ok = await confirm({ title: 'Workspace verlassen?', confirmLabel: 'Verlassen', danger: true })
                  if (ok) leave.mutate(workspace.id, { onSuccess: () => navigate('/') })
                }}
              >
                <LogOut /> Verlassen
              </Button>
            </Card>
          )}
          {workspace.role === 'owner' && (
            <Card className="border-danger/40 p-5">
              <h2 className="font-semibold text-danger">Workspace löschen</h2>
              <p className="mt-1 mb-4 text-sm text-muted">
                Löscht alle {brands.length} Marken mit allen Inhalten. Bitte vorher die Marken exportieren.
              </p>
              <Button
                variant="danger"
                onClick={async () => {
                  const ok = await confirm({
                    title: `„${workspace.name}“ endgültig löschen?`,
                    description: 'Alle Marken, Dateien und Mitgliedschaften gehen verloren.',
                    confirmLabel: 'Endgültig löschen',
                    danger: true,
                  })
                  if (!ok) return
                  remove.mutate({ id: workspace.id, brandIds: brands.map((b) => b.id) }, {
                    onSuccess: () => navigate('/'),
                    onError: (e) => toast.error(errorMessage(e)),
                  })
                }}
              >
                <Trash2 /> Workspace löschen
              </Button>
            </Card>
          )}
        </div>
      )}
      <CreateBrandDialog workspaceId={workspace.id} open={createOpen} onOpenChange={setCreateOpen} />
    </AppShell>
  )
}
