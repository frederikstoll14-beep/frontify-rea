import { AlertTriangle, Check, ChevronDown, Copy, Info, Lightbulb, OctagonAlert, Plus, StickyNote, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { RichText, RichTextEditor } from '@/components/rich-text'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Segmented, Switch } from '@/components/ui/misc'
import type { CalloutTone } from '@/lib/blocks/types'
import { cn, slugify, uniqueId } from '@/lib/utils'
import { useBrandContext } from '@/features/brand/brand-context'
import { AddItemButton, InlineInput, ItemControls, listOps, SettingsPanel, SettingsRow } from './editor-kit'
import type { BlockEditorProps, BlockViewProps } from './types'

/* ---------- Überschrift ---------- */

export function headingAnchor(text: string): string {
  return `abschnitt-${slugify(text)}`
}

export function HeadingView({ content }: BlockViewProps<'heading'>) {
  const Tag = content.level === 3 ? 'h3' : 'h2'
  return (
    <div id={headingAnchor(content.text)} className="scroll-mt-24 pt-2">
      {content.eyebrow && (
        <p className="mb-1.5 text-xs font-semibold tracking-[0.14em] text-brand-accent-text uppercase">{content.eyebrow}</p>
      )}
      <Tag
        className={cn(
          'font-brand-heading leading-tight text-ink',
          content.level === 3 ? 'text-xl font-semibold sm:text-2xl' : 'text-[1.75rem] font-bold sm:text-[2.1rem]',
        )}
      >
        {content.text}
      </Tag>
    </div>
  )
}

export function HeadingEditor({ content, onChange }: BlockEditorProps<'heading'>) {
  return (
    <div className="pt-2">
      <InlineInput
        value={content.eyebrow}
        onChange={(eyebrow) => onChange({ eyebrow })}
        placeholder="Dachzeile (optional)"
        className="mb-1.5 text-xs font-semibold tracking-[0.14em] text-brand-accent-text uppercase"
      />
      <InlineInput
        value={content.text}
        onChange={(text) => onChange({ text })}
        placeholder="Überschrift"
        className={cn(
          'font-brand-heading leading-tight text-ink',
          content.level === 3 ? 'text-xl font-semibold sm:text-2xl' : 'text-[1.75rem] font-bold sm:text-[2.1rem]',
        )}
      />
      <SettingsPanel>
        <SettingsRow label="Ebene">
          <Segmented
            size="sm"
            value={String(content.level)}
            onChange={(v) => onChange({ level: v === '3' ? 3 : 2 })}
            options={[
              { value: '2', label: 'Abschnitt' },
              { value: '3', label: 'Unterabschnitt' },
            ]}
          />
        </SettingsRow>
      </SettingsPanel>
    </div>
  )
}

/* ---------- Text ---------- */

export function TextView({ content }: BlockViewProps<'text'>) {
  return <RichText html={content.html} className={cn(content.columns === 2 && 'md:columns-2 md:gap-10')} />
}

export function TextEditor({ content, onChange }: BlockEditorProps<'text'>) {
  return (
    <div>
      <RichTextEditor value={content.html} onChange={(html) => onChange({ html })} autoFocus />
      <SettingsPanel>
        <SettingsRow label="Spalten">
          <Segmented
            size="sm"
            value={String(content.columns)}
            onChange={(v) => onChange({ columns: v === '2' ? 2 : 1 })}
            options={[
              { value: '1', label: 'Eine' },
              { value: '2', label: 'Zwei' },
            ]}
          />
        </SettingsRow>
      </SettingsPanel>
    </div>
  )
}

/* ---------- Hinweis ---------- */

const TONES: Record<CalloutTone, { label: string; icon: typeof Info; className: string }> = {
  info: { label: 'Info', icon: Info, className: 'bg-info-soft border-info/25 [&_.callout-icon]:text-info' },
  tip: { label: 'Tipp', icon: Lightbulb, className: 'bg-success-soft border-success/25 [&_.callout-icon]:text-success' },
  warning: {
    label: 'Achtung',
    icon: AlertTriangle,
    className: 'bg-warning-soft border-warning/25 [&_.callout-icon]:text-warning',
  },
  danger: {
    label: 'Verbot',
    icon: OctagonAlert,
    className: 'bg-danger-soft border-danger/25 [&_.callout-icon]:text-danger',
  },
}

