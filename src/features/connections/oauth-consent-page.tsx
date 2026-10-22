import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Bot, CheckCircle2, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useAuth } from '@/api/auth'
import { useSaveMcpGrant, useSelectableScope } from '@/api/connections'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Badge, Card, EmptyState, Switch } from '@/components/ui/misc'
import { PageSpinner } from '@/components/ui/spinner'
import {
  EMPTY_SELECTION,
  assessRedirectUri,
  countAccessibleBrands,
  describeSelection,
  isEmptySelection,
  normalizeSelection,
  type ScopeSelection,
} from '@/lib/connections'
import { APP_NAME } from '@/lib/app'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/utils'
import { ScopePicker, allScopeBrands } from './scope-picker'

type Details = {
  authorization_id: string
  redirect_uri: string
  client: { id: string; name: string; uri?: string; logo_uri?: string }
  scope: string
}

type Loaded = { kind: 'consent'; details: Details } | { kind: 'redirect'; url: string }

/**
 * Zustimmungsseite des OAuth-Servers (Supabase leitet hierher, siehe docs/MCP.md).
 * Hier wählt die Person, auf welche Workspaces und Marken die App zugreifen darf.
 */
export function OAuthConsentPage() {
  const [params] = useSearchParams()
  const authorizationId = params.get('authorization_id')
  const { user } = useAuth()

  const request = useQuery({
    queryKey: ['oauth-authorization', authorizationId],
    enabled: Boolean(authorizationId),
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    queryFn: async (): Promise<Loaded> => {
      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId!)
      if (error) throw error
      if (!data) throw new Error('Anfrage nicht gefunden')
      if ('authorization_id' in data) return { kind: 'consent', details: data as Details }
      return { kind: 'redirect', url: data.redirect_url }
    },
  })

  // Wurde die App schon früher zugelassen, geht es direkt zurück (die Auswahl bleibt bestehen).
  useEffect(() => {
    if (request.data?.kind === 'redirect') window.location.replace(request.data.url)
  }, [request.data])

  if (!authorizationId) {
    return (
      <Shell>
        <EmptyState
          icon={<AlertTriangle />}
          title="Anfrage unvollständig"
          description="Diese Seite wird von einer App aufgerufen, die sich mit Brandbench verbinden möchte. Starte die Verbindung bitte direkt in der App, zum Beispiel in Claude unter „Konnektoren“."
          action={
            <Button asChild variant="outline">
              <Link to="/konto">Verbundene Apps ansehen</Link>
            </Button>
          }
        />
      </Shell>
    )
  }

  if (request.isLoading || request.data?.kind === 'redirect')
    return <PageSpinner label="Verbindung wird vorbereitet …" />

  if (request.error || !request.data || !user) {
    return (
      <Shell>
        <EmptyState
          icon={<AlertTriangle />}
          title="Anfrage nicht möglich"
          description={`${request.error ? errorMessage(request.error) : 'Die Anfrage ist abgelaufen oder ungültig.'} Starte die Verbindung bitte noch einmal in der App.`}
        />
      </Shell>
    )
  }

  return <ConsentForm authorizationId={authorizationId} details={request.data.details} userId={user.id} />
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">{children}</div>
    </AppShell>
  )
}

