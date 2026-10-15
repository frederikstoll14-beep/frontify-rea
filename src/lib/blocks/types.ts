/**
 * Inhalts-Schemas der Guideline-Bausteine.
 * Die Daten liegen als JSON in public.blocks.content.
 */

export interface ImageRef {
  /** Pfad im Storage-Bucket "brand-files" (beginnt mit der brand_id). */
  path: string
  width?: number | null
  height?: number | null
  /** Optional: verknüpftes Asset aus einer Bibliothek. */
  assetId?: string | null
  mime?: string | null
}

export type BlockWidth = 'full' | 'two_thirds' | 'half' | 'third' | 'quarter'

export type PreviewBackground = 'light' | 'dark' | 'brand' | 'checker'

export interface HeadingContent {
  text: string
  level: 2 | 3
  eyebrow: string
}

export interface TextContent {
  html: string
  columns: 1 | 2
}

export type CalloutTone = 'info' | 'tip' | 'warning' | 'danger'

export interface CalloutContent {
  tone: CalloutTone
  title: string
  html: string
}

export interface QuoteContent {
  text: string
  source: string
  size: 'large' | 'normal'
}

export interface ChecklistItem {
  id: string
  text: string
}

export interface ChecklistContent {
  title: string
  items: ChecklistItem[]
}

export interface TableContent {
  header: boolean
  rows: string[][]
}

export interface AccordionItem {
  id: string
  title: string
  html: string
}

export interface AccordionContent {
  items: AccordionItem[]
}

export interface ColorValueToggles {
  rgb: boolean
  hsl: boolean
  cmyk: boolean
  pantone: boolean
  hks: boolean
  ral: boolean
  ncs: boolean
}

export interface ColorsContent {
  /** Leer = alle Paletten der Marke. */
  paletteIds: string[]
  layout: 'cards' | 'list' | 'strip'
  values: ColorValueToggles
  showContrast: boolean
  showScale: boolean
}

export interface TypographyContent {
  mode: 'both' | 'fonts' | 'styles'
  /** Leer = alle. */
  fontIds: string[]
  styleIds: string[]
  sampleText: string
}

export interface LogoItem {
  id: string
  assetId: string | null
  image: ImageRef | null
  label: string
  description: string
  background: PreviewBackground
}

export interface LogosContent {
  items: LogoItem[]
  columns: 1 | 2 | 3 | 4
  allowDownload: boolean
}

export interface DoDontItem {
  id: string
  kind: 'do' | 'dont'
  title: string
  text: string
  image: ImageRef | null
}

export interface DosDontsContent {
  items: DoDontItem[]
  columns: 1 | 2 | 3
}

export interface CardItem {
  id: string
  title: string
  text: string
  image: ImageRef | null
  link: string
}

export interface CardsContent {
  items: CardItem[]
  columns: 2 | 3 | 4
  style: 'plain' | 'filled' | 'outline'
  imageRatio: 'square' | 'landscape' | 'portrait'
}

export interface ImageContent {
  image: ImageRef | null
  alt: string
  caption: string
  background: PreviewBackground | 'none'
  fit: 'contain' | 'cover'
  ratio: 'auto' | '1:1' | '4:3' | '16:9' | '3:2'
  allowDownload: boolean
}

export interface GalleryItem {
  id: string
  image: ImageRef | null
  caption: string
}

export interface GalleryContent {
  items: GalleryItem[]
  columns: 2 | 3 | 4
  ratio: '1:1' | '4:3' | '16:9' | '3:4'
}

export interface VideoContent {
  url: string
  file: ImageRef | null
  caption: string
}

export interface AudioContent {
  file: ImageRef | null
  title: string
  caption: string
}

export interface EmbedContent {
  url: string
  height: number
  caption: string
}

export interface AssetsContent {
  title: string
  description: string
  assetIds: string[]
  columns: 2 | 3 | 4 | 5
  showDownloadAll: boolean
  background: PreviewBackground
}

