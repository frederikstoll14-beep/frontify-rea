import { Link } from 'react-router'
import { APP_NAME } from '@/lib/app'
import { cn } from '@/lib/utils'

/** Bildmarke: drei Ebenen (Markenkern, Gestaltung, Kanäle) liegen auf der Werkbank. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-8', className)} aria-hidden>
      <rect width="64" height="64" rx="14" className="fill-ink" />
      <path d="M14 27 L32 21 L50 27 L32 33 Z" className="fill-bg" opacity="0.45" />
      <path d="M14 20.5 L32 14.5 L50 20.5 L32 26.5 Z" className="fill-bg" opacity="0.75" />
      <path d="M14 14 L32 8 L50 14 L32 20 Z" className="fill-accent" />
      <rect x="8" y="38" width="48" height="5" rx="1.5" className="fill-bg" />
      <rect x="12" y="43" width="4.5" height="11" rx="1" className="fill-bg" />
      <rect x="47.5" y="43" width="4.5" height="11" rx="1" className="fill-bg" />
    </svg>
  )
}

export function AppLogo({ to = '/', className }: { to?: string; className?: string }) {
  return (
    <Link to={to} className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="font-display text-lg font-semibold tracking-tight text-ink">{APP_NAME}</span>
    </Link>
  )
}
