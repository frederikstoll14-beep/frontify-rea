import { X } from 'lucide-react'
import { Dialog as D } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  trigger,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  trigger?: ReactNode
}) {
  const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size]
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <D.Trigger asChild>{trigger}</D.Trigger>}
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-overlay" />
        <D.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl bg-surface shadow-card outline-none',
            'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
            width,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <D.Title className="font-display text-xl font-semibold text-ink">{title}</D.Title>
              {description ? (
                <D.Description className="mt-1 text-sm text-muted">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">
                  {typeof title === 'string' ? title : 'Dialog'}
                </D.Description>
              )}
            </div>
            <D.Close
              className="-mr-1 rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
              aria-label="Schließen"
            >
              <X className="size-5" />
            </D.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}

export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  side = 'right',
  width = 'max-w-md',
  footer,
  description,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  children: ReactNode
  side?: 'right' | 'left'
  width?: string
  footer?: ReactNode
  description?: ReactNode
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-overlay" />
        <D.Content
          className={cn(
            'fixed inset-y-0 z-50 flex w-full flex-col bg-surface shadow-card outline-none',
            side === 'right' ? 'right-0' : 'left-0',
            width,
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <D.Title className="min-w-0 truncate text-base font-semibold text-ink">{title}</D.Title>
            <D.Description className="sr-only">
              {description ?? (typeof title === 'string' ? title : 'Panel')}
            </D.Description>
            <D.Close
              className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
              aria-label="Schließen"
            >
              <X className="size-5" />
            </D.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer && <div className="border-t border-border px-5 py-3">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
