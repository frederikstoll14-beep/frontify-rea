import { z } from 'zod'
import {
  contrastRatio,
  formatCmyk,
  formatHsl,
  formatRgb,
  hexToRgb,
  normalizeHex,
  rgbToCmyk,
  rgbToHsl,
  wcagLevel,
} from '@/lib/color'
import { TOKEN_FORMATS, buildTokenFile, type TokenFormat } from '@/lib/tokens'
import { affected, defined, requireChange, row, rows } from '../db'
import { ToolError } from '../errors'
import { discardStored, fileSourceShapeShort, resolveFile, storeFile } from '../files'
import { isFontFileName } from '../fonts'
import { publishExport } from '../storage-ops'
import { defineTool } from '../tool'
import { matchByRef, type Ctx, type ScopeBrand } from '../context'

const TOKEN = /^[a-z0-9]+(-[a-z0-9]+)*$/

function hexOrThrow(value: string): string {
  const hex = normalizeHex(value)
  if (!hex) throw new ToolError(`„${value}“ ist kein gültiger HEX-Wert (z. B. #0B3C7A).`)
  return hex
}

function tokenOrThrow(value: string): string {
  if (value !== '' && !TOKEN.test(value)) {
    throw new ToolError(
      `Token „${value}“ ist ungültig: nur Kleinbuchstaben, Ziffern und einzelne Bindestriche (z. B. brand-blue).`,
    )
  }
  return value
}

function colorInfo(hex: string) {
  const rgb = hexToRgb(hex)
  const onWhite = contrastRatio(hex, '#FFFFFF')
  const onBlack = contrastRatio(hex, '#000000')
  return {
    rgb: formatRgb(rgb),
    hsl: formatHsl(rgbToHsl(rgb)),
    cmyk_calculated: formatCmyk(rgbToCmyk(rgb)),
    contrast_on_white: { ratio: Math.round(onWhite * 100) / 100, wcag: wcagLevel(onWhite) },
    contrast_on_black: { ratio: Math.round(onBlack * 100) / 100, wcag: wcagLevel(onBlack) },
  }
}

async function resolvePalette(ctx: Ctx, brand: ScopeBrand, ref?: string) {
  const list = rows(await ctx.sb.from('color_palettes').select('*').eq('brand_id', brand.id).order('sort'))
  if (list.length === 0)
    throw new ToolError(`„${brand.name}“ hat noch keine Farbpalette.`, 'Lege eine mit create_palette an.')
  if (!ref) {
    if (list.length === 1) return list[0]
    throw new ToolError(
      'Bitte die Palette angeben (Name oder ID).',
      `Vorhanden: ${list.map((p) => p.name).join(', ')}.`,
    )
  }
  return matchByRef(list, ref, [(p) => p.name], 'Palette')
}

async function resolveFont(ctx: Ctx, brand: ScopeBrand, ref: string) {
  const list = rows(await ctx.sb.from('fonts').select('*').eq('brand_id', brand.id).order('sort'))
  return matchByRef(list, ref, [(f) => f.family, (f) => f.role], 'Schrift')
}

const colorFields = {
  name: z.string().min(1).max(120).optional(),
  hex: z.string().optional().describe('HEX-Wert, z. B. #0B3C7A (auch ohne # oder dreistellig)'),
  token: z
    .string()
    .optional()
    .describe('Design-Token-Name, z. B. brand-blue (Kleinbuchstaben, Bindestriche)'),
  cmyk: z.string().max(60).optional().describe('z. B. "100 80 0 20"'),
  pantone: z.string().max(60).optional(),
  hks: z.string().max(60).optional(),
  ral: z.string().max(60).optional(),
  ncs: z.string().max(60).optional(),
  usage: z.string().max(500).optional().describe('Einsatzzweck, z. B. "Primärfarbe für Flächen"'),
  description: z.string().max(1000).optional(),
}

