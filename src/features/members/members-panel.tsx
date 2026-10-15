import { Copy, Link2, Mail, Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { displayName, useAuth } from '@/api/auth'
import { inviteUrl, useInvitations, useInvite, useRevokeInvitation, type Invitation } from '@/api/members'
import type { MemberRow } from '@/api/workspaces'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/input'
import { Avatar, Badge, SectionTitle } from '@/components/ui/misc'
import { errorMessage, formatDate } from '@/lib/utils'

export interface RoleOption {
  value: string
  label: string
  description: string
}

export const WORKSPACE_ROLES: RoleOption[] = [
  { value: 'owner', label: 'Owner', description: 'Volle Rechte inkl. Löschen des Workspaces' },
  { value: 'admin', label: 'Admin', description: 'Verwaltet alle Marken und Mitglieder (z. B. Dozierende)' },
  {
    value: 'member',
    label: 'Mitglied',
    description: 'Kann eigene Marken anlegen und Marken mit Sichtbarkeit „Workspace“ ansehen',
  },
]

export const BRAND_ROLES: RoleOption[] = [
  { value: 'admin', label: 'Admin', description: 'Bearbeiten, Einstellungen, Mitglieder, Teilen' },
  { value: 'editor', label: 'Bearbeiten', description: 'Inhalte, Dateien, Farben und Schriften bearbeiten' },
  { value: 'viewer', label: 'Ansehen', description: 'Lesen, herunterladen und kommentieren' },
]

function roleLabel(options: RoleOption[], value: string) {
  return options.find((o) => o.value === value)?.label ?? value
}

function InvitationRow({
  invitation,
  roles,
  onRevoke,
}: {
  invitation: Invitation
  roles: RoleOption[]
  onRevoke: () => void
}) {
  const role = invitation.brand_role ?? invitation.workspace_role
  const usage = invitation.max_uses
    ? `${invitation.use_count}/${invitation.max_uses}`
    : `${invitation.use_count}× genutzt`
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border-strong px-3 py-2.5">
      {invitation.email ? <Mail className="size-4 text-muted" /> : <Link2 className="size-4 text-muted" />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{invitation.email ?? 'Einladungslink'}</p>
        <p className="text-xs text-muted">
          {roleLabel(roles, role)} · {usage} · gültig bis {formatDate(invitation.expires_at)}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          void navigator.clipboard.writeText(inviteUrl(invitation.token))
          toast.success('Einladungslink kopiert')
        }}
      >
        <Copy /> Link
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label="Einladung widerrufen" onClick={onRevoke}>
        <Trash2 />
      </Button>
    </li>
  )
}

