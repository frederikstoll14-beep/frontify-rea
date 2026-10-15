import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  BLOCK_CATEGORIES,
  BLOCK_META,
  BLOCK_TYPES,
  type BlockCategory,
  type BlockType,
} from '@/lib/blocks/types'
import { cn } from '@/lib/utils'
import { BLOCKS } from '@/features/blocks/registry'

export function BlockInserterDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (type: BlockType) => void
}) {
  const [query, setQuery] = useState('')
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = BLOCK_TYPES.filter((type) => {
      if (!q) return true
      const meta = BLOCK_META[type]
      return [meta.label, meta.description, ...meta.keywords].some((s) => s.toLowerCase().includes(q))
    })
    return (Object.keys(BLOCK_CATEGORIES) as BlockCategory[])
      .map((category) => ({ category, types: matches.filter((t) => BLOCK_META[t].category === category) }))
      .filter((g) => g.types.length > 0)
  }, [query])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery('')
        onOpenChange(next)
      }}
      title="Baustein einfügen"
      size="lg"
    >
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Suchen, z. B. Farbe, Logo, Video …"
          className="pl-9"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && groups[0]?.types[0]) {
              onPick(groups[0].types[0])
              setQuery('')
            }
          }}
        />
      </div>
      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group.category}>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
              {BLOCK_CATEGORIES[group.category]}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.types.map((type) => {
                const Icon = BLOCKS[type].icon
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      onPick(type)
                      setQuery('')
                    }}
                    className="flex items-start gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-border-strong hover:bg-surface-2"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink">
                      <Icon className="size-[18px]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">{BLOCK_META[type].label}</span>
                      <span className="block text-xs leading-snug text-muted">
                        {BLOCK_META[type].description}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
        {groups.length === 0 && (
          <p className="py-6 text-center text-sm text-muted">Kein Baustein gefunden.</p>
        )}
      </div>
    </Dialog>
  )
}

export function InsertLine({ onClick, always }: { onClick: () => void; always?: boolean }) {
  return (
    <div
      className={cn(
        'group/insert relative col-span-12 flex h-6 items-center justify-center',
        !always && 'no-print',
      )}
    >
      <div
        className={cn(
          'absolute inset-x-0 top-1/2 h-px bg-accent/40 transition-opacity',
          always ? 'opacity-0' : 'opacity-0 group-hover/insert:opacity-100',
        )}
      />
      <button
        type="button"
        onClick={onClick}
        aria-label="Baustein einfügen"
        className={cn(
          'relative z-10 flex h-7 items-center gap-1 rounded-full border border-border bg-surface px-2.5 text-xs font-medium text-ink-2 shadow-sm transition-all hover:border-accent hover:text-accent',
          always ? 'opacity-100' : 'opacity-40 group-hover/insert:opacity-100 focus:opacity-100',
        )}
      >
        <Plus className="size-3.5" /> Baustein
      </button>
    </div>
  )
}
