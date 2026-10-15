import { Check, CornerDownRight, MessageSquare, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { displayName, useAuth } from '@/api/auth'
import { useCommentMutations, useComments, type Comment, type CommentTarget } from '@/api/collab'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { Avatar, EmptyState, Segmented } from '@/components/ui/misc'
import { cn, errorMessage, timeAgo } from '@/lib/utils'
import { useBrandContext } from '@/features/brand/brand-context'

function CommentItem({
  comment,
  replies,
  target,
  onPinClick,
}: {
  comment: Comment
  replies: Comment[]
  target: CommentTarget
  onPinClick?: (comment: Comment) => void
}) {
  const { user } = useAuth()
  const { brand, canEdit, canAdmin } = useBrandContext()
  const m = useCommentMutations(target, brand.id)
  const [replying, setReplying] = useState(false)
  const [reply, setReply] = useState('')
  const canDelete = (id: string | null) => id === user?.id || canAdmin

  const renderOne = (c: Comment, isReply: boolean) => (
    <div key={c.id} className={cn('flex gap-2.5', isReply && 'mt-3 ml-6')}>
      <Avatar name={displayName(c.author)} className="size-7 text-[10px]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[13px] font-semibold text-ink">{displayName(c.author)}</p>
          <span className="shrink-0 text-[11px] text-muted">{timeAgo(c.created_at)}</span>
        </div>
        {c.pos_x !== null && c.pos_y !== null && !isReply && (
          <button
            type="button"
            onClick={() => onPinClick?.(c)}
            className="mt-0.5 text-[11px] font-medium text-accent"
          >
            Markierung im Bild
          </button>
        )}
        <p className="mt-0.5 text-sm whitespace-pre-line text-ink-2">{c.body}</p>
        {canDelete(c.author_id) && (
          <button
            type="button"
            onClick={() => m.remove.mutate(c.id)}
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted hover:text-danger"
          >
            <Trash2 className="size-3" /> Löschen
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className={cn('rounded-xl border border-border p-3', comment.resolved && 'opacity-60')}>
      {renderOne(comment, false)}
      {replies.map((r) => renderOne(r, true))}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Button size="sm" variant="ghost" onClick={() => setReplying((v) => !v)}>
          <CornerDownRight /> Antworten
        </Button>
        {(canEdit || comment.author_id === user?.id) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => m.resolve.mutate({ id: comment.id, resolved: !comment.resolved })}
          >
            {comment.resolved ? <RotateCcw /> : <Check />} {comment.resolved ? 'Wieder öffnen' : 'Erledigt'}
          </Button>
        )}
      </div>
      {replying && (
        <form
          className="mt-2 space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!reply.trim()) return
            m.add.mutate(
              { body: reply.trim(), parentId: comment.id },
              {
                onSuccess: () => {
                  setReply('')
                  setReplying(false)
                },
                onError: (err) => toast.error(errorMessage(err)),
              },
            )
          }}
        >
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
            placeholder="Antwort …"
            autoFocus
          />
          <Button type="submit" size="sm" loading={m.add.isPending}>
            Senden
          </Button>
        </form>
      )}
    </div>
  )
}

/** Kommentar-Threads für eine Seite oder ein Asset. */
export function CommentsPanel({
  target,
  pin,
  onClearPin,
  onPinClick,
}: {
  target: CommentTarget
  pin?: { x: number; y: number } | null
  onClearPin?: () => void
  onPinClick?: (comment: Comment) => void
}) {
  const { brand, isMember } = useBrandContext()
  const { data: comments = [], isLoading } = useComments(target, isMember)
  const m = useCommentMutations(target, brand.id)
  const [body, setBody] = useState('')
  const [filter, setFilter] = useState<'open' | 'all'>('open')

  if (!isMember) {
    return <p className="p-5 text-sm text-muted">Kommentare sind nur für Mitglieder sichtbar.</p>
  }

  const roots = comments.filter((c) => c.parent_id === null && (filter === 'all' || !c.resolved))
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id)
  const openCount = comments.filter((c) => c.parent_id === null && !c.resolved).length

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b border-border p-4">
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!body.trim()) return
            m.add.mutate(
              { body: body.trim(), posX: pin?.x ?? null, posY: pin?.y ?? null },
              {
                onSuccess: () => {
                  setBody('')
                  onClearPin?.()
                },
                onError: (err) => toast.error(errorMessage(err)),
              },
            )
          }}
        >
          {pin && (
            <p className="flex items-center justify-between rounded-lg bg-accent-soft px-2.5 py-1.5 text-xs text-accent">
              Kommentar mit Markierung im Bild
              <button type="button" onClick={onClearPin} className="font-semibold">
                Entfernen
              </button>
            </p>
          )}
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Feedback oder Frage …"
          />
          <div className="flex items-center justify-between gap-2">
            <Segmented
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'open', label: `Offen (${openCount})` },
                { value: 'all', label: 'Alle' },
              ]}
            />
            <Button type="submit" size="sm" loading={m.add.isPending} disabled={!body.trim()}>
              Kommentieren
            </Button>
          </div>
        </form>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {isLoading ? (
          <p className="text-sm text-muted">Lädt …</p>
        ) : roots.length === 0 ? (
          <EmptyState
            icon={<MessageSquare />}
            title={filter === 'open' ? 'Keine offenen Kommentare' : 'Noch keine Kommentare'}
            description="Hier können Team und Dozierende Feedback geben."
            className="py-8"
          />
        ) : (
          roots.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              replies={repliesOf(c.id)}
              target={target}
              onPinClick={onPinClick}
            />
          ))
        )}
      </div>
    </div>
  )
}
