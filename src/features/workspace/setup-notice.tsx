import { AppLogo } from '@/components/layout/app-logo'
import { Card } from '@/components/ui/misc'

/** Wird angezeigt, wenn die Supabase-Umgebungsvariablen fehlen. */
export function SetupNotice() {
  return (
    <div className="min-h-dvh bg-bg px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <AppLogo />
        <Card className="space-y-4 p-6">
          <h1 className="font-display text-2xl font-semibold text-ink">Fast geschafft: Backend verbinden</h1>
          <p className="text-ink-2">
            Die App braucht ein (kostenloses) Supabase-Projekt für Login, Datenbank und Dateien. Setze diese
            zwei Umgebungsvariablen und starte neu bzw. deploye erneut:
          </p>
          <pre className="overflow-x-auto rounded-xl bg-[#15171F] p-4 font-mono text-sm text-[#EDEBE5]">
            {`VITE_SUPABASE_URL=https://DEIN-PROJEKT.supabase.co
VITE_SUPABASE_ANON_KEY=dein-anon-key`}
          </pre>
          <p className="text-sm text-muted">
            Die Schritt-für-Schritt-Anleitung steht in <code>docs/SETUP.md</code> im Repository.
          </p>
        </Card>
      </div>
    </div>
  )
}
