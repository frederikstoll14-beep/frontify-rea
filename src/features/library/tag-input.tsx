import { X } from 'lucide-react'
import { useState } from 'react'

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40)
}

export function TagInput({ value, onChange, placeholder = 'Tag hinzufügen' }: { value: string[]; onChange: (tags: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState('')
  const add = (raw: string) => {
    const tags = raw
      .split(',')
      .map(normalizeTag)
      .filter((t) => t && !value.includes(t))
    if (tags.length > 0) onChange([...value, ...tags])
    setInput('')
  }
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1.5 focus-within:border-ring">
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pr-1 pl-2.5 text-xs font-medium text-ink-2">
          {tag}
          <button
            type="button"
            aria-label={`Tag ${tag} entfernen`}
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="rounded-full p-0.5 hover:bg-border"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => {
          if (e.target.value.includes(',')) add(e.target.value)
          else setInput(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add(input)
          } else if (e.key === 'Backspace' && !input && value.length > 0) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={() => input && add(input)}
        placeholder={value.length === 0 ? placeholder : ''}
        className="min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted"
        aria-label={placeholder}
      />
    </div>
  )
}
