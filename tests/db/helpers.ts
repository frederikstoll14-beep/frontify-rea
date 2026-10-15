import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/lib/database.types'

// Standardwerte der lokalen Supabase-CLI (öffentliche Demo-Schlüssel, keine Geheimnisse).
export const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
export const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

export type Client = SupabaseClient<Database>

export function anonClient(): Client {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

const runId = Date.now().toString(36)

export async function newUser(label: string): Promise<{ client: Client; id: string; email: string }> {
  const client = anonClient()
  const email = `${label}-${runId}-${Math.random().toString(36).slice(2, 7)}@test.local`
  const { data, error } = await client.auth.signUp({
    email,
    password: 'test-passwort-123',
    options: { data: { full_name: label } },
  })
  if (error) throw error
  if (!data.user || !data.session)
    throw new Error('Kein Session-Token – ist "enable_confirmations" lokal aus?')
  return { client, id: data.user.id, email }
}

export function must<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(result.error.message)
  if (result.data === null || result.data === undefined) throw new Error('Keine Daten')
  return result.data as NonNullable<T>
}
