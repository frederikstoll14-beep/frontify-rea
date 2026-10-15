import { Popover as P, Switch as S, Tabs as T, Tooltip as TT } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn, initials } from '@/lib/utils'

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'
  className?: string
}) {
  const tones = {
    neutral: 'bg-surface-2 text-ink-2',
    accent: 'bg-accent-soft text-accent',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    info: 'bg-info-soft text-info',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const hue = hash % 360
  return (
    <span
      title={name}
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
        className,
      )}
      style={{ backgroundColor: `hsl(${hue} 45% 42%)` }}
    >
      {initials(name)}
    </span>
  )
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  id,
}: {
  checked: boolean
  onCheckedChange: (value: boolean) => void
  label?: ReactNode
  description?: ReactNode
  disabled?: boolean
  id?: string
}) {
  const control = (
    <S.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className="relative h-6 w-10 shrink-0 rounded-full bg-border-strong transition-colors data-[state=checked]:bg-ink disabled:opacity-50"
    >
      <S.Thumb className="block size-5 translate-x-0.5 rounded-full bg-surface shadow transition-transform data-[state=checked]:translate-x-[18px]" />
    </S.Root>
  )
  if (!label) return control
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-1">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
      {control}
    </label>
  )
}

export function Tabs({
  value,
  onValueChange,
  items,
  className,
}: {
  value: string
  onValueChange: (value: string) => void
  items: Array<{ value: string; label: ReactNode }>
  className?: string
}) {
  return (
    <T.Root value={value} onValueChange={onValueChange}>
      <T.List
        className={cn('-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1', className)}
        aria-label="Bereiche"
      >
        {items.map((item) => (
          <T.Trigger
            key={item.value}
            value={item.value}
            className="relative -mb-px shrink-0 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:text-ink data-[state=active]:border-ink data-[state=active]:text-ink"
          >
            {item.label}
          </T.Trigger>
        ))}
      </T.List>
    </T.Root>
  )
}

export function Segmented<V extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
}: {
  value: V
  onChange: (value: V) => void
  options: Array<{ value: V; label: ReactNode; title?: string }>
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div className={cn('inline-flex rounded-lg bg-surface-2 p-0.5', className)} role="radiogroup">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          title={option.title}
          onClick={() => onChange(option.value)}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-md font-medium text-muted transition-colors [&_svg]:size-4',
            size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-3 text-[13px]',
            value === option.value ? 'bg-surface text-ink shadow-sm' : 'hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <TT.Root delayDuration={300}>
      <TT.Trigger asChild>{children}</TT.Trigger>
      <TT.Portal>
        <TT.Content
          sideOffset={6}
          className="z-[60] rounded-md bg-ink px-2 py-1 text-xs font-medium text-bg shadow-card"
        >
          {content}
        </TT.Content>
      </TT.Portal>
    </TT.Root>
  )
}

export const TooltipProvider = TT.Provider

export function Popover({
  trigger,
  children,
  align = 'start',
  open,
  onOpenChange,
  className,
}: {
  trigger: ReactNode
  children: ReactNode
  align?: 'start' | 'center' | 'end'
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}) {
  return (
    <P.Root open={open} onOpenChange={onOpenChange}>
      <P.Trigger asChild>{trigger}</P.Trigger>
      <P.Portal>
        <P.Content
          align={align}
          sideOffset={6}
          collisionPadding={12}
          className={cn('z-50 w-72 rounded-xl border border-border bg-surface p-3 shadow-card', className)}
        >
          {children}
        </P.Content>
      </P.Portal>
    </P.Root>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-strong px-6 py-12 text-center',
        className,
      )}
    >
      {icon && <div className="mb-3 text-muted [&_svg]:size-8">{icon}</div>}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-2xl border border-border bg-surface', className)}>{children}</div>
}

export function SectionTitle({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-surface-2', className)} />
}
