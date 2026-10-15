import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, Columns2, Copy, GripVertical, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Block } from '@/api/guidelines'
import { Button } from '@/components/ui/button'
import { MenuContent, MenuItem, MenuLabel, MenuRoot, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { BLOCK_META, WIDTH_CLASSES, WIDTH_LABELS, type BlockWidth } from '@/lib/blocks/types'
import { cn } from '@/lib/utils'
import { BLOCKS } from '@/features/blocks/registry'

export function BlockFrame({
  block,
  index,
  count,
  selected,
  onSelect,
  onMove,
  onDuplicate,
  onRemove,
  onWidth,
  onInsertAfter,
  children,
}: {
  block: Block
  index: number
  count: number
  selected: boolean
  onSelect: () => void
  onMove: (from: number, to: number) => void
  onDuplicate: () => void
  onRemove: () => void
  onWidth: (width: BlockWidth) => void
  onInsertAfter: () => void
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({
      id: block.id,
    })
  const Icon = BLOCKS[block.type].icon
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(WIDTH_CLASSES[block.width], 'group/block relative', isDragging && 'z-20 opacity-80')}
      data-block-id={block.id}
    >
      <div
        className={cn(
          'relative -mx-2 rounded-2xl px-2 pt-9 pb-2 transition-colors sm:-mx-3 sm:px-3',
          selected ? 'bg-surface ring-2 ring-accent/60' : 'ring-1 ring-transparent hover:ring-border-strong',
        )}
        onClickCapture={() => {
          if (!selected) onSelect()
        }}
      >
        <div
          className={cn(
            'absolute top-1.5 right-1.5 left-1.5 flex items-center justify-between gap-2 transition-opacity',
            selected
              ? 'opacity-100'
              : 'opacity-0 group-focus-within/block:opacity-100 group-hover/block:opacity-100',
          )}
        >
          <div className="flex min-w-0 items-center gap-1">
            <button
              ref={setActivatorNodeRef}
              type="button"
              aria-label="Zum Verschieben ziehen"
              className="flex size-7 cursor-grab touch-none items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-ink active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-4" />
            </button>
            <span className="flex min-w-0 items-center gap-1.5 truncate text-xs font-medium text-muted">
              <Icon className="size-3.5 shrink-0" /> {BLOCK_META[block.type].label}
              {block.width !== 'full' && <span className="text-muted/70">· {WIDTH_LABELS[block.width]}</span>}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Baustein darunter einfügen"
              onClick={onInsertAfter}
            >
              <Plus />
            </Button>
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
            <MenuRoot>
              <MenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label="Weitere Aktionen">
                  <MoreHorizontal />
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuLabel>Breite</MenuLabel>
                {(Object.keys(WIDTH_LABELS) as BlockWidth[]).map((w) => (
                  <MenuItem key={w} onSelect={() => onWidth(w)} icon={<Columns2 />}>
                    {WIDTH_LABELS[w]} {block.width === w && '✓'}
                  </MenuItem>
                ))}
                <MenuSeparator />
                <MenuItem icon={<Plus />} onSelect={onInsertAfter}>
                  Baustein darunter einfügen
                </MenuItem>
                <MenuItem icon={<Copy />} onSelect={onDuplicate}>
                  Duplizieren
                </MenuItem>
                <MenuItem icon={<Trash2 />} danger onSelect={onRemove}>
                  Löschen
                </MenuItem>
              </MenuContent>
            </MenuRoot>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
