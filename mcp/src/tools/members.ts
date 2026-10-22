import { z } from 'zod'
import { affected, rows, row } from '../db'
import { ToolError } from '../errors'
import { defineTool } from '../tool'

const BRAND_ROLES = ['admin', 'editor', 'viewer'] as const

async function findBrandMember(ctx: import('../context').Ctx, brandId: string, ref: string) {
  const members = rows(
    await ctx.sb
      .from('brand_members')
      .select('user_id, profile:profiles(email, full_name)')
      .eq('brand_id', brandId),
  )
  const needle = ref.trim().toLowerCase()
  const found = members.find((m) => m.user_id === ref || m.profile?.email?.toLowerCase() === needle)
  if (!found)
    throw new ToolError(
      `Mitglied „${ref}“ nicht gefunden.`,
      'Nimm die E-Mail-Adresse aus list_brand_members.',
    )
  return { user_id: found.user_id, email: found.profile?.email ?? null }
}

export const memberTools = [
  defineTool({
    name: 'list_brand_members',
    title: 'Mitglieder einer Marke',
    description:
      'Listet, wer Zugriff auf eine Marke hat (direkte Marken-Mitglieder mit Rolle admin/editor/viewer). Workspace-Owner und -Admins haben zusätzlich automatisch Admin-Rechte.',
    input: { brand: z.string().optional() },
    kind: 'read',
    async run({ brand: ref }, ctx) {
      const brand = await ctx.brand(ref)
      const data = rows(
        await ctx.sb
          .from('brand_members')
          .select('user_id, role, created_at, profile:profiles(full_name, email)')
          .eq('brand_id', brand.id)
          .order('created_at'),
      )
      return {
        summary: `${data.length} direkte(s) Mitglied(er) von „${brand.name}“.`,
        data: data.map((m) => ({
          user_id: m.user_id,
          name: m.profile?.full_name ?? null,
          email: m.profile?.email ?? null,
          role: m.role,
          since: m.created_at,
        })),
      }
    },
  }),

  defineTool({
    name: 'set_brand_member_role',
    title: 'Rolle in einer Marke ändern',
    description:
      'Ändert die Rolle eines Marken-Mitglieds (admin, editor, viewer). Erfordert Admin-Rolle in der Marke.',
    input: {
      brand: z.string().optional(),
      user: z.string().describe('E-Mail-Adresse oder user_id'),
      role: z.enum(BRAND_ROLES),
    },
    kind: 'write',
    idempotent: true,
    async run({ brand: ref, user, role }, ctx) {
      const brand = await ctx.adminBrand(ref)
      const member = await findBrandMember(ctx, brand.id, user)
      affected(
        await ctx.sb
          .from('brand_members')
          .update({ role })
          .eq('brand_id', brand.id)
          .eq('user_id', member.user_id)
          .select('user_id'),
        'Mitglied',
      )
      return { summary: `${member.email ?? member.user_id} ist jetzt ${role} in „${brand.name}“.` }
    },
  }),

  defineTool({
    name: 'remove_brand_member',
    title: 'Mitglied aus Marke entfernen',
    description: 'Entfernt eine Person aus einer Marke. Erfordert Admin-Rolle in der Marke.',
    input: { brand: z.string().optional(), user: z.string().describe('E-Mail-Adresse oder user_id') },
    kind: 'destructive',
    async run({ brand: ref, user }, ctx) {
      const brand = await ctx.adminBrand(ref)
      const member = await findBrandMember(ctx, brand.id, user)
      affected(
        await ctx.sb
          .from('brand_members')
          .delete()
          .eq('brand_id', brand.id)
          .eq('user_id', member.user_id)
          .select('user_id'),
        'Mitglied',
      )
      return { summary: `${member.email ?? member.user_id} wurde aus „${brand.name}“ entfernt.` }
    },
  }),

  defineTool({
    name: 'invite_member',
    title: 'Person einladen',
    description:
      'Lädt eine Person zu einer Marke (mit brand) oder zu einem Workspace (ohne brand) ein. Mit E-Mail: Hat die Person schon ein Konto, wird sie sofort hinzugefügt, sonst entsteht eine Einladung für genau diese Adresse. Ohne E-Mail entsteht ein Gruppen-Link (z. B. für einen Kurs). Es werden keine E-Mails verschickt – den Link bitte selbst weitergeben.',
    input: {
      email: z.string().email().optional().describe('E-Mail der Person; weglassen für einen Gruppen-Link'),
      brand: z.string().optional().describe('Marke, wenn nur zu dieser Marke eingeladen werden soll'),
      workspace: z
        .string()
        .optional()
        .describe('Workspace (nur ohne brand nötig, wenn mehrere freigegeben sind)'),
      role: z
        .enum(['admin', 'editor', 'viewer', 'member'])
        .default('viewer')
        .describe('Marke: admin | editor | viewer. Workspace: admin | member'),
      max_uses: z
        .number()
        .int()
        .min(1)
        .max(10000)
        .optional()
        .describe('Gruppen-Link: wie oft einlösbar (Standard unbegrenzt)'),
      expires_in_days: z
        .number()
        .int()
        .min(1)
        .max(365)
        .optional()
        .describe('Gültigkeit in Tagen (Standard 30)'),
    },
    kind: 'write',
    async run({ email, brand: brandRef, workspace: wsRef, role, max_uses, expires_in_days }, ctx) {
      let workspaceId: string
      let brandId: string | null = null
      let target: string
      if (brandRef) {
        const brand = await ctx.adminBrand(brandRef)
        if (role === 'member') throw new ToolError('Für Marken gilt: admin, editor oder viewer.')
        workspaceId = brand.workspace_id
        brandId = brand.id
        target = brand.name
      } else {
        const ws = await ctx.adminWorkspace(wsRef)
        if (role !== 'admin' && role !== 'member') {
          throw new ToolError(
            'Für Workspaces gilt: admin oder member. (Für eine Marke zusätzlich brand angeben.)',
          )
        }
        workspaceId = ws.id
        target = ws.name
      }
      const cleanEmail = email?.trim().toLowerCase() || null
      if (cleanEmail) {
        const result = row(
          await ctx.sb.rpc('add_member_by_email', {
            p_workspace: workspaceId,
            p_email: cleanEmail,
            p_workspace_role: brandId ? 'member' : (role as 'admin' | 'member'),
            p_brand: brandId ?? undefined,
            p_brand_role: brandId ? (role as 'admin' | 'editor' | 'viewer') : undefined,
          }),
        )
        if (result === 'added') {
          return { summary: `${cleanEmail} wurde zu „${target}“ hinzugefügt (Rolle ${role}).` }
        }
      }
      const expires = new Date(Date.now() + (expires_in_days ?? 30) * 86_400_000).toISOString()
      const invitation = row(
        await ctx.sb
          .from('invitations')
          .insert({
            workspace_id: workspaceId,
            brand_id: brandId,
            brand_role: brandId ? (role as 'admin' | 'editor' | 'viewer') : null,
            workspace_role: brandId ? 'member' : (role as 'admin' | 'member'),
            email: cleanEmail,
            max_uses: cleanEmail ? 1 : (max_uses ?? null),
            expires_at: expires,
            created_by: ctx.principal.userId,
          })
          .select('id, token, email, expires_at, max_uses')
          .single(),
      )
      const link = ctx.link(`/einladung/${invitation.token}`)
      return {
        summary: cleanEmail
          ? `Einladung für ${cleanEmail} zu „${target}“ erstellt (noch kein Konto vorhanden). Link weitergeben: ${link ?? invitation.token}`
          : `Gruppen-Link für „${target}“ erstellt: ${link ?? invitation.token}`,
        data: {
          invitation_id: invitation.id,
          link,
          token: link ? undefined : invitation.token,
          expires_at: invitation.expires_at,
          max_uses: invitation.max_uses,
        },
      }
    },
  }),

  defineTool({
    name: 'list_invitations',
    title: 'Offene Einladungen',
    description:
      'Listet offene Einladungen/Gruppen-Links einer Marke (mit brand) oder eines Workspaces (ohne brand), jeweils mit Link.',
    input: { brand: z.string().optional(), workspace: z.string().optional() },
    kind: 'read',
    async run({ brand: brandRef, workspace: wsRef }, ctx) {
      let workspaceId: string
      let brandId: string | null = null
      if (brandRef) {
        const brand = await ctx.brand(brandRef)
        workspaceId = brand.workspace_id
        brandId = brand.id
      } else {
        workspaceId = (await ctx.workspace(wsRef)).id
      }
      let query = ctx.sb
        .from('invitations')
        .select('id, token, email, workspace_role, brand_role, max_uses, use_count, expires_at, created_at')
        .eq('workspace_id', workspaceId)
        .eq('revoked', false)
        .order('created_at', { ascending: false })
      query = brandId ? query.eq('brand_id', brandId) : query.is('brand_id', null)
      const data = rows(await query)
      return {
        summary: `${data.length} offene Einladung(en).`,
        data: data.map((i) => ({
          id: i.id,
          email: i.email,
          role: brandId ? i.brand_role : i.workspace_role,
          uses: `${i.use_count}${i.max_uses ? `/${i.max_uses}` : ''}`,
          expires_at: i.expires_at,
          expired: Date.parse(i.expires_at) < Date.now(),
          link: ctx.link(`/einladung/${i.token}`),
        })),
      }
    },
  }),

  defineTool({
    name: 'revoke_invitation',
    title: 'Einladung widerrufen',
    description:
      'Widerruft eine Einladung bzw. einen Gruppen-Link (ID aus list_invitations). Der Link funktioniert danach nicht mehr.',
    input: { invitation_id: z.string() },
    kind: 'destructive',
    idempotent: true,
    async run({ invitation_id }, ctx) {
      await ctx.assertWriteAllowed()
      affected(
        await ctx.sb.from('invitations').update({ revoked: true }).eq('id', invitation_id).select('id'),
        'Einladung',
      )
      return { summary: 'Einladung widerrufen.' }
    },
  }),
]
