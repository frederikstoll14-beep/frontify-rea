import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

function user(text: string) {
  return { messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }] }
}

/** Fertige Arbeitsabläufe, die Claude in der Prompt-Auswahl anbietet. */
export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    'brandbench_overview',
    {
      title: 'Überblick über meine Marken',
      description: 'Zeigt, was freigegeben ist, und fasst den Stand jeder Marke zusammen.',
    },
    () =>
      user(
        'Verschaffe mir einen Überblick über meine Brandbench-Marken: Rufe get_connection_info auf, dann get_brand für jede freigegebene Marke. Fasse pro Marke kurz zusammen, was schon da ist (Handbuch, Farben, Schriften, Dateien) und was fehlt. Nenne am Ende drei sinnvolle nächste Schritte.',
      ),
  )

  server.registerPrompt(
    'build_brand_handbook',
    {
      title: 'Markenhandbuch aufbauen',
      description: 'Baut oder ergänzt das Markenhandbuch einer Marke anhand eines kurzen Briefings.',
      argsSchema: {
        brand: z.string().optional().describe('Marke (Name); leer, wenn nur eine freigegeben ist'),
        briefing: z.string().describe('Worum geht es? Zielgruppe, Werte, Tonalität, Besonderheiten'),
      },
    },
    ({ brand, briefing }) =>
      user(
        `Baue das Markenhandbuch${brand ? ` der Marke „${brand}“` : ''} auf. Briefing:\n\n${briefing}\n\nVorgehen: 1) get_brand und list_guidelines lesen, damit nichts doppelt entsteht. 2) Kapitel und Seiten sinnvoll planen (Markenkern, Logo, Farben, Typografie, Bildwelt, Tonalität, Anwendungen) und mir die Gliederung kurz zeigen. 3) Nach meinem OK Seiten mit create_page und passenden Bausteinen anlegen (Überschriften, Text als Markdown, Farben-/Typografie-Bausteine, Do & Don't). Rufe bei Unsicherheit get_block_schema auf. 4) Zum Schluss die Links zu den neuen Seiten nennen.`,
      ),
  )

  server.registerPrompt(
    'audit_brand',
    {
      title: 'Marke prüfen (Audit)',
      description: 'Prüft eine Marke auf Lücken: fehlende Inhalte, Kontraste, Tokens, abgelaufene Dateien, leere Seiten.',
      argsSchema: { brand: z.string().optional().describe('Marke (Name); leer, wenn nur eine freigegeben ist') },
    },
    ({ brand }) =>
      user(
        `Prüfe die Marke${brand ? ` „${brand}“` : ''} auf Vollständigkeit und Konsistenz: get_brand, list_guidelines (leere oder unveröffentlichte Seiten), list_colors (fehlende Tokens/CMYK/Pantone, schwache Kontraste), list_typography, list_assets (abgelaufene Nutzungsrechte, fehlende Beschreibungen/Tags), list_comments (offene Kommentare). Gib einen priorisierten Befund (kritisch / wichtig / nice-to-have) mit konkreten Vorschlägen. Ändere nichts, ohne vorher zu fragen.`,
      ),
  )

  server.registerPrompt(
    'import_assets',
    {
      title: 'Dateien in eine Bibliothek importieren',
      description: 'Lädt Dateien von öffentlichen Adressen in eine Bibliothek und vergibt Titel und Tags.',
      argsSchema: {
        brand: z.string().optional().describe('Marke (Name)'),
        library: z.string().optional().describe('Bibliothek (Name)'),
        urls: z.string().describe('Eine Adresse pro Zeile'),
      },
    },
    ({ brand, library, urls }) =>
      user(
        `Importiere diese Dateien${library ? ` in die Bibliothek „${library}“` : ''}${brand ? ` der Marke „${brand}“` : ''} mit upload_asset (Parameter url). Vergib sprechende Titel und passende Tags, lies Urheberrecht/Lizenz aus dem Kontext, wenn bekannt. Danach eine Liste mit Titel, Typ und Größe.\n\n${urls}`,
      ),
  )

  server.registerPrompt(
    'prepare_brand_kit',
    {
      title: 'Brand-Kit zum Weitergeben',
      description: 'Stellt Logos, Farben und Schriften als Download-Paket zusammen.',
      argsSchema: { brand: z.string().optional().describe('Marke (Name)') },
    },
    ({ brand }) =>
      user(
        `Stelle ein Brand-Kit${brand ? ` für „${brand}“` : ''} zusammen: Logos als ZIP (download_assets_zip aus der Logo-Bibliothek), Farben/Schriften als CSS und JSON (export_tokens) und Adobe-Farbfelder (ase). Gib mir die Download-Links und fasse kurz zusammen, was enthalten ist.`,
      ),
  )
}
