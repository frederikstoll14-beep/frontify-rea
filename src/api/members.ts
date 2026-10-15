import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, type Enums, type Tables } from '@/lib/supabase'
import { check, keys, unwrap } from './client'
import type { MemberRow } from './workspaces'

export type Invitation = Tables<'invitations'>

export function useBrandMembers(brandId: string | undefined) {
  return useQuery({
    queryKey: keys.brandMembers(brandId ?? ''),
    enabled: Boolean(brandId),
    queryFn: async (): Promise<MemberRow[]> =>
      unwrap(
        await supabase
          .from('brand_members')
          .select('user_id, role, created_at, profile:profiles(id, email, full_name)')
          .eq('brand_id', brandId!)
          .order('created_at'),
      ),
  })
}

export function useSetBrandRole(brandId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { userId: string; role: Enums<'brand_role'> }) =>
      check(
        await supabase
          .from('brand_members')
          .update({ role: input.role })
          .eq('brand_id', brandId)
          .eq('user_id', input.userId),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.brandMembers(brandId) }),
  })
}

export function useRemoveBrandMember(brandId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) =>
      check(await supabase.from('brand_members').delete().eq('brand_id', brandId).eq('user_id', userId)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.brandMembers(brandId) }),
  })
}

export function useInvitations(workspaceId: string | undefined, brandId?: string) {
  return useQuery({
    queryKey: [...keys.invitations(workspaceId ?? ''), brandId ?? 'all'],
    enabled: Boolean(workspaceId),
    queryFn: async (): Promise<Invitation[]> => {
      let query = supabase
        .from('invitations')
        .select('*')
        .eq('workspace_id', workspaceId!)
        .eq('revoked', false)
        .order('created_at', { ascending: false })
      query = brandId ? query.eq('brand_id', brandId) : query.is('brand_id', null)
      return unwrap(await query)
    },
  })
}

export interface InviteInput {
  workspaceId: string
  brandId?: string | null
  email?: string | null
  workspaceRole?: Enums<'workspace_role'>
  brandRole?: Enums<'brand_role'> | null
  maxUses?: number | null
  expiresInDays?: number
}

/** Fügt bestehende Konten direkt hinzu, sonst wird eine Einladung erzeugt. */
export function useInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (
      input: InviteInput,
    ): Promise<{ status: 'added' | 'invited'; invitation?: Invitation }> => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('Nicht angemeldet')
      const email = input.email?.trim().toLowerCase() || null
      if (email) {
        const result = unwrap(
          await supabase.rpc('add_member_by_email', {
            p_workspace: input.workspaceId,
            p_email: email,
            p_workspace_role: input.workspaceRole ?? 'member',
            p_brand: input.brandId ?? undefined,
            p_brand_role: input.brandId ? (input.brandRole ?? 'viewer') : undefined,
          }),
        )
        if (result === 'added') return { status: 'added' }
      }
      const expires = new Date(Date.now() + (input.expiresInDays ?? 30) * 86_400_000).toISOString()
      const invitation = unwrap(
        await supabase
          .from('invitations')
          .insert({
            workspace_id: input.workspaceId,
            brand_id: input.brandId ?? null,
            brand_role: input.brandId ? (input.brandRole ?? 'viewer') : null,
            workspace_role: input.workspaceRole ?? 'member',
            email,
            max_uses: email ? 1 : (input.maxUses ?? null),
            expires_at: expires,
            created_by: auth.user.id,
          })
          .select()
          .single(),
      )
      return { status: 'invited', invitation }
    },
    onSuccess: (_result, input) => {
      qc.invalidateQueries({ queryKey: keys.invitations(input.workspaceId) })
      qc.invalidateQueries({ queryKey: keys.workspaceMembers(input.workspaceId) })
      if (input.brandId) qc.invalidateQueries({ queryKey: keys.brandMembers(input.brandId) })
    },
  })
}

export function useRevokeInvitation(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      check(await supabase.from('invitations').update({ revoked: true }).eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.invitations(workspaceId) }),
  })
}

export function inviteUrl(token: string): string {
  return `${window.location.origin}/einladung/${token}`
}

export function useInvitationPreview(token: string | undefined) {
  return useQuery({
    queryKey: ['invitation-preview', token],
    enabled: Boolean(token),
    queryFn: async () => {
      const rows = unwrap(await supabase.rpc('invitation_preview', { p_token: token! }))
      return rows[0] ?? null
    },
  })
}

export function useAcceptInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (token: string) => {
      const rows = unwrap(await supabase.rpc('accept_invitation', { p_token: token }))
      return rows[0]
    },
    onSuccess: () => qc.invalidateQueries(),
  })
}
