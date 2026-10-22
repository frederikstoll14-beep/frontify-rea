import { Building2, Search, Tag } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { SelectableScope } from '@/api/connections'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Badge, Card } from '@/components/ui/misc'
import {
  isBrandSelected,
  toggleBrand,
  toggleWorkspace,
  type ScopeBrand,
  type ScopeSelection,
} from '@/lib/connections'
import { ORG_TYPES, type OrgType } from '@/lib/templates/types'
import { cn } from '@/lib/utils'

const WORKSPACE_ROLE_LABEL = { owner: 'Owner', admin: 'Admin', member: 'Mitglied' } as const

function orgLabel(type: string): string {
  return ORG_TYPES[type as OrgType] ?? type
}

/** Alle Marken, die sich in diesem Dialog auswählen lassen (für Zähler und Normalisierung). */
export function allScopeBrands(scope: SelectableScope): ScopeBrand[] {
  return [...scope.brands, ...scope.directBrands].map((b) => ({
    id: b.id,
    name: b.name,
    workspace_id: b.workspace_id,
  }))
}

export function ScopePicker({
  scope,
  value,
  onChange,
  disabled,
}: {
  scope: SelectableScope
  value: ScopeSelection
  onChange: (next: ScopeSelection) => void
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const brands = useMemo(() => allScopeBrands(scope), [scope])
  const needle = query.trim().toLowerCase()
  const matches = (name: string) => !needle || name.toLowerCase().includes(needle)
  const showSearch = brands.length > 8

  return (
    <div className="space-y-3">
      {showSearch && (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Workspace oder Marke suchen …"
            className="pl-9"
            aria-label="Suchen"
          />
        </div>
      )}

      {scope.workspaces.map((ws) => {
        const wsBrands = scope.brands.filter((b) => b.workspace_id === ws.id)
        const wsSelected = value.workspaceIds.includes(ws.id)
        const visibleBrands = wsBrands.filter((b) => matches(b.name) || matches(ws.name))
        if (needle && !matches(ws.name) && visibleBrands.length === 0) return null
        return (
          <Card key={ws.id} className={cn('overflow-hidden', wsSelected && 'border-ink/60')}>
            <label
              className={cn(
                'flex cursor-pointer items-start gap-3 p-4',
                wsSelected ? 'bg-accent-soft/40' : 'hover:bg-surface-2/60',
              )}
            >
              <Checkbox
                className="mt-0.5"
                checked={wsSelected}
                disabled={disabled}
                onChange={(e) => onChange(toggleWorkspace(value, ws.id, e.target.checked, brands))}
                aria-label={`Ganzen Workspace ${ws.name} freigeben`}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <Building2 className="size-4 text-muted" aria-hidden />
                  <span className="font-semibold text-ink">{ws.name}</span>
                  <Badge>{WORKSPACE_ROLE_LABEL[ws.role]}</Badge>
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {wsSelected
                    ? 'Ganzer Workspace: alle Marken, auch neu angelegte'
                    : `${wsBrands.length} ${wsBrands.length === 1 ? 'Marke' : 'Marken'} – ganzen Workspace freigeben oder unten einzelne wählen`}
                </span>
              </span>
            </label>
            {visibleBrands.length > 0 && (
              <ul className="divide-y divide-border border-t border-border">
                {visibleBrands.map((brand) => (
                  <li key={brand.id}>
                    <label className="flex cursor-pointer items-center gap-3 py-2.5 pr-4 pl-11 hover:bg-surface-2/60">
                      <Checkbox
                        checked={isBrandSelected(value, brand)}
                        disabled={disabled || wsSelected}
                        onChange={(e) => onChange(toggleBrand(value, brand.id, e.target.checked))}
                        aria-label={`Marke ${brand.name} freigeben`}
                      />
                      <Tag className="size-4 text-muted" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{brand.name}</span>
                      <span className="shrink-0 text-xs text-muted">{orgLabel(brand.org_type)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )
      })}

      {scope.directBrands.filter((b) => matches(b.name)).length > 0 && (
        <Card className="overflow-hidden">
          <div className="p-4">
            <span className="font-semibold text-ink">Weitere Marken</span>
            <p className="mt-0.5 text-xs text-muted">Marken, zu denen du direkt eingeladen wurdest.</p>
          </div>
          <ul className="divide-y divide-border border-t border-border">
            {scope.directBrands
              .filter((b) => matches(b.name))
              .map((brand) => (
                <li key={brand.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-surface-2/60">
                    <Checkbox
                      checked={isBrandSelected(value, brand)}
                      disabled={disabled}
                      onChange={(e) => onChange(toggleBrand(value, brand.id, e.target.checked))}
                      aria-label={`Marke ${brand.name} freigeben`}
                    />
                    <Tag className="size-4 text-muted" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{brand.name}</span>
                    {brand.workspace_name && (
                      <span className="shrink-0 text-xs text-muted">{brand.workspace_name}</span>
                    )}
                  </label>
                </li>
              ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
