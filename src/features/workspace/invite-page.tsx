import { CheckCircle2, MailWarning, Users } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { useAuth } from '@/api/auth'
import { useAcceptInvitation, useInvitationPreview } from '@/api/members'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Card, EmptyState } from '@/components/ui/misc'
import { PageSpinner } from '@/components/ui/spinner'
import { errorMessage } from '@/lib/utils'
import { BRAND_ROLES, WORKSPACE_ROLES } from '@/features/members/members-panel'

export function InvitePage() {
  const { token } = useParams()
  const { user, loading } = useAuth()
  const { data: preview, isLoading } = useInvitationPreview(token)
  const accept = useAcceptInvitation()
  const navigate = useNavigate()
  const attempted = useRef(false)

  useEffect(() => {
    if (!user || !preview?.is_valid || !token || attempted.current) return
    attempted.current = true
    accept.mutate(token, {
      onSuccess: (result) => {
        toast.success('Einladung angenommen')
        if (result?.brand_slug) navigate(`/b/${result.brand_slug}`, { replace: true })
        else if (result?.workspace_slug) navigate(`/w/${result.workspace_slug}`, { replace: true })
        else navigate('/', { replace: true })
      },
      onError: (e) => toast.error(errorMessage(e)),
    })
  }, [user, preview, token, accept, navigate])

  if (loading || isLoading) return <PageSpinner />

  if (!preview || !preview.is_valid) {
    return (
      <AppShell>
        <EmptyState
          icon={<MailWarning />}
          title="Einladung ungültig"
          description="Der Link ist abgelaufen, wurde widerrufen oder schon zu oft verwendet. Bitte frag nach einem neuen Link."
          action={
            <Button asChild variant="outline">
              <Link to="/">Zur Startseite</Link>
            </Button>
          }
        />
      </AppShell>
    )
  }

  const role = preview.brand_role
    ? BRAND_ROLES.find((r) => r.value === preview.brand_role)
    : WORKSPACE_ROLES.find((r) => r.value === preview.workspace_role)
  const target = preview.brand_name ?? preview.workspace_name

  if (user) {
    return (
      <AppShell>
        {accept.isError ? (
          <EmptyState
            icon={<MailWarning />}
            title="Das hat nicht geklappt"
            description={errorMessage(accept.error)}
            action={
              <Button asChild variant="outline">
                <Link to="/">Zur Übersicht</Link>
              </Button>
            }
          />
        ) : (
          <PageSpinner label="Einladung wird angenommen …" />
        )}
      </AppShell>
    )
  }

  const next = encodeURIComponent(`/einladung/${token}`)
  return (
    <AppShell>
      <Card className="mx-auto max-w-md p-6 text-center sm:p-8">
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Users className="size-7" />
        </span>
        <h1 className="font-display text-2xl font-semibold text-ink">Du bist eingeladen</h1>
        <p className="mt-2 text-ink-2">
          Arbeite mit an <strong>{target}</strong>
          {preview.brand_name && <> im Workspace „{preview.workspace_name}“</>}.
        </p>
        {role && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-muted">
            <CheckCircle2 className="size-4 text-success" /> Rolle: {role.label} – {role.description}
          </p>
        )}
        {preview.email_bound && (
          <p className="mt-3 text-xs text-muted">
            Diese Einladung gilt nur für die eingeladene E-Mail-Adresse.
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2">
          <Button asChild size="lg">
            <Link to={`/login?modus=registrieren&weiter=${next}`}>Konto erstellen & beitreten</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to={`/login?weiter=${next}`}>Ich habe schon ein Konto</Link>
          </Button>
        </div>
      </Card>
    </AppShell>
  )
}