export const basicsTools = [
  defineTool({
    name: 'list_colors',
    title: 'Farben der Marke',
    description:
      'Listet alle Farbpaletten mit Farben: HEX, Token, CMYK, Pantone, HKS, RAL, NCS, Einsatzzweck – plus berechnete Werte (RGB, HSL, WCAG-Kontrast auf Weiß/Schwarz).',
    input: { brand: z.string().optional() },
    kind: 'read',
    async run({ brand: ref }, ctx) {
      const brand = await ctx.brand(ref)
      const palettes = rows(
        await ctx.sb.from('color_palettes').select('*, colors(*)').eq('brand_id', brand.id).order('sort'),
      )
      const total = palettes.reduce((n, p) => n + p.colors.length, 0)
      return {
        summary: `${palettes.length} Palette(n) mit ${total} Farbe(n) in „${brand.name}“.`,
        data: palettes.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          colors: [...p.colors]
            .sort((a, b) => a.sort - b.sort)
            .map((c) => ({
              id: c.id,
              name: c.name,
              hex: c.hex,
              token: c.token,
              cmyk: c.cmyk,
              pantone: c.pantone,
              hks: c.hks,
              ral: c.ral,
              ncs: c.ncs,
              usage: c.usage,
              description: c.description,
              ...colorInfo(c.hex),
            })),
        })),
      }
    },
  }),

  defineTool({
    name: 'create_palette',
    title: 'Farbpalette anlegen',
    description: 'Legt eine neue Farbpalette an (z. B. „Primärfarben“, „Sekundärfarben“).',
    input: {
      brand: z.string().optional(),
      name: z.string().min(1).max(120),
      description: z.string().max(1000).optional(),
    },
    kind: 'write',
    async run({ brand: ref, name, description }, ctx) {
      const brand = await ctx.editableBrand(ref)
      const existing = rows(await ctx.sb.from('color_palettes').select('sort').eq('brand_id', brand.id))
      const palette = row(
        await ctx.sb
          .from('color_palettes')
          .insert({
            brand_id: brand.id,
            name: name.trim(),
            description: description ?? '',
            sort: existing.length ? Math.max(...existing.map((p) => p.sort)) + 1 : 0,
          })
          .select('id, name')
          .single(),
      )
      return { summary: `Palette „${palette.name}“ angelegt.`, data: palette }
    },
  }),

  defineTool({
    name: 'update_palette',
    title: 'Farbpalette bearbeiten',
    description: 'Benennt eine Farbpalette um oder ändert ihre Beschreibung.',
    input: {
      brand: z.string().optional(),
      palette: z.string(),
      name: z.string().min(1).max(120).optional(),
      description: z.string().max(1000).optional(),
    },
    kind: 'write',
    idempotent: true,
    async run({ brand: ref, palette: pRef, name, description }, ctx) {
      const brand = await ctx.editableBrand(ref)
      const palette = await resolvePalette(ctx, brand, pRef)
      const patch = defined({ name: name?.trim(), description })
      requireChange(patch)
      const [updated] = affected(
        await ctx.sb
          .from('color_palettes')
          .update(patch)
          .eq('id', palette.id)
          .select('id, name, description'),
        'Palette',
      )
      return { summary: `Palette „${updated.name}“ gespeichert.`, data: updated }
    },
  }),

  defineTool({
    name: 'delete_palette',
    title: 'Farbpalette löschen',
    description: 'Löscht eine Palette samt aller Farben darin.',
    input: { brand: z.string().optional(), palette: z.string() },
    kind: 'destructive',
    async run({ brand: ref, palette: pRef }, ctx) {
      const brand = await ctx.editableBrand(ref)
      const palette = await resolvePalette(ctx, brand, pRef)
      affected(await ctx.sb.from('color_palettes').delete().eq('id', palette.id).select('id'), 'Palette')
      return { summary: `Palette „${palette.name}“ gelöscht.` }
    },
  }),

  defineTool({
    name: 'save_color',
    title: 'Farbe anlegen oder ändern',
    description:
      'Legt eine Farbe in einer Palette an – oder ändert eine bestehende (color_id angeben; dann genügen die zu ändernden Felder). HEX ist Pflicht beim Anlegen.',
    input: {
      brand: z.string().optional(),
      palette: z.string().optional().describe('Palette (Name oder ID); optional, wenn es nur eine gibt'),
      color_id: z.string().optional().describe('ID einer vorhandenen Farbe, um sie zu ändern'),
      ...colorFields,
    },
    kind: 'write',
    idempotent: true,
    async run(a, ctx) {
      const brand = await ctx.editableBrand(a.brand)
      const values = defined({
        name: a.name?.trim(),
        hex: a.hex !== undefined ? hexOrThrow(a.hex) : undefined,
        token: a.token !== undefined ? tokenOrThrow(a.token) : undefined,
        cmyk: a.cmyk,
        pantone: a.pantone,
        hks: a.hks,
        ral: a.ral,
        ncs: a.ncs,
        usage: a.usage,
        description: a.description,
      })
      if (a.color_id) {
        const patch: Record<string, unknown> = { ...values }
        if (a.palette) patch.palette_id = (await resolvePalette(ctx, brand, a.palette)).id
        requireChange(patch)
        const [updated] = affected(
          await ctx.sb
            .from('colors')
            .update(patch as never)
            .eq('id', a.color_id)
            .eq('brand_id', brand.id)
            .select('id, name, hex, token'),
          'Farbe',
        )
        return {
          summary: `Farbe „${updated.name}“ gespeichert.`,
          data: { ...updated, ...colorInfo(updated.hex) },
        }
      }
      if (!values.name || !values.hex) throw new ToolError('Zum Anlegen werden name und hex benötigt.')
      const palette = await resolvePalette(ctx, brand, a.palette)
      const siblings = rows(await ctx.sb.from('colors').select('sort').eq('palette_id', palette.id))
      const created = row(
        await ctx.sb
          .from('colors')
          .insert({
            ...(values as { name: string; hex: string }),
            palette_id: palette.id,
            brand_id: brand.id,
            sort: siblings.length ? Math.max(...siblings.map((c) => c.sort)) + 1 : 0,
          })
          .select('id, name, hex, token')
          .single(),
      )
      return {
        summary: `Farbe „${created.name}“ (${created.hex}) in „${palette.name}“ angelegt.`,
        data: { ...created, ...colorInfo(created.hex) },
      }
    },
  }),

  defineTool({
    name: 'move_color',
    title: 'Farbe verschieben',
    description:
      'Verschiebt eine Farbe innerhalb ihrer Palette (position, 0 = ganz vorn) oder in eine andere Palette.',
    input: {
      brand: z.string().optional(),
      color_id: z.string(),
      palette: z.string().optional().describe('Zielpalette (Name oder ID); weglassen = gleiche Palette'),
      position: z.number().int().min(0).optional(),
    },
    kind: 'write',
    idempotent: true,
    async run({ brand: ref, color_id, palette: pRef, position }, ctx) {
      const brand = await ctx.editableBrand(ref)
      const color = row(
        await ctx.sb.from('colors').select('*').eq('id', color_id).eq('brand_id', brand.id).single(),
      )
      const targetPalette = pRef ? (await resolvePalette(ctx, brand, pRef)).id : color.palette_id
      const siblings = rows(
        await ctx.sb.from('colors').select('id, sort').eq('palette_id', targetPalette).order('sort'),
      ).filter((c) => c.id !== color.id)
      const index = Math.min(position ?? siblings.length, siblings.length)
      const ordered = [
        ...siblings.slice(0, index),
        { id: color.id, sort: color.sort },
        ...siblings.slice(index),
      ]
      await Promise.all(
        ordered.map(async (c, i) => {
          const patch = c.id === color.id ? { sort: i, palette_id: targetPalette } : { sort: i }
          if (c.id !== color.id && c.sort === i) return
          affected(await ctx.sb.from('colors').update(patch).eq('id', c.id).select('id'), 'Farbe')
        }),
      )
      return { summary: `Farbe „${color.name}“ verschoben.` }
    },
  }),

  defineTool({
    name: 'delete_color',
    title: 'Farbe löschen',
    description: 'Löscht eine Farbe (ID aus list_colors).',
    input: { brand: z.string().optional(), color_id: z.string() },
    kind: 'destructive',
    async run({ brand: ref, color_id }, ctx) {
      const brand = await ctx.editableBrand(ref)
      const [gone] = affected(
        await ctx.sb.from('colors').delete().eq('id', color_id).eq('brand_id', brand.id).select('name'),
        'Farbe',
      )
      return { summary: `Farbe „${gone.name}“ gelöscht.` }
    },
  }),

  defineTool({
    name: 'check_contrast',
    title: 'Farbkontrast prüfen (WCAG)',
    description:
      'Berechnet das Kontrastverhältnis zweier Farben und die WCAG-Stufe (AAA, AA, AA groß). Braucht keine Marke.',
    input: {
      foreground: z.string().describe('Vordergrundfarbe als HEX'),
      background: z.string().describe('Hintergrundfarbe als HEX'),
    },
    kind: 'read',
    async run({ foreground, background }) {
      const fg = hexOrThrow(foreground)
      const bg = hexOrThrow(background)
      const ratio = contrastRatio(fg, bg)
      return {
        summary: `${fg} auf ${bg}: ${ratio.toFixed(2)}:1 – ${wcagLevel(ratio)}`,
        data: {
          foreground: fg,
          background: bg,
          ratio: Math.round(ratio * 100) / 100,
          wcag: wcagLevel(ratio),
        },
      }
    },
  }),

  defineTool({
    name: 'list_typography',
    title: 'Schriften und Textstile',
    description:
      'Listet die Schriften (Google-Font, eigene Dateien, Systemschrift) und Textstile (Größe, Gewicht, Zeilenhöhe …) einer Marke.',
    input: { brand: z.string().optional() },
    kind: 'read',
    async run({ brand: ref }, ctx) {
      const brand = await ctx.brand(ref)
      const [fonts, styles] = await Promise.all([
        ctx.sb.from('fonts').select('*').eq('brand_id', brand.id).order('sort'),
        ctx.sb.from('text_styles').select('*').eq('brand_id', brand.id).order('sort'),
      ])
      return {
        summary: `${rows(fonts).length} Schrift(en), ${rows(styles).length} Textstil(e) in „${brand.name}“.`,
        data: {
          fonts: rows(fonts).map((f) => ({
            id: f.id,
            family: f.family,
            source: f.source,
            role: f.role,
            weights: f.weights,
            fallback: f.fallback,
            license: f.license,
            description: f.description,
            files: Array.isArray(f.files)
              ? (f.files as Array<{ name?: string; weight?: number; style?: string }>).map((x) => ({
                  name: x.name,
                  weight: x.weight,
                  style: x.style,
                }))
              : [],
          })),
          text_styles: rows(styles),
        },
      }
    },
  }),

  defineTool({
    name: 'save_font',
    title: 'Schrift anlegen oder ändern',
    description:
      'Legt eine Schrift an oder ändert sie (font_id angeben). source "google" lädt die Familie von Google Fonts (Name genau wie auf fonts.google.com, z. B. "Barlow Condensed"), "upload" nutzt eigene Dateien (danach upload_font_file), "system" eine Systemschrift.',
    input: {
      brand: z.string().optional(),
      font_id: z.string().optional(),
      family: z.string().min(1).max(120).optional(),
      source: z.enum(['google', 'upload', 'system']).optional(),
      role: z
        .string()
        .max(60)
        .optional()
        .describe('z. B. Headline, Fließtext – wird auch als Token-Name genutzt'),
      weights: z.array(z.number().int().min(100).max(900)).max(9).optional(),
      fallback: z.string().max(120).optional().describe('Ersatzschrift-Familie, z. B. sans-serif oder serif'),
      license: z.string().max(500).optional(),
      description: z.string().max(1000).optional(),
    },
    kind: 'write',
    idempotent: true,
    async run({ brand: ref, font_id, family, source, role, weights, fallback, license, description }, ctx) {
      const brand = await ctx.editableBrand(ref)
      const values = defined({
        family: family?.trim(),
        source,
        role,
        weights,
        fallback,
        license,
        description,
      })
      if (font_id) {
        requireChange(values)
        const [updated] = affected(
          await ctx.sb
            .from('fonts')
            .update(values)
            .eq('id', font_id)
            .eq('brand_id', brand.id)
            .select('id, family, source, weights'),
          'Schrift',
        )
        return { summary: `Schrift „${updated.family}“ gespeichert.`, data: updated }
      }
      if (!values.family) throw new ToolError('Zum Anlegen wird family benötigt.')
      const siblings = rows(await ctx.sb.from('fonts').select('sort').eq('brand_id', brand.id))
      const created = row(
        await ctx.sb
          .from('fonts')
          .insert({
            ...(values as { family: string }),
            brand_id: brand.id,
            sort: siblings.length ? Math.max(...siblings.map((f) => f.sort)) + 1 : 0,
          })
          .select('id, family, source, weights')
          .single(),
      )
      return { summary: `Schrift „${created.family}“ angelegt.`, data: created }
    },
  }),

  defineTool({
    name: 'upload_font_file',
    title: 'Schriftdatei hochladen',
    description:
      'Lädt eine Schriftdatei (WOFF2, WOFF, TTF, OTF) zu einer Schrift mit source "upload" hoch. Bitte nur Dateien verwenden, für die eine Lizenz vorliegt.',
    input: {
      brand: z.string().optional(),
      font: z.string().describe('Schrift (Familienname oder ID)'),
      weight: z.number().int().min(100).max(900).default(400),
      style: z.enum(['normal', 'italic']).default('normal'),
      ...fileSourceShapeShort,
    },
    kind: 'write',
    async run(args, ctx) {
      const brand = await ctx.editableBrand(args.brand)
      if (!isFontFileName(args.file_name)) throw new ToolError('Erlaubt sind nur WOFF2, WOFF, TTF und OTF.')
      const font = await resolveFont(ctx, brand, args.font)
      const file = await resolveFile(ctx, brand, args)
      const stored = await storeFile(ctx, brand, { ...file, mime: file.mime }, 'fonts')
      const files = Array.isArray(font.files) ? (font.files as unknown[]) : []
      const entry = {
        path: stored.path,
        name: stored.fileName,
        format: stored.ext,
        weight: args.weight,
        style: args.style,
      }
      const weights = [...new Set([...font.weights, args.weight])].sort((a, b) => a - b)
      const result = await ctx.sb
        .from('fonts')
        .update({ files: [...files, entry] as never, weights, source: 'upload' })
        .eq('id', font.id)
        .select('id')
      if (result.error || (result.data ?? []).length === 0) {
        await discardStored(ctx, stored)
        if (result.error) throw result.error
        throw new ToolError('Schrift nicht gefunden – oder dir fehlt dafür die Berechtigung.')
      }
      return {
        summary: `Schriftdatei „${stored.fileName}“ (${args.weight}${args.style === 'italic' ? ' kursiv' : ''}) zu „${font.family}“ hinzugefügt.`,
        data: entry,
      }
    },
  }),

  defineTool({
    name: 'delete_font',
    title: 'Schrift löschen',
    description: 'Löscht eine Schrift samt hochgeladener Dateien.',
    input: { brand: z.string().optional(), font: z.string().describe('Familienname oder ID') },
    kind: 'destructive',
    async run({ brand: ref, font: fRef }, ctx) {
      const brand = await ctx.editableBrand(ref)
      const font = await resolveFont(ctx, brand, fRef)
      const paths = (Array.isArray(font.files) ? (font.files as Array<{ path?: string }>) : [])
        .map((f) => f.path)
        .filter((p): p is string => Boolean(p))
      if (paths.length > 0) await ctx.storage.remove(paths)
      affected(await ctx.sb.from('fonts').delete().eq('id', font.id).select('id'), 'Schrift')
      return { summary: `Schrift „${font.family}“ gelöscht.` }
    },
  }),

  defineTool({
    name: 'save_text_style',
    title: 'Textstil anlegen oder ändern',
    description:
      'Legt einen Textstil an (z. B. H1, Fließtext, Caption) oder ändert ihn (style_id angeben). font_family ist der Schriftname. Größe in px, Zeilenhöhe als Faktor, Laufweite in em.',
    input: {
      brand: z.string().optional(),
      style_id: z.string().optional(),
      name: z.string().min(1).max(120).optional(),
      token: z.string().optional().describe('Token-Name, z. B. heading-1'),
      font_family: z.string().min(1).max(120).optional(),
      font_weight: z.number().int().min(100).max(900).optional(),
      font_size: z.number().positive().max(400).optional().describe('px'),
      line_height: z.number().positive().max(5).optional().describe('Faktor, z. B. 1.4'),
      letter_spacing: z.number().min(-1).max(2).optional().describe('em, z. B. 0.02'),
      text_transform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(),
      italic: z.boolean().optional(),
      sample: z.string().max(500).optional(),
      usage: z.string().max(500).optional(),
    },
    kind: 'write',
    idempotent: true,
    async run(a, ctx) {
      const brand = await ctx.editableBrand(a.brand)
      const values = defined({
        name: a.name?.trim(),
        token: a.token !== undefined ? tokenOrThrow(a.token) : undefined,
        font_family: a.font_family?.trim(),
        font_weight: a.font_weight,
        font_size: a.font_size,
        line_height: a.line_height,
        letter_spacing: a.letter_spacing,
        text_transform: a.text_transform,
        italic: a.italic,
        sample: a.sample,
        usage: a.usage,
      })
      if (a.style_id) {
        requireChange(values)
        const [updated] = affected(
          await ctx.sb
            .from('text_styles')
            .update(values)
            .eq('id', a.style_id)
            .eq('brand_id', brand.id)
            .select('id, name'),
          'Textstil',
        )
        return { summary: `Textstil „${updated.name}“ gespeichert.`, data: updated }
      }
      if (!values.name || !values.font_family)
        throw new ToolError('Zum Anlegen werden name und font_family benötigt.')
      const siblings = rows(await ctx.sb.from('text_styles').select('sort').eq('brand_id', brand.id))
      const created = row(
        await ctx.sb
          .from('text_styles')
          .insert({
            ...(values as { name: string; font_family: string }),
            brand_id: brand.id,
            sort: siblings.length ? Math.max(...siblings.map((s) => s.sort)) + 1 : 0,
          })
          .select('id, name')
          .single(),
      )
      return { summary: `Textstil „${created.name}“ angelegt.`, data: created }
    },
  }),

  defineTool({
    name: 'delete_text_style',
    title: 'Textstil löschen',
    description: 'Löscht einen Textstil (ID aus list_typography).',
    input: { brand: z.string().optional(), style_id: z.string() },
    kind: 'destructive',
    async run({ brand: ref, style_id }, ctx) {
      const brand = await ctx.editableBrand(ref)
      const [gone] = affected(
        await ctx.sb.from('text_styles').delete().eq('id', style_id).eq('brand_id', brand.id).select('name'),
        'Textstil',
      )
      return { summary: `Textstil „${gone.name}“ gelöscht.` }
    },
  }),

  defineTool({
    name: 'export_tokens',
    title: 'Design-Tokens exportieren',
    description:
      'Erzeugt Design-Tokens aus Farben, Schriften und Textstilen: css (Variablen), scss, json (W3C Design Tokens), tailwind (v4) oder ase (Adobe-Farbfelder). Text-Formate kommen direkt in der Antwort, ase als Download-Link.',
    input: { brand: z.string().optional(), format: z.enum(['css', 'scss', 'json', 'tailwind', 'ase']) },
    kind: 'read',
    async run({ brand: ref, format }, ctx) {
      const brand = await ctx.brand(ref)
      const [palettes, styles, fonts] = await Promise.all([
        ctx.sb.from('color_palettes').select('name, colors(*)').eq('brand_id', brand.id).order('sort'),
        ctx.sb.from('text_styles').select('*').eq('brand_id', brand.id).order('sort'),
        ctx.sb.from('fonts').select('family, fallback, role').eq('brand_id', brand.id).order('sort'),
      ])
      const blob = buildTokenFile(format as TokenFormat, {
        brandName: brand.name,
        palettes: rows(palettes).map((p) => ({
          name: p.name,
          colors: [...p.colors].sort((a, b) => a.sort - b.sort),
        })),
        textStyles: rows(styles).map((s) => ({
          ...s,
          font_size: Number(s.font_size),
          line_height: Number(s.line_height),
          letter_spacing: Number(s.letter_spacing),
        })),
        fonts: rows(fonts),
      })
      const meta = TOKEN_FORMATS[format as TokenFormat]
      if (format !== 'ase') {
        return {
          summary: `${meta.label} für „${brand.name}“ (${meta.file}).`,
          data: { file_name: meta.file, content: await blob.text() },
        }
      }
      const bytes = Buffer.from(await blob.arrayBuffer())
      const published = await publishExport(ctx, brand, meta.file, bytes, meta.mime)
      if (published) {
        return {
          summary: `Adobe-Farbfelder für „${brand.name}“ – Download-Link 60 Minuten gültig.`,
          data: { file_name: meta.file, download_url: published.url },
        }
      }
      return {
        summary: `Adobe-Farbfelder für „${brand.name}“ (${bytes.length} Bytes, base64).`,
        data: { file_name: meta.file, content_base64: bytes.toString('base64') },
      }
    },
  }),
]