export function CalloutView({ content }: BlockViewProps<'callout'>) {
  const tone = TONES[content.tone] ?? TONES.info
  const Icon = tone.icon
  return (
    <div className={cn('flex gap-3 rounded-2xl border p-4 sm:p-5', tone.className)}>
      <Icon className="callout-icon mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {content.title && <p className="mb-1 font-semibold text-ink">{content.title}</p>}
        <RichText html={content.html} className="text-[15px] [&_p]:text-ink-2" />
      </div>
    </div>
  )
}

export function CalloutEditor({ content, onChange }: BlockEditorProps<'callout'>) {
  const tone = TONES[content.tone] ?? TONES.info
  const Icon = tone.icon
  return (
    <div>
      <div className={cn('flex gap-3 rounded-2xl border p-4', tone.className)}>
        <Icon className="callout-icon mt-1 size-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <InlineInput
            value={content.title}
            onChange={(title) => onChange({ title })}
            placeholder="Titel (optional)"
            className="font-semibold text-ink"
          />
          <RichTextEditor value={content.html} onChange={(html) => onChange({ html })} headings={false} />
        </div>
      </div>
      <SettingsPanel>
        <SettingsRow label="Art">
          <Segmented
            size="sm"
            value={content.tone}
            onChange={(t) => onChange({ tone: t })}
            options={(Object.keys(TONES) as CalloutTone[]).map((t) => ({ value: t, label: TONES[t].label }))}
          />
        </SettingsRow>
      </SettingsPanel>
    </div>
  )
}

/* ---------- Zitat ---------- */

export function QuoteView({ content }: BlockViewProps<'quote'>) {
  if (!content.text) return null
  return (
    <figure className="relative border-l-4 border-brand-accent py-1 pl-5 sm:pl-7">
      <blockquote
        className={cn(
          'font-brand-heading leading-snug text-ink',
          content.size === 'large' ? 'text-2xl font-semibold sm:text-[2rem]' : 'text-xl',
        )}
      >
        „{content.text}“
      </blockquote>
      {content.source && <figcaption className="mt-3 text-sm text-muted">— {content.source}</figcaption>}
    </figure>
  )
}

export function QuoteEditor({ content, onChange }: BlockEditorProps<'quote'>) {
  return (
    <div>
      <figure className="border-l-4 border-brand-accent py-1 pl-5 sm:pl-7">
        <InlineInput
          multiline
          value={content.text}
          onChange={(text) => onChange({ text })}
          placeholder="Claim, Leitsatz oder Zitat"
          className={cn(
            'font-brand-heading leading-snug text-ink',
            content.size === 'large' ? 'text-2xl font-semibold sm:text-[2rem]' : 'text-xl',
          )}
        />
        <InlineInput
          value={content.source}
          onChange={(source) => onChange({ source })}
          placeholder="Quelle (optional)"
          className="mt-2 text-sm text-muted"
        />
      </figure>
      <SettingsPanel>
        <SettingsRow label="Größe">
          <Segmented
            size="sm"
            value={content.size}
            onChange={(size) => onChange({ size })}
            options={[
              { value: 'large', label: 'Groß' },
              { value: 'normal', label: 'Normal' },
            ]}
          />
        </SettingsRow>
      </SettingsPanel>
    </div>
  )
}

/* ---------- Checkliste ---------- */

