import { Link } from 'react-router'
import { APP_NAME } from '@/lib/app'
import { cn } from '@/lib/utils'

export function CompassMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-8', className)} aria-hidden>
      <rect width="64" height="64" rx="14" className="fill-ink" />
      <path d="M32 12 L40 32 L32 52 L24 32 Z" className="fill-bg" />
      <path d="M32 12 L40 32 L32 32 Z" className="fill-accent" />
      <circle cx="32" cy="32" r="3" className="fill-ink" />
    </svg>
  )
}

export function AppLogo({ to = '/', className }: { to?: string; className?: string }) {
  return (
    <Link to={to} className={cn('flex items-center gap-2.5', className)}>
      <CompassMark />
      <span className="font-display text-lg font-semibold tracking-tight text-ink">{APP_NAME}</span>
    </Link>
  )
}
