/**
 * Logik rund um verbundene Apps (MCP-Konnektor, z. B. Claude):
 * Auswahl von Workspaces und Marken, Einschätzung der App anhand der Weiterleitungs-Adresse.
 */

export interface ScopeBrand {
  id: string
  name: string
  workspace_id: string
}

export interface ScopeSelection {
  /** Ganze Workspaces: enthalten alle Marken, auch später angelegte. */
  workspaceIds: string[]
  /** Einzelne Marken zusätzlich zu den Workspaces. */
  brandIds: string[]
}

export const EMPTY_SELECTION: ScopeSelection = { workspaceIds: [], brandIds: [] }

export function isEmptySelection(selection: ScopeSelection): boolean {
  return selection.workspaceIds.length === 0 && selection.brandIds.length === 0
}

/** Einzelmarken, die schon über einen ausgewählten Workspace abgedeckt sind, werden entfernt. */
export function normalizeSelection(selection: ScopeSelection, brands: ScopeBrand[]): ScopeSelection {
  const workspaces = new Set(selection.workspaceIds)
  const workspaceOf = new Map(brands.map((b) => [b.id, b.workspace_id]))
  return {
    workspaceIds: [...workspaces],
    brandIds: [...new Set(selection.brandIds)].filter((id) => {
      const ws = workspaceOf.get(id)
      return !(ws && workspaces.has(ws))
    }),
  }
}

export function toggleWorkspace(
  selection: ScopeSelection,
  workspaceId: string,
  on: boolean,
  brands: ScopeBrand[],
): ScopeSelection {
  const workspaceIds = on
    ? [...new Set([...selection.workspaceIds, workspaceId])]
    : selection.workspaceIds.filter((id) => id !== workspaceId)
  return normalizeSelection({ workspaceIds, brandIds: selection.brandIds }, brands)
}

export function toggleBrand(selection: ScopeSelection, brandId: string, on: boolean): ScopeSelection {
  const brandIds = on
    ? [...new Set([...selection.brandIds, brandId])]
    : selection.brandIds.filter((id) => id !== brandId)
  return { workspaceIds: selection.workspaceIds, brandIds }
}

export function isBrandSelected(selection: ScopeSelection, brand: ScopeBrand): boolean {
  return selection.workspaceIds.includes(brand.workspace_id) || selection.brandIds.includes(brand.id)
}

/** Anzahl der Marken, auf die die Auswahl aktuell Zugriff gibt. */
export function countAccessibleBrands(selection: ScopeSelection, brands: ScopeBrand[]): number {
  return brands.filter((b) => isBrandSelected(selection, b)).length
}

export type AppTrust = 'known' | 'local' | 'unknown'

export interface AppAssessment {
  trust: AppTrust
  /** Hostname (oder Schema) der Weiterleitung, wohin der Zugriff nach der Zustimmung geht. */
  destination: string
}

const KNOWN_HOSTS = ['claude.ai', 'claude.com', 'chatgpt.com']

/** Schätzt anhand der Weiterleitungs-Adresse ein, ob die App bekannt ist. */
export function assessRedirectUri(redirectUri: string): AppAssessment {
  let url: URL
  try {
    url = new URL(redirectUri)
  } catch {
    return { trust: 'unknown', destination: redirectUri.slice(0, 80) }
  }
  const host = url.hostname.toLowerCase()
  if (url.protocol === 'https:' && KNOWN_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
    return { trust: 'known', destination: host }
  }
  if (
    (url.protocol === 'http:' && (host === 'localhost' || host === '127.0.0.1' || host === '[::1]')) ||
    url.protocol === 'vscode:' ||
    url.protocol === 'cursor:'
  ) {
    return { trust: 'local', destination: host || url.protocol.replace(':', '') }
  }
  return { trust: 'unknown', destination: host || url.protocol.replace(':', '') }
}

export interface AccessInput {
  workspaceRole: 'owner' | 'admin' | 'member' | null
  /** Direkte Marken-Mitgliedschaft */
  brandRole: 'admin' | 'editor' | 'viewer' | null
  visibility: 'private' | 'workspace'
}

/**
 * Hat die Person Zugriff auf die Marke? Spiegelt public.brand_role_of() für den Fall
 * „angemeldet, nicht öffentlich“. Nur für die Anzeige; durchgesetzt wird in der Datenbank.
 */
export function hasBrandAccess(input: AccessInput): boolean {
  if (input.workspaceRole === 'owner' || input.workspaceRole === 'admin') return true
  if (input.brandRole) return true
  return input.workspaceRole === 'member' && input.visibility === 'workspace'
}

export function describeSelection(
  selection: ScopeSelection,
  counts: { workspaces: number; brands: number },
): string {
  if (isEmptySelection(selection)) return 'Nichts ausgewählt'
  const parts: string[] = []
  if (selection.workspaceIds.length > 0) {
    parts.push(
      selection.workspaceIds.length === 1
        ? '1 ganzer Workspace'
        : `${selection.workspaceIds.length} ganze Workspaces`,
    )
  }
  if (selection.brandIds.length > 0) {
    parts.push(
      selection.brandIds.length === 1 ? '1 einzelne Marke' : `${selection.brandIds.length} einzelne Marken`,
    )
  }
  const total = counts.brands
  return `${parts.join(' + ')} (${total} ${total === 1 ? 'Marke' : 'Marken'} erreichbar)`
}
