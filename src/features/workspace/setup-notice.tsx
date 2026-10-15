import { LogoMark } from '@/components/layout/app-logo'
import { Card } from '@/components/ui/misc'
import { APP_NAME } from '@/lib/app'

/**
 * Wird angezeigt, wenn die Supabase-Umgebungsvariablen fehlen oder ungültig sind.
 * Läuft außerhalb des Routers – deshalb hier keine <Link>-Komponenten verwenden.
 */
export function SetupNotice({ problem }: { problem: string | null }) {
  return (
    <div className="min-h-dvh bg-bg px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <span className="font-display text-lg font-semibold tracking-tight text-ink">{APP_NAME}</span>
        </div>
        <Card className="space-y-4 p-6">
          <h1 className="font-display text-2xl font-semibold text-ink">Fast geschafft: Backend verbinden</h1>
          {problem && (
            <p className="rounded-xl bg-warning-soft p-3 text-sm text-ink-2">
              <span className="font-semibold">Problem: </span>
              {problem}
            </p>
          )}
          <p className="text-ink-2">
            Die App braucht ein (kostenloses) Supabase-Projekt für Login, Datenbank und Dateien. Setze in
            Vercel unter <strong>Settings → Environment Variables</strong> diese zwei Werte und deploye danach
            neu (<strong>Deployments → … → Redeploy</strong>). Vite liest die Werte nur beim Build.
          </p>
          <pre className="overflow-x-auto rounded-xl bg-[#15171F] p-4 font-mono text-sm text-[#EDEBE5]">
            {`VITE_SUPABASE_URL=https://DEIN-PROJEKT.supabase.co
VITE_SUPABASE_ANON_KEY=dein-anon-oder-publishable-key`}
          </pre>
          <p className="text-sm text-muted">
            Die Schritt-für-Schritt-Anleitung steht in <code>docs/SETUP.md</code> im Repository.
          </p>
        </Card>
      </div>
    </div>
  )
}
