import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { fontFiles, useFonts } from '@/api/basics'
import type { Brand } from '@/api/brands'
import { getSignedUrl } from '@/api/storage'
import { contrastRatio, normalizeHex, readableTextColor } from '@/lib/color'
import { fontStack, loadUploadedFont, loadWebFonts } from '@/lib/fonts'
import { cn } from '@/lib/utils'

const DEFAULT_PRIMARY = '#15171F'
const DEFAULT_ACCENT = '#D9481F'

export function brandColors(brand: Pick<Brand, 'theme'>) {
  const primary = normalizeHex(brand.theme.primary ?? '') ?? DEFAULT_PRIMARY
  const accent = normalizeHex(brand.theme.accent ?? '') ?? DEFAULT_ACCENT
  const pick = (background: string, fallback: string) =>
    contrastRatio(accent, background) >= 3
      ? accent
      : contrastRatio(primary, background) >= 3
        ? primary
        : fallback
  return {
    primary,
    accent,
    primaryInk: readableTextColor(primary),
    accentInk: readableTextColor(accent),
    accentTextLight: pick('#F6F5F1', '#15171F'),
    accentTextDark: pick('#111217', '#F1EFE9'),
  }
}

/** Setzt die Marken-Variablen (--brand-*) und lädt die Marken-Schriften. */
export function BrandTheme({
  brand,
  children,
  className,
}: {
  brand: Brand
  children: ReactNode
  className?: string
}) {
  const { data: fonts } = useFonts(brand.id)
  const headingFont = brand.theme.headingFont
  const bodyFont = brand.theme.bodyFont

  useEffect(() => {
    if (!fonts) return
    const fromLibrary = fonts.filter((f) => f.source === 'google')
    const families = [...fromLibrary.map((f) => ({ family: f.family, weights: f.weights }))]
    for (const name of [headingFont, bodyFont]) {
      if (name && !fonts.some((f) => f.family === name))
        families.push({ family: name, weights: [400, 600, 700] })
    }
    loadWebFonts(families)
    for (const font of fonts.filter((f) => f.source === 'upload')) {
      void loadUploadedFont(font, fontFiles(font), getSignedUrl)
    }
  }, [fonts, headingFont, bodyFont])

  const colors = brandColors(brand)
  const fallbackFor = (family: string | undefined) =>
    fonts?.find((f) => f.family === family)?.fallback ?? 'system-ui, sans-serif'

  const style = {
    '--brand-primary': colors.primary,
    '--brand-primary-ink': colors.primaryInk,
    '--brand-accent': colors.accent,
    '--brand-accent-text-light': colors.accentTextLight,
    '--brand-accent-text-dark': colors.accentTextDark,
    '--brand-heading-font': headingFont ? fontStack(headingFont, fallbackFor(headingFont)) : undefined,
    '--brand-body-font': bodyFont ? fontStack(bodyFont, fallbackFor(bodyFont)) : undefined,
  } as CSSProperties

  return (
    <div style={style} className={cn('brand-scope', className)}>
      {children}
    </div>
  )
}
