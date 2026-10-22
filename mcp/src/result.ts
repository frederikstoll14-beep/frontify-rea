import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

const MAX_TEXT = 90_000

export type Content = CallToolResult['content'][number]

export interface ToolOutput {
  /** Eine Zeile bis wenige Zeilen Klartext für die Person. */
  summary: string
  /** Strukturierte Daten für das Modell (werden als JSON angehängt). */
  data?: unknown
  /** Zusätzliche Inhalte (Bilder, eingebettete Dateien). */
  extra?: Content[]
}

function stringify(data: unknown): string {
  return JSON.stringify(data, (_key, value) => (value === undefined ? undefined : value))
}

/** Baut das Ergebnis eines Tools: Klartext-Zeile, dann JSON. Zu lange Antworten werden gekürzt. */
export function toResult(output: ToolOutput): CallToolResult {
  let text = output.summary
  if (output.data !== undefined) {
    let json = stringify(output.data)
    if (json.length > MAX_TEXT) {
      json = `${json.slice(0, MAX_TEXT)} …`
      text += `\n(Antwort gekürzt: Mit Filtern, limit/offset oder get_* für Einzelobjekte weiter eingrenzen.)`
    }
    text += `\n\n${json}`
  }
  return { content: [{ type: 'text', text }, ...(output.extra ?? [])] }
}

export function toErrorResult(message: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: message }] }
}
