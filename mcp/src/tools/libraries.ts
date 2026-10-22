import JSZip from 'jszip'
import { z } from 'zod'
import { slugify } from '@/lib/utils'
import { matchByRef, type Ctx, type ScopeBrand } from '../context'
import { affected, defined, page, requireChange, row, rows, uniqueSlug } from '../db'
import { ToolError } from '../errors'
import {
  buildStoragePath,
  discardStored,
  downloadBytes,
  fileSourceShape,
  fileSourceShapeShort,
  removePaths,
  resolveFile,
  signedUrl,
  signedUrls,
  storeFile,
} from '../files'
import { CONVERT_MIME, convertImage, isImage, loadSharp, type ConvertTarget } from '../images'
import { isTextMime, safeFileName, titleFromFileName, extensionOf } from '../mime'
import { resolveLibrary, isUuid } from '../resolve'
import { publishExport } from '../storage-ops'
import { defineTool } from '../tool'

const KINDS = ['media', 'logos', 'icons', 'documents', 'templates', 'audio_video'] as const

/** Antwort-Obergrenzen für Inhalte, die direkt im Gespräch landen. */
const INLINE_IMAGE_MAX = 1_500_000
const INLINE_TEXT_MAX = 200_000
const INLINE_BINARY_MAX = 2_500_000
const ZIP_MAX_TOTAL = 150 * 1024 * 1024

type AssetRow = {
  id: string
  library_id: string
  brand_id: string
  title: string
  description: string
  file_path: string
  thumb_path: string | null
  file_name: string
  mime_type: string
  ext: string
  size_bytes: number
  width: number | null
  height: number | null
  tags: string[]
  copyright: string
  license_note: string
  expires_at: string | null
  downloadable: boolean
  version: number
  created_at: string
  updated_at: string
}

function assetSummary(a: AssetRow) {
  return {
    id: a.id,
    title: a.title,
    file_name: a.file_name,
    mime_type: a.mime_type,
    size_bytes: Number(a.size_bytes),
    width: a.width,
    height: a.height,
    tags: a.tags,
    version: a.version,
    library_id: a.library_id,
    downloadable: a.downloadable,
    expires_at: a.expires_at,
    updated_at: a.updated_at,
  }
}

async function loadAsset(ctx: Ctx, assetId: string): Promise<{ asset: AssetRow; brand: ScopeBrand }> {
  if (!isUuid(assetId)) throw new ToolError('asset_id muss eine ID sein (siehe list_assets).')
  const found = await ctx.sb.from('assets').select('*').eq('id', assetId.trim()).maybeSingle()
  if (found.error) throw found.error
  if (!found.data) throw new ToolError('Datei nicht gefunden – oder nicht freigegeben.')
  const brand = await ctx.brandById(found.data.brand_id)
  return { asset: found.data as AssetRow, brand }
}

async function loadAssets(ctx: Ctx, ids: string[]): Promise<Array<{ asset: AssetRow; brand: ScopeBrand }>> {
  const unique = [...new Set(ids)]
  if (unique.some((id) => !isUuid(id))) throw new ToolError('asset_ids müssen IDs sein (siehe list_assets).')
  const data = rows(await ctx.sb.from('assets').select('*').in('id', unique))
  const found = new Map(data.map((a) => [a.id, a as AssetRow]))
  const missing = unique.filter((id) => !found.has(id))
  if (missing.length > 0) throw new ToolError(`Datei(en) nicht gefunden: ${missing.slice(0, 3).join(', ')}.`)
  const result = []
  for (const id of unique) {
    const asset = found.get(id)!
    result.push({ asset, brand: await ctx.brandById(asset.brand_id) })
  }
  return result
}

async function assertDownloadable(brand: ScopeBrand, asset: AssetRow): Promise<void> {
  if (!asset.downloadable) {
    throw new ToolError(
      `„${asset.title}“ ist nicht zum Download freigegeben.`,
      'Ein Admin kann das in den Dateieinstellungen (update_asset: downloadable) ändern.',
    )
  }
  void brand
}

