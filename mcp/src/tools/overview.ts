import { z } from 'zod'
import { SERVER_VERSION } from '../config'
import { page, rows } from '../db'
import { defineTool } from '../tool'
import { signedUrls } from '../files'

export const overviewTools = [
  defineTool({
    name: 'get_connection_info',
    title: 'Verbindung & Freigabe anzeigen',
    description:
      'Zeigt, wer verbunden ist, ob nur gelesen werden darf und auf welche Workspaces und Marken (= „Projekte“) die App zugreifen darf, jeweils mit der eigenen Rolle. Am besten zuerst aufrufen.',
    input: {},
    kind: 'read',
    async run(_args, ctx) {
      const scope = await ctx.scope({ allowNoGrant: true })
      if (!scope.granted) {
        return {
          summary:
            'Die Verbindung steht, aber es ist noch nichts freigegeben. Bitte in Brandbench unter „Konto → Verbundene Apps“ Workspaces und Marken auswählen.',
          data: { granted: false },
        }
      }
      return {
        summary: `Verbunden als ${ctx.principal.email ?? ctx.principal.userId} · ${scope.read_only ? 'nur lesen' : 'Lesen und Schreiben'} · ${scope.workspaces.length} Workspace(s), ${scope.brands.length} Marke(n) freigegeben.`,
        data: {
          user: { id: ctx.principal.userId, email: ctx.principal.email },
          app: { client_id: scope.client_id, name: scope.client_name ?? null },
          mode: scope.read_only ? 'read_only' : 'read_write',
          workspaces: scope.workspaces.map((w) => ({ id: w.id, name: w.name, slug: w.slug, role: w.role })),
          brands: scope.brands.map((b) => ({
            id: b.id,
            name: b.name,
            slug: b.slug,
            workspace: b.workspace_name,
            role: b.role,
            via: b.via,
            url: ctx.link(`/b/${b.slug}`),
          })),
          limits: { max_file_mb: 50, base64_upload_mb: 3, signed_url_minutes: 60 },
          server_version: SERVER_VERSION,
          hint: '„Projekt“ = Marke (brand). Workspaces enthalten Marken. Die Auswahl ändert die Person in Brandbench unter „Konto → Verbundene Apps“.',
        },
      }
    },
  }),

  defineTool({
    name: 'list_workspaces',
    title: 'Workspaces auflisten',
    description:
      'Listet die freigegebenen Workspaces (z. B. Kurse oder Teams) mit Rolle und Anzahl der erreichbaren Marken.',
    input: {},
    kind: 'read',
    async run(_args, ctx) {
      const scope = await ctx.scope()
      const data = scope.workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
        description: w.description,
        role: w.role,
        brands: scope.brands.filter((b) => b.workspace_id === w.id).length,
        url: ctx.link(`/w/${w.slug}`),
      }))
      const partial = new Set(scope.brands.filter((b) => b.via === 'brand').map((b) => b.workspace_name))
      return {
        summary: `${data.length} Workspace(s) freigegeben${partial.size > 0 ? `; zusätzlich einzelne Marken aus: ${[...partial].join(', ')}` : ''}.`,
        data,
      }
    },
  }),

  defineTool({
    name: 'list_brands',
    title: 'Marken (Projekte) auflisten',
    description:
      'Listet die freigegebenen Marken („Projekte“), optional gefiltert nach Workspace oder Suchwort. Liefert IDs, Kurz-URLs und die eigene Rolle.',
    input: {
      workspace: z.string().optional().describe('Workspace (Name, Kurz-URL oder ID) als Filter'),
      query: z.string().optional().describe('Suchwort im Namen oder Claim'),
    },
    kind: 'read',
    async run({ workspace, query }, ctx) {
      const scope = await ctx.scope()
      let brands = scope.brands
      if (workspace) {
        const needle = workspace.trim().toLowerCase()
        brands = brands.filter(
          (b) =>
            b.workspace_id === workspace ||
            b.workspace_name.toLowerCase() === needle ||
            b.workspace_slug.toLowerCase() === needle,
        )
      }
      if (query) {
        const q = query.trim().toLowerCase()
        brands = brands.filter((b) => `${b.name} ${b.tagline}`.toLowerCase().includes(q))
      }
      return {
        summary: `${brands.length} Marke(n).`,
        data: brands.map((b) => ({
          id: b.id,
          name: b.name,
          slug: b.slug,
          tagline: b.tagline,
          org_type: b.org_type,
          workspace: { id: b.workspace_id, name: b.workspace_name },
          role: b.role,
          visibility: b.visibility,
          is_public: b.is_public,
          updated_at: b.updated_at,
          url: ctx.link(`/b/${b.slug}`),
        })),
      }
    },
  }),

  defineTool({
    name: 'get_brand',
    title: 'Marke im Überblick',
    description:
      'Zeigt eine Marke komplett im Überblick: Einstellungen, Theme, Startseite, Handbücher mit Seitenzahl, Bibliotheken mit Dateizahl, Farbpaletten, Schriften, Textstile. Gut als Einstieg, bevor man etwas ändert.',
    input: {
      brand: z
        .string()
        .optional()
        .describe('Marke (Name, Kurz-URL oder ID); optional, wenn nur eine freigegeben ist'),
    },
    kind: 'read',
    async run({ brand: ref }, ctx) {
      const scope = await ctx.brand(ref)
      const [brandRow, libraries, guidelines, palettes, fonts, styles] = await Promise.all([
        ctx.sb.from('brands').select('*').eq('id', scope.id).single(),
        ctx.sb
          .from('libraries')
          .select('id, name, slug, kind, description, assets(count)')
          .eq('brand_id', scope.id)
          .order('sort'),
        ctx.sb
          .from('guidelines')
          .select('id, title, slug, description, is_published, guideline_pages(count)')
          .eq('brand_id', scope.id)
          .order('sort'),
        ctx.sb
          .from('color_palettes')
          .select('id, name, colors(count)')
          .eq('brand_id', scope.id)
          .order('sort'),
        ctx.sb
          .from('fonts')
          .select('id, family, source, role, weights')
          .eq('brand_id', scope.id)
          .order('sort'),
        ctx.sb.from('text_styles').select('id, name, token').eq('brand_id', scope.id).order('sort'),
      ])
      if (brandRow.error) throw brandRow.error
      const b = brandRow.data
      const count = (value: unknown): number =>
        Array.isArray(value) ? ((value[0] as { count?: number })?.count ?? 0) : 0
      return {
        summary: `${b.name} (${scope.workspace_name}) · deine Rolle: ${scope.role}`,
        data: {
          id: b.id,
          name: b.name,
          slug: b.slug,
          workspace: { id: scope.workspace_id, name: scope.workspace_name },
          role: scope.role,
          org_type: b.org_type,
          tagline: b.tagline,
          description: b.description,
          visibility: b.visibility,
          is_public: b.is_public,
          public_until: b.public_until,
          public_downloads: b.public_downloads,
          theme: b.theme,
          home: b.home,
          logo_path: b.logo_path,
          cover_path: b.cover_path,
          url: ctx.link(`/b/${b.slug}`),
          guidelines: rows(guidelines).map((g) => ({
            id: g.id,
            title: g.title,
            slug: g.slug,
            description: g.description,
            published: g.is_published,
            entries: count(g.guideline_pages),
          })),
          libraries: rows(libraries).map((l) => ({
            id: l.id,
            name: l.name,
            slug: l.slug,
            kind: l.kind,
            description: l.description,
            assets: count(l.assets),
          })),
          palettes: rows(palettes).map((p) => ({ id: p.id, name: p.name, colors: count(p.colors) })),
          fonts: rows(fonts),
          text_styles: rows(styles),
        },
      }
    },
  }),

  defineTool({
    name: 'search',
    title: 'In einer Marke suchen',
    description:
      'Volltextsuche in einer Marke über Handbuch-Seiten und -Bausteine, Dateien (Titel, Beschreibung, Tags, Dateiname) und Farben (Name, HEX, Pantone, HKS).',
    input: {
      brand: z.string().optional().describe('Marke; optional, wenn nur eine freigegeben ist'),
      query: z.string().min(2).describe('Suchbegriff (mindestens 2 Zeichen)'),
    },
    kind: 'read',
    async run({ brand: ref, query }, ctx) {
      const brand = await ctx.brand(ref)
      const hits = rows(await ctx.sb.rpc('search_brand', { p_brand: brand.id, p_query: query.trim() }))
      const thumbs = await signedUrls(ctx, hits.map((h) => h.thumb_path).filter(Boolean), 900)
      return {
        summary: `${hits.length} Treffer für „${query}“ in ${brand.name}.`,
        data: hits.map((h) => ({
          kind: h.kind,
          id: h.id,
          title: h.title,
          snippet: h.snippet ? String(h.snippet).slice(0, 240) : '',
          guideline: h.guideline_slug,
          page_slug: h.page_slug,
          library: h.library_slug,
          hex: h.hex,
          thumbnail_url: h.thumb_path ? (thumbs.get(h.thumb_path) ?? null) : null,
        })),
      }
    },
  }),

  defineTool({
    name: 'get_activity',
    title: 'Änderungsverlauf',
    description: 'Zeigt den Verlauf einer Marke: wer wann was angelegt, geändert oder gelöscht hat.',
    input: {
      brand: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional().describe('Anzahl Einträge (Standard 30)'),
      offset: z.number().int().min(0).optional(),
    },
    kind: 'read',
    async run({ brand: ref, limit, offset }, ctx) {
      const brand = await ctx.brand(ref)
      const p = page(limit, offset, 200, 30)
      const data = rows(
        await ctx.sb
          .from('activity')
          .select('id, action, entity, label, created_at, actor:profiles(full_name, email)')
          .eq('brand_id', brand.id)
          .order('created_at', { ascending: false })
          .range(p.from, p.to),
      )
      return {
        summary: `${data.length} Einträge aus dem Verlauf von ${brand.name}.`,
        data: data.map((a) => ({
          at: a.created_at,
          by: a.actor ? a.actor.full_name || a.actor.email : null,
          action: a.action,
          entity: a.entity,
          label: a.label,
        })),
      }
    },
  }),
]
