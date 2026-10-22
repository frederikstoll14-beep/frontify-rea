import { Bot, Plug, Unplug } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/api/auth'
import {
  useConnectedApps,
  useDisconnectApp,
  useMcpGrants,
  useSaveMcpGrant,
  useSelectableScope,
  type ConnectedApp,
  type McpGrant,
} from '@/api/connections'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge, Card, Switch } from '@/components/ui/misc'
import { PageSpinner } from '@/components/ui/spinner'
import {
  EMPTY_SELECTION,
  countAccessibleBrands,
  describeSelection,
  isEmptySelection,
  normalizeSelection,
  type ScopeSelection,
} from '@/lib/connections'
import { errorMessage, timeAgo } from '@/lib/utils'
import { ScopePicker, allScopeBrands } from './scope-picker'

function mcpUrl(): string {
  return `${window.location.origin}/mcp`
}

/** Konto → Verbundene Apps: Auswahl ändern, Verbindung trennen, Adresse zum Verbinden kopieren. */
export function ConnectedAppsCard() {
  const { user } = useAuth()
  const grants = useMcpGrants(user?.id)
  const apps = useConnectedApps(user?.id)
  const [editing, setEditing] = useState<{ clientId: string; name: string } | null>(null)
  const disconnect = useDisconnectApp()
  const confirm = useConfirm()

  const rows = useMemo(() => {
    const byClient = new Map<string, { app: ConnectedApp | null; grant: McpGrant | null }>()
    for (const app of apps.data ?? []) byClient.set(app.clientId, { app, grant: null })
    for (const grant of grants.data ?? []) {
      const existing = byClient.get(grant.client_id)
      byClient.set(grant.client_id, { app: existing?.app ?? null, grant })
    }
    return [...byClient.entries()].map(([clientId, value]) => ({ clientId, ...value }))
  }, [apps.data, grants.data])

  const loading = grants.isLoading || apps.isLoading
  // Ist der OAuth-Server nicht eingeschaltet, liefert listGrants einen Fehler – dann blenden wir nur die Liste aus.
  const unavailable = Boolean(apps.error) && (grants.data ?? []).length === 0

  return (
    <section aria-labelledby="connected-apps-title">
      <Card className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Plug className="size-5" aria-hidden />
          </span>
          <div>
            <h2 id="connected-apps-title" className="font-semibold text-ink">
              Verbundene Apps
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              KI-Assistenten wie Claude können mit deinen Marken arbeiten. Du bestimmst, welche Workspaces und
              Marken sie sehen.
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-surface-2/60 p-3 text-sm">
          <p className="font-medium text-ink">Neue App verbinden</p>
          <p className="mt-1 text-muted">
            In Claude unter <em>Einstellungen → Konnektoren → Benutzerdefinierten Konnektor hinzufügen</em>{' '}
            diese Adresse eintragen:
          </p>
          <div className="mt-2 flex gap-2">
            <Input
              readOnly
              value={mcpUrl()}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="MCP-Adresse"
            />
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(mcpUrl()).then(
                  () => toast.success('Adresse kopiert'),
                  () => toast.error('Kopieren nicht möglich – bitte von Hand markieren'),
                )
              }}
            >
              Kopieren
            </Button>
          </div>
        </div>

        {loading && <PageSpinner label="Lädt …" />}
        {!loading && unavailable && (
          <p className="text-sm text-muted">
            Die Verbindung für Apps ist in diesem Projekt noch nicht eingeschaltet. Eine Anleitung steht in
            docs/MCP.md.
          </p>
        )}
        {!loading && !unavailable && rows.length === 0 && (
          <p className="text-sm text-muted">Noch keine App verbunden.</p>
        )}

        <ul className="space-y-3">
          {rows.map(({ clientId, app, grant }) => {
            const name = app?.name || grant?.client_name || 'Unbenannte App'
            return (
              <li key={clientId} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium text-ink">
                      <Bot className="size-4 text-muted" aria-hidden /> {name}
                      {grant?.read_only && <Badge tone="info">Nur lesen</Badge>}
                      {!grant && <Badge tone="warning">Keine Auswahl</Badge>}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {grant
                        ? `${grant.workspace_ids.length} Workspace${grant.workspace_ids.length === 1 ? '' : 's'}, ${grant.brand_ids.length} einzelne Marke${grant.brand_ids.length === 1 ? '' : 'n'}`
                        : 'Die App sieht nichts, bis du eine Auswahl triffst.'}
                      {grant?.last_used_at
                        ? ` · zuletzt genutzt ${timeAgo(grant.last_used_at)}`
                        : app?.grantedAt
                          ? ` · verbunden ${timeAgo(app.grantedAt)}`
                          : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing({ clientId, name })}>
                      Auswahl ändern
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-danger"
                      loading={disconnect.isPending && disconnect.variables === clientId}
                      onClick={async () => {
                        const ok = await confirm({
                          title: `„${name}“ trennen?`,
                          description:
                            'Die App verliert sofort den Zugriff auf alle Workspaces und Marken. Du kannst sie später neu verbinden.',
                          confirmLabel: 'Trennen',
                          danger: true,
                        })
                        if (!ok) return
                        disconnect.mutate(clientId, {
                          onSuccess: () => toast.success('Verbindung getrennt'),
                          onError: (e) => toast.error(errorMessage(e)),
                        })
                      }}
                    >
                      <Unplug /> Trennen
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        {editing && (
          <EditSelectionDialog
            clientId={editing.clientId}
            name={editing.name}
            grant={(grants.data ?? []).find((g) => g.client_id === editing.clientId) ?? null}
            onClose={() => setEditing(null)}
          />
        )}
      </Card>
    </section>
  )
}

function EditSelectionDialog({
  clientId,
  name,
  grant,
  onClose,
}: {
  clientId: string
  name: string
  grant: McpGrant | null
  onClose: () => void
}) {
  const { user } = useAuth()
  const scope = useSelectableScope(user?.id)
  const save = useSaveMcpGrant()
  const [selection, setSelection] = useState<ScopeSelection>(
    grant ? { workspaceIds: grant.workspace_ids, brandIds: grant.brand_ids } : EMPTY_SELECTION,
  )
  const [readOnly, setReadOnly] = useState(grant?.read_only ?? false)
  const brands = useMemo(() => (scope.data ? allScopeBrands(scope.data) : []), [scope.data])

  useEffect(() => {
    if (brands.length > 0) setSelection((current) => normalizeSelection(current, brands))
  }, [brands])

  const count = countAccessibleBrands(selection, brands)

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      title={`Zugriff für „${name}“`}
      description="Die App sieht und ändert nur, was hier ausgewählt ist."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            loading={save.isPending}
            disabled={isEmptySelection(selection)}
            onClick={() =>
              save.mutate(
                { clientId, clientName: name, selection, readOnly },
                {
                  onSuccess: () => {
                    toast.success('Auswahl gespeichert')
                    onClose()
                  },
                  onError: (e) => toast.error(errorMessage(e)),
                },
              )
            }
          >
            Speichern
          </Button>
        </>
      }
    >
      {scope.isLoading && <PageSpinner label="Lädt …" />}
      {scope.data && <ScopePicker scope={scope.data} value={selection} onChange={setSelection} />}
      <div className="mt-4">
        <Switch
          checked={readOnly}
          onCheckedChange={setReadOnly}
          label="Nur lesen"
          description="Ansehen und herunterladen ja, anlegen, ändern oder löschen nein."
        />
      </div>
      <p className="mt-3 text-sm text-muted">
        {describeSelection(selection, { workspaces: selection.workspaceIds.length, brands: count })}
      </p>
    </Dialog>
  )
}
