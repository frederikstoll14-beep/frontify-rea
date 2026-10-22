import { describe, expect, it } from 'vitest'
import {
  assessRedirectUri,
  countAccessibleBrands,
  describeSelection,
  hasBrandAccess,
  isBrandSelected,
  isEmptySelection,
  normalizeSelection,
  toggleBrand,
  toggleWorkspace,
  type ScopeBrand,
} from './connections'

const brands: ScopeBrand[] = [
  { id: 'a', name: 'A', workspace_id: 'w1' },
  { id: 'b', name: 'B', workspace_id: 'w1' },
  { id: 'c', name: 'C', workspace_id: 'w2' },
]

describe('Auswahl', () => {
  it('entfernt Einzelmarken, die ein gewählter Workspace schon abdeckt', () => {
    const next = normalizeSelection({ workspaceIds: ['w1'], brandIds: ['a', 'c'] }, brands)
    expect(next.brandIds).toEqual(['c'])
  })

  it('Workspace an: Einzelmarken des Workspaces fallen weg, Workspace aus: bleibt ohne Marken', () => {
    let selection = toggleBrand({ workspaceIds: [], brandIds: [] }, 'a', true)
    selection = toggleWorkspace(selection, 'w1', true, brands)
    expect(selection).toEqual({ workspaceIds: ['w1'], brandIds: [] })
    selection = toggleWorkspace(selection, 'w1', false, brands)
    expect(isEmptySelection(selection)).toBe(true)
  })

  it('zählt erreichbare Marken', () => {
    const selection = { workspaceIds: ['w1'], brandIds: ['c'] }
    expect(countAccessibleBrands(selection, brands)).toBe(3)
    expect(isBrandSelected(selection, brands[2])).toBe(true)
    expect(countAccessibleBrands({ workspaceIds: [], brandIds: ['b'] }, brands)).toBe(1)
  })

  it('beschreibt die Auswahl verständlich', () => {
    expect(describeSelection({ workspaceIds: [], brandIds: [] }, { workspaces: 0, brands: 0 })).toBe(
      'Nichts ausgewählt',
    )
    expect(describeSelection({ workspaceIds: ['w1'], brandIds: ['c'] }, { workspaces: 1, brands: 3 })).toBe(
      '1 ganzer Workspace + 1 einzelne Marke (3 Marken erreichbar)',
    )
  })
})

describe('App-Einschätzung', () => {
  it('erkennt Claude', () => {
    expect(assessRedirectUri('https://claude.ai/api/mcp/auth_callback')).toEqual({
      trust: 'known',
      destination: 'claude.ai',
    })
    expect(assessRedirectUri('https://claude.com/api/mcp/auth_callback').trust).toBe('known')
  })

  it('lässt sich nicht von ähnlichen Adressen täuschen', () => {
    expect(assessRedirectUri('https://claude.ai.evil.example/cb').trust).toBe('unknown')
    expect(assessRedirectUri('https://evilclaude.ai/cb').trust).toBe('unknown')
    expect(assessRedirectUri('http://claude.ai/cb').trust).toBe('unknown')
  })

  it('erkennt lokale Apps und unbekannte Adressen', () => {
    expect(assessRedirectUri('http://127.0.0.1:33418/callback').trust).toBe('local')
    expect(assessRedirectUri('vscode://anthropic.claude-code/callback').trust).toBe('local')
    expect(assessRedirectUri('https://example.org/cb').trust).toBe('unknown')
    expect(assessRedirectUri('kein url').trust).toBe('unknown')
  })
})

describe('Zugriff auf Marken', () => {
  it('spiegelt die Regeln der Datenbank', () => {
    expect(hasBrandAccess({ workspaceRole: 'admin', brandRole: null, visibility: 'private' })).toBe(true)
    expect(hasBrandAccess({ workspaceRole: 'member', brandRole: null, visibility: 'workspace' })).toBe(true)
    expect(hasBrandAccess({ workspaceRole: 'member', brandRole: null, visibility: 'private' })).toBe(false)
    expect(hasBrandAccess({ workspaceRole: 'member', brandRole: 'viewer', visibility: 'private' })).toBe(true)
    expect(hasBrandAccess({ workspaceRole: null, brandRole: 'editor', visibility: 'private' })).toBe(true)
    expect(hasBrandAccess({ workspaceRole: null, brandRole: null, visibility: 'workspace' })).toBe(false)
  })
})