/** Mitgliederliste mit Rollen, Einladungen per E-Mail und Einladungslinks. */
export function MembersPanel({
  workspaceId,
  brandId,
  members,
  roles,
  canManage,
  onRoleChange,
  onRemove,
  scopeLabel,
}: {
  workspaceId: string
  brandId?: string
  members: MemberRow[]
  roles: RoleOption[]
  canManage: boolean
  onRoleChange: (userId: string, role: string) => void
  onRemove: (userId: string) => void
  scopeLabel: string
}) {
  const { user } = useAuth()
  const { data: invitations = [] } = useInvitations(canManage ? workspaceId : undefined, brandId)
  const invite = useInvite()
  const revoke = useRevokeInvitation(workspaceId)
  const confirm = useConfirm()
  const assignable = roles.filter((r) => r.value !== 'owner')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState(assignable[assignable.length - 1]?.value ?? 'viewer')
  const [linkDialog, setLinkDialog] = useState(false)
  const [linkRole, setLinkRole] = useState(assignable[assignable.length - 1]?.value ?? 'viewer')
  const [linkDays, setLinkDays] = useState(30)
  const [createdLink, setCreatedLink] = useState<string | null>(null)

  const roleInput = (value: string) =>
    brandId
      ? { brandId, brandRole: value as 'admin' | 'editor' | 'viewer', workspaceRole: 'member' as const }
      : { workspaceRole: value as 'admin' | 'member' }

  const sendInvite = () => {
    const address = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      toast.error('Bitte eine gültige E-Mail-Adresse eingeben')
      return
    }
    invite.mutate(
      { workspaceId, email: address, ...roleInput(role) },
      {
        onSuccess: (result) => {
          setEmail('')
          if (result.status === 'added') {
            toast.success(`${address} wurde hinzugefügt`)
          } else if (result.invitation) {
            const url = inviteUrl(result.invitation.token)
            void navigator.clipboard.writeText(url).catch(() => undefined)
            toast.success('Einladung erstellt – Link kopiert', {
              description:
                'Sobald sich die Person mit dieser E-Mail registriert, hat sie automatisch Zugriff.',
              action: {
                label: 'E-Mail öffnen',
                onClick: () => {
                  window.location.href = `mailto:${address}?subject=${encodeURIComponent(`Einladung: ${scopeLabel}`)}&body=${encodeURIComponent(`Hallo,\n\ndu bist eingeladen, bei „${scopeLabel}“ mitzuarbeiten. Hier geht's los:\n${url}\n\nViele Grüße`)}`
                },
              },
              duration: 10000,
            })
          }
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    )
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <SectionTitle
            title="Personen einladen"
            description="Bestehende Konten werden sofort hinzugefügt. Neue Personen erhalten einen Einladungslink."
          />
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault()
              sendInvite()
            }}
          >
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@hochschule.de"
              className="flex-1"
            />
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="sm:w-44"
              aria-label="Rolle"
            >
              {assignable.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
            <Button type="submit" loading={invite.isPending}>
              <UserPlus /> Einladen
            </Button>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setLinkDialog(true)}>
              <Link2 /> Einladungslink für Gruppe erstellen
            </Button>
            <span className="text-xs text-muted">
              Ideal für einen ganzen Kurs: ein Link, beliebig viele Personen.
            </span>
          </div>
        </section>
      )}

      <section>
        <SectionTitle title={`Mitglieder (${members.length})`} />
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {members.map((m) => {
            const name = displayName(m.profile)
            const isSelf = m.user_id === user?.id
            return (
              <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Avatar name={name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {name} {isSelf && <span className="text-muted">(du)</span>}
                  </p>
                  <p className="truncate text-xs text-muted">{m.profile?.email}</p>
                </div>
                {canManage && !(m.role === 'owner' && !roles.some((r) => r.value === 'owner')) ? (
                  <Select
                    value={m.role}
                    onChange={(e) => onRoleChange(m.user_id, e.target.value)}
                    className="h-9 w-40"
                    aria-label={`Rolle von ${name}`}
                  >
                    {roles.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Badge>{roleLabel(roles, m.role)}</Badge>
                )}
                {(canManage || isSelf) && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={isSelf ? 'Verlassen' : `${name} entfernen`}
                    onClick={async () => {
                      const ok = await confirm({
                        title: isSelf ? 'Wirklich verlassen?' : `${name} entfernen?`,
                        description: isSelf
                          ? 'Du verlierst den Zugriff.'
                          : 'Die Person verliert den Zugriff.',
                        confirmLabel: isSelf ? 'Verlassen' : 'Entfernen',
                        danger: true,
                      })
                      if (ok) onRemove(m.user_id)
                    }}
                  >
                    <Trash2 />
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
        <dl className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-3">
          {roles.map((r) => (
            <div key={r.value}>
              <dt className="font-semibold text-ink-2">{r.label}</dt>
              <dd>{r.description}</dd>
            </div>
          ))}
        </dl>
      </section>

      {canManage && invitations.length > 0 && (
        <section>
          <SectionTitle title="Offene Einladungen" />
          <ul className="space-y-2">
            {invitations.map((inv) => (
              <InvitationRow
                key={inv.id}
                invitation={inv}
                roles={roles}
                onRevoke={() =>
                  revoke.mutate(inv.id, { onSuccess: () => toast.success('Einladung widerrufen') })
                }
              />
            ))}
          </ul>
        </section>
      )}

      <Dialog
        open={linkDialog}
        onOpenChange={(open) => {
          setLinkDialog(open)
          if (!open) setCreatedLink(null)
        }}
        title="Einladungslink"
        description={`Jede Person mit diesem Link kann „${scopeLabel}“ beitreten, nachdem sie sich angemeldet hat.`}
        size="sm"
        footer={
          createdLink ? (
            <Button onClick={() => setLinkDialog(false)}>Fertig</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setLinkDialog(false)}>
                Abbrechen
              </Button>
              <Button
                loading={invite.isPending}
                onClick={() =>
                  invite.mutate(
                    { workspaceId, expiresInDays: linkDays, ...roleInput(linkRole) },
                    {
                      onSuccess: (result) => {
                        if (result.invitation) {
                          const url = inviteUrl(result.invitation.token)
                          setCreatedLink(url)
                          void navigator.clipboard.writeText(url).catch(() => undefined)
                        }
                      },
                      onError: (e) => toast.error(errorMessage(e)),
                    },
                  )
                }
              >
                Link erstellen
              </Button>
            </>
          )
        }
      >
        {createdLink ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-2">
              Der Link wurde kopiert. Teile ihn z. B. im Kurs-Chat oder Moodle.
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={createdLink}
                onFocus={(e) => e.target.select()}
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                aria-label="Kopieren"
                onClick={() => {
                  void navigator.clipboard.writeText(createdLink)
                  toast.success('Kopiert')
                }}
              >
                <Copy />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Rolle">
              <Select value={linkRole} onChange={(e) => setLinkRole(e.target.value)}>
                {assignable.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label} – {r.description}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Gültig für">
              <Select value={String(linkDays)} onChange={(e) => setLinkDays(Number(e.target.value))}>
                <option value="7">7 Tage</option>
                <option value="30">30 Tage</option>
                <option value="120">ein Semester (120 Tage)</option>
                <option value="365">ein Jahr</option>
              </Select>
            </Field>
          </div>
        )}
      </Dialog>
    </div>
  )
}
