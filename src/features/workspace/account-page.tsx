import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/api/auth'
import { AppShell } from '@/components/layout/app-shell'
import { ConnectedAppsCard } from '@/features/connections/connected-apps'
import { useProductTour } from '@/features/onboarding/product-tour'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { Field, Input } from '@/components/ui/input'
import { Card } from '@/components/ui/misc'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/utils'

export function AccountPage() {
  const { user, profile } = useAuth()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<'name' | 'password' | 'delete' | null>(null)
  const confirm = useConfirm()
  const navigate = useNavigate()
  const { openTour } = useProductTour()

  useEffect(() => setName(profile?.full_name ?? ''), [profile?.full_name])

  return (
    <AppShell>
      <h1 className="mb-6 font-display text-3xl font-semibold text-ink">Konto</h1>
      <div className="grid max-w-3xl gap-4">
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold text-ink">Profil</h2>
          <Field label="Name" hint="So sieht dich dein Team bei Kommentaren und im Verlauf.">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="E-Mail">
            <Input value={user?.email ?? ''} disabled />
          </Field>
          <Button
            loading={busy === 'name'}
            onClick={async () => {
              if (!user) return
              setBusy('name')
              const { error } = await supabase
                .from('profiles')
                .update({ full_name: name.trim() })
                .eq('id', user.id)
              setBusy(null)
              if (error) toast.error(errorMessage(error))
              else {
                toast.success('Gespeichert')
                void qc.invalidateQueries({ queryKey: ['profile'] })
              }
            }}
          >
            Speichern
          </Button>
        </Card>
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold text-ink">Passwort ändern</h2>
          <Field label="Neues Passwort" hint="Mindestens 8 Zeichen">
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button
            variant="outline"
            loading={busy === 'password'}
            disabled={password.length < 8}
            onClick={async () => {
              setBusy('password')
              const { error } = await supabase.auth.updateUser({ password })
              setBusy(null)
              if (error) toast.error(errorMessage(error))
              else {
                setPassword('')
                toast.success('Passwort geändert')
              }
            }}
          >
            Passwort ändern
          </Button>
        </Card>
        <ConnectedAppsCard />
        <Card className="space-y-3 p-5">
          <h2 className="font-semibold text-ink">Produkttour</h2>
          <p className="text-sm text-muted">
            Ein kurzer Rundgang durch Workspaces, Marken, Markenhandbuch, Markenbasis, Bibliotheken und das
            Teilen. Du kannst ihn jederzeit wiederholen.
          </p>
          <Button variant="outline" onClick={openTour}>
            Tour starten
          </Button>
        </Card>
        <Card className="space-y-3 border-danger/40 p-5">
          <h2 className="font-semibold text-danger">Konto löschen</h2>
          <p className="text-sm text-muted">
            Löscht dein Konto und alle Mitgliedschaften. Deine Kommentare bleiben ohne Namen erhalten, damit
            Diskussionen nachvollziehbar bleiben. Bist du Owner eines Workspaces, lösche ihn vorher oder
            ernenne eine andere Person zum Owner.
          </p>
          <Button
            variant="outline"
            className="text-danger"
            loading={busy === 'delete'}
            onClick={async () => {
              const ok = await confirm({
                title: 'Konto endgültig löschen?',
                description: 'Das kann nicht rückgängig gemacht werden.',
                confirmLabel: 'Konto löschen',
                danger: true,
              })
              if (!ok) return
              setBusy('delete')
              const { error } = await supabase.rpc('delete_my_account')
              setBusy(null)
              if (error) {
                toast.error(errorMessage(error))
                return
              }
              await supabase.auth.signOut()
              toast.success('Dein Konto wurde gelöscht')
              navigate('/login')
            }}
          >
            Konto löschen
          </Button>
        </Card>
      </div>
    </AppShell>
  )
}
