import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import type { McpConfig } from './config'

export interface Principal {
  token: string
  userId: string
  /** OAuth-Client (die verbundene App), für die das Token ausgestellt wurde. */
  clientId: string
  email: string | null
}

export type AuthFailure = { ok: false; status: 401 | 403; error: string; description: string }
export type AuthResult = { ok: true; principal: Principal } | AuthFailure

const verifiers = new Map<string, SupabaseClient<Database>>()

function verifier(config: McpConfig): SupabaseClient<Database> {
  const key = `${config.supabaseUrl}|${config.anonKey}`
  let client = verifiers.get(key)
  if (!client) {
    client = createClient<Database>(config.supabaseUrl, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    verifiers.set(key, client)
  }
  return client
}

/** Client, der alle Anfragen mit dem Token der Person ausführt – die Datenbank prüft die Rechte (RLS). */
export function userClient(config: McpConfig, token: string): SupabaseClient<Database> {
  return createClient<Database>(config.supabaseUrl, config.anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export function bearerToken(header: string | null): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(header ?? '')
  return match ? match[1] : null
}

/**
 * Prüft das Zugriffs-Token: Signatur (JWKS des Supabase-Projekts), Ablauf und dass es für eine
 * verbundene App ausgestellt wurde (Claim client_id). Normale Anmelde-Sitzungen der Web-App werden
 * hier bewusst nicht akzeptiert.
 */
export async function authenticate(config: McpConfig, header: string | null): Promise<AuthResult> {
  const token = bearerToken(header)
  if (!token) {
    return { ok: false, status: 401, error: 'invalid_request', description: 'Anmeldung erforderlich' }
  }
  let claims: Record<string, unknown> | undefined
  try {
    const { data, error } = await verifier(config).auth.getClaims(token)
    if (error || !data) {
      return { ok: false, status: 401, error: 'invalid_token', description: 'Token ungültig oder abgelaufen' }
    }
    claims = data.claims as unknown as Record<string, unknown>
  } catch {
    return {
      ok: false,
      status: 401,
      error: 'invalid_token',
      description: 'Token konnte nicht geprüft werden',
    }
  }
  const userId = typeof claims.sub === 'string' ? claims.sub : null
  const clientId = typeof claims.client_id === 'string' && claims.client_id ? claims.client_id : null
  if (!userId || claims.role !== 'authenticated') {
    return {
      ok: false,
      status: 401,
      error: 'invalid_token',
      description: 'Token gehört zu keiner angemeldeten Person',
    }
  }
  if (!clientId) {
    return {
      ok: false,
      status: 403,
      error: 'insufficient_scope',
      description: 'Dieses Token stammt nicht von einer verbundenen App. Verbinde die App über OAuth.',
    }
  }
  return {
    ok: true,
    principal: {
      token,
      userId,
      clientId,
      email: typeof claims.email === 'string' ? claims.email : null,
    },
  }
}
