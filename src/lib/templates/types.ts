import type { BlockContentMap, BlockType, BlockWidth } from '@/lib/blocks/types'

/** Format, das public.apply_brand_template(p_brand, p_template) versteht. */

export interface BrandTheme {
  primary?: string
  accent?: string
  headingFont?: string
  bodyFont?: string
  /** Hintergrund des Portal-Hero-Bereichs */
  heroStyle?: 'brand' | 'light' | 'dark' | 'image'
  radius?: 'none' | 'small' | 'large'
  logoBackground?: 'light' | 'dark' | 'brand'
}

export interface QuickLink {
  label: string
  url: string
}

export interface BrandHome {
  welcome?: string
  quickLinks?: QuickLink[]
  showColors?: boolean
  showLibraries?: boolean
}

export interface TemplateColor {
  name: string
  hex: string
  token?: string
  cmyk?: string
  pantone?: string
  hks?: string
  ral?: string
  ncs?: string
  usage?: string
  description?: string
}

export interface TemplatePalette {
  name: string
  description?: string
  colors: TemplateColor[]
}

export interface TemplateFont {
  family: string
  source?: 'google' | 'upload' | 'system'
  role?: string
  weights?: number[]
  fallback?: string
  license?: string
  description?: string
}

export interface TemplateTextStyle {
  name: string
  token?: string
  fontFamily: string
  fontWeight?: number
  fontSize?: number
  lineHeight?: number
  letterSpacing?: number
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  italic?: boolean
  sample?: string
  usage?: string
}

export interface TemplateLibrary {
  name: string
  kind: 'media' | 'logos' | 'icons' | 'documents' | 'templates' | 'audio_video'
  slug?: string
  description?: string
}

export type TemplateBlock = {
  [K in BlockType]: { type: K; width?: BlockWidth; content: Partial<BlockContentMap[K]> }
}[BlockType]

export interface TemplatePage {
  kind?: 'page'
  title: string
  slug?: string
  intro?: string
  blocks?: TemplateBlock[]
}

export interface TemplateChapter {
  kind: 'chapter'
  title: string
  pages: TemplatePage[]
}

export interface TemplateGuideline {
  title: string
  slug?: string
  description?: string
  icon?: string
  items: Array<TemplateChapter | TemplatePage>
}

export interface BrandTemplateData {
  theme?: BrandTheme
  home?: BrandHome
  palettes?: TemplatePalette[]
  fonts?: TemplateFont[]
  textStyles?: TemplateTextStyle[]
  libraries?: TemplateLibrary[]
  guidelines?: TemplateGuideline[]
}

export interface BrandTemplate {
  id: string
  name: string
  description: string
  orgType: OrgType
  data: BrandTemplateData
}

export type OrgType = 'verein' | 'unternehmen' | 'verband' | 'organisation' | 'event' | 'athlet'

export const ORG_TYPES: Record<OrgType, string> = {
  verein: 'Verein',
  unternehmen: 'Unternehmen',
  verband: 'Verband / Liga',
  organisation: 'Organisation',
  event: 'Event / Turnier',
  athlet: 'Athlet:in / Personenmarke',
}