function ConsentForm({
  authorizationId,
  details,
  userId,
}: {
  authorizationId: string
  details: Details
  userId: string
}) {
  const scope = useSelectableScope(userId)
  const save = useSaveMcpGrant()
  const [selection, setSelection] = useState<ScopeSelection>(EMPTY_SELECTION)
  const [readOnly, setReadOnly] = useState(false)
  const [busy, setBusy] = useState<'approve' | 'deny' | null>(null)
  const assessment = assessRedirectUri(details.redirect_uri)

  const data = scope.data
  const brands = useMemo(() => (data ? allScopeBrands(data) : []), [data])
  const normalized = useMemo(() => normalizeSelection(selection, brands), [selection, brands])
  const brandCount = countAccessibleBrands(normalized, brands)
  const appName = details.client.name?.trim() || 'Unbenannte App'

  const approve = async () => {
    setBusy('approve')
    try {
      await save.mutateAsync({
        clientId: details.client.id,
        clientName: appName,
        selection: normalized,
        readOnly,
      })
      const { data, error } = await supabase.auth.oauth.approveAuthorization(authorizationId, {
        skipBrowserRedirect: true,
      })
      if (error) throw error
      window.location.replace(data.redirect_url)
    } catch (error) {
      toast.error(errorMessage(error))
      setBusy(null)
    }
  }

  const deny = async () => {
    setBusy('deny')
    try {
      const { data, error } = await supabase.auth.oauth.denyAuthorization(authorizationId, {
        skipBrowserRedirect: true,
      })
      if (error) throw error
      window.location.replace(data.redirect_url)
    } catch (error) {
      toast.error(errorMessage(error))
      setBusy(null)
    }
  }

  return (
    <Shell>
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Bot className="size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-semibold text-ink">
            „{appName}“ mit {APP_NAME} verbinden
          </h1>
          <p className="mt-2 text-sm text-muted">
            Die App arbeitet danach in deinem Namen mit deinen Rechten. Du bestimmst, welche Workspaces und
            Marken sie sehen und ändern darf. Alles andere bleibt unsichtbar, auch für die App.
          </p>
        </div>
      </div>

      <Card className="mt-6 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">{appName}</span>
          {assessment.trust === 'known' && (
            <Badge tone="success">
              <ShieldCheck className="size-3" aria-hidden /> Bekannte App
            </Badge>
          )}
          {assessment.trust === 'local' && <Badge tone="info">Läuft auf deinem Gerät</Badge>}
          <span className="text-xs text-muted">Rückkehr zu: {assessment.destination}</span>
        </div>
        {assessment.trust === 'unknown' && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Diese App ist uns nicht bekannt. Lass den Zugriff nur zu, wenn du die Verbindung gerade selbst
              eingerichtet hast.
            </span>
          </p>
        )}
      </Card>

      <h2 className="mt-8 mb-3 text-lg font-semibold text-ink">Worauf darf die App zugreifen?</h2>

      {scope.isLoading && <PageSpinner label="Lädt deine Workspaces …" />}
      {scope.error && (
        <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{errorMessage(scope.error)}</p>
      )}
      {data && data.workspaces.length === 0 && data.directBrands.length === 0 && (
        <EmptyState
          title="Noch nichts zum Freigeben"
          description="Lege in Brandbench zuerst einen Workspace oder eine Marke an. Danach kannst du die Verbindung wiederholen."
        />
      )}
      {data && (data.workspaces.length > 0 || data.directBrands.length > 0) && (
        <>
          <div className="mb-3 flex flex-wrap gap-2 text-sm">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setSelection(
                  normalizeSelection(
                    {
                      workspaceIds: data.workspaces.map((w) => w.id),
                      brandIds: data.directBrands.map((b) => b.id),
                    },
                    brands,
                  ),
                )
              }
            >
              Alles auswählen
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelection(EMPTY_SELECTION)}>
              Auswahl leeren
            </Button>
          </div>
          <ScopePicker scope={data} value={selection} onChange={setSelection} disabled={busy !== null} />
        </>
      )}

      <Card className="mt-6 p-4">
        <Switch
          checked={readOnly}
          onCheckedChange={setReadOnly}
          label="Nur lesen"
          description="Die App darf alles ansehen und herunterladen, aber nichts anlegen, ändern oder löschen."
        />
      </Card>

      <Card className="mt-4 bg-surface-2/50 p-4 text-sm text-muted">
        <p className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          <span>
            Du kannst die Auswahl jederzeit unter{' '}
            <strong className="text-ink">Konto → Verbundene Apps</strong> ändern oder die Verbindung trennen.
            Dein Konto löschen oder Workspaces verlassen kann eine App nie.
          </span>
        </p>
      </Card>

      <div className="sticky bottom-0 -mx-4 mt-6 border-t border-border bg-bg/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <p className="mb-3 text-sm text-muted">
          {describeSelection(normalized, { workspaces: normalized.workspaceIds.length, brands: brandCount })}
          {readOnly && !isEmptySelection(normalized) && ' · nur lesen'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="lg"
            loading={busy === 'approve'}
            disabled={isEmptySelection(normalized) || busy === 'deny'}
            onClick={approve}
          >
            Zugriff erlauben
          </Button>
          <Button
            size="lg"
            variant="outline"
            loading={busy === 'deny'}
            disabled={busy === 'approve'}
            onClick={deny}
          >
            Abbrechen
          </Button>
        </div>
      </div>
    </Shell>
  )
}
