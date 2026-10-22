import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { userClient, type Principal } from './auth'
import type { McpConfig } from './config'
import { ToolError, describeError } from './errors'

export type WorkspaceRole = 'owner' | 'admin' | 'member'
export type BrandRole = 'admin' | 'editor' | 'viewer'

export interface ScopeWorkspace {
  id: string
  name: string
  slug: string
  description: string
  role: WorkspaceRole
  created_at: string
}

export interface ScopeBrand {
  id: string
  name: string
  slug: string
  org_type: string
  tagline: string
  workspace_id: string
  workspace_name: string
  workspace_slug: string
  role: BrandRole
  /** „workspace“ = über einen freigegebenen Workspace, „brand“ = einzeln freigegeben */
  via: 'workspace' | 'brand'
  visibility: 'private' | 'workspace'
  is_public: boolean
  updated_at: string
}

export interface Scope {
  client_id: string
  client_name?: string
  granted: boolean
  read_only: boolean
  workspaces: ScopeWorkspace[]
  brands: ScopeBrand[]
}

export const NO_GRANT_MESSAGE =
  'Diese Verbindung hat noch keine Freigabe (oder sie wurde widerrufen). Öffne in Brandbench „Konto → Verbundene Apps“ und wähle aus, auf welche Workspaces und Marken die App zugreifen darf.'

export const BUCKET = 'brand-files'

function norm(value: string): string {
  return value.trim().toLowerCase()
}

/** Findet genau ein Objekt über ID, Kurz-URL oder Namen (exakt, sonst eindeutiger Teiltreffer). */
export function matchByRef<T extends { id: string }>(
  items: T[],
  ref: string,
  keys: Array<(item: T) => string | null | undefined>,
  kind: string,
): T {
  const wanted = norm(ref)
  const byId = items.find((item) => item.id.toLowerCase() === wanted)
  if (byId) return byId
  const exact = items.filter((item) => keys.some((key) => norm(key(item) ?? '') === wanted))
  if (exact.length === 1) return exact[0]
  const candidates = exact.length > 1 ? exact : items.filter((item) => keys.some((key) => norm(key(item) ?? '').includes(wanted)))
  if (candidates.length === 1) return candidates[0]
  if (candidates.length === 0) {
    const options = items.slice(0, 15).map((item) => keys[0](item)).filter(Boolean)
    throw new ToolError(
      `${kind} „${ref}“ nicht gefunden.`,
      options.length > 0 ? `Verfügbar: ${options.join(', ')}.` : 'Es gibt dazu nichts (oder keine Freigabe).',
    )
  }
  throw new ToolError(
    `${kind} „${ref}“ ist nicht eindeutig.`,
    `Meinst du: ${candidates.slice(0, 8).map((c) => `${keys[0](c)} (${c.id})`).join(', ')}? Nimm am besten die ID.`,
  )
}

/** Alles, was ein Tool für eine Anfrage braucht: Person, App, Auswahl und ein Client mit dem Token der Person. */
export class Ctx {
  readonly sb: SupabaseClient<Database>
  private scopePromise: Promise<Scope> | null = null

  constructor(
    readonly config: McpConfig,
    readonly principal: Principal,
    /** Adresse, unter der dieser Server erreichbar ist (liegt bei Vercel auf derselben Domain wie die Web-App). */
    readonly origin: string | null = null,
  ) {
    this.sb = userClient(config, principal.token)
  }

  /** Adresse der Web-App für Links (Marke öffnen, Einladung annehmen). */
  get appUrl(): string | null {
    return this.config.appUrl ?? this.origin
  }

  link(path: string): string | null {
    return this.appUrl ? `${this.appUrl}${path}` : null
  }

  get storage() {
    return this.sb.storage.from(BUCKET)
  }

  /** Auswahl der Person für diese App (bei jeder Anfrage frisch aus der Datenbank). */
  async scope(options: { allowNoGrant?: boolean } = {}): Promise<Scope> {
    if (!this.scopePromise) {
      this.scopePromise = (async () => {
        const { data, error } = await this.sb.rpc('mcp_scope')
        if (error) throw new ToolError(`Freigabe konnte nicht gelesen werden: ${describeError(error)}`)
        return data as unknown as Scope
      })()
    }
    const scope = await this.scopePromise
    if (!scope.granted && !options.allowNoGrant) throw new ToolError(NO_GRANT_MESSAGE)
    return scope
  }

  invalidateScope(): void {
    this.scopePromise = null
  }

  async readOnly(): Promise<boolean> {
    return (await this.scope()).read_only
  }

