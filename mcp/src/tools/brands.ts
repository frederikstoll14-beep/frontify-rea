import { z } from 'zod'
import { BLOCK_TYPES } from '@/lib/blocks/types'
import { buildBrandExport, parseBrandExport, stripForeignReferences } from '@/lib/brand-export'
import { TEMPLATES, getTemplate } from '@/lib/templates'
import { ORG_TYPES, type BrandTemplateData } from '@/lib/templates/types'
import { slugify } from '@/lib/utils'
import { affected, defined, requireChange, row, rows } from '../db'
import { ToolError } from '../errors'
import {
  assertBrandPath,
  optionalFileSourceShape,
  resolveFile,
  storeFile,
  discardStored,
  signedUrl,
} from '../files'
import { publishExport, removeBrandFiles } from '../storage-ops'
import { defineTool } from '../tool'

const ORG_KEYS = Object.keys(ORG_TYPES) as [keyof typeof ORG_TYPES, ...Array<keyof typeof ORG_TYPES>]

const themeShape = z
  .object({
    primary: z.string().optional().describe('Primärfarbe als HEX, z. B. #0B3C7A'),
    accent: z.string().optional().describe('Akzentfarbe als HEX'),
    headingFont: z.string().optional(),
    bodyFont: z.string().optional(),
    heroStyle: z.enum(['brand', 'light', 'dark', 'image']).optional(),
    radius: z.enum(['none', 'small', 'large']).optional(),
    logoBackground: z.enum(['light', 'dark', 'brand']).optional(),
  })
  .strict()

const homeShape = z
  .object({
    welcome: z.string().optional().describe('Begrüßungstext der Startseite'),
    quickLinks: z
      .array(z.object({ label: z.string(), url: z.string() }))
      .max(12)
      .optional(),
    showColors: z.boolean().optional(),
    showLibraries: z.boolean().optional(),
  })
  .strict()

const HEX = /^#[0-9a-f]{6}$/i

function checkTheme(theme: z.infer<typeof themeShape> | undefined): void {
  for (const key of ['primary', 'accent'] as const) {
    const value = theme?.[key]
    if (value !== undefined && !HEX.test(value))
      throw new ToolError(`theme.${key} muss ein HEX-Wert wie #0B3C7A sein.`)
  }
}

