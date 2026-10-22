export function isFontFileName(name: string): boolean {
  return /\.(woff2?|ttf|otf)$/i.test(name)
}
