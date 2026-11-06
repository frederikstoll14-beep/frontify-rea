import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/api/auth'
import { supabase } from '@/lib/supabase'
import { demoTemplate } from '@/lib/templates/demo'
import { DEMO_BRAND, DEMO_WORKSPACE } from '@/lib/demo-seed'

/**
 * Legt neuen Konten beim ersten Anmelden einen Beispiel-Workspace mit der Beispiel-Marke an.
 * „Schon angelegt“ steht im Profil (demo_seeded_at) – so kommt nichts wieder, was jemand gelöscht hat.
 */
export function SeedDemoWorkspace() {
  const { user, profile } = useAuth()
  const qc = useQueryClient()
  const started = useRef<string | null>(null)

  useEffect(() => {
    if (!user || !profile || profile.demo_seeded_at || started.current === user.id) return
    started.current = user.id

    const run = async () => {
      // Atomar „in Besitz nehmen“: nur ein Tab/Aufruf bekommt hier eine Zeile zurück.
      const claim = await supabase
        .from('profiles')
        .update({ demo_seeded_at: new Date().toISOString() })
        .eq('id', user.id)
        .is('demo_seeded_at', null)
        .select('id')
      if (claim.error || !claim.data || claim.data.length === 0) return

      try {
        const workspace = await supabase.rpc('create_workspace', {
          p_name: DEMO_WORKSPACE.name,
          p_description: DEMO_WORKSPACE.description,
        })
        if (workspace.error) throw workspace.error
        const brand = await supabase.rpc('create_brand', {
          p_workspace: workspace.data.id,
          p_name: DEMO_BRAND.name,
          p_org_type: demoTemplate.orgType,
          p_tagline: DEMO_BRAND.tagline,
          p_template: JSON.parse(JSON.stringify(demoTemplate.data)),
        })
        if (brand.error) throw brand.error
        await qc.invalidateQueries()
        toast.success('Beispiel-Workspace angelegt', {
          description:
            'Zum Ausprobieren. Wenn du alles verstanden hast, kannst du ihn in den Einstellungen löschen.',
          duration: 9000,
        })
      } catch {
        // Nichts halb Angelegtes zurücklassen und beim nächsten Mal noch einmal versuchen
        await supabase.from('profiles').update({ demo_seeded_at: null }).eq('id', user.id)
        started.current = null
      }
    }
    void run()
  }, [user, profile, qc])

  return null
}
