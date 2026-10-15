import { Activity as ActivityIcon, CheckCircle2, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { displayName } from '@/api/auth'
import { useActivity, useBrandComments } from '@/api/collab'
import { Avatar, Badge, EmptyState, Tabs } from '@/components/ui/misc'
import { PageSpinner } from '@/components/ui/spinner'
import { formatDateTime, timeAgo } from '@/lib/utils'
import { useBrandContext } from '@/features/brand/brand-context'

const ENTITY_LABELS: Record<string, string> = {
  brands: 'Marke',
  guidelines: 'Markenhandbuch',
  guideline_pages: 'Seite',
  assets: 'Datei',
  color_palettes: 'Farbpalette',
  fonts: 'Schrift',
  libraries: 'Bibliothek',
  comments: 'Kommentar',
  brand_members: 'Mitglied',
}

const ACTION_LABELS: Record<string, string> = {
  created: 'hat angelegt',
  updated: 'hat geändert',
  deleted: 'hat gelöscht',
  new_version: 'hat eine neue Version hochgeladen von',
}

function actionText(action: string, entity: string): string {
  if (entity === 'comments') return 'hat kommentiert'
  if (entity === 'brand_members') return action === 'created' ? 'hat hinzugefügt:' : 'hat entfernt:'
  return `${ACTION_LABELS[action] ?? action} ${ENTITY_LABELS[entity] ?? entity}`
}

export function ActivityPage() {
  const { brand, basePath, isMember } = useBrandContext()
  const [tab, setTab] = useState('feedback')
  const { data: activity = [], isLoading } = useActivity(brand.id, isMember)
  const { data: comments = [], isLoading: loadingComments } = useBrandComments(brand.id, isMember)

  if (!isMember) return <EmptyState title="Nur für Mitglieder" className="m-8" />

  const open = comments.filter((c) => !c.resolved)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold tracking-[0.12em] text-brand-accent-text uppercase">Team</p>
      <h1 className="mt-1 mb-6 font-brand-heading text-3xl font-bold text-ink">Aktivität & Feedback</h1>
      <Tabs
        value={tab}
        onValueChange={setTab}
        className="mb-6"
        items={[
          { value: 'feedback', label: `Feedback (${open.length} offen)` },
          { value: 'verlauf', label: 'Änderungsverlauf' },
        ]}
      />
      {tab === 'feedback' &&
        (loadingComments ? (
          <PageSpinner />
        ) : comments.length === 0 ? (
          <EmptyState icon={<MessageSquare />} title="Noch kein Feedback" description="Kommentare zu Seiten und Dateien erscheinen hier gesammelt." />
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => {
              const page = c.page as { title: string; slug: string; guideline: { slug: string } | null } | null
              const asset = c.asset as { title: string; library: { slug: string } | null } | null
              const href = page
                ? `${basePath}/g/${page.guideline?.slug}/${page.slug}`
                : asset
                  ? `${basePath}/bibliothek/${asset.library?.slug}?asset=${c.asset_id}`
                  : basePath
              return (
                <li key={c.id}>
                  <Link to={href} className="flex gap-3 rounded-2xl border border-border bg-surface p-4 transition-shadow hover:shadow-card">
                    <Avatar name={displayName(c.author)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold text-ink">{displayName(c.author)}</span>
                        <span className="text-muted">zu</span>
                        <span className="font-medium text-ink-2">{page?.title ?? asset?.title ?? 'Inhalt'}</span>
                        {c.resolved && (
                          <Badge tone="success">
                            <CheckCircle2 className="size-3" /> erledigt
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-3 text-sm whitespace-pre-line text-ink-2">{c.body}</p>
                      <p className="mt-1 text-xs text-muted">{timeAgo(c.created_at)}</p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        ))}
      {tab === 'verlauf' &&
        (isLoading ? (
          <PageSpinner />
        ) : activity.length === 0 ? (
          <EmptyState icon={<ActivityIcon />} title="Noch keine Aktivität" />
        ) : (
          <ol className="relative space-y-4 border-l border-border pl-6">
            {activity.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute top-1.5 -left-[29px] size-2.5 rounded-full border-2 border-bg bg-border-strong" />
                <p className="text-sm text-ink-2">
                  <span className="font-semibold text-ink">{a.actor ? displayName(a.actor) : 'System'}</span>{' '}
                  {actionText(a.action, a.entity)} {a.label && <span className="font-medium text-ink">„{a.label}“</span>}
                </p>
                <p className="text-xs text-muted" title={formatDateTime(a.created_at)}>
                  {timeAgo(a.created_at)}
                </p>
              </li>
            ))}
          </ol>
        ))}
    </div>
  )
}
