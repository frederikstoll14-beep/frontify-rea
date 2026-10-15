import { Check } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCreateBrand } from '@/api/brands'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/input'
import { TEMPLATES } from '@/lib/templates'
import { ORG_TYPES, type OrgType } from '@/lib/templates/types'
import { cn, errorMessage } from '@/lib/utils'

export function CreateBrandDialog({
  workspaceId,
  open,
  onOpenChange,
}: {
  workspaceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const create = useCreateBrand()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [orgType, setOrgType] = useState<OrgType>('verein')
  const [templateId, setTemplateId] = useState('verein')

  const submit = () => {
    const template = TEMPLATES.find((t) => t.id === templateId)
    if (!name.trim() || !template) return
    create.mutate(
      { workspaceId, name: name.trim(), orgType, tagline, template: template.data },
      {
        onSuccess: (brand) => {
          onOpenChange(false)
          setName('')
          setTagline('')
          toast.success(`„${brand.name}“ ist angelegt`)
          navigate(`/b/${brand.slug}`)
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Neue Marke anlegen"
      description="Unternehmen, Verein, Verband oder Organisation – mit fertiger Struktur zum Ausfüllen."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={submit} loading={create.isPending} disabled={!name.trim()}>
            Marke anlegen
          </Button>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. SV Musterstadt 1904 e.V."
              maxLength={120}
            />
          </Field>
          <Field label="Art">
            <Select
              value={orgType}
              onChange={(e) => {
                const value = e.target.value as OrgType
                setOrgType(value)
                const match = TEMPLATES.find((t) => t.orgType === value && t.id !== 'demo')
                if (match && templateId !== 'leer' && templateId !== 'demo') setTemplateId(match.id)
              }}
            >
              {Object.entries(ORG_TYPES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Claim (optional)">
          <Input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Wofür steht die Marke in einem Satz?"
          />
        </Field>
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-ink-2">Vorlage</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplateId(t.id)}
                aria-pressed={templateId === t.id}
                className={cn(
                  'relative rounded-xl border p-3.5 text-left transition-colors',
                  templateId === t.id
                    ? 'border-ink bg-surface-2 ring-1 ring-ink'
                    : 'border-border hover:border-border-strong',
                )}
              >
                <span className="block pr-6 text-sm font-semibold text-ink">{t.name}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted">{t.description}</span>
                {templateId === t.id && <Check className="absolute top-3 right-3 size-4 text-ink" />}
              </button>
            ))}
          </div>
        </fieldset>
      </form>
    </Dialog>
  )
}
