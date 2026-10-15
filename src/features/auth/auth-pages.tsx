import { ArrowLeft, Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useAuth } from '@/api/auth'
import { AppLogo } from '@/components/layout/app-logo'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/misc'
import { PageSpinner } from '@/components/ui/spinner'
import { APP_NAME } from '@/lib/app'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/utils'

function safeRedirect(target: string | null): string {
  if (!target || !target.startsWith('/') || target.startsWith('//')) return '/'
  return target
}

function AuthShell({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[1fr_minmax(420px,520px)]">
      <div className="relative hidden overflow-hidden bg-ink p-12 text-bg lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 64 64" className="size-10" aria-hidden>
            <rect width="64" height="64" rx="14" fill="currentColor" opacity="0.12" />
            <path d="M32 12 L40 32 L32 52 L24 32 Z" fill="currentColor" />
            <path d="M32 12 L40 32 L32 32 Z" className="fill-accent" />
          </svg>
          <span className="font-display text-xl font-semibold">{APP_NAME}</span>
        </div>
        <div className="max-w-md">
          <p className="font-display text-4xl leading-tight font-semibold">
            Die ganze Marke an einem Ort. Für alle, die mit ihr arbeiten.
          </p>
          <p className="mt-4 text-bg/70">
            Markenkern, Logos, Farben, Typografie, Bildwelt und Vorlagen – gemeinsam pflegen, sicher teilen, überall abrufbar.
          </p>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full">
          {['#0B3C7A', '#FFFFFF', '#FFC72C', '#D9481F', '#23855A'].map((c) => (
            <span key={c} className="flex-1" style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <div className="lg:hidden">
          <AppLogo />
        </div>
        <div className="mx-auto my-auto w-full max-w-sm py-10">
          <h1 className="font-display text-3xl font-semibold text-ink">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function LoginPage() {
  const { user, loading } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const redirect = safeRedirect(params.get('weiter'))
  const [mode, setMode] = useState<'login' | 'signup'>(params.get('modus') === 'registrieren' ? 'signup' : 'login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<'confirm' | 'magic' | null>(null)

  if (loading) return <PageSpinner />
  if (user) return <Navigate to={redirect} replace />

  const emailRedirect = `${window.location.origin}${redirect}`

  const submit = async () => {
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        navigate(redirect, { replace: true })
      } else {
        if (password.length < 8) {
          toast.error('Bitte mindestens 8 Zeichen für das Passwort verwenden.')
          return
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() }, emailRedirectTo: emailRedirect },
        })
        if (error) throw error
        if (data.session) navigate(redirect, { replace: true })
        else setSent('confirm')
      }
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const magicLink = async () => {
    if (!email.trim()) {
      toast.error('Bitte zuerst die E-Mail-Adresse eingeben.')
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: emailRedirect, shouldCreateUser: false },
      })
      if (error) throw error
      setSent('magic')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <AuthShell title="Schau in dein Postfach" subtitle={`Wir haben eine E-Mail an ${email} geschickt.`}>
        <div className="flex gap-3 rounded-2xl border border-border bg-surface p-4 text-sm text-ink-2">
          <Mail className="size-5 shrink-0 text-accent" />
          {sent === 'confirm'
            ? 'Bestätige deine Adresse über den Link in der E-Mail. Danach bist du automatisch angemeldet.'
            : 'Klicke auf den Link in der E-Mail, um dich ohne Passwort anzumelden.'}
        </div>
        <Button variant="ghost" className="mt-4" onClick={() => setSent(null)}>
          <ArrowLeft /> Zurück
        </Button>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title={mode === 'login' ? 'Willkommen zurück' : 'Konto erstellen'}
      subtitle={mode === 'login' ? `Melde dich bei ${APP_NAME} an.` : 'Kostenlos – du brauchst nur eine E-Mail-Adresse.'}
    >
      <Segmented
        value={mode}
        onChange={setMode}
        className="mb-6 w-full [&>button]:flex-1"
        options={[
          { value: 'login', label: 'Anmelden' },
          { value: 'signup', label: 'Registrieren' },
        ]}
      />
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        {mode === 'signup' && (
          <Field label="Name" htmlFor="name">
            <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Vor- und Nachname" />
          </Field>
        )}
        <Field label="E-Mail" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field
          label="Passwort"
          htmlFor="password"
          hint={mode === 'signup' ? 'Mindestens 8 Zeichen' : undefined}
        >
          <Input
            id="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          {mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
        </Button>
      </form>
      {mode === 'login' && (
        <div className="mt-4 flex flex-wrap justify-between gap-2 text-sm">
          <button type="button" className="font-medium text-accent hover:underline" onClick={() => void magicLink()}>
            Login-Link per E-Mail
          </button>
          <Link to={`/passwort-vergessen?email=${encodeURIComponent(email)}`} className="text-muted hover:text-ink">
            Passwort vergessen?
          </Link>
        </div>
      )}
      <p className="mt-8 text-xs leading-relaxed text-muted">
        Mit der Registrierung werden Name und E-Mail-Adresse gespeichert, damit dein Team dich zuordnen kann.
      </p>
    </AuthShell>
  )
}

export function ForgotPasswordPage() {
  const [params] = useSearchParams()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  return (
    <AuthShell title="Passwort zurücksetzen" subtitle="Wir schicken dir einen Link, mit dem du ein neues Passwort festlegst.">
      {sent ? (
        <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-ink-2">
          Falls ein Konto für {email} existiert, ist die E-Mail unterwegs.
        </p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
              redirectTo: `${window.location.origin}/passwort-neu`,
            })
            setBusy(false)
            if (error) toast.error(errorMessage(error))
            else setSent(true)
          }}
        >
          <Field label="E-Mail">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </Field>
          <Button type="submit" className="w-full" loading={busy}>
            Link senden
          </Button>
        </form>
      )}
      <Link to="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Zur Anmeldung
      </Link>
    </AuthShell>
  )
}

export function ResetPasswordPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [waited, setWaited] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 2500)
    return () => clearTimeout(t)
  }, [])

  if (loading || (!user && !waited)) return <PageSpinner />
  if (!user) {
    return (
      <AuthShell title="Link abgelaufen" subtitle="Bitte fordere einen neuen Link an.">
        <Button asChild>
          <Link to="/passwort-vergessen">Neuen Link anfordern</Link>
        </Button>
      </AuthShell>
    )
  }
  return (
    <AuthShell title="Neues Passwort" subtitle={user.email}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          if (password.length < 8) {
            toast.error('Mindestens 8 Zeichen')
            return
          }
          setBusy(true)
          const { error } = await supabase.auth.updateUser({ password })
          setBusy(false)
          if (error) toast.error(errorMessage(error))
          else {
            toast.success('Passwort geändert')
            navigate('/')
          }
        }}
      >
        <Field label="Neues Passwort" hint="Mindestens 8 Zeichen">
          <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </Field>
        <Button type="submit" className="w-full" loading={busy}>
          Speichern
        </Button>
      </form>
    </AuthShell>
  )
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <PageSpinner />
  if (!user) {
    const target = `${window.location.pathname}${window.location.search}`
    return <Navigate to={`/login?weiter=${encodeURIComponent(target)}`} replace />
  }
  return <>{children}</>
}