export interface DividerContent {
  style: 'line' | 'space'
  size: 's' | 'm' | 'l'
}

export interface NoteContent {
  html: string
}

export interface CodeContent {
  language: string
  code: string
}

export interface DownloadKitContent {
  title: string
  description: string
  formats: Array<'css' | 'scss' | 'json' | 'tailwind' | 'ase'>
}

export interface BlockContentMap {
  heading: HeadingContent
  text: TextContent
  callout: CalloutContent
  quote: QuoteContent
  checklist: ChecklistContent
  table: TableContent
  accordion: AccordionContent
  colors: ColorsContent
  typography: TypographyContent
  logos: LogosContent
  dos_donts: DosDontsContent
  cards: CardsContent
  image: ImageContent
  gallery: GalleryContent
  video: VideoContent
  audio: AudioContent
  embed: EmbedContent
  assets: AssetsContent
  divider: DividerContent
  note: NoteContent
  code: CodeContent
  download_kit: DownloadKitContent
}

export type BlockType = keyof BlockContentMap

export const BLOCK_TYPES = [
  'heading',
  'text',
  'callout',
  'quote',
  'checklist',
  'table',
  'accordion',
  'colors',
  'typography',
  'logos',
  'dos_donts',
  'cards',
  'image',
  'gallery',
  'video',
  'audio',
  'embed',
  'assets',
  'divider',
  'note',
  'code',
  'download_kit',
] as const satisfies readonly BlockType[]

export function isBlockType(value: string): value is BlockType {
  return (BLOCK_TYPES as readonly string[]).includes(value)
}

export type BlockCategory = 'text' | 'brand' | 'media' | 'structure'

export interface BlockMeta {
  label: string
  description: string
  category: BlockCategory
  keywords: string[]
}

export const BLOCK_CATEGORIES: Record<BlockCategory, string> = {
  text: 'Text',
  brand: 'Marke',
  media: 'Medien & Dateien',
  structure: 'Struktur',
}

