import { Eye, EyeOff, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useDeleteGuideline, useUpdateGuideline, type Guideline } from '@/api/guidelines'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Textarea } from '@/components/ui/input'
import { MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { errorMessage } from '@/lib/utils'
import { useBrandContext } from '@/features/brand/brand-context'

/** Verwaltung eines Markenhandbuchs: umbenennen, veröffentlichen, löschen. */
export function GuidelineMenu({ guideline }: { guideline: Guideline }) {
  const { brand, basePath } = useBrandContext()
  const update = useUpdateGuideline(brand.id)
  const remove = useDeleteGuideline(brand.id)
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(guideline.title)
  const [description, setDescription] = useState(guideline.description)

  return (
    <>
      <MenuRoot>
        <MenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label="Markenhandbuch verwalten">
            <MoreHorizontal />
          </Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem
            icon={<Pencil />}
            onSelect={() => {
              setTitle(guideline.title)
              setDescription(guideline.description)
              setOpen(true)
            }}
          >
            Titel & Beschreibung
          </MenuItem>
          <MenuItem
            icon={guideline.is_published ? <EyeOff /> : <Eye />}
            onSelect={() =>
              update.mutate(
                { id: guideline.id, patch: { is_published: !guideline.is_published } },
                {
                  onSuccess: () =>
                    toast.success(
                      guideline.is_published ? 'Nur noch für Bearbeitende sichtbar' : 'Veröffentlicht',
                    ),
                  onError: (e) => toast.error(errorMessage(e)),
                },
              )
            }
          >
            {guideline.is_published ? 'Als Entwurf verbergen' : 'Veröffentlichen'}
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            icon={<Trash2 />}
            danger
            onSelect={async () => {
              const ok = await confirm({
                title: 'Markenhandbuch löschen?',
                description: `„${guideline.title}“ wird mit allen Kapiteln, Seiten und Versionen dauerhaft gelöscht.`,
                confirmLabel: 'Endgültig löschen',
                danger: true,
              })
              if (!ok) return
              remove.mutate(guideline.id, {
                onSuccess: () => navigate(basePath),
                onError: (e) => toast.error(errorMessage(e)),
              })
            }}
          >
            Löschen
          </MenuItem>
        </MenuContent>
      </MenuRoot>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Markenhandbuch bearbeiten"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button
              disabled={!title.trim()}
              loading={update.isPending}
              onClick={() =>
                update.mutate(
                  { id: guideline.id, patch: { title: title.trim(), description } },
                  { onSuccess: () => setOpen(false), onError: (e) => toast.error(errorMessage(e)) },
                )
              }
            >
              Speichern
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Titel">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
          </Field>
          <Field label="Beschreibung">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </Field>
        </div>
      </Dialog>
    </>
  )
}