function mimeResult(bytes: Buffer, mime: string, title: string) {
  // Bilder, die Claude sehen kann, kommen als Bild; Text als Text; alles andere als eingebettete Datei.
  if (['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(mime)) {
    return [{ type: 'image' as const, data: bytes.toString('base64'), mimeType: mime }]
  }
  if (isTextMime(mime)) {
    return [{ type: 'text' as const, text: `--- ${title} ---\n${bytes.toString('utf8')}` }]
  }
  return [
    {
      type: 'resource' as const,
      resource: {
        uri: `brandbench://file/${encodeURIComponent(title)}`,
        mimeType: mime,
        blob: bytes.toString('base64'),
      },
    },
  ]
}

async function nextSort(ctx: Ctx, table: 'libraries' | 'collections', brandId: string): Promise<number> {
  const list = rows(await ctx.sb.from(table).select('sort').eq('brand_id', brandId))
  return list.length ? Math.max(...list.map((r) => r.sort)) + 1 : 0
}

const tagList = z.array(z.string().min(1).max(60)).max(40)

export const libraryTools = [
  defineTool({
    name: 'list_libraries',
    title: 'Bibliotheken',
    description:
      'Listet die Bibliotheken einer Marke (Logos, Bilder, Dokumente, Icons, Vorlagen, Audio/Video) mit Anzahl der Dateien.',
    input: { brand: z.string().optional() },
    kind: 'read',
    async run({ brand: ref }, ctx) {
      const brand = await ctx.brand(ref)
      const data = rows(
        await ctx.sb
          .from('libraries')
          .select('id, name, slug, kind, description, assets(count)')
          .eq('brand_id', brand.id)
          .order('sort'),
      )
      return {
        summary: `${data.length} Bibliothek(en) in „${brand.name}“.`,
        data: data.map((l) => ({
          id: l.id,
          name: l.name,
          slug: l.slug,
          kind: l.kind,
          description: l.description,
          assets: (l.assets as unknown as Array<{ count: number }>)?.[0]?.count ?? 0,
          url: ctx.link(`/b/${brand.slug}/bibliothek/${l.slug}`),
        })),
      }
    },
  }),

  defineTool({
    name: 'create_library',
    title: 'Bibliothek anlegen',
    description:
      'Legt eine Bibliothek an. kind: media (Bilder & Medien), logos, icons, documents, templates, audio_video.',
    input: {
      brand: z.string().optional(),
      name: z.string().min(1).max(120),
      kind: z.enum(KINDS).default('media'),
      description: z.string().max(1000).optional(),
    },
    kind: 'write',
    async run({ brand: ref, name, kind, description }, ctx) {
      const brand = await ctx.editableBrand(ref)
      const existing = rows(await ctx.sb.from('libraries').select('slug').eq('brand_id', brand.id))
      const created = row(
        await ctx.sb
          .from('libraries')
          .insert({
            brand_id: brand.id,
            name: name.trim(),
            kind,
            slug: uniqueSlug(
              slugify(name),
              existing.map((l) => l.slug),
            ),
            description: description ?? '',
            sort: await nextSort(ctx, 'libraries', brand.id),
          })
          .select('id, name, slug, kind')
          .single(),
      )
      return { summary: `Bibliothek „${created.name}“ angelegt.`, data: created }
    },
  }),

  defineTool({
    name: 'update_library',
    title: 'Bibliothek bearbeiten',
    description: 'Benennt eine Bibliothek um, ändert Beschreibung oder Typ.',
    input: {
      brand: z.string().optional(),
      library: z.string().optional(),
      name: z.string().min(1).max(120).optional(),
      description: z.string().max(1000).optional(),
      kind: z.enum(KINDS).optional(),
    },
    kind: 'write',
    idempotent: true,
    async run({ brand: ref, library: lRef, name, description, kind }, ctx) {
      const brand = await ctx.editableBrand(ref)
      const library = await resolveLibrary(ctx, brand, lRef)
      const patch = defined({ name: name?.trim(), description, kind })
      requireChange(patch)
      const [updated] = affected(
        await ctx.sb.from('libraries').update(patch).eq('id', library.id).select('id, name, slug, kind'),
        'Bibliothek',
      )
      return { summary: `Bibliothek „${updated.name}“ gespeichert.`, data: updated }
    },
  }),

  defineTool({
    name: 'delete_library',
    title: 'Bibliothek löschen',
    description:
      'Löscht eine Bibliothek mit allen Dateien und Sammlungen darin. Unwiderruflich. confirm_name = exakter Name der Bibliothek.',
    input: { brand: z.string().optional(), library: z.string(), confirm_name: z.string() },
    kind: 'destructive',
    async run({ brand: ref, library: lRef, confirm_name }, ctx) {
      const brand = await ctx.editableBrand(ref)
      const library = await resolveLibrary(ctx, brand, lRef)
      if (confirm_name.trim() !== library.name)
        throw new ToolError(`Zur Bestätigung muss confirm_name genau „${library.name}“ lauten.`)
      const assets = rows(
        await ctx.sb.from('assets').select('id, file_path, thumb_path').eq('library_id', library.id),
      )
      const versions = assets.length
        ? rows(
            await ctx.sb
              .from('asset_versions')
              .select('file_path, thumb_path')
              .in(
                'asset_id',
                assets.map((a) => a.id),
              ),
          )
        : []
      await removePaths(ctx, [
        ...assets.flatMap((a) => [a.file_path, a.thumb_path]),
        ...versions.flatMap((v) => [v.file_path, v.thumb_path]),
      ])
      affected(await ctx.sb.from('libraries').delete().eq('id', library.id).select('id'), 'Bibliothek')
      return { summary: `Bibliothek „${library.name}“ mit ${assets.length} Datei(en) gelöscht.` }
    },
  }),

  defineTool({
    name: 'list_assets',
    title: 'Dateien auflisten und suchen',
    description:
      'Listet Dateien (Assets) einer Marke, optional gefiltert nach Bibliothek, Sammlung, Suchwort, Tag oder Typ (z. B. "image/", "application/pdf"). Mit thumbnails=true kommen kurzlebige Vorschau-URLs mit.',
    input: {
      brand: z.string().optional(),
      library: z.string().optional().describe('Bibliothek (Name, Kurz-URL oder ID)'),
      collection: z.string().optional().describe('Sammlung (Name oder ID) innerhalb der Bibliothek'),
      query: z.string().optional().describe('Suchwort in Titel, Beschreibung, Dateiname oder Tags'),
      tag: z.string().optional(),
      mime_prefix: z.string().optional().describe('z. B. "image/", "video/", "application/pdf"'),
      thumbnails: z.boolean().optional(),
      limit: z.number().int().min(1).max(200).optional().describe('Standard 50'),
      offset: z.number().int().min(0).optional(),
    },
    kind: 'read',
    async run(
      { brand: ref, library: lRef, collection, query, tag, mime_prefix, thumbnails, limit, offset },
      ctx,
    ) {
      const brand = await ctx.brand(ref)
      const p = page(limit, offset)
      let q = ctx.sb.from('assets').select('*', { count: 'exact' }).eq('brand_id', brand.id)
      let libraryId: string | null = null
      if (lRef) {
        libraryId = (await resolveLibrary(ctx, brand, lRef)).id
        q = q.eq('library_id', libraryId)
      }
      if (collection) {
        const cols = rows(
          await ctx.sb
            .from('collections')
            .select('id, name, library_id, collection_assets(asset_id)')
            .eq('brand_id', brand.id),
        )
        const scoped = libraryId ? cols.filter((c) => c.library_id === libraryId) : cols
        const found = matchByRef(scoped, collection, [(c) => c.name], 'Sammlung')
        const ids = found.collection_assets.map((x) => x.asset_id)
        q = q.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
      }
      if (tag) q = q.contains('tags', [tag.trim()])
      if (mime_prefix) q = q.ilike('mime_type', `${mime_prefix.replace(/[%_]/g, '')}%`)
      if (query?.trim()) {
        const term = query.trim().replace(/[%_,()]/g, ' ')
        q = q.or(
          `title.ilike.%${term}%,description.ilike.%${term}%,file_name.ilike.%${term}%,tags.cs.{${term.replace(/[{}"]/g, '')}}`,
        )
      }
      const { data, error, count } = await q.order('created_at', { ascending: false }).range(p.from, p.to)
      if (error) throw error
      const list = (data ?? []) as AssetRow[]
      const thumbs = thumbnails
        ? await signedUrls(ctx, list.map((a) => a.thumb_path ?? a.file_path).filter(Boolean), 1800)
        : new Map<string, string>()
      return {
        summary: `${list.length} von ${count ?? list.length} Datei(en) in „${brand.name}“${offset ? ` (ab ${offset})` : ''}.`,
        data: list.map((a) => ({
          ...assetSummary(a),
          ...(thumbnails ? { thumbnail_url: thumbs.get(a.thumb_path ?? a.file_path) ?? null } : {}),
        })),
      }
    },
  }),

  defineTool({
    name: 'get_asset',
    title: 'Datei im Detail',
    description:
      'Zeigt alle Angaben zu einer Datei (Beschreibung, Tags, Lizenz, Version, Ablaufdatum, Sammlungen, Anzahl Kommentare) plus Download-Link (1 Stunde gültig). Dateiinhalt: download_asset.',
    input: { asset_id: z.string() },
    kind: 'read',
    async run({ asset_id }, ctx) {
      const { asset, brand } = await loadAsset(ctx, asset_id)
      const [collections, comments, versions, url, thumb] = await Promise.all([
        ctx.sb.from('collection_assets').select('collection:collections(id, name)').eq('asset_id', asset.id),
        ctx.sb.from('comments').select('id', { count: 'exact', head: true }).eq('asset_id', asset.id),
        ctx.sb.from('asset_versions').select('id', { count: 'exact', head: true }).eq('asset_id', asset.id),
        signedUrl(ctx, asset.file_path, 3600, asset.file_name),
        asset.thumb_path ? signedUrl(ctx, asset.thumb_path, 3600) : Promise.resolve(null),
      ])
      return {
        summary: `${asset.title} (${asset.file_name}, ${(Number(asset.size_bytes) / 1024).toFixed(0)} KB)`,
        data: {
          ...assetSummary(asset),
          description: asset.description,
          copyright: asset.copyright,
          license_note: asset.license_note,
          collections: rows(collections).map((c) => c.collection),
          comments: comments.count ?? 0,
          earlier_versions: versions.count ?? 0,
          download_url: url,
          thumbnail_url: thumb,
          web_url: ctx.link(`/b/${brand.slug}`),
        },
      }
    },
  }),

  defineTool({
    name: 'upload_asset',
    title: 'Datei hochladen',
    description:
      'Lädt eine Datei in eine Bibliothek hoch (mit Vorschaubild für Bilder). Quelle genau eine von: text (SVG/CSS/JSON/Markdown als Klartext), content_base64 (kleine Dateien bis ca. 3 MB), url (öffentliche https-Adresse, bis 50 MB) oder upload_path (nach create_upload_url, für große Dateien). Titel, Beschreibung, Tags, Urheberrecht und Lizenz lassen sich gleich mitgeben.',
    input: {
      brand: z.string().optional(),
      library: z
        .string()
        .optional()
        .describe('Zielbibliothek (Name, Kurz-URL oder ID); optional, wenn es nur eine gibt'),
      ...fileSourceShape,
      title: z.string().max(200).optional().describe('Standard: aus dem Dateinamen'),
      description: z.string().max(2000).optional(),
      tags: tagList.optional(),
      copyright: z.string().max(300).optional(),
      license_note: z.string().max(1000).optional(),
      expires_at: z.string().optional().describe('Ablaufdatum der Nutzungsrechte (YYYY-MM-DD)'),
      downloadable: z.boolean().optional().describe('Standard: true'),
    },
    kind: 'write',
    async run(args, ctx) {
      const brand = await ctx.editableBrand(args.brand)
      const library = await resolveLibrary(ctx, brand, args.library)
      if (args.expires_at && Number.isNaN(Date.parse(args.expires_at)))
        throw new ToolError('expires_at muss ein Datum wie 2027-12-31 sein.')
      const file = await resolveFile(ctx, brand, args)
      const stored = await storeFile(ctx, brand, file, 'assets')
      try {
        const created = row(
          await ctx.sb
            .from('assets')
            .insert({
              library_id: library.id,
              brand_id: brand.id,
              title: (args.title?.trim() || titleFromFileName(stored.fileName)).slice(0, 200),
              description: args.description ?? '',
              file_path: stored.path,
              thumb_path: stored.thumbPath,
              file_name: stored.fileName,
              mime_type: stored.mime,
              ext: stored.ext,
              size_bytes: stored.size,
              width: stored.width,
              height: stored.height,
              tags: args.tags ?? [],
              copyright: args.copyright ?? '',
              license_note: args.license_note ?? '',
              expires_at: args.expires_at ?? null,
              ...(args.downloadable === undefined ? {} : { downloadable: args.downloadable }),
            })
            .select('*')
            .single(),
        )
        return {
          summary: `„${created.title}“ in „${library.name}“ hochgeladen (${(stored.size / 1024).toFixed(0)} KB).`,
          data: {
            ...assetSummary(created as AssetRow),
            web_url: ctx.link(`/b/${brand.slug}/bibliothek/${library.slug}`),
          },
        }
      } catch (error) {
        await discardStored(ctx, stored)
        throw error
      }
    },
  }),

  defineTool({
    name: 'create_upload_url',
    title: 'Upload-Adresse für große Dateien',
    description:
      'Erzeugt eine einmalige Upload-Adresse (2 Stunden gültig) für Dateien bis 50 MB. Die Datei dann per HTTP PUT an upload_url senden (Header Content-Type, Body = Dateiinhalt, z. B. mit curl -X PUT -H "Content-Type: …" --data-binary @datei "<upload_url>"). Danach upload_asset (oder replace_asset_file, set_brand_image …) mit upload_path aufrufen. Nur nötig, wenn url/text/content_base64 nicht reichen.',
    input: {
      brand: z.string().optional(),
      file_name: z.string().min(1).max(200),
      mime_type: z.string().optional(),
    },
    kind: 'write',
    async run({ brand: ref, file_name, mime_type }, ctx) {
      const brand = await ctx.editableBrand(ref)
      const name = safeFileName(file_name)
      const path = buildStoragePath(brand.id, 'assets', name)
      const { data, error } = await ctx.storage.createSignedUploadUrl(path)
      if (error || !data)
        throw new ToolError(
          `Upload-Adresse konnte nicht erzeugt werden: ${error?.message ?? 'unbekannter Fehler'}`,
        )
      return {
        summary: `Upload-Adresse für „${name}“ bereit (2 Stunden gültig, einmalig).`,
        data: {
          upload_url: data.signedUrl,
          method: 'PUT',
          headers: { 'Content-Type': mime_type || 'application/octet-stream' },
          upload_path: path,
          max_mb: 50,
          next_step: `Datei hochladen, dann upload_asset mit file_name="${name}" und upload_path="${path}" aufrufen.`,
        },
      }
    },
  }),

  defineTool({
    name: 'update_asset',
    title: 'Dateiangaben ändern',
    description:
      'Ändert Titel, Beschreibung, Tags, Urheberrecht, Lizenz, Ablaufdatum, Download-Freigabe oder verschiebt die Datei in eine andere Bibliothek. Tags ersetzt (tags) oder ergänzt/entfernt (add_tags/remove_tags).',
    input: {
      asset_id: z.string(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).optional(),
      tags: tagList.optional().describe('Ersetzt alle Tags'),
      add_tags: tagList.optional(),
      remove_tags: tagList.optional(),
      copyright: z.string().max(300).optional(),
      license_note: z.string().max(1000).optional(),
      expires_at: z.string().nullable().optional().describe('YYYY-MM-DD oder null zum Entfernen'),
      downloadable: z.boolean().optional(),
      library: z.string().optional().describe('Zielbibliothek zum Verschieben'),
    },
    kind: 'write',
    idempotent: true,
    async run(a, ctx) {
      const { asset, brand } = await loadAsset(ctx, a.asset_id)
      await ctx.requireEdit(brand)
      if (a.expires_at && Number.isNaN(Date.parse(a.expires_at)))
        throw new ToolError('expires_at muss ein Datum wie 2027-12-31 sein.')
      let tags = a.tags
      if (!tags && (a.add_tags || a.remove_tags)) {
        const remove = new Set((a.remove_tags ?? []).map((t) => t.toLowerCase()))
        tags = [...new Set([...asset.tags, ...(a.add_tags ?? [])])].filter(
          (t) => !remove.has(t.toLowerCase()),
        )
      }
      const patch: Record<string, unknown> = defined({
        title: a.title?.trim(),
        description: a.description,
        tags,
        copyright: a.copyright,
        license_note: a.license_note,
        expires_at: a.expires_at,
        downloadable: a.downloadable,
      })
      if (a.library) patch.library_id = (await resolveLibrary(ctx, brand, a.library)).id
      requireChange(patch)
      const [updated] = affected(
        await ctx.sb
          .from('assets')
          .update(patch as never)
          .eq('id', asset.id)
          .select('*'),
        'Datei',
      )
      return { summary: `„${updated.title}“ gespeichert.`, data: assetSummary(updated as AssetRow) }
    },
  }),

  defineTool({
    name: 'bulk_update_assets',
    title: 'Mehrere Dateien gleichzeitig ändern',
    description:
      'Setzt für mehrere Dateien Tags (ergänzen/entfernen), verschiebt sie in eine Bibliothek und/oder ändert die Download-Freigabe. Bis zu 100 Dateien.',
    input: {
      asset_ids: z.array(z.string()).min(1).max(100),
      add_tags: tagList.optional(),
      remove_tags: tagList.optional(),
      library: z
        .string()
        .optional()
        .describe('Zielbibliothek (alle Dateien müssen zur selben Marke gehören)'),
      downloadable: z.boolean().optional(),
    },
    kind: 'write',
    idempotent: true,
    async run({ asset_ids, add_tags, remove_tags, library, downloadable }, ctx) {
      const loaded = await loadAssets(ctx, asset_ids)
      const brands = new Set(loaded.map((l) => l.brand.id))
      if (library && brands.size > 1)
        throw new ToolError('Zum Verschieben müssen alle Dateien zur selben Marke gehören.')
      for (const brand of new Map(loaded.map((l) => [l.brand.id, l.brand])).values())
        await ctx.requireEdit(brand)
      const libraryId = library ? (await resolveLibrary(ctx, loaded[0].brand, library)).id : undefined
      const remove = new Set((remove_tags ?? []).map((t) => t.toLowerCase()))
      let done = 0
      for (const { asset } of loaded) {
        const patch: Record<string, unknown> = defined({ downloadable, library_id: libraryId })
        if (add_tags || remove_tags) {
          patch.tags = [...new Set([...asset.tags, ...(add_tags ?? [])])].filter(
            (t) => !remove.has(t.toLowerCase()),
          )
        }
        requireChange(patch)
        affected(
          await ctx.sb
            .from('assets')
            .update(patch as never)
            .eq('id', asset.id)
            .select('id'),
          'Datei',
        )
        done++
      }
      return { summary: `${done} Datei(en) geändert.` }
    },
  }),

  defineTool({
    name: 'replace_asset_file',
    title: 'Datei durch neue Version ersetzen',
    description:
      'Ersetzt die Datei eines Assets durch eine neue Version. Die bisherige Datei bleibt als Version erhalten (list_asset_versions, restore_asset_version). Quellen wie bei upload_asset.',
    input: {
      asset_id: z.string(),
      note: z.string().max(500).optional().describe('Was hat sich geändert?'),
      ...fileSourceShapeShort,
    },
    kind: 'write',
    async run(args, ctx) {
      const { asset, brand } = await loadAsset(ctx, args.asset_id)
      await ctx.requireEdit(brand)
      const file = await resolveFile(ctx, brand, args)
      const stored = await storeFile(ctx, brand, file, 'assets')
      try {
        row(
          await ctx.sb
            .from('asset_versions')
            .insert({
              asset_id: asset.id,
              brand_id: brand.id,
              version: asset.version,
              file_path: asset.file_path,
              thumb_path: asset.thumb_path,
              file_name: asset.file_name,
              mime_type: asset.mime_type,
              size_bytes: asset.size_bytes,
              width: asset.width,
              height: asset.height,
              note: args.note ?? '',
            })
            .select('id')
            .single(),
        )
        const [updated] = affected(
          await ctx.sb
            .from('assets')
            .update({
              file_path: stored.path,
              thumb_path: stored.thumbPath,
              file_name: stored.fileName,
              mime_type: stored.mime,
              ext: stored.ext,
              size_bytes: stored.size,
              width: stored.width,
              height: stored.height,
              version: asset.version + 1,
            })
            .eq('id', asset.id)
            .select('*'),
          'Datei',
        )
        return {
          summary: `„${updated.title}“ ist jetzt Version ${updated.version}.`,
          data: assetSummary(updated as AssetRow),
        }
      } catch (error) {
        await discardStored(ctx, stored)
        throw error
      }
    },
  }),

  defineTool({
    name: 'list_asset_versions',
    title: 'Frühere Dateiversionen',
    description: 'Listet die früheren Versionen einer Datei (neueste zuerst) mit Download-Links.',
    input: { asset_id: z.string() },
    kind: 'read',
    async run({ asset_id }, ctx) {
      const { asset } = await loadAsset(ctx, asset_id)
      const data = rows(
        await ctx.sb
          .from('asset_versions')
          .select('*, author:profiles(full_name, email)')
          .eq('asset_id', asset.id)
          .order('version', { ascending: false }),
      )
      const urls = await signedUrls(
        ctx,
        data.map((v) => v.file_path),
      )
      return {
        summary: `Aktuell Version ${asset.version}; ${data.length} frühere Version(en).`,
        data: data.map((v) => ({
          id: v.id,
          version: v.version,
          file_name: v.file_name,
          size_bytes: Number(v.size_bytes),
          note: v.note,
          at: v.created_at,
          by: v.author ? v.author.full_name || v.author.email : null,
          download_url: urls.get(v.file_path) ?? null,
        })),
      }
    },
  }),

  defineTool({
    name: 'restore_asset_version',
    title: 'Dateiversion wiederherstellen',
    description:
      'Macht eine frühere Version wieder zur aktuellen Datei (als neue Version; nichts geht verloren).',
    input: { asset_id: z.string(), version_id: z.string() },
    kind: 'write',
    async run({ asset_id, version_id }, ctx) {
      const { asset, brand } = await loadAsset(ctx, asset_id)
      await ctx.requireEdit(brand)
      const version = row(
        await ctx.sb
          .from('asset_versions')
          .select('*')
          .eq('id', version_id)
          .eq('asset_id', asset.id)
          .single(),
      )
      row(
        await ctx.sb
          .from('asset_versions')
          .insert({
            asset_id: asset.id,
            brand_id: brand.id,
            version: asset.version,
            file_path: asset.file_path,
            thumb_path: asset.thumb_path,
            file_name: asset.file_name,
            mime_type: asset.mime_type,
            size_bytes: asset.size_bytes,
            width: asset.width,
            height: asset.height,
            note: `Ersetzt durch Wiederherstellung von Version ${version.version}`,
          })
          .select('id')
          .single(),
      )
      const [updated] = affected(
        await ctx.sb
          .from('assets')
          .update({
            file_path: version.file_path,
            thumb_path: version.thumb_path,
            file_name: version.file_name,
            mime_type: version.mime_type,
            ext: extensionOf(version.file_name),
            size_bytes: version.size_bytes,
            width: version.width,
            height: version.height,
            version: asset.version + 1,
          })
          .eq('id', asset.id)
          .select('*'),
        'Datei',
      )
      return {
        summary: `Version ${version.version} wiederhergestellt – jetzt Version ${updated.version}.`,
        data: assetSummary(updated as AssetRow),
      }
    },
  }),

  defineTool({
    name: 'delete_assets',
    title: 'Dateien löschen',
    description:
      'Löscht eine oder mehrere Dateien samt Vorschaubildern und früheren Versionen. Unwiderruflich. Verweise in Handbuch-Bausteinen bleiben als leere Bilder zurück.',
    input: { asset_ids: z.array(z.string()).min(1).max(100) },
    kind: 'destructive',
    async run({ asset_ids }, ctx) {
      const loaded = await loadAssets(ctx, asset_ids)
      for (const brand of new Map(loaded.map((l) => [l.brand.id, l.brand])).values())
        await ctx.requireEdit(brand)
      const ids = loaded.map((l) => l.asset.id)
      const versions = rows(
        await ctx.sb.from('asset_versions').select('file_path, thumb_path').in('asset_id', ids),
      )
      const deleted = affected(await ctx.sb.from('assets').delete().in('id', ids).select('id'), 'Datei')
      await removePaths(ctx, [
        ...loaded.flatMap((l) => [l.asset.file_path, l.asset.thumb_path]),
        ...versions.flatMap((v) => [v.file_path, v.thumb_path]),
      ])
      return { summary: `${deleted.length} Datei(en) gelöscht.` }
    },
  }),

  defineTool({
    name: 'download_asset',
    title: 'Datei herunterladen',
    description:
      'Liefert eine Datei: immer mit Download-Link (1 Stunde gültig); kleine Bilder/Texte zusätzlich direkt im Gespräch (inline=true, Standard bei kleinen Dateien). Bilder und SVGs lassen sich umwandeln: format (png, jpg, webp), width in px, background (HEX, für JPG/transparent). Der Link ist ein normaler HTTPS-Download.',
    input: {
      asset_id: z.string(),
      inline: z
        .boolean()
        .optional()
        .describe('Inhalt direkt mitliefern (Bilder ≤ 1,5 MB, Texte ≤ 200 KB, sonst nur Link)'),
      format: z.enum(['png', 'jpg', 'webp']).optional().describe('Bild in dieses Format umwandeln'),
      width: z.number().int().min(16).max(8000).optional().describe('Zielbreite in Pixel (nur mit format)'),
      background: z.string().optional().describe('Hintergrundfarbe als HEX beim Umwandeln, z. B. #FFFFFF'),
    },
    kind: 'read',
    async run({ asset_id, inline, format, width, background }, ctx) {
      const { asset, brand } = await loadAsset(ctx, asset_id)
      await assertDownloadable(brand, asset)
      const wantsConversion = Boolean(format)
      if (wantsConversion && !isImage(asset.mime_type))
        throw new ToolError('Nur Bilder und SVGs lassen sich umwandeln.')
      if (!wantsConversion && width) throw new ToolError('width funktioniert nur zusammen mit format.')
      if (background && !/^#[0-9a-f]{6}$/i.test(background))
        throw new ToolError('background muss ein HEX-Wert wie #FFFFFF sein.')

      const original = await signedUrl(ctx, asset.file_path, 3600, asset.file_name)
      if (!wantsConversion) {
        const small = isImage(asset.mime_type)
          ? asset.size_bytes <= INLINE_IMAGE_MAX
          : isTextMime(asset.mime_type)
            ? asset.size_bytes <= INLINE_TEXT_MAX
            : false
        const wantInline = inline ?? small
        const info = { ...assetSummary(asset), download_url: original, expires_in_minutes: 60 }
        if (!wantInline)
          return { summary: `„${asset.title}“: Download-Link (60 Minuten gültig).`, data: info }
        if (
          asset.size_bytes >
          (isImage(asset.mime_type)
            ? INLINE_IMAGE_MAX
            : isTextMime(asset.mime_type)
              ? INLINE_TEXT_MAX
              : INLINE_BINARY_MAX)
        ) {
          return {
            summary: `„${asset.title}“ ist zu groß für die direkte Anzeige – hier der Download-Link.`,
            data: info,
          }
        }
        const bytes = await downloadBytes(ctx, asset.file_path)
        // SVG und andere Formate, die Claude nicht als Bild anzeigen kann, kommen als Text bzw. Datei
        return {
          summary: `„${asset.title}“ (${asset.file_name}).`,
          data: info,
          extra: mimeResult(bytes, asset.mime_type, asset.file_name),
        }
      }

      if (!(await loadSharp()))
        throw new ToolError('Umwandeln ist auf diesem Server nicht verfügbar (sharp fehlt).')
      const source = await downloadBytes(ctx, asset.file_path)
      const converted = await convertImage(
        source,
        asset.mime_type,
        format as ConvertTarget,
        width ?? null,
        background ?? null,
      )
      if (!converted) throw new ToolError('Umwandeln ist auf diesem Server nicht verfügbar.')
      const fileName = `${slugify(asset.title)}${width ? `-${width}px` : ''}.${format}`
      const mime = CONVERT_MIME[format as ConvertTarget]
      const published = await publishExport(ctx, brand, fileName, converted, mime)
      const data = {
        file_name: fileName,
        mime_type: mime,
        size_bytes: converted.length,
        download_url: published?.url ?? null,
        expires_in_minutes: published ? 60 : null,
      }
      const showInline = (inline ?? true) && converted.length <= INLINE_IMAGE_MAX
      if (!published && !showInline) {
        throw new ToolError(
          'Das Ergebnis ist zu groß für die direkte Antwort, und ohne Bearbeitungsrechte kann kein Download-Link bereitgestellt werden.',
        )
      }
      return {
        summary: `„${asset.title}“ als ${format?.toUpperCase()}${width ? ` (${width}px breit)` : ''}.`,
        data,
        extra: showInline ? mimeResult(converted, mime, fileName) : undefined,
      }
    },
  }),

  defineTool({
    name: 'download_assets_zip',
    title: 'Dateien als ZIP herunterladen',
    description:
      'Packt Dateien in ein ZIP-Archiv und liefert einen Download-Link (60 Minuten gültig). Auswahl: asset_ids, eine ganze Bibliothek (library) und/oder eine Sammlung. Nur Dateien, die zum Download freigegeben sind. Bis 150 MB gesamt. Braucht Bearbeitungsrechte (für den temporären Link).',
    input: {
      brand: z.string().optional(),
      asset_ids: z.array(z.string()).max(500).optional(),
      library: z.string().optional(),
      collection: z.string().optional().describe('Sammlung (Name oder ID); zusammen mit library'),
      zip_name: z.string().max(80).optional().describe('Name des Archivs ohne .zip'),
    },
    kind: 'read',
    async run({ brand: ref, asset_ids, library, collection, zip_name }, ctx) {
      if (!asset_ids?.length && !library) throw new ToolError('Bitte asset_ids oder eine library angeben.')
      let brand: ScopeBrand
      let assets: AssetRow[]
      if (asset_ids?.length) {
        const loaded = await loadAssets(ctx, asset_ids)
        const brands = new Set(loaded.map((l) => l.brand.id))
        if (brands.size > 1) throw new ToolError('Alle Dateien eines ZIPs müssen zur selben Marke gehören.')
        brand = loaded[0].brand
        assets = loaded.map((l) => l.asset)
      } else {
        brand = await ctx.brand(ref)
        const lib = await resolveLibrary(ctx, brand, library)
        let q = ctx.sb.from('assets').select('*').eq('library_id', lib.id)
        if (collection) {
          const cols = rows(
            await ctx.sb
              .from('collections')
              .select('id, name, collection_assets(asset_id)')
              .eq('library_id', lib.id),
          )
          const found = matchByRef(cols, collection, [(c) => c.name], 'Sammlung')
          const ids = found.collection_assets.map((x) => x.asset_id)
          q = q.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
        }
        assets = rows(await q.order('created_at')) as AssetRow[]
      }
      const allowed = assets.filter((a) => a.downloadable)
      const skipped = assets.length - allowed.length
      if (allowed.length === 0) throw new ToolError('Keine der Dateien ist zum Download freigegeben.')
      const total = allowed.reduce((sum, a) => sum + Number(a.size_bytes), 0)
      if (total > ZIP_MAX_TOTAL)
        throw new ToolError(
          `Zusammen ${(total / 1024 / 1024).toFixed(0)} MB – das ist mehr als die Obergrenze von 150 MB. Bitte aufteilen.`,
        )

      const zip = new JSZip()
      const used = new Set<string>()
      for (const asset of allowed) {
        let name = safeFileName(asset.file_name)
        let i = 2
        while (used.has(name)) name = asset.file_name.replace(/(\.[^.]+)?$/, `-${i++}$1`)
        used.add(name)
        zip.file(name, await downloadBytes(ctx, asset.file_path))
      }
      const bytes = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      })
      const fileName = `${slugify(zip_name || `${brand.slug}-dateien`)}.zip`
      const published = await publishExport(ctx, brand, fileName, bytes, 'application/zip')
      if (published) {
        return {
          summary: `ZIP mit ${allowed.length} Datei(en) (${(bytes.length / 1024 / 1024).toFixed(1)} MB) – Link 60 Minuten gültig${skipped ? `; ${skipped} Datei(en) ohne Download-Freigabe übersprungen` : ''}.`,
          data: {
            file_name: fileName,
            files: allowed.length,
            size_bytes: bytes.length,
            download_url: published.url,
          },
        }
      }
      if (bytes.length <= INLINE_BINARY_MAX) {
        return {
          summary: `ZIP mit ${allowed.length} Datei(en) direkt eingebettet (nur lesender Zugriff – kein Download-Link möglich).`,
          data: { file_name: fileName, files: allowed.length },
          extra: mimeResult(bytes, 'application/zip', fileName),
        }
      }
      throw new ToolError(
        'Das ZIP ist zu groß für die direkte Antwort, und ohne Bearbeitungsrechte kann kein Download-Link bereitgestellt werden. Lade einzelne Dateien mit download_asset.',
      )
    },
  }),

  defineTool({
    name: 'list_collections',
    title: 'Sammlungen',
    description:
      'Listet die Sammlungen (kuratierte Gruppen von Dateien) einer Bibliothek oder der ganzen Marke.',
    input: { brand: z.string().optional(), library: z.string().optional() },
    kind: 'read',
    async run({ brand: ref, library: lRef }, ctx) {
      const brand = await ctx.brand(ref)
      let q = ctx.sb
        .from('collections')
        .select('id, name, description, library_id, collection_assets(asset_id)')
        .eq('brand_id', brand.id)
        .order('sort')
      if (lRef) q = q.eq('library_id', (await resolveLibrary(ctx, brand, lRef)).id)
      const data = rows(await q)
      return {
        summary: `${data.length} Sammlung(en).`,
        data: data.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          library_id: c.library_id,
          asset_ids: c.collection_assets.map((x) => x.asset_id),
        })),
      }
    },
  }),

  defineTool({
    name: 'create_collection',
    title: 'Sammlung anlegen',
    description: 'Legt in einer Bibliothek eine Sammlung an, optional gleich mit Dateien.',
    input: {
      brand: z.string().optional(),
      library: z.string().optional(),
      name: z.string().min(1).max(120),
      description: z.string().max(1000).optional(),
      asset_ids: z.array(z.string()).max(500).optional(),
    },
    kind: 'write',
    async run({ brand: ref, library: lRef, name, description, asset_ids }, ctx) {
      const brand = await ctx.editableBrand(ref)
      const library = await resolveLibrary(ctx, brand, lRef)
      const created = row(
        await ctx.sb
          .from('collections')
          .insert({
            library_id: library.id,
            brand_id: brand.id,
            name: name.trim(),
            description: description ?? '',
            sort: await nextSort(ctx, 'collections', brand.id),
          })
          .select('id, name')
          .single(),
      )
      if (asset_ids?.length) {
        const { error } = await ctx.sb.from('collection_assets').upsert(
          asset_ids.map((asset_id, sort) => ({
            collection_id: created.id,
            asset_id,
            brand_id: brand.id,
            sort,
          })),
          { onConflict: 'collection_id,asset_id', ignoreDuplicates: true },
        )
        if (error) {
          await ctx.sb.from('collections').delete().eq('id', created.id)
          throw error
        }
      }
      return {
        summary: `Sammlung „${created.name}“ in „${library.name}“ angelegt${asset_ids?.length ? ` (${asset_ids.length} Dateien)` : ''}.`,
        data: created,
      }
    },
  }),

  defineTool({
    name: 'update_collection',
    title: 'Sammlung bearbeiten',
    description: 'Benennt eine Sammlung um und/oder fügt Dateien hinzu bzw. entfernt sie.',
    input: {
      brand: z.string().optional(),
      collection: z.string().describe('Name oder ID'),
      name: z.string().min(1).max(120).optional(),
      description: z.string().max(1000).optional(),
      add_asset_ids: z.array(z.string()).max(500).optional(),
      remove_asset_ids: z.array(z.string()).max(500).optional(),
    },
    kind: 'write',
    idempotent: true,
    async run({ brand: ref, collection, name, description, add_asset_ids, remove_asset_ids }, ctx) {
      const brand = await ctx.editableBrand(ref)
      const cols = rows(await ctx.sb.from('collections').select('id, name').eq('brand_id', brand.id))
      const found = matchByRef(cols, collection, [(c) => c.name], 'Sammlung')
      const patch = defined({ name: name?.trim(), description })
      if (Object.keys(patch).length > 0)
        affected(await ctx.sb.from('collections').update(patch).eq('id', found.id).select('id'), 'Sammlung')
      if (add_asset_ids?.length) {
        const { error } = await ctx.sb.from('collection_assets').upsert(
          add_asset_ids.map((asset_id) => ({ collection_id: found.id, asset_id, brand_id: brand.id })),
          { onConflict: 'collection_id,asset_id', ignoreDuplicates: true },
        )
        if (error) throw error
      }
      if (remove_asset_ids?.length) {
        const { error } = await ctx.sb
          .from('collection_assets')
          .delete()
          .eq('collection_id', found.id)
          .in('asset_id', remove_asset_ids)
        if (error) throw error
      }
      requireChange({
        ...patch,
        a: add_asset_ids?.length ? 1 : undefined,
        r: remove_asset_ids?.length ? 1 : undefined,
      })
      return { summary: `Sammlung „${name ?? found.name}“ gespeichert.` }
    },
  }),

  defineTool({
    name: 'delete_collection',
    title: 'Sammlung löschen',
    description: 'Löscht eine Sammlung. Die Dateien selbst bleiben erhalten.',
    input: { brand: z.string().optional(), collection: z.string().describe('Name oder ID') },
    kind: 'destructive',
    async run({ brand: ref, collection }, ctx) {
      const brand = await ctx.editableBrand(ref)
      const cols = rows(await ctx.sb.from('collections').select('id, name').eq('brand_id', brand.id))
      const found = matchByRef(cols, collection, [(c) => c.name], 'Sammlung')
      affected(await ctx.sb.from('collections').delete().eq('id', found.id).select('id'), 'Sammlung')
      return { summary: `Sammlung „${found.name}“ gelöscht (Dateien bleiben).` }
    },
  }),
]
