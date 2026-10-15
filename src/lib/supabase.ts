import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { readSupabaseConfig } from './supabase-config'

const config = readSupabaseConfig(import.meta.env as Record<string, string | undefined>)

export const isConfigured = config.problem === null
export const configProblem = config.problem

export const supabase = createClient<Database>(
  config.url ?? 'http://localhost:54321',
  config.key ?? 'missing-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  },
)

export const BUCKET = 'brand-files'

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]