export function ChecklistView({ content, block }: BlockViewProps<'checklist'>) {
  const storageKey = `checklist:${block.id}`
  const [checked, setChecked] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? '[]') as string[]
    } catch {
      return []
    }
  })
  const toggle = (id: string) => {
    const next = checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id]
    setChecked(next)
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      // Speicher nicht verfügbar
    }
  }
  const items = content.items.filter((i) => i.text.trim())
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      {content.title && <p className="mb-3 font-semibold text-ink">{content.title}</p>}
      <ul className="space-y-1">
        {items.map((item) => {
          const done = checked.includes(item.id)
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => toggle(item.id)}
                className="flex w-full items-start gap-3 rounded-lg px-1 py-1.5 text-left hover:bg-surface-2"
                aria-pressed={done}
              >
                <span
                  className={cn(
                    'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border-2',
                    done ? 'border-success bg-success text-white' : 'border-border-strong',
                  )}
                >
                  {done && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span className={cn('text-[15px] text-ink-2', done && 'text-muted line-through')}>{item.text}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {items.length > 0 && <p className="mt-3 text-xs text-muted">Dein Häkchen-Stand wird nur in diesem Browser gespeichert.</p>}
    </div>
  )
}

export function ChecklistEditor({ content, onChange }: BlockEditorProps<'checklist'>) {
  const ops = listOps(content.items, (items) => onChange({ items }))
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <InlineInput
        value={content.title}
        onChange={(title) => onChange({ title })}
        placeholder="Titel der Checkliste"
        className="font-semibold text-ink"
      />
      {content.items.map((item, i) => (
        <div key={item.id} className="flex items-center gap-2">
          <span className="size-5 shrink-0 rounded-md border-2 border-border-strong" />
          <Input
            value={item.text}
            onChange={(e) => ops.update(i, { text: e.target.value })}
            placeholder="Prüfpunkt"
            onKeyDown={(e) => {
              if (e.key === 'Enter') ops.add({ id: uniqueId(), text: '' })
            }}
          />
          <ItemControls index={i} count={content.items.length} onMove={ops.move} onRemove={() => ops.remove(i)} />
        </div>
      ))}
      <AddItemButton onClick={() => ops.add({ id: uniqueId(), text: '' })}>Punkt hinzufügen</AddItemButton>
    </div>
  )
}

/* ---------- Tabelle ---------- */