export const BLOCK_META: Record<BlockType, BlockMeta> = {
  heading: {
    label: 'Überschrift',
    description: 'Abschnittstitel, erscheint im Seiten-Inhaltsverzeichnis',
    category: 'text',
    keywords: ['titel', 'abschnitt', 'h2'],
  },
  text: {
    label: 'Text',
    description: 'Fließtext mit Formatierung, Listen und Links',
    category: 'text',
    keywords: ['absatz', 'rich text', 'beschreibung'],
  },
  callout: {
    label: 'Hinweis',
    description: 'Hervorgehobene Box für Info, Tipp oder Warnung',
    category: 'text',
    keywords: ['callout', 'info', 'warnung', 'tipp'],
  },
  quote: {
    label: 'Zitat',
    description: 'Claim, Leitsatz oder Zitat mit Quelle',
    category: 'text',
    keywords: ['claim', 'slogan', 'leitsatz'],
  },
  checklist: {
    label: 'Checkliste',
    description: 'Prüfpunkte, z. B. vor der Veröffentlichung',
    category: 'text',
    keywords: ['liste', 'todo', 'prüfen'],
  },
  table: {
    label: 'Tabelle',
    description: 'Strukturierte Übersicht, z. B. Zielgruppen oder Formate',
    category: 'text',
    keywords: ['raster', 'übersicht', 'matrix'],
  },
  accordion: {
    label: 'Akkordeon',
    description: 'Auf- und zuklappbare Abschnitte, z. B. FAQ',
    category: 'structure',
    keywords: ['faq', 'klappen', 'fragen'],
  },
  colors: {
    label: 'Farben',
    description: 'Farbpaletten mit HEX, RGB, CMYK, Pantone, HKS, RAL',
    category: 'brand',
    keywords: ['palette', 'farbe', 'cmyk', 'pantone', 'hks'],
  },
  typography: {
    label: 'Typografie',
    description: 'Schriften und Textstile mit Live-Vorschau',
    category: 'brand',
    keywords: ['schrift', 'font', 'textstil'],
  },
  logos: {
    label: 'Logos',
    description: 'Logo-Varianten auf passenden Hintergründen, mit Download',
    category: 'brand',
    keywords: ['wappen', 'signet', 'wortmarke', 'bildmarke'],
  },
  dos_donts: {
    label: 'Do & Don’t',
    description: 'Richtige und falsche Anwendung gegenüberstellen',
    category: 'brand',
    keywords: ['richtig', 'falsch', 'regeln', 'tonalität'],
  },
  cards: {
    label: 'Karten',
    description: 'Kacheln für Werte, Personas, Zielgruppen oder Links',
    category: 'brand',
    keywords: ['werte', 'persona', 'kacheln', 'grid'],
  },
  image: {
    label: 'Bild',
    description: 'Einzelbild mit Bildunterschrift',
    category: 'media',
    keywords: ['foto', 'grafik', 'abbildung'],
  },
  gallery: {
    label: 'Galerie',
    description: 'Bildraster, z. B. für die Bildsprache',
    category: 'media',
    keywords: ['bilder', 'moodboard', 'bildwelt'],
  },
  video: {
    label: 'Video',
    description: 'YouTube, Vimeo oder hochgeladenes Video',
    category: 'media',
    keywords: ['film', 'youtube', 'vimeo', 'clip'],
  },
  audio: {
    label: 'Audio',
    description: 'Sound-Logo, Einlaufmusik, Jingle',
    category: 'media',
    keywords: ['sound', 'jingle', 'musik', 'hymne'],
  },
  embed: {
    label: 'Einbettung',
    description: 'Figma, Canva, Miro, Google Slides, Spotify …',
    category: 'media',
    keywords: ['figma', 'canva', 'miro', 'iframe'],
  },
  assets: {
    label: 'Dateien & Downloads',
    description: 'Ausgewählte Assets aus der Mediathek als Paket',
    category: 'media',
    keywords: ['download', 'asset kit', 'paket', 'dateien'],
  },
  download_kit: {
    label: 'Farb- & Token-Export',
    description: 'Farben und Schriften als CSS, JSON, ASE …',
    category: 'brand',
    keywords: ['export', 'tokens', 'ase', 'css', 'design tokens'],
  },
  divider: {
    label: 'Trenner',
    description: 'Linie oder Abstand',
    category: 'structure',
    keywords: ['linie', 'abstand', 'spacer'],
  },
  note: {
    label: 'Team-Notiz',
    description: 'Interne Notiz, nur im Bearbeitungsmodus sichtbar',
    category: 'structure',
    keywords: ['intern', 'todo', 'entwurf'],
  },
  code: {
    label: 'Code',
    description: 'Code-Schnipsel, z. B. für Web-Einbindung',
    category: 'structure',
    keywords: ['html', 'css', 'snippet'],
  },
}

export const DEFAULT_COLOR_VALUES: ColorValueToggles = {
  rgb: true,
  hsl: false,
  cmyk: true,
  pantone: true,
  hks: false,
  ral: false,
  ncs: false,
}

