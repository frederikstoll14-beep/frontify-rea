import { imageSize } from 'image-size'

export interface ImageDims {
  width: number
  height: number
}

type SharpFactory = typeof import('sharp').default

let sharpPromise: Promise<SharpFactory | null> | undefined

/** sharp ist optional: Fehlt es, entfallen Vorschaubilder und Formatumwandlung, alles andere funktioniert. */
export function loadSharp(): Promise<SharpFactory | null> {
  sharpPromise ??= import('sharp')
    .then((mod) => (mod.default ?? (mod as unknown as SharpFactory)) as SharpFactory)
    .catch(() => null)
  return sharpPromise
}

const RASTER = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/bmp']

export function isRaster(mime: string): boolean {
  return RASTER.includes(mime)
}

export function isImage(mime: string): boolean {
  return isRaster(mime) || mime === 'image/svg+xml'
}

export function readDimensions(bytes: Uint8Array, mime: string): ImageDims | null {
  if (!isImage(mime)) return null
  try {
    const size = imageSize(bytes)
    return size.width && size.height ? { width: size.width, height: size.height } : null
  } catch {
    return null
  }
}

/** Vorschaubild (max. 800 px, WebP) wie in der Web-App; kleine Rasterbilder brauchen keins. */
export async function createThumbnail(
  bytes: Buffer,
  mime: string,
  dims: ImageDims | null,
): Promise<Buffer | null> {
  if (!isImage(mime)) return null
  if (isRaster(mime) && bytes.length < 150_000 && dims && Math.max(dims.width, dims.height) <= 800)
    return null
  const sharp = await loadSharp()
  if (!sharp) return null
  try {
    return await sharp(bytes, {
      limitInputPixels: 80_000_000,
      ...(mime === 'image/svg+xml' ? { density: 144 } : {}),
    })
      .rotate()
      .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: mime !== 'image/svg+xml' })
      .webp({ quality: 82 })
      .toBuffer()
  } catch {
    return null
  }
}

export type ConvertTarget = 'png' | 'jpg' | 'webp'

export const CONVERT_MIME: Record<ConvertTarget, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
}

/** Wandelt ein Bild (auch SVG) um, optional auf eine Breite skaliert. null, wenn sharp fehlt. */
export async function convertImage(
  bytes: Buffer,
  mime: string,
  format: ConvertTarget,
  width: number | null,
  background: string | null,
): Promise<Buffer | null> {
  const sharp = await loadSharp()
  if (!sharp) return null
  let pipeline = sharp(bytes, {
    limitInputPixels: 80_000_000,
    ...(mime === 'image/svg+xml' ? { density: width && width > 1000 ? 300 : 192 } : {}),
  }).rotate()
  if (width) pipeline = pipeline.resize({ width, withoutEnlargement: mime !== 'image/svg+xml' })
  if (format === 'jpg')
    pipeline = pipeline.flatten({ background: background ?? '#FFFFFF' }).jpeg({ quality: 90 })
  else if (background) pipeline = pipeline.flatten({ background }).toFormat(format === 'png' ? 'png' : 'webp')
  else pipeline = format === 'png' ? pipeline.png() : pipeline.webp({ quality: 90 })
  return pipeline.toBuffer()
}