export function TableView({ content }: BlockViewProps<'table'>) {
  const head = content.header ? (content.rows[0] ?? null) : null
  const body = content.header ? content.rows.slice(1) : content.rows
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full min-w-[480px] border-collapse text-left text-sm">
        {head && (
          <thead>
            <tr className="bg-surface-2">
              {head.map((cell, i) => (
                <th key={i} className="px-4 py-3 font-semibold text-ink">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {body.map((row, r) => (
            <tr key={r} className="border-t border-border">
              {row.map((cell, c) => (
                <td key={c} className={cn('px-4 py-3 align-top text-ink-2', c === 0 && 'font-medium text-ink')}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function TableEditor({ content, onChange }: BlockEditorProps<'table'>) {
  const rows = content.rows.length > 0 ? content.rows : [['']]
  const cols = Math.max(...rows.map((r) => r.length))
  const setCell = (r: number, c: number, value: string) =>
    onChange({ rows: rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? value : cell)) : row)) })
  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface p-2">
        <table className="w-full min-w-[480px] border-separate border-spacing-1">
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {Array.from({ length: cols }, (_, c) => (
                  <td key={c}>
                    <Input
                      value={row[c] ?? ''}
                      onChange={(e) => setCell(r, c, e.target.value)}
                      className={cn('h-9', content.header && r === 0 && 'bg-surface-2 font-semibold')}
                      aria-label={`Zeile ${r + 1}, Spalte ${c + 1}`}
                    />
                  </td>
                ))}
                <td className="w-9">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Zeile löschen"
                    disabled={rows.length <= 1}
                    onClick={() => onChange({ rows: rows.filter((_, i) => i !== r) })}
                  >
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SettingsPanel>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onChange({ rows: [...rows, Array(cols).fill('')] })}>
            <Plus /> Zeile
          </Button>
          <Button size="sm" variant="outline" onClick={() => onChange({ rows: rows.map((row) => [...row, '']) })}>
            <Plus /> Spalte
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={cols <= 1}
            onClick={() => onChange({ rows: rows.map((row) => row.slice(0, cols - 1)) })}
          >
            <Trash2 /> Letzte Spalte
          </Button>
        </div>
        <Switch checked={content.header} onCheckedChange={(header) => onChange({ header })} label="Erste Zeile als Kopfzeile" />
      </SettingsPanel>
    </div>
  )
}

/* ---------- Akkordeon ---------- */

export function AccordionView({ content }: BlockViewProps<'accordion'>) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {content.items.map((item) => (
        <details key={item.id} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 font-medium text-ink hover:bg-surface-2 sm:px-5 [&::-webkit-details-marker]:hidden">
            {item.title}
            <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-4 sm:px-5">
            <RichText html={item.html} />
          </div>
        </details>
      ))}
    </div>
  )
}

export function AccordionEditor({ content, onChange }: BlockEditorProps<'accordion'>) {
  const ops = listOps(content.items, (items) => onChange({ items }))
  return (
    <div className="space-y-3">
      {content.items.map((item, i) => (
        <div key={item.id} className="space-y-2 rounded-2xl border border-border bg-surface p-3">
          <div className="flex items-center gap-2">
            <Input
              value={item.title}
              onChange={(e) => ops.update(i, { title: e.target.value })}
              placeholder="Titel / Frage"
              className="font-medium"
            />
            <ItemControls index={i} count={content.items.length} onMove={ops.move} onRemove={() => ops.remove(i)} />
          </div>
          <RichTextEditor value={item.html} onChange={(html) => ops.update(i, { html })} headings={false} />
        </div>
      ))}
      <AddItemButton onClick={() => ops.add({ id: uniqueId(), title: '', html: '' })}>Eintrag hinzufügen</AddItemButton>
    </div>
  )
}

/* ---------- Trenner ---------- */

const DIVIDER_SPACE = { s: 'py-2', m: 'py-5', l: 'py-10' }

export function DividerView({ content }: BlockViewProps<'divider'>) {
  return (
    <div className={DIVIDER_SPACE[content.size] ?? 'py-5'} aria-hidden>
      {content.style === 'line' && <hr className="border-border" />}
    </div>
  )
}

export function DividerEditor({ content, onChange }: BlockEditorProps<'divider'>) {
  return (
    <div>
      <DividerView content={content} block={undefined as never} />
      <SettingsPanel>
        <SettingsRow label="Darstellung">
          <Segmented
            size="sm"
            value={content.style}
            onChange={(style) => onChange({ style })}
            options={[
              { value: 'line', label: 'Linie' },
              { value: 'space', label: 'Abstand' },
            ]}
          />
          <Segmented
            size="sm"
            value={content.size}
            onChange={(size) => onChange({ size })}
            options={[
              { value: 's', label: 'S' },
              { value: 'm', label: 'M' },
              { value: 'l', label: 'L' },
            ]}
          />
        </SettingsRow>
      </SettingsPanel>
    </div>
  )
}

/* ---------- Team-Notiz ---------- */

export function NoteView({ content }: BlockViewProps<'note'>) {
  const { editMode } = useBrandContext()
  if (!editMode) return null
  return (
    <div className="flex gap-3 rounded-2xl border border-dashed border-warning/50 bg-warning-soft/60 p-4">
      <StickyNote className="mt-0.5 size-5 shrink-0 text-warning" />
      <div className="min-w-0">
        <p className="mb-1 text-xs font-semibold tracking-wide text-warning uppercase">Team-Notiz · nur im Bearbeitungsmodus</p>
        <RichText html={content.html} className="text-sm" />
      </div>
    </div>
  )
}

export function NoteEditor({ content, onChange }: BlockEditorProps<'note'>) {
  return (
    <div className="rounded-2xl border border-dashed border-warning/50 bg-warning-soft/60 p-3">
      <p className="mb-2 text-xs font-semibold tracking-wide text-warning uppercase">
        Team-Notiz · Leser:innen sehen sie nicht
      </p>
      <RichTextEditor value={content.html} onChange={(html) => onChange({ html })} headings={false} autoFocus />
    </div>
  )
}

/* ---------- Code ---------- */

const LANGUAGES = ['html', 'css', 'scss', 'javascript', 'json', 'markdown', 'text']

export function CodeView({ content }: BlockViewProps<'code'>) {
  if (!content.code) return null
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-[#15171F] text-[#EDEBE5]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs">
        <span className="font-mono tracking-wide text-white/60 uppercase">{content.language}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(content.code)
            toast.success('Code kopiert')
          }}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-white/70 hover:bg-white/10 hover:text-white"
        >
          <Copy className="size-3.5" /> Kopieren
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed">
        <code>{content.code}</code>
      </pre>
    </div>
  )
}

export function CodeEditor({ content, onChange }: BlockEditorProps<'code'>) {
  return (
    <div className="space-y-2">
      <Select value={content.language} onChange={(e) => onChange({ language: e.target.value })} className="w-48">
        {LANGUAGES.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </Select>
      <Textarea
        value={content.code}
        onChange={(e) => onChange({ code: e.target.value })}
        rows={8}
        spellCheck={false}
        className="font-mono text-[13px]"
        placeholder="<!-- Code hier einfügen -->"
      />
    </div>
  )
}
