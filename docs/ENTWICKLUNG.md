# Entwicklung

## Stack

| Schicht | Technik |
| --- | --- |
| Frontend | React 19, TypeScript (strict), Vite 7, Tailwind CSS 4, React Router 7, TanStack Query 5 |
| UI-Bausteine | Radix UI (Dialoge, Menüs, Tabs, Switch, Tooltip), lucide-react, sonner |
| Editor | TipTap 3 (Rich Text), dnd-kit (Drag & Drop) |
| Backend | Supabase: Postgres 17 mit Row Level Security, Auth, Storage, RPC-Funktionen |
| Tests | Vitest (Logik), Vitest gegen lokales Supabase (Rechte), Playwright (End-to-End) |

## Lokal starten

Voraussetzungen: Node 22, Docker.

```bash
npm install
npx supabase start          # lokaler Stack: Postgres, Auth, Storage, Mailpit
cp .env.example .env.local  # Werte aus `npx supabase status` eintragen (API_URL, ANON_KEY)
npm run dev                 # http://127.0.0.1:5173
```

Lokale E-Mails (Bestätigung, Passwort vergessen) landen in Mailpit unter http://127.0.0.1:54324.

## Befehle

```bash
npm run lint          # ESLint
npm run format        # Prettier
npm run typecheck     # TypeScript
npm test              # Unit-Tests (Farben, Tokens, Vorlagen, Export, Embeds, Links)
npm run test:db       # Rechte-Tests gegen lokales Supabase (RLS, Storage, Einladungen)
npm run test:mcp      # MCP-Konnektor: OAuth-Ablauf, alle Werkzeuge, Rechte (gegen lokales Supabase)
npm run test:e2e      # Playwright: Mehrnutzer-Ablauf + Mobil-Check + Zustimmungsseite des Konnektors
npm run build:mcp     # api/mcp.js (Vercel-Funktion) aus mcp/ neu bündeln und committen
npm run mcp:dev       # MCP-Server lokal auf http://127.0.0.1:8787/mcp
npm run build         # Produktions-Build
npm run db:types      # TypeScript-Typen aus dem lokalen Schema neu erzeugen
```

Die GitHub-Action `.github/workflows/ci.yml` führt alle Schritte aus. Dazu startet sie ein lokales Supabase im CI.

## Projektstruktur

```
mcp/src/                   MCP-Server für KI-Assistenten (siehe docs/MCP.md)
api/mcp.js                 Daraus gebündelte Vercel-Funktion (generiert, wird eingecheckt)
supabase/
  migrations/…schema.sql   Komplettes Datenbankschema inkl. RLS, Storage, RPCs
  migrations/…mcp_connector.sql   Auswahl für verbundene Apps und ihre Durchsetzung
  config.toml              Lokale Supabase-Konfiguration
src/
  api/                     Datenzugriff (TanStack-Query-Hooks, Supabase-Aufrufe)
  app/router.tsx           Routen (schwere Seiten werden nachgeladen)
  components/ui/           UI-Grundbausteine (Button, Dialog, Menü, Tabs …)
  components/media/        Bilder aus dem Storage, Upload, Asset-Auswahl, Downloads
  features/
    auth/                  Login, Registrierung, Passwort
    workspace/             Dashboard, Workspace, Einladung, Konto
    brand/                 Marken-Layout, Theme, Startseite, Suche
    guidelines/            Markenhandbuch: Navigation, Seiten-Editor, Kommentare, Versionen
    blocks/                22 Bausteine (Ansicht + Editor) und Registry
    basics/                Markenbasis: Farben, Schriften, Textstile, Token-Export
    library/               Bibliotheken, Asset-Details, Tags, Sammlungen
    settings/              Marken-Einstellungen, Teilen, Export/Import
    members/               Mitglieder & Einladungen
    connections/           Zustimmungsseite (/oauth/consent) und „Verbundene Apps“ im Konto
    activity/, print/      Verlauf & Feedback, Druck/PDF
  lib/
    blocks/types.ts        Inhalts-Schemas der Bausteine
    templates/             Vorlagen (Verein, Unternehmen, Verband, Organisation, Demo)
    color.ts, tokens.ts    Farbrechnung, WCAG, Design-Token-Export (CSS, SCSS, JSON, Tailwind, ASE)
    brand-export.ts        Export/Import einer kompletten Marke
tests/
  db/                      Rechte-Tests
  e2e/                     Playwright
docs/                      Diese Dokumentation + Frontify-Analyse
```

## Datenmodell

```
workspaces ─┬─ workspace_members (owner | admin | member)
            └─ brands ─┬─ brand_members (admin | editor | viewer)
                       ├─ invitations (E-Mail oder Link, Rolle, Ablauf, max. Nutzungen)
                       ├─ guidelines ── guideline_pages (chapter | page) ── blocks (type, width, content jsonb)
                       │                       └─ page_revisions (Snapshots)
                       ├─ color_palettes ── colors
                       ├─ fonts, text_styles
                       ├─ libraries ── assets ── asset_versions
                       │         └─ collections ── collection_assets
                       ├─ comments (Seite oder Asset, Threads, Pins x/y)
                       └─ activity (per Trigger)
```

**Effektive Rolle pro Marke** (`brand_role_of`):

- Workspace-Owner und -Admins sind auf jeder Marke Admin.
- Ansonsten gilt die Rolle aus `brand_members`.
- Workspace-Mitglieder ohne eigene Rolle dürfen ansehen, wenn `visibility = 'workspace'`.
- Ist `is_public` gesetzt (und `public_until` nicht abgelaufen), können auch anonyme Besucher lesen. Kommentare, Mitglieder und Verlauf bleiben für sie unsichtbar.

**Sicherheitsprinzipien:**

- Jede Tabelle hat RLS. Schreiben geht nur mit `can_edit_brand`.
- `brand_id` in Kind-Tabellen setzt immer ein Trigger aus dem Elternobjekt. Was der Client mitschickt, wird ignoriert, so ist kein Schreiben in fremde Marken möglich.
- Dateien liegen im privaten Bucket `brand-files/<brand_id>/…`. Die Storage-Policies prüfen dieselben Rechte. Ausgeliefert wird per Signed URL (1 h).
- Workspaces, Marken und Einladungen werden nur über `security definer`-Funktionen mit expliziten Prüfungen angelegt bzw. eingelöst.
- Verbundene Apps (OAuth-Token mit Claim `client_id`) sehen nur die Workspaces und Marken ihrer Auswahl (`mcp_grants`). Die Prüfung steckt in `workspace_role_of`, `brand_role_of` und `shares_workspace_with`; alle Regeln bauen darauf auf. Konto löschen, Workspace verlassen und Einladungen einlösen sind für Apps gesperrt.
- Rich Text wird beim Anzeigen mit DOMPurify bereinigt. Externe Links sind auf `http(s)`/`mailto` beschränkt, Einbettungen laufen in sandboxed iframes.

## Neuen Baustein hinzufügen

1. Inhaltstyp und Standardwerte in `src/lib/blocks/types.ts` ergänzen (`BlockContentMap`, `BLOCK_TYPES`, `BLOCK_META`, `defaultContent`).
2. `View` und `Editor` in `src/features/blocks/*-blocks.tsx` schreiben.
3. In `src/features/blocks/registry.tsx` registrieren.
4. Die Vorlagen-Tests prüfen automatisch, ob Vorlagen nur bekannte Bausteine nutzen.
