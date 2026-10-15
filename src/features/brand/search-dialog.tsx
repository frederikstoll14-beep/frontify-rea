import { Command, FileText, Image as ImageIcon, Palette, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useSearch } from '@/api/collab'
import { StorageImage } from '@/components/media/storage-image'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { stripHtml } from '@/lib/utils'
import { useBrandContext } from './brand-context'

function snippet(text: string | null, query: string): string {
  if (!text) return ''
  const clean = stripHtml(text)
    .replace(/\b(html|text|title|eyebrow|caption|items|id|kind|level|columns|tone|source|size)\b\s*:?/gi, ' ')
    .replace(/[,:[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const idx = clean.toLowerCase().indexOf(query.toLowerCase())
  if (idx < 0) return clean.slice(0, 140)
  const start = Math.max(0, idx - 50)
  return `${start > 0 ? '…' : ''}${clean.slice(start, idx + 90)}…`
}

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { brand, basePath } = useBrandContext()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const navigate = useNavigate()
  const { data: results = [], isFetching } = useSearch(brand.id, debounced)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250)
    return () => clearTimeout(t)
  }, [query])

  const go = (path: string) => {
    onOpenChange(false)
    setQuery('')
    navigate(path)
  }

  const pages = results.filter((r) => r.kind === 'page' || r.kind === 'block')
  const uniquePages = pages.filter((r, i) => pages.findIndex((x) => x.id === r.id) === i)
  const assets = results.filter((r) => r.kind === 'asset')
  const colors = results.filter((r) => r.kind === 'color')

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={`In „${brand.name}“ suchen`} size="lg">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Seiten, Inhalte, Dateien, Farben …"
          className="h-12 pl-9 text-base"
        />
      </div>
      <div className="mt-4 min-h-40 space-y-5">
        {debounced.trim().length < 2 ? (
          <p className="flex items-center gap-2 py-8 text-center text-sm text-muted">
            Mindestens zwei Zeichen eingeben. Tipp: <Command className="size-3.5" /> K öffnet die Suche
            überall.
          </p>
        ) : isFetching && results.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">Sucht …</p>
        ) : results.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">Nichts gefunden für „{debounced}“.</p>
        ) : (
          <>
            {uniquePages.length > 0 && (
              <section>
                <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">Seiten</h3>
                <ul className="space-y-1">
                  {uniquePages.map((r) => (
                    <li key={`${r.kind}-${r.id}`}>
                      <button
                        type="button"
                        onClick={() => go(`${basePath}/g/${r.guideline_slug}/${r.page_slug}`)}
                        className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-2"
                      >
                        <FileText className="mt-0.5 size-4 shrink-0 text-muted" />
                        <span className="min-w-0">
                          <span className="block font-medium text-ink">{r.title}</span>
                          {r.snippet && (
                            <span className="line-clamp-2 block text-[13px] text-muted">
                              {snippet(r.snippet, debounced)}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {assets.length > 0 && (
              <section>
                <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">Dateien</h3>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {assets.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => go(`${basePath}/bibliothek/${r.library_slug}?asset=${r.id}`)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-surface-2"
                      >
                        {r.thumb_path ? (
                          <StorageImage path={r.thumb_path} alt="" className="size-10 shrink-0 rounded-lg" />
                        ) : (
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-2">
                            <ImageIcon className="size-4 text-muted" />
                          </span>
                        )}
                        <span className="truncate font-medium text-ink">{r.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {colors.length > 0 && (
              <section>
                <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">Farben</h3>
                <ul className="flex flex-wrap gap-2">
                  {colors.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(r.hex ?? '')
                          toast.success(`${r.title} kopiert`, { description: r.hex ?? '' })
                        }}
                        className="flex items-center gap-2 rounded-full border border-border py-1 pr-3 pl-1 text-sm hover:bg-surface-2"
                      >
                        <span
                          className="size-6 rounded-full border border-black/10"
                          style={{ backgroundColor: r.hex ?? '' }}
                        />
                        {r.title} <span className="font-mono text-xs text-muted">{r.hex}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => go(`${basePath}/basis?tab=farben`)}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-accent"
                >
                  <Palette className="size-4" /> Alle Farben
                </button>
              </section>
            )}
          </>
        )}
      </div>
    </Dialog>
  )
}
