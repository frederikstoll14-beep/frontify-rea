import type { CalloutTone, CardItem, DoDontItem } from '@/lib/blocks/types'
import type { TemplateBlock, TemplateChapter, TemplatePage } from './types'

const id = () => crypto.randomUUID()

export const heading = (text: string, eyebrow = ''): TemplateBlock => ({
  type: 'heading',
  content: { text, level: 2, eyebrow },
})

export const subheading = (text: string): TemplateBlock => ({
  type: 'heading',
  content: { text, level: 3, eyebrow: '' },
})

export const text = (html: string, width?: TemplateBlock['width']): TemplateBlock => ({
  type: 'text',
  width,
  content: { html, columns: 1 },
})

export const callout = (tone: CalloutTone, title: string, html: string): TemplateBlock => ({
  type: 'callout',
  content: { tone, title, html },
})

/** Leitfrage für Studierende – erscheint als Tipp-Box. */
export const task = (html: string): TemplateBlock => callout('tip', 'Leitfragen', html)

export const note = (html: string): TemplateBlock => ({ type: 'note', content: { html } })

export const quote = (textValue: string, source = ''): TemplateBlock => ({
  type: 'quote',
  content: { text: textValue, source, size: 'large' },
})

export const cards = (
  items: Array<Pick<CardItem, 'title' | 'text'>>,
  columns: 2 | 3 | 4 = 3,
  style: 'plain' | 'filled' | 'outline' = 'filled',
): TemplateBlock => ({
  type: 'cards',
  content: {
    columns,
    style,
    imageRatio: 'landscape',
    items: items.map((item) => ({ id: id(), image: null, link: '', ...item })),
  },
})

export const dosDonts = (items: Array<Pick<DoDontItem, 'kind' | 'title' | 'text'>>, columns: 1 | 2 | 3 = 2) =>
  ({
    type: 'dos_donts',
    content: { columns, items: items.map((item) => ({ id: id(), image: null, ...item })) },
  }) satisfies TemplateBlock

export const table = (rows: string[][]): TemplateBlock => ({ type: 'table', content: { header: true, rows } })

export const checklist = (title: string, items: string[]): TemplateBlock => ({
  type: 'checklist',
  content: { title, items: items.map((t) => ({ id: id(), text: t })) },
})

export const accordion = (items: Array<{ title: string; html: string }>): TemplateBlock => ({
  type: 'accordion',
  content: { items: items.map((item) => ({ id: id(), ...item })) },
})

export const colorsBlock = (layout: 'cards' | 'list' | 'strip' = 'cards'): TemplateBlock => ({
  type: 'colors',
  content: { paletteIds: [], layout, showContrast: true, showScale: false },
})

export const typographyBlock = (mode: 'both' | 'fonts' | 'styles' = 'both'): TemplateBlock => ({
  type: 'typography',
  content: { mode, fontIds: [], styleIds: [] },
})

export const logosBlock = (): TemplateBlock => ({
  type: 'logos',
  content: { items: [], columns: 2, allowDownload: true },
})

export const galleryBlock = (): TemplateBlock => ({
  type: 'gallery',
  content: { items: [], columns: 3, ratio: '4:3' },
})

export const imageBlock = (caption = ''): TemplateBlock => ({
  type: 'image',
  content: { image: null, caption, alt: '', background: 'checker', fit: 'contain', ratio: '16:9' },
})

export const assetsBlock = (title: string, description = ''): TemplateBlock => ({
  type: 'assets',
  content: { title, description, assetIds: [], columns: 4, showDownloadAll: true, background: 'light' },
})

export const downloadKit = (): TemplateBlock => ({ type: 'download_kit', content: {} })

export const divider = (): TemplateBlock => ({ type: 'divider', content: { style: 'line', size: 'm' } })

export const page = (title: string, intro: string, blocks: TemplateBlock[], slug?: string): TemplatePage => ({
  title,
  intro,
  blocks,
  slug,
})

export const chapter = (title: string, pages: TemplatePage[]): TemplateChapter => ({
  kind: 'chapter',
  title,
  pages,
})

export const ul = (items: string[]): string => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`

export const p = (...paragraphs: string[]): string => paragraphs.map((t) => `<p>${t}</p>`).join('')