  /** Workspace aus der Freigabe (nur ganz freigegebene Workspaces). */
  async workspace(ref?: string): Promise<ScopeWorkspace> {
    const scope = await this.scope()
    if (!ref) {
      if (scope.workspaces.length === 1) return scope.workspaces[0]
      if (scope.workspaces.length === 0) {
        throw new ToolError('Es ist kein ganzer Workspace freigegeben.', 'Einzelne Marken sind trotzdem nutzbar (list_brands).')
      }
      throw new ToolError(
        'Bitte den Workspace angeben (Name, Kurz-URL oder ID).',
        `Freigegeben: ${scope.workspaces.map((w) => w.name).join(', ')}.`,
      )
    }
    try {
      return matchByRef(scope.workspaces, ref, [(w) => w.name, (w) => w.slug], 'Workspace')
    } catch (error) {
      const partial = scope.brands.find((b) => norm(b.workspace_name) === norm(ref) || b.workspace_id === ref)
      if (partial) {
        throw new ToolError(
          `Der Workspace „${partial.workspace_name}“ ist nicht als Ganzes freigegeben, nur einzelne Marken daraus.`,
          'Ändere die Auswahl in Brandbench unter „Konto → Verbundene Apps“, wenn die App den ganzen Workspace nutzen soll.',
        )
      }
      throw error
    }
  }

  /** Marke aus der Freigabe; ohne Angabe, wenn nur eine Marke freigegeben ist. */
  async brand(ref?: string): Promise<ScopeBrand> {
    const scope = await this.scope()
    if (!ref) {
      if (scope.brands.length === 1) return scope.brands[0]
      if (scope.brands.length === 0) throw new ToolError('Es ist keine Marke freigegeben.')
      throw new ToolError(
        'Bitte die Marke angeben (Name, Kurz-URL oder ID).',
        `Freigegeben: ${scope.brands.map((b) => b.name).join(', ')}.`,
      )
    }
    return matchByRef(scope.brands, ref, [(b) => b.name, (b) => b.slug], 'Marke')
  }

  private assertWritable(scope: Scope): void {
    if (scope.read_only) {
      throw new ToolError(
        'Diese Verbindung ist auf „nur lesen“ beschränkt.',
        'Die Person kann das in Brandbench unter „Konto → Verbundene Apps → Auswahl ändern“ umstellen.',
      )
    }
  }

  /** Marke über ihre ID (nur innerhalb der Freigabe). */
  async brandById(id: string): Promise<ScopeBrand> {
    const scope = await this.scope()
    const brand = scope.brands.find((b) => b.id === id)
    if (!brand) throw new ToolError('Nicht gefunden – oder nicht für diese Verbindung freigegeben.')
    return brand
  }

  /** Wirft, wenn in der Marke nichts geändert werden darf (nur lesen oder Rolle Betrachter:in). */
  async requireEdit(brand: ScopeBrand): Promise<ScopeBrand> {
    this.assertWritable(await this.scope())
    if (brand.role !== 'admin' && brand.role !== 'editor') {
      throw new ToolError(`In „${brand.name}“ hast du nur Leserechte.`, 'Bearbeiten dürfen Editor:innen und Admins der Marke.')
    }
    return brand
  }

  async requireAdmin(brand: ScopeBrand): Promise<ScopeBrand> {
    this.assertWritable(await this.scope())
    if (brand.role !== 'admin') {
      throw new ToolError(`Dafür braucht es die Rolle Admin in „${brand.name}“ (du hast: ${brand.role}).`)
    }
    return brand
  }

  /** Marke, in der Inhalte geändert werden dürfen (Rolle Bearbeiten oder Admin, nicht „nur lesen“). */
  async editableBrand(ref?: string): Promise<ScopeBrand> {
    return this.requireEdit(await this.brand(ref))
  }

  async adminBrand(ref?: string): Promise<ScopeBrand> {
    return this.requireAdmin(await this.brand(ref))
  }

  async assertWriteAllowed(): Promise<void> {
    this.assertWritable(await this.scope())
  }

  async adminWorkspace(ref?: string): Promise<ScopeWorkspace> {
    const ws = await this.workspace(ref)
    this.assertWritable(await this.scope())
    if (ws.role !== 'owner' && ws.role !== 'admin') {
      throw new ToolError(`Dafür braucht es die Rolle Owner oder Admin im Workspace „${ws.name}“ (du hast: ${ws.role}).`)
    }
    return ws
  }

  async ownerWorkspace(ref?: string): Promise<ScopeWorkspace> {
    const ws = await this.workspace(ref)
    this.assertWritable(await this.scope())
    if (ws.role !== 'owner') {
      throw new ToolError(`Dafür braucht es die Rolle Owner im Workspace „${ws.name}“ (du hast: ${ws.role}).`)
    }
    return ws
  }
}
