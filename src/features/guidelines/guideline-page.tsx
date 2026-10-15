import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, CircleAlert, Cloud, EyeOff, FileText, History, Link2, Loader2, MessageSquare, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { useComments } from '@/api/collab'
import { keys } from '@/api/client'
import { buildNav, flattenNav, useUpdatePage, type Block } from '@/api/guidelines'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/dialog'
import { Badge, EmptyState, Tooltip } from '@/components/ui/misc'
import { PageSpinner } from '@/components/ui/spinner'
import { type BlockType } from '@/lib/blocks/types'
import { cn, errorMessage, formatDateTime } from '@/lib/utils'
import { useBrandContext } from '@/features/brand/brand-context'
import { getBlockDefinition } from '@/features/blocks/registry'
import { headingAnchor } from '@/features/blocks/text-blocks'
import { InlineInput } from '@/features/blocks/editor-kit'
import { BlockFrame } from './block-frame'
import { BlockInserterDialog, InsertLine } from './block-inserter'
import { CommentsPanel } from './comments-panel'
import { useGuidelineOutlet } from './guideline-layout'
import { RevisionsPanel } from './revisions-panel'
import { usePageBlocks, type SaveState } from './use-page-blocks'
import { WIDTH_CLASSES } from '@/lib/blocks/types'

export function BlockView({ block }: { block: Block }) {
  const def = getBlockDefinition(block.type)
  const View = def.View as React.ComponentType<{ block: Block; content: Block['content'] }>
  return <View block={block} content={block.content} />
}

function BlockEditorSlot({ block, onChange }: { block: Block; onChange: (patch: Record<string, unknown>) => void }) {
  const def = getBlockDefinition(block.type)
  const Editor = def.Editor as React.ComponentType<{
    block: Block
    content: Block['content']
    onChange: (patch: Record<string, unknown>) => void
  }>
  return <Editor block={block} content={block.content} onChange={onChange} />
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted" role="status">
      {state === 'saving' ? (
        <>
          <Loader2 className="size-3.5 animate-spin" /> Speichert …
        </>
      ) : state === 'error' ? (
        <>
          <CircleAlert className="size-3.5 text-danger" /> Fehler beim Speichern
        </>
      ) : (
        <>
          <Cloud className="size-3.5" /> Gespeichert
        </>
      )}
    </span>
  )
}

