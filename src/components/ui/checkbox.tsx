import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const Checkbox = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  function Checkbox({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          'size-[18px] shrink-0 cursor-pointer rounded border-border-strong accent-ink disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
        {...props}
      />
    )
  },
)
