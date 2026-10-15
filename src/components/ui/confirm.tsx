import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Button } from './button'
import { Dialog } from './dialog'

interface ConfirmOptions {
  title: string
  description?: ReactNode
  confirmLabel?: string
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((next) => {
    setOptions(next)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setOptions(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={options !== null}
        onOpenChange={(open) => !open && close(false)}
        title={options?.title ?? ''}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              Abbrechen
            </Button>
            <Button variant={options?.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
              {options?.confirmLabel ?? 'Bestätigen'}
            </Button>
          </>
        }
      >
        {options?.description && <div className="text-sm text-ink-2">{options.description}</div>}
      </Dialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm braucht <ConfirmProvider>')
  return ctx
}
