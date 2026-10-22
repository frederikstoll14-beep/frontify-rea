import { z } from 'zod'
import { affected, defined, requireChange, rows, row } from '../db'
import { ToolError } from '../errors'
import { removeBrandFiles } from '../storage-ops'
import { defineTool } from '../tool'

const WORKSPACE_ROLES = ['owner', 'admin', 'member'] as const

export const workspaceTools = [
  defineTool({
    name: 'create_workspace',
    title: 'Workspace anlegen',
    description:
      'Legt einen neuen Workspace an (z. B. einen Kurs oder ein Team). Du wirst Owner. Der Workspace gehört automatisch zur Freigabe dieser Verbindung.',
    input: {
      name: z.string().min(1).max(120),
      description: z.string().max(1000).optional(),
    },
    kind: 'write',
    async run({ name, description }, ctx) {
      await ctx.assertWriteAllowed()
      const ws = row(
        await ctx.sb.rpc('create_workspace', { p_name: name.trim(), p_description: description ?? '' }),
      )
      ctx.invalidateScope()
      return {
        summary: `Workspace „${ws.name}“ angelegt.`,
        data: { id: ws.id, name: ws.name, slug: ws.slug, url: ctx.link(`/w/${ws.slug}`) },
      }
    },
  }),

  defineTool({
    name: 'update_workspace',
    title: 'Workspace bearbeiten',
    description: 'Ändert Name oder Beschreibung eines Workspaces (Rolle Owner oder Admin).',
    input: {
      workspace: z.string().optional().describe('Workspace (Name, Kurz-URL oder ID)'),
      name: z.string().min(1).max(120).optional(),
      description: z.string().max(1000).optional(),
    },
    kind: 'write',
    idempotent: true,
    async run({ workspace: ref, name, description }, ctx) {
      const ws = await ctx.adminWorkspace(ref)
      const patch = defined({ name: name?.trim(), description })
      requireChange(patch)
      const [updated] = affected(
        await ctx.sb.from('workspaces').update(patch).eq('id', ws.id).select('id, name, slug, description'),
        'Workspace',
      )
      ctx.invalidateScope()
      return { summary: `Workspace „${updated.name}“ gespeichert.`, data: updated }
    },
  }),

  defineTool({
    name: 'delete_workspace',
    title: 'Workspace löschen',
    description:
      'Löscht einen Workspace samt ALLER Marken, Texte und Dateien darin. Unwiderruflich. Nur Owner. Zur Sicherheit muss der Name des Workspaces exakt als confirm_name wiederholt werden.',
    input: {
      workspace: z.string().describe('Workspace (Name, Kurz-URL oder ID)'),
      confirm_name: z.string().describe('Exakter Name des Workspaces zur Bestätigung'),
    },
    kind: 'destructive',
    async run({ workspace: ref, confirm_name }, ctx) {
      const ws = await ctx.ownerWorkspace(ref)
      if (confirm_name.trim() !== ws.name) {
        throw new ToolError(`Zur Bestätigung muss confirm_name genau „${ws.name}“ lauten.`)
      }
      const brands = rows(await ctx.sb.from('brands').select('id').eq('workspace_id', ws.id))
      for (const brand of brands) await removeBrandFiles(ctx, brand.id)
      affected(await ctx.sb.from('workspaces').delete().eq('id', ws.id).select('id'), 'Workspace')
      ctx.invalidateScope()
      return { summary: `Workspace „${ws.name}“ mit ${brands.length} Marke(n) gelöscht.` }
    },
  }),

  defineTool({
    name: 'list_workspace_members',
    title: 'Workspace-Mitglieder',
    description: 'Listet die Mitglieder eines Workspaces mit Rollen (owner, admin, member).',
    input: { workspace: z.string().optional() },
    kind: 'read',
    async run({ workspace: ref }, ctx) {
      const ws = await ctx.workspace(ref)
      const data = rows(
        await ctx.sb
          .from('workspace_members')
          .select('user_id, role, created_at, profile:profiles(full_name, email)')
          .eq('workspace_id', ws.id)
          .order('created_at'),
      )
      return {
        summary: `${data.length} Mitglied(er) in „${ws.name}“.`,
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
    name: 'set_workspace_member_role',
    title: 'Workspace-Rolle ändern',
    description:
      'Ändert die Rolle eines Workspace-Mitglieds (owner, admin, member). Owner-Rechte vergeben oder entziehen dürfen nur Owner; ein Workspace behält immer mindestens einen Owner.',
    input: {
      workspace: z.string().optional(),
      user: z.string().describe('E-Mail-Adresse oder user_id des Mitglieds'),
      role: z.enum(WORKSPACE_ROLES),
    },
    kind: 'write',
    idempotent: true,
    async run({ workspace: ref, user, role }, ctx) {
      const ws = await ctx.adminWorkspace(ref)
      const member = await findWorkspaceMember(ctx, ws.id, user)
      affected(
        await ctx.sb
          .from('workspace_members')
          .update({ role })
          .eq('workspace_id', ws.id)
          .eq('user_id', member.user_id)
          .select('user_id'),
        'Mitglied',
      )
      return { summary: `${member.email ?? member.user_id} ist jetzt ${role} in „${ws.name}“.` }
    },
  }),

  defineTool({
    name: 'remove_workspace_member',
    title: 'Mitglied aus Workspace entfernen',
    description:
      'Entfernt eine Person aus einem Workspace (Rolle Owner oder Admin). Der letzte Owner kann nicht entfernt werden.',
    input: { workspace: z.string().optional(), user: z.string().describe('E-Mail-Adresse oder user_id') },
    kind: 'destructive',
    async run({ workspace: ref, user }, ctx) {
      const ws = await ctx.adminWorkspace(ref)
      const member = await findWorkspaceMember(ctx, ws.id, user)
      affected(
        await ctx.sb
          .from('workspace_members')
          .delete()
          .eq('workspace_id', ws.id)
          .eq('user_id', member.user_id)
          .select('user_id'),
        'Mitglied',
      )
      return { summary: `${member.email ?? member.user_id} wurde aus „${ws.name}“ entfernt.` }
    },
  }),
]

export async function findWorkspaceMember(
  ctx: import('../context').Ctx,
  workspaceId: string,
  ref: string,
): Promise<{ user_id: string; email: string | null }> {
  const members = rows(
    await ctx.sb
      .from('workspace_members')
      .select('user_id, profile:profiles(email, full_name)')
      .eq('workspace_id', workspaceId),
  )
  const needle = ref.trim().toLowerCase()
  const found = members.find((m) => m.user_id === ref || m.profile?.email?.toLowerCase() === needle)
  if (!found)
    throw new ToolError(
      `Mitglied „${ref}“ nicht gefunden.`,
      'Nimm die E-Mail-Adresse aus list_workspace_members.',
    )
  return { user_id: found.user_id, email: found.profile?.email ?? null }
}
