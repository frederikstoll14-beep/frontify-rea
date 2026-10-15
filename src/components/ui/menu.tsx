import { DropdownMenu as M } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const MenuRoot = M.Root
export const MenuTrigger = M.Trigger

export function MenuContent({
  children,
  align = 'end',
  className,
}: {
  children: ReactNode
  align?: 'start' | 'end' | 'center'
  className?: string
}) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={6}
        collisionPadding={12}
        className={cn(
          'z-50 min-w-48 overflow-hidden rounded-xl border border-border bg-surface p-1 text-sm shadow-card',
          className,
        )}
      >
        {children}
      </M.Content>
    </M.Portal>
  )
}

export function MenuItem({
  children,
  onSelect,
  icon,
  danger,
  disabled,
}: {
  children: ReactNode
  onSelect?: () => void
  icon?: ReactNode
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <M.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted',
        danger && 'text-danger [&_svg]:text-danger',
      )}
    >
      {icon}
      <span className="flex-1">{children}</span>
    </M.Item>
  )
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <M.Label className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{children}</M.Label>
}

export function MenuSeparator() {
  return <M.Separator className="my-1 h-px bg-border" />
}

export const MenuSub = M.Sub

export function MenuSubTrigger({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <M.SubTrigger className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 outline-none select-none data-[highlighted]:bg-surface-2 data-[state=open]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted">
      {icon}
      <span className="flex-1">{children}</span>
      <span aria-hidden className="text-muted">›</span>
    </M.SubTrigger>
  )
}

export function MenuSubContent({ children }: { children: ReactNode }) {
  return (
    <M.Portal>
      <M.SubContent
        sideOffset={4}
        collisionPadding={12}
        className="z-50 max-h-80 min-w-44 overflow-y-auto rounded-xl border border-border bg-surface p-1 text-sm shadow-card"
      >
        {children}
      </M.SubContent>
    </M.Portal>
  )
}
