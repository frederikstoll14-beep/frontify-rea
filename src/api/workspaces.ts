import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, type Enums, type Tables } from '@/lib/supabase'
import { removeFolder } from './brands'
import { check, keys, unwrap, unwrapMaybe } from './client'

export type Workspace = Tables<'workspaces'>
export type WorkspaceRole = Enums<'workspace_role'>

export interface WorkspaceWithRole extends Workspace {
  role: WorkspaceRole
  brand_count: number
}

export function useWorkspaces(userId: string | undefined) {
  return useQuery({
    queryKey: [...keys.workspaces, userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<WorkspaceWithRole[]> => {
      const rows = unwrap(
        await supabase
          .from('workspace_members')
          .select('role, workspace:workspaces(*, brands(count))')
          .eq('user_id', userId!)
          .order('created_at', { ascending: true }),
      )
      return rows
        .filter((r) => r.workspace)
        .map((r) => {
          const { brands, ...ws } = r.workspace as Workspace & { brands: Array<{ count: number }> }
          return { ...ws, role: r.role, brand_count: brands?.[0]?.count ?? 0 }
        })
    },
  })
}

export function useWorkspace(slug: string | undefined) {
  return useQuery({
    queryKey: keys.workspace(slug ?? ''),
    enabled: Boolean(slug),
    queryFn: async () => {
      const ws = unwrapMaybe(await supabase.from('workspaces').select('*').eq('slug', slug!).maybeSingle())
      if (!ws) return null
      const role = unwrapMaybe(await supabase.rpc('workspace_role_of', { p_workspace: ws.id }))
      return { ...ws, role: role as WorkspaceRole | null }
    },
  })
}

export function useCreateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; description?: string }) =>
      unwrap(await supabase.rpc('create_workspace', { p_name: input.name, p_description: input.description ?? '' })),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.workspaces }),
  })
}

export function useUpdateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; name: string; description: string }) =>
      unwrap(
        await supabase
          .from('workspaces')
          .update({ name: input.name, description: input.description })
          .eq('id', input.id)
          .select()
          .single(),
      ),
    onSuccess: (ws) => {
      qc.invalidateQueries({ queryKey: keys.workspaces })
      qc.invalidateQueries({ queryKey: keys.workspace(ws.slug) })
    },
  })
}

export function useDeleteWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; brandIds: string[] }) => {
      for (const brandId of input.brandIds) await removeFolder(brandId)
      check(await supabase.from('workspaces').delete().eq('id', input.id))
    },
    onSuccess: () => qc.invalidateQueries(),
  })
}

export function useLeaveWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => check(await supabase.rpc('leave_workspace', { p_workspace: id })),
    onSuccess: () => qc.invalidateQueries(),
  })
}

export interface MemberRow {
  user_id: string
  role: string
  created_at: string
  profile: Pick<Tables<'profiles'>, 'id' | 'email' | 'full_name'> | null
}

export function useWorkspaceMembers(workspaceId: string | undefined) {
  return useQuery({
    queryKey: keys.workspaceMembers(workspaceId ?? ''),
    enabled: Boolean(workspaceId),
    queryFn: async (): Promise<MemberRow[]> =>
      unwrap(
        await supabase
          .from('workspace_members')
          .select('user_id, role, created_at, profile:profiles(id, email, full_name)')
          .eq('workspace_id', workspaceId!)
          .order('created_at'),
      ),
  })
}

export function useSetWorkspaceRole(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { userId: string; role: WorkspaceRole }) =>
      check(
        await supabase
          .from('workspace_members')
          .update({ role: input.role })
          .eq('workspace_id', workspaceId)
          .eq('user_id', input.userId),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.workspaceMembers(workspaceId) }),
  })
}

export function useRemoveWorkspaceMember(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) =>
      check(await supabase.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', userId)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.workspaceMembers(workspaceId) }),
  })
}
