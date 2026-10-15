import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Eye,
  EyeOff,
  FilePlus2,
  FolderInput,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router'
import { toast } from 'sonner'
import {
  buildNav,
  useCreatePage,
  useDeletePage,
  useReorderPages,
  useUpdatePage,
  type Guideline,
  type GuidelinePage,
} from '@/api/guidelines'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from '@/components/ui/menu'
import { cn, errorMessage, moveItem } from '@/lib/utils'
import { useBrandContext } from '@/features/brand/brand-context'

type NameDialogState =
  | { mode: 'create'; kind: 'chapter' | 'page'; parentId: string | null }
  | { mode: 'rename'; page: GuidelinePage }
  | null

export function GuidelineNav({
  guideline,
  pages,
  onNavigate,
}: {
  guideline: Guideline
  pages: GuidelinePage[]
  onNavigate?: () => void
}) {
  const { editMode, basePath, brand } = useBrandContext()
  const nav = buildNav(pages)
  const createPage = useCreatePage(guideline.id, brand.id)
  const updatePage = useUpdatePage(guideline.id, brand.id)
  const deletePage = useDeletePage(guideline.id)
  const reorder = useReorderPages(guideline.id)
  const confirm = useConfirm()
  const [dialog, setDialog] = useState<NameDialogState>(null)
  const [name, setName] = useState('')
  const [collapsed, setCollapsed] = useState<string[]>([])

  const chapters = pages.filter((p) => p.kind === 'chapter').sort((a, b) => a.sort - b.sort)

  const siblingsOf = (page: GuidelinePage) =>
    pages.filter((p) => p.parent_id === page.parent_id).sort((a, b) => a.sort - b.sort)

  const moveWithinSiblings = (page: GuidelinePage, delta: number) => {
    const siblings = siblingsOf(page)
    const index = siblings.findIndex((p) => p.id === page.id)
    const target = index + delta
    if (target < 0 || target >= siblings.length) return
    const next = moveItem(siblings, index, target)
    reorder.mutate(next.map((p, i) => ({ id: p.id, sort: i })))
  }

  const moveToChapter = (page: GuidelinePage, chapterId: string | null) => {
    const siblings = pages.filter((p) => p.parent_id === chapterId)
    const sort = siblings.length > 0 ? Math.max(...siblings.map((p) => p.sort)) + 1 : 0
    reorder.mutate([{ id: page.id, sort, parent_id: chapterId }])
  }

  const submitDialog = () => {
    const value = name.trim()
    if (!value || !dialog) return
    if (dialog.mode === 'create') {
      createPage.mutate(
        { title: value, kind: dialog.kind, parentId: dialog.parentId, pages },
        {
          onSuccess: () => {
            setDialog(null)
            toast.success(dialog.kind === 'chapter' ? 'Kapitel angelegt' : 'Seite angelegt')
          },
          onError: (e) => toast.error(errorMessage(e)),
        },
      )
    } else {
      updatePage.mutate(
        { id: dialog.page.id, patch: { title: value } },
        { onSuccess: () => setDialog(null), onError: (e) => toast.error(errorMessage(e)) },
      )
    }
  }

  const openDialog = (state: NonNullable<NameDialogState>) => {
    setName(state.mode === 'rename' ? state.page.title : '')
    setDialog(state)
  }

  const itemMenu = (page: GuidelinePage) => (
    <MenuRoot>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={`Aktionen für ${page.title}`}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted opacity-0 group-hover/nav:opacity-100 hover:bg-border hover:text-ink focus:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </MenuTrigger>
      <MenuContent align="start">
        {page.kind === 'chapter' && (
          <MenuItem
            icon={<FilePlus2 />}
            onSelect={() => openDialog({ mode: 'create', kind: 'page', parentId: page.id })}
          >
            Seite in diesem Kapitel
          </MenuItem>
        )}
        <MenuItem icon={<Pencil />} onSelect={() => openDialog({ mode: 'rename', page })}>
          Umbenennen
        </MenuItem>
        <MenuItem
          icon={page.is_published ? <EyeOff /> : <Eye />}
          onSelect={() => updatePage.mutate({ id: page.id, patch: { is_published: !page.is_published } })}
        >
          {page.is_published ? 'Als Entwurf verbergen' : 'Veröffentlichen'}
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<ArrowUp />} onSelect={() => moveWithinSiblings(page, -1)}>
          Nach oben
        </MenuItem>
        <MenuItem icon={<ArrowDown />} onSelect={() => moveWithinSiblings(page, 1)}>
          Nach unten
        </MenuItem>
        {page.kind === 'page' && (
          <MenuSub>
            <MenuSubTrigger icon={<FolderInput />}>Verschieben nach</MenuSubTrigger>
            <MenuSubContent>
              <MenuItem onSelect={() => moveToChapter(page, null)}>Ohne Kapitel</MenuItem>
              {chapters.map((c) => (
                <MenuItem key={c.id} onSelect={() => moveToChapter(page, c.id)}>
                  {c.title} {page.parent_id === c.id && '✓'}
                </MenuItem>
              ))}
            </MenuSubContent>
          </MenuSub>
        )}
        <MenuSeparator />
        <MenuItem
          icon={<Trash2 />}
          danger
          onSelect={async () => {
            const ok = await confirm({
              title: page.kind === 'chapter' ? 'Kapitel löschen?' : 'Seite löschen?',
              description:
                page.kind === 'chapter'
                  ? `„${page.title}“ und alle Seiten darin werden dauerhaft gelöscht.`
                  : `„${page.title}“ wird mit allen Bausteinen dauerhaft gelöscht.`,
              confirmLabel: 'Löschen',
              danger: true,
            })
            if (ok) deletePage.mutate(page.id, { onError: (e) => toast.error(errorMessage(e)) })
          }}
        >
          Löschen
        </MenuItem>
      </MenuContent>
    </MenuRoot>
  )

  const pageLink = (page: GuidelinePage, nested: boolean) => (
    <li key={page.id} className="group/nav flex items-center gap-0.5">
      <NavLink
        to={`${basePath}/g/${guideline.slug}/${page.slug}`}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-[14px] transition-colors',
            nested && 'pl-5',
            isActive
              ? 'bg-surface font-semibold text-ink shadow-sm'
              : 'text-ink-2 hover:bg-surface/70 hover:text-ink',
            !page.is_published && 'italic',
          )
        }
      >
        <span className="truncate">{page.title}</span>
        {!page.is_published && <EyeOff className="size-3.5 shrink-0 text-muted" aria-label="Entwurf" />}
      </NavLink>
      {editMode && itemMenu(page)}
    </li>
  )

  return (
    <nav aria-label="Inhalt" className="space-y-4">
      {nav.map((group, gi) => {
        if (!group.chapter) {
          return (
            <ul key={`loose-${gi}`} className="space-y-0.5">
              {group.pages.map((p) => pageLink(p, false))}
            </ul>
          )
        }
        const chapter = group.chapter
        const isCollapsed = collapsed.includes(chapter.id)
        return (
          <div key={chapter.id}>
            <div className="group/nav flex items-center gap-0.5">
              <button
                type="button"
                onClick={() =>
                  setCollapsed((prev) =>
                    isCollapsed ? prev.filter((id) => id !== chapter.id) : [...prev, chapter.id],
                  )
                }
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2.5 py-1 text-left text-[11px] font-semibold tracking-[0.08em] text-muted uppercase hover:text-ink',
                  !chapter.is_published && 'italic',
                )}
                aria-expanded={!isCollapsed}
              >
                <ChevronRight
                  className={cn('size-3.5 shrink-0 transition-transform', !isCollapsed && 'rotate-90')}
                />
                <span className="truncate">{chapter.title}</span>
                {!chapter.is_published && <EyeOff className="size-3 shrink-0" aria-label="Entwurf" />}
              </button>
              {editMode && itemMenu(chapter)}
            </div>
            {!isCollapsed && (
              <ul className="mt-0.5 space-y-0.5">
                {group.pages.map((p) => pageLink(p, true))}
                {group.pages.length === 0 && (
                  <li className="px-5 py-1 text-xs text-muted">Noch keine Seiten</li>
                )}
              </ul>
            )}
          </div>
        )
      })}

      {editMode && (
        <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => openDialog({ mode: 'create', kind: 'page', parentId: null })}
          >
            <FilePlus2 /> Seite
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openDialog({ mode: 'create', kind: 'chapter', parentId: null })}
          >
            <FolderPlus /> Kapitel
          </Button>
        </div>
      )}

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        title={
          dialog?.mode === 'rename'
            ? 'Umbenennen'
            : dialog?.kind === 'chapter'
              ? 'Neues Kapitel'
              : 'Neue Seite'
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Abbrechen
            </Button>
            <Button
              onClick={submitDialog}
              loading={createPage.isPending || updatePage.isPending}
              disabled={!name.trim()}
            >
              {dialog?.mode === 'rename' ? 'Speichern' : 'Anlegen'}
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submitDialog()
          }}
        >
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Titel"
            maxLength={160}
          />
        </form>
      </Dialog>
    </nav>
  )
}