export function defaultContent<T extends BlockType>(type: T): BlockContentMap[T] {
  const defaults: { [K in BlockType]: () => BlockContentMap[K] } = {
    heading: () => ({ text: 'Neuer Abschnitt', level: 2, eyebrow: '' }),
    text: () => ({ html: '', columns: 1 }),
    callout: () => ({ tone: 'info', title: '', html: '' }),
    quote: () => ({ text: '', source: '', size: 'large' }),
    checklist: () => ({ title: '', items: [{ id: crypto.randomUUID(), text: '' }] }),
    table: () => ({
      header: true,
      rows: [
        ['Spalte 1', 'Spalte 2', 'Spalte 3'],
        ['', '', ''],
      ],
    }),
    accordion: () => ({ items: [{ id: crypto.randomUUID(), title: 'Frage', html: '' }] }),
    colors: () => ({
      paletteIds: [],
      layout: 'cards',
      values: { ...DEFAULT_COLOR_VALUES },
      showContrast: true,
      showScale: false,
    }),
    typography: () => ({
      mode: 'both',
      fontIds: [],
      styleIds: [],
      sampleText: 'Gemeinsam auf dem Platz. Gemeinsam für die Region.',
    }),
    logos: () => ({ items: [], columns: 2, allowDownload: true }),
    dos_donts: () => ({
      items: [
        { id: crypto.randomUUID(), kind: 'do', title: 'So geht’s', text: '', image: null },
        { id: crypto.randomUUID(), kind: 'dont', title: 'So bitte nicht', text: '', image: null },
      ],
      columns: 2,
    }),
    cards: () => ({
      items: [
        { id: crypto.randomUUID(), title: 'Titel', text: '', image: null, link: '' },
        { id: crypto.randomUUID(), title: 'Titel', text: '', image: null, link: '' },
        { id: crypto.randomUUID(), title: 'Titel', text: '', image: null, link: '' },
      ],
      columns: 3,
      style: 'filled',
      imageRatio: 'landscape',
    }),
    image: () => ({
      image: null,
      alt: '',
      caption: '',
      background: 'none',
      fit: 'contain',
      ratio: 'auto',
      allowDownload: false,
    }),
    gallery: () => ({ items: [], columns: 3, ratio: '4:3' }),
    video: () => ({ url: '', file: null, caption: '' }),
    audio: () => ({ file: null, title: '', caption: '' }),
    embed: () => ({ url: '', height: 480, caption: '' }),
    assets: () => ({
      title: 'Downloads',
      description: '',
      assetIds: [],
      columns: 4,
      showDownloadAll: true,
      background: 'light',
    }),
    divider: () => ({ style: 'line', size: 'm' }),
    note: () => ({ html: '' }),
    code: () => ({ language: 'html', code: '' }),
    download_kit: () => ({
      title: 'Farben & Schriften für Designer:innen und Entwickler:innen',
      description: '',
      formats: ['css', 'scss', 'json', 'tailwind', 'ase'],
    }),
  }
  return defaults[type]() as BlockContentMap[T]
}

/** Ergänzt fehlende Felder (z. B. aus älteren Vorlagen) mit Standardwerten. */
export function withDefaults<T extends BlockType>(type: T, content: unknown): BlockContentMap[T] {
  const base = defaultContent(type)
  if (!content || typeof content !== 'object' || Array.isArray(content)) return base
  return { ...base, ...(content as Partial<BlockContentMap[T]>) }
}

export const WIDTH_LABELS: Record<BlockWidth, string> = {
  full: 'Volle Breite',
  two_thirds: '2/3',
  half: '1/2',
  third: '1/3',
  quarter: '1/4',
}

export const WIDTH_CLASSES: Record<BlockWidth, string> = {
  full: 'col-span-12',
  two_thirds: 'col-span-12 md:col-span-8',
  half: 'col-span-12 md:col-span-6',
  third: 'col-span-12 sm:col-span-6 md:col-span-4',
  quarter: 'col-span-6 md:col-span-3',
}

/** Sammelt alle Storage-Pfade, die ein Baustein referenziert (für Vorschau-URLs). */
export function collectImagePaths(type: string, content: unknown): string[] {
  const paths: string[] = []
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    const record = value as Record<string, unknown>
    if (typeof record.path === 'string' && record.path.length > 0) paths.push(record.path)
    Object.values(record).forEach(visit)
  }
  if (type) visit(content)
  return paths
}

/** Asset-IDs, die ein Baustein referenziert. */
export function collectAssetIds(type: string, content: unknown): string[] {
  if (!content || typeof content !== 'object') return []
  const record = content as Record<string, unknown>
  if (type === 'assets' && Array.isArray(record.assetIds)) {
    return record.assetIds.filter((id): id is string => typeof id === 'string')
  }
  if (type === 'logos' && Array.isArray(record.items)) {
    return record.items
      .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>).assetId : null))
      .filter((id): id is string => typeof id === 'string')
  }
  return []
}
