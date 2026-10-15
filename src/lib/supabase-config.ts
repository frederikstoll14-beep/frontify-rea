export interface SupabaseConfig {
  url: string | null
  key: string | null
  /** Verständliche Beschreibung, was an der Konfiguration fehlt oder falsch ist. */
  problem: string | null
}

function clean(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim()
}

/**
 * Liest und normalisiert die Supabase-Umgebungsvariablen.
 * Toleriert häufige Eingabefehler (fehlendes https://, Schrägstrich oder /rest/v1 am Ende,
 * Anführungszeichen) und akzeptiert den neuen Namen VITE_SUPABASE_PUBLISHABLE_KEY.
 */
export function readSupabaseConfig(env: Record<string, string | undefined>): SupabaseConfig {
  let url = clean(env.VITE_SUPABASE_URL)
  const key = clean(env.VITE_SUPABASE_ANON_KEY) || clean(env.VITE_SUPABASE_PUBLISHABLE_KEY)

  if (!url && !key) {
    return { url: null, key: null, problem: 'VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY fehlen.' }
  }
  if (!url) return { url: null, key: null, problem: 'VITE_SUPABASE_URL fehlt.' }
  if (!key) return { url: null, key: null, problem: 'VITE_SUPABASE_ANON_KEY fehlt.' }

  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  url = url.replace(/\/+(rest|auth|storage)\/v1\/?.*$/i, '').replace(/\/+$/, '')

  try {
    const parsed = new URL(url)
    if (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost') {
      return { url: null, key: null, problem: `VITE_SUPABASE_URL ist keine gültige Adresse: „${url}“.` }
    }
  } catch {
    return { url: null, key: null, problem: `VITE_SUPABASE_URL ist keine gültige Adresse: „${url}“.` }
  }

  if (key.startsWith('sb_secret_') || /service_role/.test(decodeJwtRole(key))) {
    return {
      url: null,
      key: null,
      problem:
        'In VITE_SUPABASE_ANON_KEY steht der geheime service_role/secret key. Bitte sofort durch den anon/publishable key ersetzen und den geheimen Schlüssel in Supabase neu erzeugen.',
    }
  }

  return { url, key, problem: null }
}

function decodeJwtRole(key: string): string {
  const parts = key.split('.')
  if (parts.length !== 3) return ''
  try {
    const json = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof json.role === 'string' ? json.role : ''
  } catch {
    return ''
  }
}
