/** Browser-seitige Bildverarbeitung: Maße, Vorschaubilder, Formatkonvertierung. */

export const RASTER_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/bmp']

export function isImageMime(mime: string | null | undefined): boolean {
  return Boolean(mime && (RASTER_TYPES.includes(mime) || mime === 'image/svg+xml'))
}

export function isSvg(mime: string | null | undefined, name?: string): boolean {
  return mime === 'image/svg+xml' || Boolean(name?.toLowerCase().endsWith('.svg'))
}

export function isVideoMime(mime: string | null | undefined): boolean {
  return Boolean(mime?.startsWith('video/'))
}

export function isAudioMime(mime: string | null | undefined): boolean {
  return Boolean(mime?.startsWith('audio/'))
}

export function isFontFile(name: string): boolean {
  return /\.(woff2?|ttf|otf)$/i.test(name)
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'))
    img.src = src
  })
}

export async function imageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob)
  try {
    return await loadImage(url)
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

export async function readImageSize(file: Blob): Promise<{ width: number; height: number } | null> {
  if (!isImageMime(file.type)) return null
  try {
    const img = await imageFromBlob(file)
    const width = img.naturalWidth || img.width
    const height = img.naturalHeight || img.height
    return width && height ? { width, height } : null
  } catch {
    return null
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Export fehlgeschlagen'))), type, quality)
  })
}

export async function renderToBlob(
  img: CanvasImageSource & { width: number; height: number },
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  type: 'image/png' | 'image/jpeg' | 'image/webp',
  background?: string,
): Promise<Blob> {
  const scale = targetWidth / sourceWidth
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(sourceWidth * scale))
  canvas.height = Math.max(1, Math.round(sourceHeight * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas nicht verfügbar')
  if (type === 'image/jpeg' || background) {
    ctx.fillStyle = background ?? '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvasToBlob(canvas, type, type === 'image/png' ? undefined : 0.9)
}

/** Vorschaubild (max. 800 px, WebP) für Bilder und SVGs. */
export async function createThumbnail(file: Blob, maxSize = 800): Promise<Blob | null> {
  if (!isImageMime(file.type) && !isVideoMime(file.type)) return null
  try {
    if (isVideoMime(file.type)) return await videoThumbnail(file, maxSize)
    const img = await imageFromBlob(file)
    let w = img.naturalWidth || img.width || 800
    let h = img.naturalHeight || img.height || 800
    if (file.type === 'image/svg+xml' && (!img.naturalWidth || !img.naturalHeight)) {
      w = 800
      h = 800
    }
    const target = Math.min(maxSize, Math.max(w, h))
    const targetWidth = w >= h ? target : Math.round((target * w) / h)
    if (file.type !== 'image/svg+xml' && file.size < 150_000 && Math.max(w, h) <= maxSize) return null
    return await renderToBlob(img, w, h, targetWidth, 'image/webp')
  } catch {
    return null
  }
}

function videoThumbnail(file: Blob, maxSize: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'
    video.src = url
    const cleanup = () => URL.revokeObjectURL(url)
    video.onloadeddata = () => {
      video.currentTime = Math.min(1, (video.duration || 2) / 3)
    }
    video.onseeked = async () => {
      try {
        const w = video.videoWidth
        const h = video.videoHeight
        const target = Math.min(maxSize, w)
        const blob = await renderToBlob(
          video as unknown as CanvasImageSource & { width: number; height: number },
          w,
          h,
          target,
          'image/webp',
        )
        resolve(blob)
      } catch {
        resolve(null)
      } finally {
        cleanup()
      }
    }
    video.onerror = () => {
      cleanup()
      resolve(null)
    }
    setTimeout(() => resolve(null), 8000)
  })
}

export type ConvertFormat = 'original' | 'png' | 'jpg' | 'webp'

export const CONVERT_LABELS: Record<ConvertFormat, string> = {
  original: 'Original',
  png: 'PNG',
  jpg: 'JPG',
  webp: 'WebP',
}

/** Konvertiert ein Bild (auch SVG) in ein anderes Format/eine andere Breite. */
export async function convertImage(
  blob: Blob,
  format: Exclude<ConvertFormat, 'original'>,
  width: number | null,
  background?: string,
): Promise<Blob> {
  const img = await imageFromBlob(blob)
  let w = img.naturalWidth || img.width
  let h = img.naturalHeight || img.height
  if (!w || !h) {
    w = 1000
    h = 1000
  }
  const mime = format === 'png' ? 'image/png' : format === 'jpg' ? 'image/jpeg' : 'image/webp'
  return renderToBlob(img, w, h, width ?? w, mime, background)
}
