import { Link } from 'react-router'
import { APP_NAME } from '@/lib/app'
import { cn } from '@/lib/utils'

/** Bildmarke: eine Werkbank, deren Tischplatte eine Farbpalette ist. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-8', className)} aria-hidden>
      <rect width="64" height="64" rx="14" className="fill-ink" />
      <rect x="9" y="17" width="10.25" height="10" rx="1.5" className="fill-bg" />
      <rect x="20.75" y="17" width="10.25" height="10" rx="1.5" className="fill-accent" />
      <rect x="32.5" y="17" width="10.25" height="10" rx="1.5" fill="#FFC72C" />
      <rect x="44.25" y="17" width="10.25" height="10" rx="1.5" fill="#3B6FD8" />
      <rect x="12" y="27" width="5" height="22" rx="1" className="fill-bg" />
      <rect x="47" y="27" width="5" height="22" rx="1" className="fill-bg" />
      <rect x="12" y="39" width="40" height="3.5" rx="1" className="fill-bg" opacity="0.55" />
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
