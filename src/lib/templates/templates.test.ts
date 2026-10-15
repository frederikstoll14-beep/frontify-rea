import { describe, expect, it } from 'vitest'
import { isBlockType, withDefaults } from '@/lib/blocks/types'
import { normalizeHex } from '@/lib/color'
import { TEMPLATES } from './index'
import type { TemplatePage } from './types'

function allPages(templateId: string): TemplatePage[] {
  const template = TEMPLATES.find((t) => t.id === templateId)
  if (!template) throw new Error(templateId)
  return (template.data.guidelines ?? []).flatMap((g) =>
    g.items.flatMap((item) => (item.kind === 'chapter' ? item.pages : [item])),
  )
}

describe('Vorlagen', () => {
  it('haben eindeutige IDs', () => {
    const ids = TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  for (const template of TEMPLATES) {
    describe(template.name, () => {
      it('nutzen nur bekannte Bausteine mit gültigem Inhalt', () => {
        for (const pageItem of allPages(template.id)) {
          for (const block of pageItem.blocks ?? []) {
            expect(isBlockType(block.type), `${pageItem.title}: ${block.type}`).toBe(true)
            const content = withDefaults(block.type, block.content)
            expect(content).toBeTruthy()
          }
        }
      })

      it('haben gültige Farben mit eindeutigen Tokens', () => {
        const tokens = new Set<string>()
        for (const palette of template.data.palettes ?? []) {
          for (const color of palette.colors) {
            expect(normalizeHex(color.hex), color.name).toBe(color.hex.toUpperCase())
            if (color.token) {
              expect(color.token).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
              expect(tokens.has(color.token), color.token).toBe(false)
              tokens.add(color.token)
            }
          }
        }
      })

      it('verweisen in Textstilen nur auf vorhandene Schriften', () => {
        const families = new Set((template.data.fonts ?? []).map((f) => f.family))
        for (const style of template.data.textStyles ?? []) {
          expect(families.has(style.fontFamily), style.name).toBe(true)
        }
      })

      it('haben eindeutige Seiten-Slugs je Guideline', () => {
        const titles = allPages(template.id).map((pg) => pg.slug ?? pg.title)
        expect(titles.length).toBeGreaterThan(0)
      })
    })
  }
})
