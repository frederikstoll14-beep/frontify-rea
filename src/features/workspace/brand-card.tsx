import { ArrowRight, Globe, Lock } from 'lucide-react'
import { Link } from 'react-router'
import type { Brand } from '@/api/brands'
import { StorageImage } from '@/components/media/storage-image'
import { Badge } from '@/components/ui/misc'
import { readableTextColor, normalizeHex } from '@/lib/color'
import { ORG_TYPES, type OrgType } from '@/lib/templates/types'
import { initials, timeAgo } from '@/lib/utils'

export function BrandCard({ brand }: { brand: Brand }) {
  const primary = normalizeHex(brand.theme.primary ?? '') ?? '#15171F'
  const ink = readableTextColor(primary)
  return (
    <Link
      to={`/b/${brand.slug}`}
      className="group overflow-hidden rounded-2xl border border-border bg-surface transition-shadow hover:shadow-card"
    >
      <div
        className="relative flex aspect-[16/9] items-center justify-center overflow-hidden"
        style={{ backgroundColor: primary, color: ink }}
      >
        {brand.cover_path ? (
          <StorageImage path={brand.cover_path} alt="" className="absolute inset-0 h-full w-full" />
        ) : null}
        {brand.logo_path ? (
          <span className="relative flex size-20 items-center justify-center rounded-2xl bg-white/95 p-2 shadow-sm">
            <StorageImage path={brand.logo_path} alt={brand.name} fit="contain" className="h-full w-full" />
          </span>
        ) : (
          !brand.cover_path && (
            <span className="relative font-display text-4xl font-semibold opacity-90">
              {initials(brand.name)}
            </span>
          )
        )}
        <span className="absolute top-3 right-3 flex gap-1.5">
          {brand.is_public && (
            <Badge className="bg-white/90 text-[#15171F]">
              <Globe className="size-3" /> Öffentlich
            </Badge>
          )}
          {brand.visibility === 'private' && (
            <Badge className="bg-white/90 text-[#15171F]">
              <Lock className="size-3" /> Privat
            </Badge>
          )}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{brand.name}</p>
          <p className="truncate text-xs text-muted">
            {ORG_TYPES[brand.org_type as OrgType] ?? brand.org_type} · aktualisiert{' '}
            {timeAgo(brand.updated_at)}
          </p>
        </div>
        <ArrowRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  )
}
