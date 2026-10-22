import { readSupabaseConfig } from '@/lib/supabase-config'

export const SERVER_NAME = 'brandbench'
export const SERVER_VERSION = '1.0.0'

export interface McpConfig {
  supabaseUrl: string
  anonKey: string
  /** Öffentliche Adresse der Web-App (für Einladungs- und Freigabelinks), ohne Schrägstrich am Ende. */
  appUrl: string | null
  /** Öffentliche Adresse dieses MCP-Servers, falls sie sich nicht aus den Anfrage-Headern ergibt. */
  publicUrl: string | null
  /** Erlaubt Abrufe von URLs im lokalen Netz (nur für Tests und lokale Entwicklung). */
  allowPrivateUrls: boolean
}

export type ConfigResult = { ok: true; config: McpConfig } | { ok: false; problem: string }

function clean(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim().replace(/\/+$/, '')
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Liest die Konfiguration aus Umgebungsvariablen. Die Supabase-Werte dürfen so heißen wie für die
 * Web-App (VITE_*, NEXT_PUBLIC_*) oder ohne Präfix (SUPABASE_URL, SUPABASE_ANON_KEY).
 */
export function readConfig(env: Record<string, string | undefined>): ConfigResult {
  const parsed = readSupabaseConfig({
    VITE_SUPABASE_URL: env.SUPABASE_URL ?? env.VITE_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY,
    VITE_SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  })
  if (!parsed.url || !parsed.key) {
    return {
      ok: false,
      problem: `${parsed.problem ?? 'Supabase ist nicht konfiguriert.'} Setze SUPABASE_URL und SUPABASE_ANON_KEY (oder die VITE_/NEXT_PUBLIC_-Namen).`,
    }
  }
  return {
    ok: true,
    config: {
      supabaseUrl: parsed.url,
      anonKey: parsed.key,
      appUrl: clean(env.APP_URL) ?? clean(env.MCP_APP_URL),
      publicUrl: clean(env.MCP_PUBLIC_URL),
      allowPrivateUrls: env.MCP_ALLOW_PRIVATE_URLS === '1',
    },
  }
}
