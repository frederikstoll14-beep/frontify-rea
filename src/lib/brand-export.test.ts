import { describe, expect, it } from 'vitest'
import { buildBrandExport, parseBrandExport, stripForeignReferences, type ExportInput } from './brand-export'

const input: ExportInput = {
  brand: { id: 'b1', name: 'Test', slug: 'test', theme: { primary: '#000000' }, home: { welcome: 'Hallo' } },
  palettes: [
    {
      name: 'Primär',
      description: '',
      colors: [
        { name: 'Blau', hex: '#0000FF', token: 'blau', cmyk: '', pantone: '', hks: '', ral: '', ncs: '', usage: '', description: '' },
      ],
    },
  ],
  fonts: [{ family: 'Eigene', source: 'upload', role: '', weights: [400], fallback: 'sans-serif', license: '', description: '' }],
  textStyles: [],
  libraries: [{ name: 'Logos', kind: 'logos', slug: 'logos', description: '' }],
  guidelines: [{ id: 'g1', title: 'Handbuch', slug: 'handbuch', description: '', icon: 'book-open' }],
  pages: [
    { id: 'c1', guideline_id: 'g1', parent_id: null, kind: 'chapter', title: 'Kapitel', slug: 'kapitel', intro: '', sort: 1 },
    { id: 'p0', guideline_id: 'g1', parent_id: null, kind: 'page', title: 'Start', slug: 'start', intro: '', sort: 0 },
    { id: 'p1', guideline_id: 'g1', parent_id: 'c1', kind: 'page', title: 'Seite', slug: 'seite', intro: 'Intro', sort: 0 },
  ],
  blocks: [
    { page_id: 'p1', type: 'text', width: 'full', sort: 1, content: { html: '<p>B</p>' } },
    { page_id: 'p1', type: 'heading', width: 'full', sort: 0, content: { text: 'A' } },
  ],
}

describe('brand-export', () => {
  it('baut die Kapitelstruktur in der richtigen Reihenfolge', () => {
    const file = buildBrandExport(input)
    const items = file.data.guidelines![0].items
    expect(items[0]).toMatchObject({ title: 'Start' })
    expect(items[1]).toMatchObject({ kind: 'chapter', title: 'Kapitel' })
    const chapter = items[1] as { pages: Array<{ blocks: Array<{ type: string }> }> }
    expect(chapter.pages[0].blocks.map((b) => b.type)).toEqual(['heading', 'text'])
  })

  it('exportiert eigene Schriftdateien nicht', () => {
    expect(buildBrandExport(input).data.fonts![0].source).toBe('system')
  })

  it('prüft das Dateiformat beim Import', () => {
    const json = JSON.stringify(buildBrandExport(input))
    expect(parseBrandExport(json).source.name).toBe('Test')
    expect(() => parseBrandExport('{}')).toThrow(/Markenkompass/)
    expect(() => parseBrandExport('kein json')).toThrow(/JSON/)
  })

  it('entfernt fremde Datei- und Asset-Verweise', () => {
    const content = {
      image: { path: 'andere-marke/blocks/a.png' },
      own: { path: 'ziel/blocks/b.png' },
      items: [{ assetId: 'x', image: { path: 'andere/x.png' }, label: 'Logo' }],
      assetIds: ['a', 'b'],
      paletteIds: ['p'],
    }
    const result = stripForeignReferences(content, 'ziel')
    expect(result.image).toBeNull()
    expect(result.own).toEqual({ path: 'ziel/blocks/b.png' })
    expect(result.items[0]).toEqual({ assetId: null, image: null, label: 'Logo' })
    expect(result.assetIds).toEqual([])
    expect(result.paletteIds).toEqual([])
  })
})
