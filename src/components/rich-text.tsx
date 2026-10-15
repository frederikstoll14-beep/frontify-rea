import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import DOMPurify from 'dompurify'
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Quote, Underline, Unlink } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { cn } from '@/lib/utils'

const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'code', 'pre', 'hr']

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|\/|#)/i,
  })
}

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

export function RichText({ html, className }: { html: string; className?: string }) {
  const clean = useMemo(() => sanitizeHtml(html), [html])
  if (!clean.trim()) return null
  return <div className={cn('prose-brand', className)} dangerouslySetInnerHTML={{ __html: clean }} />
}

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'flex size-8 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-surface-2 [&_svg]:size-4',
        active && 'bg-surface-2 text-ink',
      )}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor, headings }: { editor: Editor; headings: boolean }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      link: e.isActive('link'),
    }),
  })

  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link-Adresse (https://…)', previous ?? 'https://')
    if (url === null) return
    if (url.trim() === '' || url === 'https://') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1.5 py-1" role="toolbar" aria-label="Formatierung">
      <ToolbarButton label="Fett" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold />
      </ToolbarButton>
      <ToolbarButton label="Kursiv" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic />
      </ToolbarButton>
      <ToolbarButton
        label="Unterstrichen"
        active={state.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline />
      </ToolbarButton>
      {headings && (
        <>
          <span className="mx-1 h-5 w-px bg-border" />
          <ToolbarButton
            label="Zwischenüberschrift"
            active={state.h2}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 />
          </ToolbarButton>
          <ToolbarButton
            label="Kleine Überschrift"
            active={state.h3}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <Heading3 />
          </ToolbarButton>
        </>
      )}
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolbarButton label="Liste" active={state.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List />
      </ToolbarButton>
      <ToolbarButton
        label="Nummerierte Liste"
        active={state.ordered}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered />
      </ToolbarButton>
      <ToolbarButton label="Zitat" active={state.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote />
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolbarButton label="Link" active={state.link} onClick={setLink}>
        <Link2 />
      </ToolbarButton>
      {state.link && (
        <ToolbarButton label="Link entfernen" onClick={() => editor.chain().focus().unsetLink().run()}>
          <Unlink />
        </ToolbarButton>
      )}
    </div>
  )
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Text eingeben …',
  headings = true,
  className,
  autoFocus,
}: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  headings?: boolean
  className?: string
  autoFocus?: boolean
}) {
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        codeBlock: false,
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: sanitizeHtml(value),
    autofocus: autoFocus ? 'end' : false,
    editorProps: { attributes: { class: 'min-h-[3rem] px-3 py-2.5 focus:outline-none' } },
    onUpdate: ({ editor: e }) => {
      const html = e.isEmpty ? '' : e.getHTML()
      onChangeRef.current(html)
    },
  })

  if (!editor) return null
  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-surface focus-within:border-ring', className)}>
      <Toolbar editor={editor} headings={headings} />
      <EditorContent editor={editor} className="prose-brand" />
    </div>
  )
}