function PageToc({ blocks }: { blocks: Block[] }) {
  const headings = blocks.filter(
    (b): b is Block<'heading'> => b.type === 'heading' && Boolean((b as Block<'heading'>).content.text),
  )
  if (headings.length < 2) return null
  return (
    <nav aria-label="Auf dieser Seite" className="no-print sticky top-24 hidden w-52 shrink-0 self-start xl:block">
      <p className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Auf dieser Seite</p>
      <ul className="space-y-1 border-l border-border">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${headingAnchor(h.content.text)}`}
              className={cn(
                '-ml-px block border-l-2 border-transparent py-0.5 text-[13px] text-muted hover:border-ink hover:text-ink',
                h.content.level === 3 ? 'pl-6' : 'pl-3',
              )}
            >
              {h.content.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function GuidelinePageView() {
  const { pageSlug } = useParams()
  const { guideline, pages } = useGuidelineOutlet()
  const { brand, basePath, editMode, isMember, canEdit } = useBrandContext()
  const page = pages.find((p) => p.slug === pageSlug && p.kind === 'page')
  const chapter = page?.parent_id ? pages.find((p) => p.id === page.parent_id) : null
  const ordered = useMemo(() => flattenNav(buildNav(pages)), [pages])
  const index = page ? ordered.findIndex((p) => p.id === page.id) : -1
  const prev = index > 0 ? ordered[index - 1] : null
  const next = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null

  const state = usePageBlocks(page?.id, brand.id)
  const updatePage = useUpdatePage(guideline.id, brand.id)
  const qc = useQueryClient()
  const { data: comments = [] } = useComments(page ? { pageId: page.id } : null, isMember)
  const openComments = comments.filter((c) => c.parent_id === null && !c.resolved).length

  const [selected, setSelected] = useState<string | null>(null)
  const [inserterAt, setInserterAt] = useState<number | null>(null)
  const [panel, setPanel] = useState<'comments' | 'revisions' | null>(null)
  const [title, setTitle] = useState(page?.title ?? '')
  const [intro, setIntro] = useState(page?.intro ?? '')

  useEffect(() => {
    setTitle(page?.title ?? '')
    setIntro(page?.intro ?? '')
    setSelected(null)
  }, [page?.id, page?.title, page?.intro])

  useEffect(() => {
    if (!editMode) setSelected(null)
  }, [editMode])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Scroll zu Anker nach Laden
  useEffect(() => {
    if (state.isLoading || !window.location.hash) return
    const el = document.getElementById(decodeURIComponent(window.location.hash.slice(1)))
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [state.isLoading, page?.id])

  // Titel/Intro verzögert speichern
  useEffect(() => {
    if (!page || !editMode) return
    if (title === page.title && intro === page.intro) return
    const timer = setTimeout(() => {
      if (!title.trim()) return
      updatePage.mutate(
        { id: page.id, patch: { title: title.trim(), intro } },
        { onError: (e) => toast.error(errorMessage(e)) },
      )
    }, 800)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, intro])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (!page) {
    return (
      <div className="px-4 py-16">
        <EmptyState
          icon={<FileText />}
          title="Seite nicht gefunden"
          description="Die Seite wurde umbenannt, verschoben oder ist ein Entwurf."
          action={
            <Button asChild variant="outline">
              <Link to={`${basePath}/g/${guideline.slug}`}>Zum Anfang</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const visibleBlocks = editMode ? state.blocks : state.blocks.filter((b) => b.type !== 'note')

  const handleInsert = async (type: BlockType) => {
    const at = inserterAt ?? state.blocks.length
    setInserterAt(null)
    const block = await state.insert(type, at)
    if (block) {
      setSelected(block.id)
      setTimeout(() => document.querySelector(`[data-block-id="${block.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = state.blocks.findIndex((b) => b.id === active.id)
    const to = state.blocks.findIndex((b) => b.id === over.id)
    if (from >= 0 && to >= 0) state.move(from, to)
  }

  return (
    <div className="flex gap-10 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <article className="mx-auto w-full max-w-[880px] min-w-0">
        <header className="mb-8 border-b border-border pb-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.12em] text-brand-accent-text uppercase">
              {chapter?.title ?? guideline.title}
              {!page.is_published && (
                <Badge tone="warning">
                  <EyeOff className="size-3" /> Entwurf
                </Badge>
              )}
            </div>
            <div className="no-print flex items-center gap-1">
              {editMode && <SaveIndicator state={state.saveState} />}
              <Tooltip content="Link zur Seite kopieren">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Link kopieren"
                  onClick={() => {
                    void navigator.clipboard.writeText(window.location.href.split('#')[0])
                    toast.success('Link kopiert')
                  }}
                >
                  <Link2 />
                </Button>
              </Tooltip>
              {canEdit && (
                <Tooltip content="Versionen">
                  <Button size="icon-sm" variant="ghost" aria-label="Versionen" onClick={() => setPanel('revisions')}>
                    <History />
                  </Button>
                </Tooltip>
              )}
              {isMember && (
                <Button size="sm" variant="ghost" onClick={() => setPanel('comments')} aria-label="Kommentare">
                  <MessageSquare />
                  {openComments > 0 && <span className="text-xs font-semibold">{openComments}</span>}
                </Button>
              )}
            </div>
          </div>
          {editMode ? (
            <>
              <InlineInput
                value={title}
                onChange={setTitle}
                placeholder="Seitentitel"
                ariaLabel="Seitentitel"
                className="font-brand-heading text-4xl leading-tight font-bold text-ink sm:text-5xl"
              />
              <InlineInput
                multiline
                value={intro}
                onChange={setIntro}
                placeholder="Kurze Einleitung (optional)"
                ariaLabel="Einleitung"
                className="mt-3 text-lg leading-relaxed text-ink-2"
              />
            </>
          ) : (
            <>
              <h1 className="font-brand-heading text-4xl leading-tight font-bold text-balance text-ink sm:text-5xl">
                {page.title}
              </h1>
              {page.intro && <p className="mt-3 text-lg leading-relaxed text-pretty text-ink-2">{page.intro}</p>}
            </>
          )}
          <p className="mt-4 text-xs text-muted">Zuletzt aktualisiert: {formatDateTime(page.updated_at)}</p>
        </header>

        {state.isLoading ? (
          <PageSpinner />
        ) : editMode ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={state.blocks.map((b) => b.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-12 gap-x-6 gap-y-4">
                {state.blocks.length === 0 ? (
                  <InsertLine onClick={() => setInserterAt(0)} always />
                ) : (
                  <InsertLine onClick={() => setInserterAt(0)} />
                )}
                {state.blocks.map((block, i) => (
                  <BlockFrame
                    key={block.id}
                    block={block}
                    index={i}
                    count={state.blocks.length}
                    selected={selected === block.id}
                    onSelect={() => setSelected(block.id)}
                    onMove={state.move}
                    onDuplicate={() => void state.duplicate(block.id)}
                    onRemove={() => void state.remove(block.id)}
                    onWidth={(w) => state.setWidth(block.id, w)}
                    onInsertAfter={() => setInserterAt(i + 1)}
                  >
                    {selected === block.id ? (
                      <BlockEditorSlot block={block} onChange={(patch) => state.updateContent(block.id, patch)} />
                    ) : (
                      <div className="pointer-events-none min-h-8 select-none">
                        <BlockView block={block} />
                      </div>
                    )}
                  </BlockFrame>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : visibleBlocks.length === 0 ? (
          <EmptyState
            title="Diese Seite ist noch leer"
            description={canEdit ? 'Schalte oben auf „Bearbeiten“, um Bausteine hinzuzufügen.' : undefined}
          />
        ) : (
          <div className="grid grid-cols-12 gap-x-6 gap-y-8">
            {visibleBlocks.map((block) => (
              <div key={block.id} className={cn(WIDTH_CLASSES[block.width], 'min-w-0')}>
                <BlockView block={block} />
              </div>
            ))}
          </div>
        )}

        {editMode && state.blocks.length > 0 && (
          <div className="no-print mt-6 flex justify-center">
            <Button variant="outline" onClick={() => setInserterAt(state.blocks.length)}>
              <Plus /> Baustein hinzufügen
            </Button>
          </div>
        )}

        {(prev || next) && (
          <nav className="no-print mt-14 grid gap-3 border-t border-border pt-6 sm:grid-cols-2" aria-label="Seitennavigation">
            {prev ? (
              <Link
                to={`${basePath}/g/${guideline.slug}/${prev.slug}`}
                className="group rounded-2xl border border-border bg-surface p-4 transition-shadow hover:shadow-card"
              >
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <ArrowLeft className="size-3.5" /> Zurück
                </span>
                <span className="mt-1 block font-semibold text-ink">{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link
                to={`${basePath}/g/${guideline.slug}/${next.slug}`}
                className="group rounded-2xl border border-border bg-surface p-4 text-right transition-shadow hover:shadow-card"
              >
                <span className="flex items-center justify-end gap-1.5 text-xs text-muted">
                  Weiter <ArrowRight className="size-3.5" />
                </span>
                <span className="mt-1 block font-semibold text-ink">{next.title}</span>
              </Link>
            )}
          </nav>
        )}
      </article>

      <PageToc blocks={visibleBlocks} />

      <BlockInserterDialog
        open={inserterAt !== null}
        onOpenChange={(open) => !open && setInserterAt(null)}
        onPick={(type) => void handleInsert(type)}
      />

      <Sheet open={panel === 'comments'} onOpenChange={(open) => setPanel(open ? 'comments' : null)} title={`Kommentare · ${page.title}`}>
        <CommentsPanel target={{ pageId: page.id }} />
      </Sheet>
      <Sheet open={panel === 'revisions'} onOpenChange={(open) => setPanel(open ? 'revisions' : null)} title="Versionen dieser Seite">
        <RevisionsPanel
          page={page}
          blocks={state.blocks}
          beforeSnapshot={state.flushAll}
          onRestored={() => {
            void qc.invalidateQueries({ queryKey: keys.blocks(page.id) })
            void qc.invalidateQueries({ queryKey: keys.pages(guideline.id) })
            setPanel(null)
          }}
        />
      </Sheet>
    </div>
  )
}
