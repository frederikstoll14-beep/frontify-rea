import { History, RotateCcw, Save } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { displayName } from '@/api/auth'
import { restoreRevision, useCreateRevision, useRevisions, type Block, type GuidelinePage, type RevisionSnapshot } from '@/api/guidelines'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/misc'
import { errorMessage, formatDateTime } from '@/lib/utils'

export function RevisionsPanel({
  page,
  blocks,
  beforeSnapshot,
  onRestored,
}: {
  page: GuidelinePage
  blocks: Block[]
  beforeSnapshot: () => Promise<void>
  onRestored: () => void
}) {
  const { data: revisions = [], isLoading } = useRevisions(page.id, true)
  const create = useCreateRevision(page.id, page.brand_id)
  const confirm = useConfirm()
  const [label, setLabel] = useState('')
  const [restoring, setRestoring] = useState<string | null>(null)

  return (
    <div className="space-y-4 p-4">
      <form
        className="space-y-2 rounded-xl border border-border p-3"
        onSubmit={async (e) => {
          e.preventDefault()
          await beforeSnapshot()
          create.mutate(
            { label: label.trim() || 'Zwischenstand', page, blocks },
            {
              onSuccess: () => {
                setLabel('')
                toast.success('Version gespeichert')
              },
              onError: (err) => toast.error(errorMessage(err)),
            },
          )
        }}
      >
        <p className="text-sm font-medium text-ink">Aktuellen Stand sichern</p>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="z. B. Abgabe Zwischenpräsentation" />
        <Button type="submit" size="sm" loading={create.isPending}>
          <Save /> Version speichern
        </Button>
      </form>
      {isLoading ? (
        <p className="text-sm text-muted">Lädt …</p>
      ) : revisions.length === 0 ? (
        <EmptyState icon={<History />} title="Noch keine Versionen" description="Sichere wichtige Stände, z. B. vor einer Abgabe." className="py-8" />
      ) : (
        <ul className="space-y-2">
          {revisions.map((revision) => {
            const snapshot = revision.snapshot as unknown as RevisionSnapshot
            return (
              <li key={revision.id} className="flex items-start justify-between gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{revision.label || 'Version'}</p>
                  <p className="text-xs text-muted">
                    {formatDateTime(revision.created_at)} · {displayName(revision.author)} · {snapshot.blocks?.length ?? 0} Bausteine
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  loading={restoring === revision.id}
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Version wiederherstellen?',
                      description: 'Der aktuelle Stand wird vorher automatisch als Version gesichert.',
                      confirmLabel: 'Wiederherstellen',
                    })
                    if (!ok) return
                    setRestoring(revision.id)
                    try {
                      await beforeSnapshot()
                      await restoreRevision({ page, current: blocks, revision })
                      toast.success('Version wiederhergestellt')
                      onRestored()
                    } catch (err) {
                      toast.error(errorMessage(err))
                    } finally {
                      setRestoring(null)
                    }
                  }}
                >
                  <RotateCcw /> Wiederherstellen
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
