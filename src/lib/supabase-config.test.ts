import { describe, expect, it } from 'vitest'
import { readSupabaseConfig } from './supabase-config'

const anon =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const service =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

describe('readSupabaseConfig', () => {
  it('meldet fehlende Variablen', () => {
    expect(readSupabaseConfig({}).problem).toMatch(/fehlen/)
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co' }).problem).toMatch(
      /ANON_KEY fehlt/,
    )
  })

  it('normalisiert typische Eingabefehler', () => {
    for (const raw of [
      'abc.supabase.co',
      ' https://abc.supabase.co/ ',
      'https://abc.supabase.co/rest/v1/',
      '"https://abc.supabase.co"',
    ]) {
      const config = readSupabaseConfig({ VITE_SUPABASE_URL: raw, VITE_SUPABASE_ANON_KEY: anon })
      expect(config.problem, raw).toBeNull()
      expect(config.url, raw).toBe('https://abc.supabase.co')
    }
  })

  it('akzeptiert den publishable key unter neuem Namen', () => {
    const config = readSupabaseConfig({
      VITE_SUPABASE_URL: 'https://abc.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_123',
    })
    expect(config.key).toBe('sb_publishable_123')
  })

  it('akzeptiert die NEXT_PUBLIC_*-Namen der Vercel-Integration', () => {
    const config = readSupabaseConfig({
      NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_123',
    })
    expect(config).toEqual({ url: 'https://abc.supabase.co', key: 'sb_publishable_123', problem: null })
    expect(
      readSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
      }).key,
    ).toBe(anon)
  })

  it('lehnt ungültige Adressen und geheime Schlüssel ab', () => {
    expect(
      readSupabaseConfig({ VITE_SUPABASE_URL: 'kein link', VITE_SUPABASE_ANON_KEY: anon }).problem,
    ).toMatch(/keine gültige Adresse/)
    expect(
      readSupabaseConfig({ VITE_SUPABASE_URL: 'https://abc.supabase.co', VITE_SUPABASE_ANON_KEY: service })
        .problem,
    ).toMatch(/service_role/)
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: 'https://abc.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'sb_secret_x',
      }).problem,
    ).toMatch(/geheime/)
  })
})
