import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { buildNav, fetchGuidelineBlocks, useGuidelines, usePages, type Block } from '@/api/guidelines'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'
import { PageSpinner } from '@/components/ui/spinner'
import { WIDTH_CLASSES } from '@/lib/blocks/types'
import { cn, formatDate } from '@/lib/utils'
import { useBrandContext } from '@/features/brand/brand-context'
import { BrandMark } from '@/features/brand/brand-layout'
import { BlockView } from '@/features/guidelines/guideline-page'

/** Druckansicht eines kompletten Markenhandbuchs (Browser-Druck → „Als PDF speichern“). */
export function PrintPage() {
  const { guidelineSlug } = useParams()
  const { brand, basePath } = useBrandContext()
  const { data: guidelines = [], isLoading } = useGuidelines(brand.id)
  const guideline = guidelines.find((g) => g.slug === guidelineSlug)
  const { data: pages = [] } = usePages(guideline?.id)
  const nav = buildNav(pages)
  const pageIds = pages.filter((p) => p.kind === 'page' && p.is_published).map((p) => p.id)
  const { data: blocks, isLoading: loadingBlocks } = useQuery({
    queryKey: ['print-blocks', guideline?.id, pageIds.join(',')],
    enabled: pageIds.length > 0,
    queryFn: () => fetchGuidelineBlocks(pageIds),
  })

  useEffect(() => {
    if (guideline) document.title = `${brand.name} – ${guideline.title}`
  }, [brand.name, guideline])

  if (isLoading || (pageIds.length > 0 && loadingBlocks))
    return <PageSpinner label="Bereitet den Druck vor …" />
  if (!guideline) return <EmptyState title="Markenhandbuch nicht gefunden" className="m-8" />

  const blocksOf = (pageId: string): Block[] =>
    (blocks ?? []).filter((b) => b.page_id === pageId && b.type !== 'note').sort((a, b) => a.sort - b.sort)

  return (
    <div className="bg-white text-[#15171F]">
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
        <p className="text-sm text-ink-2">
          Druckansicht – im Druckdialog „Als PDF speichern“ wählen. Tipp: Hintergrundgrafiken aktivieren.
        </p>
        <div className="flex gap-2">
          <Button asChild variant="ghost">
            <Link to={`${basePath}/g/${guideline.slug}`}>Zurück</Link>
          </Button>
          <Button onClick={() => window.print()}>
            <Printer /> Drucken / PDF
          </Button>
        </div>
      </div>
      <div className="mx-auto max-w-[900px] px-6 py-10 print:px-0 print:py-0">
        <section className="flex min-h-[85vh] flex-col justify-between rounded-3xl bg-brand p-10 text-brand-ink print:min-h-[250mm] print:rounded-none">
          <BrandMark brand={brand} onColor className="size-20 rounded-2xl text-2xl" />
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] uppercase opacity-80">{guideline.title}</p>
            <h1 className="mt-3 font-brand-heading text-6xl leading-none font-bold">{brand.name}</h1>
            {brand.tagline && <p className="mt-4 text-xl opacity-85">{brand.tagline}</p>}
          </div>
          <p className="text-sm opacity-70">Stand: {formatDate(new Date())}</p>
        </section>

        <section className="print-break py-12">
          <h2 className="mb-6 font-brand-heading text-3xl font-bold">Inhalt</h2>
          <ol className="space-y-3">
            {nav.map((group, i) => (
              <li key={group.chapter?.id ?? `loose-${i}`}>
                {group.chapter && <p className="font-semibold">{group.chapter.title}</p>}
                <ul className={cn('text-ink-2', group.chapter && 'ml-4')}>
                  {group.pages
                    .filter((p) => p.is_published)
                    .map((p) => (
                      <li key={p.id}>{p.title}</li>
                    ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>

        {nav.map((group) =>
          group.pages
            .filter((p) => p.is_published)
            .map((page, i) => (
              <section key={page.id} className="print-break py-10">
                {group.chapter && i === 0 && (
                  <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-brand-accent-text uppercase">
                    {group.chapter.title}
                  </p>
                )}
                <h2 className="font-brand-heading text-4xl font-bold">{page.title}</h2>
                {page.intro && <p className="mt-2 text-lg text-ink-2">{page.intro}</p>}
                <div className="mt-8 grid grid-cols-12 gap-x-6 gap-y-8">
                  {blocksOf(page.id).map((block) => (
                    <div key={block.id} className={cn(WIDTH_CLASSES[block.width], 'avoid-break min-w-0')}>
                      <BlockView block={block} />
                    </div>
                  ))}
                </div>
              </section>
            )),
        )}
      </div>
    </div>
  )
}