function checkQuickLinks(home: z.infer<typeof homeShape> | undefined): void {
  for (const link of home?.quickLinks ?? []) {
    if (!/^(https?:\/\/|mailto:|\/)/i.test(link.url)) {
      throw new ToolError(
        `Schnellzugriff „${link.label}“: Die Adresse muss mit http(s)://, mailto: oder / beginnen.`,
      )
    }
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

export const brandTools = [
  defineTool({
    name: 'list_templates',
    title: 'Vorlagen für neue Marken',
    description:
      'Listet die eingebauten Vorlagen mit Kapitelstruktur und Leitfragen (Verein, Unternehmen, Verband, Organisation, Leer, Demo-Portal) sowie die möglichen Organisationsarten.',
    input: {},
    kind: 'read',
    async run() {
      return {
        summary: `${TEMPLATES.length} Vorlagen.`,
        data: {
          templates: TEMPLATES.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            org_type: t.orgType,
            guidelines: (t.data.guidelines ?? []).map((g) => g.title),
          })),
          org_types: ORG_TYPES,
        },
      }
    },
  }),

  defineTool({
    name: 'create_brand',
    title: 'Marke (Projekt) anlegen',
    description:
      'Legt eine neue Marke in einem freigegebenen Workspace an, optional mit Vorlage (siehe list_templates). Du wirst Admin der Marke. Ohne Vorlage entsteht ein leeres Handbuch mit Standard-Bibliotheken.',
    input: {
      workspace: z
        .string()
        .optional()
        .describe('Workspace (Name, Kurz-URL oder ID); optional, wenn nur einer freigegeben ist'),
      name: z.string().min(1).max(120),
      org_type: z.enum(ORG_KEYS).optional().describe('Art der Organisation (Standard: organisation)'),
      tagline: z.string().max(200).optional().describe('Claim / Tagline'),
      template: z.string().optional().describe('Vorlagen-ID aus list_templates (Standard: leer)'),
    },
    kind: 'write',
    async run({ workspace: ref, name, org_type, tagline, template }, ctx) {
      await ctx.assertWriteAllowed()
      const ws = await ctx.workspace(ref)
      const chosen = getTemplate(template ?? 'leer')
      if (!chosen) {
        throw new ToolError(
          `Vorlage „${template}“ gibt es nicht.`,
          `Möglich: ${TEMPLATES.map((t) => t.id).join(', ')}.`,
        )
      }
      const brand = row(
        await ctx.sb.rpc('create_brand', {
          p_workspace: ws.id,
          p_name: name.trim(),
          p_org_type: org_type ?? chosen.orgType,
          p_tagline: tagline ?? '',
          p_template: JSON.parse(JSON.stringify(chosen.data)),
        }),
      )
      ctx.invalidateScope()
      return {
        summary: `Marke „${brand.name}“ in „${ws.name}“ angelegt (Vorlage: ${chosen.name}).`,
        data: {
          id: brand.id,
          name: brand.name,
          slug: brand.slug,
          workspace: ws.name,
          url: ctx.link(`/b/${brand.slug}`),
        },
      }
    },
  }),

  defineTool({
    name: 'update_brand',
    title: 'Marke bearbeiten',
    description:
      'Ändert Stammdaten einer Marke: Name, Kurz-URL, Claim, Beschreibung, Art, Sichtbarkeit sowie Theme (Farben/Schriften des Portals) und Startseite. theme und home werden mit den bestehenden Werten zusammengeführt. Erfordert Admin-Rolle. Öffentliche Freigabe: set_brand_sharing.',
    input: {
      brand: z.string().optional(),
      name: z.string().min(1).max(120).optional(),
      slug: z
        .string()
        .min(1)
        .max(80)
        .optional()
        .describe('Kurz-URL; wird zu Kleinbuchstaben/Bindestrichen normalisiert'),
      tagline: z.string().max(200).optional(),
      description: z.string().max(4000).optional(),
      org_type: z.enum(ORG_KEYS).optional(),
      visibility: z
        .enum(['private', 'workspace'])
        .optional()
        .describe('workspace = alle Workspace-Mitglieder dürfen ansehen, private = nur Eingeladene'),
      theme: themeShape.optional(),
      home: homeShape.optional(),
    },
    kind: 'write',
    idempotent: true,
    async run({ brand: ref, name, slug, tagline, description, org_type, visibility, theme, home }, ctx) {
      const brand = await ctx.adminBrand(ref)
      checkTheme(theme)
      checkQuickLinks(home)
      const patch: Record<string, unknown> = defined({
        name: name?.trim(),
        slug: slug ? slugify(slug) : undefined,
        tagline,
        description,
        org_type,
        visibility,
      })
      if (theme || home) {
        const current = row(await ctx.sb.from('brands').select('theme, home').eq('id', brand.id).single())
        if (theme) patch.theme = { ...asObject(current.theme), ...theme }
        if (home) patch.home = { ...asObject(current.home), ...home }
      }
      requireChange(patch)
      const [updated] = affected(
        await ctx.sb
          .from('brands')
          .update(patch as never)
          .eq('id', brand.id)
          .select('id, name, slug, tagline, org_type, visibility, theme, home'),
        'Marke',
      )
      ctx.invalidateScope()
      return {
        summary: `Marke „${updated.name}“ gespeichert.`,
        data: { ...updated, url: ctx.link(`/b/${updated.slug}`) },
      }
    },
  }),

  defineTool({
    name: 'set_brand_sharing',
    title: 'Öffentlichen Freigabelink steuern',
    description:
      'Schaltet den öffentlichen Link einer Marke ein oder aus (jede Person mit dem Link darf ansehen, ohne Anmeldung), setzt ein Ablaufdatum und erlaubt/verbietet Downloads. Zum Einschalten muss confirm_public=true gesetzt werden, weil Inhalte dann öffentlich sichtbar sind. Erfordert Admin-Rolle.',
    input: {
      brand: z.string().optional(),
      is_public: z.boolean().optional().describe('true = öffentlich, false = nicht öffentlich'),
      public_until: z
        .string()
        .nullable()
        .optional()
        .describe('Ablaufdatum (ISO, z. B. 2026-12-31) oder null für unbegrenzt'),
      public_downloads: z.boolean().optional().describe('Dürfen öffentliche Besucher Dateien herunterladen?'),
      confirm_public: z
        .boolean()
        .optional()
        .describe('Muss true sein, wenn is_public auf true gestellt wird'),
    },
    kind: 'write',
    idempotent: true,
    async run({ brand: ref, is_public, public_until, public_downloads, confirm_public }, ctx) {
      const brand = await ctx.adminBrand(ref)
      if (is_public === true && confirm_public !== true) {
        throw new ToolError(
          'Zum Veröffentlichen bitte confirm_public=true setzen.',
          `Danach kann jede Person mit dem Link „${brand.name}“ ohne Anmeldung ansehen.`,
        )
      }
      let until: string | null | undefined = undefined
      if (public_until !== undefined) {
        if (public_until === null) until = null
        else {
          const date = new Date(public_until)
          if (Number.isNaN(date.getTime())) throw new ToolError('public_until ist kein gültiges Datum.')
          until = date.toISOString()
        }
      }
      const patch = defined({ is_public, public_until: until, public_downloads })
      requireChange(patch)
      const [updated] = affected(
        await ctx.sb
          .from('brands')
          .update(patch)
          .eq('id', brand.id)
          .select('slug, is_public, public_until, public_downloads'),
        'Marke',
      )
      ctx.invalidateScope()
      return {
        summary: updated.is_public
          ? `„${brand.name}“ ist öffentlich${updated.public_until ? ` bis ${updated.public_until.slice(0, 10)}` : ''}.`
          : `„${brand.name}“ ist nicht öffentlich.`,
        data: { ...updated, public_url: updated.is_public ? ctx.link(`/b/${updated.slug}`) : null },
      }
    },
  }),

  defineTool({
    name: 'delete_brand',
    title: 'Marke löschen',
    description:
      'Löscht eine Marke samt Handbüchern, Farben, Schriften, Bibliotheken und allen Dateien. Unwiderruflich. Erfordert Admin-Rolle; confirm_name muss den exakten Namen der Marke enthalten.',
    input: {
      brand: z.string().describe('Marke (Name, Kurz-URL oder ID)'),
      confirm_name: z.string().describe('Exakter Name der Marke zur Bestätigung'),
    },
    kind: 'destructive',
    async run({ brand: ref, confirm_name }, ctx) {
      const brand = await ctx.adminBrand(ref)
      if (confirm_name.trim() !== brand.name) {
        throw new ToolError(`Zur Bestätigung muss confirm_name genau „${brand.name}“ lauten.`)
      }
      await removeBrandFiles(ctx, brand.id)
      affected(await ctx.sb.from('brands').delete().eq('id', brand.id).select('id'), 'Marke')
      ctx.invalidateScope()
      return { summary: `Marke „${brand.name}“ wurde gelöscht.` }
    },
  }),

  defineTool({
    name: 'apply_template',
    title: 'Vorlage zu einer Marke hinzufügen',
    description:
      'Fügt die Inhalte einer eingebauten Vorlage (Kapitel, Seiten, Farben, Schriften, Textstile, Bibliotheken) zu einer bestehenden Marke hinzu. Bestehende Inhalte bleiben erhalten.',
    input: { brand: z.string().optional(), template: z.string().describe('Vorlagen-ID aus list_templates') },
    kind: 'write',
    async run({ brand: ref, template }, ctx) {
      const brand = await ctx.editableBrand(ref)
      const chosen = getTemplate(template)
      if (!chosen)
        throw new ToolError(
          `Vorlage „${template}“ gibt es nicht.`,
          `Möglich: ${TEMPLATES.map((t) => t.id).join(', ')}.`,
        )
      const { error } = await ctx.sb.rpc('apply_brand_template', {
        p_brand: brand.id,
        p_template: JSON.parse(JSON.stringify({ ...chosen.data, theme: undefined, home: undefined })),
      })
      if (error) throw error
      return { summary: `Vorlage „${chosen.name}“ zu „${brand.name}“ hinzugefügt.` }
    },
  }),

  defineTool({
    name: 'export_brand',
    title: 'Marke als JSON exportieren',
    description:
      'Exportiert Struktur und Inhalte einer Marke (Handbücher, Bausteine, Farben, Schriften, Textstile, Bibliotheken, Theme) als JSON im Brandbench-Format. Taugt als Backup oder Vorlage; mit import_brand in andere Marken einspielbar. Dateien werden nicht eingebettet (dafür download_assets_zip).',
    input: { brand: z.string().optional() },
    kind: 'read',
    async run({ brand: ref }, ctx) {
      const scope = await ctx.brand(ref)
      const [brandRow, palettes, fonts, styles, libraries, guidelines] = await Promise.all([
        ctx.sb.from('brands').select('*').eq('id', scope.id).single(),
        ctx.sb.from('color_palettes').select('*, colors(*)').eq('brand_id', scope.id).order('sort'),
        ctx.sb.from('fonts').select('*').eq('brand_id', scope.id).order('sort'),
        ctx.sb.from('text_styles').select('*').eq('brand_id', scope.id).order('sort'),
        ctx.sb.from('libraries').select('*').eq('brand_id', scope.id).order('sort'),
        ctx.sb.from('guidelines').select('*').eq('brand_id', scope.id).order('sort'),
      ])
      const b = row(brandRow)
      const guidelineRows = rows(guidelines)
      const pages = guidelineRows.length
        ? rows(
            await ctx.sb
              .from('guideline_pages')
              .select('*')
              .in(
                'guideline_id',
                guidelineRows.map((g) => g.id),
              ),
          )
        : []
      const blocks = pages.length
        ? rows(
            await ctx.sb
              .from('blocks')
              .select('page_id, type, width, sort, content')
              .in(
                'page_id',
                pages.map((p) => p.id),
              ),
          )
        : []
      const file = buildBrandExport({
        brand: { id: b.id, name: b.name, slug: b.slug, theme: asObject(b.theme), home: asObject(b.home) },
        palettes: rows(palettes).map((p) => ({
          ...p,
          colors: [...p.colors].sort((x, y) => x.sort - y.sort),
        })),
        fonts: rows(fonts),
        textStyles: rows(styles).map((s) => ({
          ...s,
          font_size: Number(s.font_size),
          line_height: Number(s.line_height),
          letter_spacing: Number(s.letter_spacing),
        })),
        libraries: rows(libraries),
        guidelines: guidelineRows,
        pages,
        blocks,
      })
      const json = JSON.stringify(file)
      const fileName = `${scope.slug}-brandbench-${new Date().toISOString().slice(0, 10)}.json`
      const stats = {
        guidelines: guidelineRows.length,
        pages: pages.filter((p) => p.kind === 'page').length,
        blocks: blocks.length,
        palettes: rows(palettes).length,
        fonts: rows(fonts).length,
      }
      if (json.length <= 120_000) {
        return {
          summary: `Export von „${scope.name}“ (${Math.round(json.length / 1024)} KB).`,
          data: { file_name: fileName, stats, export: file },
        }
      }
      const published = await publishExport(ctx, scope, fileName, Buffer.from(json), 'application/json')
      if (published) {
        return {
          summary: `Export von „${scope.name}“ (${Math.round(json.length / 1024)} KB) liegt für 60 Minuten zum Download bereit.`,
          data: { file_name: fileName, stats, download_url: published.url },
        }
      }
      throw new ToolError(
        `Der Export ist mit ${Math.round(json.length / 1024)} KB zu groß für die direkte Antwort.`,
        'Mit Bearbeitungsrechten wird er als Download-Link bereitgestellt.',
      )
    },
  }),

  defineTool({
    name: 'import_brand',
    title: 'JSON-Export in eine Marke importieren',
    description:
      'Spielt einen Export (Ausgabe von export_brand, Feld "export") in eine bestehende Marke ein. Bestehendes bleibt erhalten, Neues wird hinzugefügt. Bilder und Verweise auf andere Marken werden nicht übernommen.',
    input: {
      brand: z.string().optional().describe('Zielmarke'),
      export: z.record(z.string(), z.unknown()).describe('Das Export-Objekt (format "brandbench-brand")'),
      include_theme: z
        .boolean()
        .optional()
        .describe('Theme und Startseite des Exports übernehmen (Standard: nein)'),
    },
    kind: 'write',
    async run({ brand: ref, export: file, include_theme }, ctx) {
      const brand = await ctx.editableBrand(ref)
      let parsed
      try {
        parsed = parseBrandExport(JSON.stringify(file))
      } catch (error) {
        throw new ToolError((error as Error).message)
      }
      const data: BrandTemplateData =
        parsed.source.brandId === brand.id ? parsed.data : stripForeignReferences(parsed.data, brand.id)
      for (const guideline of data.guidelines ?? []) {
        const check = (blocks: Array<{ type: string }> = []) => {
          for (const block of blocks) {
            if (!(BLOCK_TYPES as readonly string[]).includes(block.type)) {
              throw new ToolError(`Unbekannter Bausteintyp „${block.type}“ im Export.`)
            }
          }
        }
        for (const item of guideline.items) {
          if (item.kind === 'chapter') item.pages.forEach((p) => check(p.blocks))
          else check(item.blocks)
        }
      }
      const payload = include_theme ? data : { ...data, theme: undefined, home: undefined }
      const { error } = await ctx.sb.rpc('apply_brand_template', {
        p_brand: brand.id,
        p_template: JSON.parse(JSON.stringify(payload)),
      })
      if (error) throw error
      return { summary: `Export „${parsed.source.name}“ in „${brand.name}“ importiert.` }
    },
  }),

  defineTool({
    name: 'set_brand_image',
    title: 'Logo oder Titelbild der Marke setzen',
    description:
      'Setzt das Logo (Kopfzeile, Karte) oder das Titelbild der Startseite einer Marke. Entweder asset_id eines vorhandenen Assets verwenden oder eine Datei übergeben (text für SVG, content_base64, url). Mit remove=true wird das Bild entfernt. Erfordert Admin-Rolle.',
    input: {
      brand: z.string().optional(),
      kind: z.enum(['logo', 'cover']),
      asset_id: z.string().optional().describe('ID eines Assets dieser Marke'),
      remove: z.boolean().optional(),
      ...optionalFileSourceShape,
    },
    kind: 'write',
    idempotent: true,
    async run(args, ctx) {
      const { brand: ref, kind, asset_id, remove } = args
      const brand = await ctx.adminBrand(ref)
      const column = kind === 'logo' ? 'logo_path' : 'cover_path'
      let path: string | null = null
      let stored: Awaited<ReturnType<typeof storeFile>> | null = null
      if (remove) {
        path = null
      } else if (asset_id) {
        const asset = row(
          await ctx.sb
            .from('assets')
            .select('file_path, brand_id')
            .eq('id', asset_id)
            .eq('brand_id', brand.id)
            .single(),
        )
        path = asset.file_path
      } else {
        if (!args.file_name)
          throw new ToolError(
            'Bitte asset_id oder eine Datei (file_name plus text/content_base64/url) angeben.',
          )
        const file = await resolveFile(ctx, brand, { ...args, file_name: args.file_name })
        if (!file.mime.startsWith('image/'))
          throw new ToolError('Logo und Titelbild müssen Bilder sein (SVG, PNG, JPG, WebP).')
        stored = await storeFile(ctx, brand, file, 'brand')
        path = stored.path
      }
      if (path) assertBrandPath(path, brand.id)
      const result = await ctx.sb
        .from('brands')
        .update({ [column]: path } as never)
        .eq('id', brand.id)
        .select('id')
      if (result.error || (result.data ?? []).length === 0) {
        if (stored) await discardStored(ctx, stored)
        if (result.error) throw result.error
        throw new ToolError('Marke nicht gefunden – oder dir fehlt dafür die Berechtigung.')
      }
      const url = path ? await signedUrl(ctx, path) : null
      return {
        summary: remove
          ? `${kind === 'logo' ? 'Logo' : 'Titelbild'} von „${brand.name}“ entfernt.`
          : `${kind === 'logo' ? 'Logo' : 'Titelbild'} von „${brand.name}“ gesetzt.`,
        data: { path, preview_url: url },
      }
    },
  }),
]
