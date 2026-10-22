import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { hasBrandAccess, type ScopeSelection } from '@/lib/connections'
import { supabase, type Enums, type Tables } from '@/lib/supabase'
import { check, unwrap } from './client'

export type McpGrant = Tables<'mcp_grants'>

export interface ScopeWorkspace {
  id: string
  name: string
  slug: string
  role: Enums<'workspace_role'>
}

export interface ScopeBrandRow {
  id: string
  name: string
  slug: string
  org_type: string
  workspace_id: string
  logo_path: string | null
}

export interface SelectableScope {
  workspaces: ScopeWorkspace[]
  /** Marken, die in einem der eigenen Workspaces liegen und zugänglich sind. */
  brands: ScopeBrandRow[]
  /** Marken aus fremden Workspaces, zu denen die Person direkt eingeladen wurde. */
  directBrands: Array<ScopeBrandRow & { workspace_name: string | null }>
}

const BRAND_COLUMNS = 'id, name, slug, org_type, workspace_id, logo_path, visibility'

/** Alles, was die Person einer App freigeben könnte. */
export function useSelectableScope(userId: string | undefined) {
  return useQuery({
    queryKey: ['selectable-scope', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<SelectableScope> => {
      const memberships = unwrap(
        await supabase
          .from('workspace_members')
          .select('role, workspace:workspaces(id, name, slug)')
          .eq('user_id', userId!),
      )
      const workspaces: ScopeWorkspace[] = memberships
        .filter((m) => m.workspace)
        .map((m) => ({ ...(m.workspace as { id: string; name: string; slug: string }), role: m.role }))
        .sort((a, b) => a.name.localeCompare(b.name, 'de'))
      const workspaceIds = workspaces.map((w) => w.id)
      const roleOf = new Map(workspaces.map((w) => [w.id, w.role]))

      const direct = unwrap(
        await supabase
          .from('brand_members')
          .select(`role, brand:brands(${BRAND_COLUMNS}, workspace:workspaces(name))`)
          .eq('user_id', userId!),
      )
      const directRole = new Map<string, Enums<'brand_role'>>()
      for (const row of direct) {
        if (row.brand) directRole.set((row.brand as { id: string }).id, row.role)
      }

      const inWorkspaces =
        workspaceIds.length > 0
          ? unwrap(await supabase.from('brands').select(BRAND_COLUMNS).in('workspace_id', workspaceIds))
          : []

      const brands = inWorkspaces
        .filter((b) =>
          hasBrandAccess({
            workspaceRole: roleOf.get(b.workspace_id) ?? null,
            brandRole: directRole.get(b.id) ?? null,
            visibility: b.visibility,
          }),
        )
        .map(({ visibility: _visibility, ...rest }) => rest)
        .sort((a, b) => a.name.localeCompare(b.name, 'de'))

      const directBrands = direct
        .map((row) => row.brand as unknown as (ScopeBrandRow & { workspace: { name: string } | null }) | null)
        .filter((b): b is NonNullable<typeof b> => Boolean(b) && !roleOf.has(b!.workspace_id))
        .map(({ workspace, ...rest }) => ({ ...rest, workspace_name: workspace?.name ?? null }))
        .sort((a, b) => a.name.localeCompare(b.name, 'de'))

      return { workspaces, brands, directBrands }
    },
  })
}

export function useMcpGrants(userId: string | undefined) {
  return useQuery({
    queryKey: ['mcp-grants', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<McpGrant[]> =>
      unwrap(await supabase.from('mcp_grants').select('*').order('created_at', { ascending: false })),
  })
}

export interface ConnectedApp {
  clientId: string
  name: string
  logoUri: string | null
  uri: string | null
  grantedAt: string | null
}

/** Von Supabase verwaltete Zustimmungen (Wer darf sich überhaupt als Person anmelden?). */
export function useConnectedApps(userId: string | undefined) {
  return useQuery({
    queryKey: ['oauth-grants', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<ConnectedApp[]> => {
      const { data, error } = await supabase.auth.oauth.listGrants()
      if (error) throw error
      return (data ?? []).map((g) => ({
        clientId: g.client.id,
        name: g.client.name,
        logoUri: g.client.logo_uri || null,
        uri: g.client.uri || null,
        grantedAt: g.granted_at,
      }))
    },
  })
}

export function useSaveMcpGrant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      clientId: string
      clientName: string
      selection: ScopeSelection
      readOnly: boolean
    }) =>
      unwrap(
        await supabase.rpc('save_mcp_grant', {
          p_client_id: input.clientId,
          p_client_name: input.clientName,
          p_workspaces: input.selection.workspaceIds,
          p_brands: input.selection.brandIds,
          p_read_only: input.readOnly,
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mcp-grants'] }),
  })
}

/** Trennt eine App: Auswahl löschen und die Anmeldung bei Supabase widerrufen. */
export function useDisconnectApp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (clientId: string) => {
      // Zuerst die Auswahl: Schon danach kann die App nichts mehr sehen.
      check(await supabase.from('mcp_grants').delete().eq('client_id', clientId))
      const { error } = await supabase.auth.oauth.revokeGrant({ clientId })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mcp-grants'] })
      void qc.invalidateQueries({ queryKey: ['oauth-grants'] })
    },
  })
}
