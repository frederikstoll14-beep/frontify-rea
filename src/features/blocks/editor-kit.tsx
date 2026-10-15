import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/input'
import { cn, moveItem } from '@/lib/utils'

/** Randloses Eingabefeld, das wie der dargestellte Text aussieht. */
export function InlineInput({
  value,
  onChange,
  placeholder,
  className,
  multiline,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  multiline?: boolean
  ariaLabel?: string
}) {
  const base =
    'w-full rounded-md bg-transparent px-1 -mx-1 outline-none placeholder:text-muted/70 hover:bg-surface-2/70 focus:bg-surface-2/70 transition-colors'
  if (multiline) {
    return (
      <textarea
        aria-label={ariaLabel ?? placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={1}
        className={cn(base, 'field-sizing-content min-h-[1.5em] resize-none py-0.5', className)}
      />
    )
  }
  return (
    <input
      aria-label={ariaLabel ?? placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(base, className)}
    />
  )
}

export function SettingsRow({
  label,
  children,
  className,
}: {
  label: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-2', className)}>
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

export function SettingsPanel({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 space-y-3 rounded-xl border border-border bg-surface-2/50 p-3 text-sm">
      {children}
    </div>
  )
}

export function ItemControls({
  index,
  count,
  onMove,
  onRemove,
  className,
}: {
  index: number
  count: number
  onMove: (from: number, to: number) => void
  onRemove: () => void
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Nach oben"
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
      >
        <ArrowUp />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Nach unten"
        disabled={index === count - 1}
        onClick={() => onMove(index, index + 1)}
      >
        <ArrowDown />
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label="Entfernen" onClick={onRemove}>
        <Trash2 />
      </Button>
    </div>
  )
}

export function AddItemButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button size="sm" variant="outline" onClick={onClick}>
      <Plus /> {children}
    </Button>
  )
}

export function listOps<T>(items: T[], set: (items: T[]) => void) {
  return {
    update: (index: number, patch: Partial<T>) =>
      set(items.map((item, i) => (i === index ? { ...item, ...patch } : item))),
    remove: (index: number) => set(items.filter((_, i) => i !== index)),
    move: (from: number, to: number) => {
      if (to < 0 || to >= items.length) return
      set(moveItem(items, from, to))
    },
    add: (item: T) => set([...items, item]),
  }
}

export function CheckboxList<T extends { id: string; label: string }>({
  items,
  selected,
  onChange,
  emptyLabel = 'Alle',
}: {
  items: T[]
  selected: string[]
  onChange: (ids: string[]) => void
  emptyLabel?: string
}) {
  const all = selected.length === 0
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange([])}
        className={cn(
          'rounded-full border px-2.5 py-1 text-xs font-medium',
          all
            ? 'border-ink bg-ink text-bg'
            : 'border-border bg-surface text-ink-2 hover:border-border-strong',
        )}
      >
        {emptyLabel}
      </button>
      {items.map((item) => {
        const active = selected.includes(item.id)
        return (
          <button
            key={item.id}
            type="button"
            onClick={() =>
              onChange(active ? selected.filter((id) => id !== item.id) : [...selected, item.id])
            }
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-medium',
              active
                ? 'border-ink bg-ink text-bg'
                : 'border-border bg-surface text-ink-2 hover:border-border-strong',
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
