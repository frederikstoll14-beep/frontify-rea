# Brandbench mit Claude verbinden (MCP-Konnektor)

Mit dem Konnektor arbeitet Claude direkt in Brandbench: Marken anlegen, Markenhandbuch schreiben, Farben und Schriften pflegen, Dateien hochladen und herunterladen, Mitglieder einladen, Kommentare lesen. Alles, was die Web-App kann, kann auch Claude.

Du entscheidest beim Verbinden, **welche Workspaces und Marken (Mehrfachauswahl)** Claude sehen und ändern darf. Alles andere bleibt für Claude unsichtbar. Dafür sorgt die Datenbank, nicht nur der Konnektor.

> **Begriffe:** Ein „Projekt“ heißt in Brandbench **Marke**. Ein Workspace (z. B. ein Kurs) enthält beliebig viele Marken.

```
Claude ──► https://DEINE-APP/mcp ──► Supabase (Login, Datenbank, Speicher)
              (MCP-Server auf Vercel)   mit deinen Rechten und deiner Auswahl
```

---

## 1. Einrichten (einmalig, ca. 10 Minuten)

Du brauchst eine laufende Brandbench-Installation nach [SETUP.md](SETUP.md) (Supabase + Vercel).

### 1.1 Datenbank-Update einspielen

Im Supabase-Dashboard unter **SQL Editor → New query** den Inhalt von
[`supabase/migrations/20261022120000_mcp_connector.sql`](../supabase/migrations/20261022120000_mcp_connector.sql) einfügen und **Run** klicken. Es muss „Success“ erscheinen.

Das Skript legt die Tabelle für die Auswahl an und erweitert die Rechte-Funktionen. Normale Nutzung der Web-App verändert sich nicht.

### 1.2 OAuth-Server in Supabase einschalten

Im Supabase-Dashboard unter **Authentication → OAuth Server**:

1. **OAuth Server aktivieren.**
2. **Authorization Path** auf `/oauth/consent` setzen.
3. **Dynamic Client Registration** (dynamische Registrierung) aktivieren. Dadurch kann sich Claude selbst anmelden.

Unter **Authentication → URL Configuration** muss die **Site URL** die Adresse deiner Web-App sein (z. B. `https://brandbench.vercel.app`). Das hast du in SETUP.md schon getan.

> **Empfohlen:** Unter **Project Settings → JWT Keys** auf asymmetrische Schlüssel (ES256/RS256) umstellen. Der Konnektor funktioniert auch mit dem alten HS256-Schlüssel, prüft dann aber jedes Token mit einer zusätzlichen Anfrage bei Supabase.

### 1.3 Web-App neu veröffentlichen

Der MCP-Server liegt im selben Repository (`api/mcp.js`) und wird mit der Web-App auf Vercel veröffentlicht. **Du musst keine neuen Umgebungsvariablen setzen**: Er liest dieselben Werte (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` oder die `NEXT_PUBLIC_*`-Namen der Supabase-Integration).

1. Änderungen mergen und auf Vercel deployen (automatisch bei Push auf den Hauptzweig).
2. Prüfen: `https://DEINE-APP/mcp/health` muss `"ok": true` zeigen.

> **Wichtig:** Nimm die **Production-Adresse**. Vorschau-Deployments sind bei Vercel standardmäßig passwortgeschützt, dort kann Claude sich nicht verbinden.

Optional: `APP_URL` setzen, wenn die Web-App unter einer anderen Adresse als der MCP-Server liegt (nur für Links in Antworten).

### 1.4 In Claude hinzufügen

1. Claude öffnen → **Einstellungen → Konnektoren** → **Benutzerdefinierten Konnektor hinzufügen**.
2. Name: `Brandbench`. URL: `https://DEINE-APP/mcp`. **Hinzufügen.**
   (Die Adresse steht auch in Brandbench unter **Konto → Verbundene Apps** zum Kopieren.)
3. **Verbinden** klicken. Ein Browserfenster öffnet sich:
   - bei Brandbench anmelden (falls nötig),
   - **Workspaces und Marken auswählen**, optional „Nur lesen“ einschalten,
   - **Zugriff erlauben.**
4. In einem neuen Chat den Konnektor über das Werkzeug-Menü aktivieren und loslegen.

> Bei Claude Team/Enterprise muss ein Organisations-Owner den Konnektor einmal unter **Organisationseinstellungen → Konnektoren** hinzufügen. Danach verbindet sich jede Person mit ihrem eigenen Brandbench-Konto.

---

## 2. Benutzen

Beispiele, die du Claude schreiben kannst:

- „Was ist in meinen Brandbench-Marken freigegeben? Gib mir einen Überblick.“
- „Lege im Workspace ‚Brand Identity WS 26‘ eine Marke ‚SV Teststadt‘ mit der Vereinsvorlage an.“
- „Schreibe für ‚SV Teststadt‘ die Seite ‚Markenkern‘: Werte, Mission, Tonalität.“
- „Lege die Farben Rheinblau #0B3C7A und Sonnengelb #FFC72C als Palette ‚Hausfarben‘ an und prüfe den Kontrast.“
- „Lade dieses Logo (SVG) in die Logo-Bibliothek hoch und tagge es mit ‚primär‘.“
- „Gib mir alle Logos als ZIP und die Farben als CSS und Adobe-Farbfelder.“
- „Prüfe die Marke auf Lücken: leere Seiten, fehlende Tokens, abgelaufene Bildrechte.“

In Claude gibt es dazu fertige **Prompts** (Prompt-Menü des Konnektors): Überblick, Handbuch aufbauen, Marke prüfen, Dateien importieren, Brand-Kit zusammenstellen.

### Auswahl ändern oder trennen

In Brandbench unter **Konto → Verbundene Apps**:

- **Auswahl ändern:** andere Workspaces/Marken wählen oder „Nur lesen“ umstellen. Gilt **sofort**, ohne neu zu verbinden.
- **Trennen:** Claude verliert sofort jeden Zugriff.

Neue Marken in einem **ganz freigegebenen Workspace** gehören automatisch dazu. Einzeln gewählte Marken bleiben einzeln. Workspaces, die Claude selbst anlegt, werden automatisch freigegeben.

---

## 3. Was Claude kann

84 Werkzeuge. Lesende sind als „nur lesen“ markiert, löschende als „destruktiv“ (Claude fragt dich dann vor dem Ausführen, je nach Einstellung).

| Bereich            | Werkzeuge                                                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Überblick          | `get_connection_info`, `list_workspaces`, `list_brands`, `get_brand`, `search`, `get_activity`                                                                                 |
| Workspaces         | `create_workspace`, `update_workspace`, `delete_workspace`, `list_workspace_members`, `set_workspace_member_role`, `remove_workspace_member`                                  |
| Marken             | `create_brand`, `update_brand`, `set_brand_sharing`, `delete_brand`, `list_templates`, `apply_template`, `export_brand`, `import_brand`, `set_brand_image`                     |
| Personen           | `list_brand_members`, `set_brand_member_role`, `remove_brand_member`, `invite_member`, `list_invitations`, `revoke_invitation`                                                 |
| Markenhandbuch     | `list_guidelines`, `create_guideline`, `update_guideline`, `delete_guideline`, `get_page`, `create_page`, `update_page`, `move_page`, `delete_page`                            |
| Bausteine          | `get_block_schema`, `add_block`, `update_block`, `move_block`, `delete_block`, `replace_page_blocks`                                                                           |
| Versionen          | `list_page_revisions`, `create_page_revision`, `restore_page_revision`                                                                                                         |
| Farben             | `list_colors`, `create_palette`, `update_palette`, `delete_palette`, `save_color`, `move_color`, `delete_color`, `check_contrast`                                              |
| Schriften          | `list_typography`, `save_font`, `upload_font_file`, `delete_font`, `save_text_style`, `delete_text_style`                                                                      |
| Design-Tokens      | `export_tokens` (CSS, SCSS, JSON, Tailwind, Adobe ASE)                                                                                                                          |
| Bibliotheken       | `list_libraries`, `create_library`, `update_library`, `delete_library`                                                                                                         |
| Dateien            | `list_assets`, `get_asset`, `upload_asset`, `create_upload_url`, `update_asset`, `bulk_update_assets`, `delete_assets`                                                        |
| Dateiversionen     | `replace_asset_file`, `list_asset_versions`, `restore_asset_version`                                                                                                           |
| Download           | `download_asset` (inkl. Umwandeln in PNG/JPG/WebP und Skalieren), `download_assets_zip`                                                                                       |
| Sammlungen         | `list_collections`, `create_collection`, `update_collection`, `delete_collection`                                                                                              |
| Zusammenarbeit     | `list_comments`, `add_comment`, `resolve_comment`, `delete_comment`                                                                                                            |

Marken, Workspaces, Bibliotheken, Handbücher und Seiten lassen sich über **Name, Kurz-URL oder ID** ansprechen. Ist nur eine Marke freigegeben, kann der Name sogar entfallen.

### Dateien hochladen und herunterladen

**Hochladen** (`upload_asset`): genau eine Quelle pro Datei.

| Quelle           | Wofür                                                | Grenze           |
| ---------------- | ---------------------------------------------------- | ---------------- |
| `text`           | SVG, CSS, JSON, Markdown direkt als Text             | wenige MB        |
| `content_base64` | kleine Binärdateien (PNG, PDF …) aus dem Gespräch    | ca. 3 MB         |
| `url`            | öffentliche https-Adresse, der Server lädt die Datei | 50 MB            |
| `upload_path`    | Große Dateien: erst `create_upload_url`, dann HTTP PUT | 50 MB           |

Bilder bekommen automatisch Maße und ein Vorschaubild. Titel, Beschreibung, Tags, Urheberrecht, Lizenz und Ablaufdatum lassen sich gleich mitgeben. `replace_asset_file` legt eine neue Version an, die alte bleibt wiederherstellbar.

**Herunterladen:**

- `download_asset` liefert **immer einen Download-Link** (1 Stunde gültig). Kleine Bilder und Texte erscheinen zusätzlich direkt im Gespräch, sodass Claude sie ansehen kann. Bilder und SVGs lassen sich mit `format` (png, jpg, webp), `width` und `background` umwandeln.
- `download_assets_zip` packt eine Auswahl, eine Bibliothek oder eine Sammlung in ein ZIP (bis 150 MB). Dateien, die nicht zum Download freigegeben sind, werden übersprungen.
- Für Links, die der Server erzeugt (ZIP, Export, ASE), braucht die Verbindung Bearbeitungsrechte. Mit „Nur lesen“ kommen kleine Ergebnisse direkt in der Antwort.

### Bausteine im Handbuch

Alle 22 Bausteine der Web-App sind verfügbar (Text, Überschrift, Hinweis, Zitat, Farben, Typografie, Logos, Do & Don't, Karten, Bild, Galerie, Video, Audio, Einbettung, Downloads, Token-Export, Tabelle, Checkliste, Akkordeon, Code, Trenner, Team-Notiz). `get_block_schema` zeigt Felder und Beispiele.

- Fließtext darf als **Markdown** angegeben werden (`{"markdown": "…"}`), der Server macht daraus bereinigtes HTML.
- Bilder werden mit `{"assetId": "<ID>"}` auf Dateien der Bibliothek verwiesen. Pfade, Maße und Typ ergänzt der Server.
- Ungültige Eingaben werden mit einer verständlichen Meldung abgelehnt, nichts wird halb gespeichert.
- `replace_page_blocks` sichert den alten Seitenstand automatisch als Version.

---

## 4. Sicherheit

- **Anmeldung:** Brandbench verwendet Supabase als OAuth-2.1-Server (mit PKCE). Claude bekommt nie dein Passwort. Zugriffstoken sind eine Stunde gültig und werden automatisch erneuert.
- **Deine Rechte, nicht mehr:** Jede Anfrage läuft mit deinem Token direkt gegen die Datenbank. Die Rechteprüfung (Row Level Security) ist dieselbe wie in der Web-App. Es gibt keinen Admin-Schlüssel im Konnektor.
- **Deine Auswahl gilt in der Datenbank:** Die Auswahl hängt an den zentralen Rechte-Funktionen. Ein Token einer verbundenen App kann Workspaces und Marken außerhalb der Auswahl weder lesen noch ändern, auch nicht bei direktem Zugriff auf die Datenbank oder den Datei-Speicher, und ebenso keine E-Mail-Adressen anderer Personen aus nicht freigegebenen Workspaces.
- **Nicht änderbar durch die App:** Eine App kann ihre eigene Auswahl nicht erweitern, kein Konto löschen, keinen Workspace verlassen und keine Einladungen einlösen.
- **Ohne Auswahl nichts:** Verbindungen ohne gespeicherte Auswahl (oder nach dem Trennen) sehen keine Daten.
- **Nur lesen:** Sperrt auch in der Datenbank alle Schreibzugriffe, inklusive Kommentare.
- **Bestätigung beim Löschen:** Workspaces, Marken, Handbücher und Bibliotheken löscht Claude nur, wenn der exakte Name als Bestätigung mitgegeben wird. Mit Seiten- und Dateiversionen lassen sich Fehler rückgängig machen.
- **Öffentliche Freigabe:** `set_brand_sharing` verlangt ausdrücklich `confirm_public`.
- **Datei-Abruf per URL:** nur https, nie zu internen Adressen (Schutz vor SSRF, auch nach Weiterleitungen), mit Größen- und Zeitlimit.
- **Rich Text:** Markdown und HTML werden bereinigt (kein Skript, keine gefährlichen Links).
- **Bekannt vs. unbekannt:** Auf der Zustimmungsseite zeigt Brandbench, ob die App bekannt ist (Claude) oder warnt vor unbekannten Apps. Registriert sich dennoch eine fremde App, siehst du sie unter **Konto → Verbundene Apps** und kannst sie trennen.

> **Hinweis zur dynamischen Registrierung:** Sie erlaubt jeder MCP-App, sich bei deinem Supabase-Projekt anzumelden, aber nur du kannst ihr Zugriff geben. Wenn du keine App verbinden willst, schalte sie in Supabase wieder aus.

---

## 5. Fehlerbehebung

| Problem                                                    | Lösung                                                                                                                                                                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude meldet „Verbindung fehlgeschlagen“                  | `https://DEINE-APP/mcp/health` im Browser öffnen. Zeigt es `ok: false`, steht dort, was in den Umgebungsvariablen fehlt. Production-Adresse verwenden (keine Vorschau-Adresse).                |
| Nach „Verbinden“ erscheint eine Supabase-Fehlerseite       | In Supabase unter Authentication → OAuth Server prüfen: aktiviert, Authorization Path `/oauth/consent`, dynamische Registrierung an. Site URL = Web-App-Adresse.                              |
| Zustimmungsseite zeigt „Anfrage nicht möglich“             | Die Anfrage ist abgelaufen oder wurde schon benutzt. In Claude erneut auf „Verbinden“ klicken.                                                                                                |
| Claude sieht keine Marken / „noch keine Freigabe“          | In Brandbench unter Konto → Verbundene Apps → „Auswahl ändern“ Workspaces/Marken wählen.                                                                                                      |
| „Nur Leserechte“ / „nur lesen“ beim Ändern                  | Die Verbindung ist auf „nur lesen“ gestellt, oder du hast in der Marke nur die Rolle „Ansehen“.                                                                                                |
| Upload bricht ab                                           | Dateien bis 50 MB. Über `content_base64` nur bis ca. 3 MB (Grenze von Vercel). Größeres: `url` oder `create_upload_url`.                                                                       |
| Vorschaubilder fehlen                                      | Die Bildbibliothek `sharp` ließ sich auf dem Server nicht laden. Hochladen funktioniert trotzdem; Vorschau und Umwandeln entfallen.                                                           |
| „Rate limit“ bei Supabase                                  | Anmelden und Tokens sind im kostenlosen Tarif begrenzt. Kurz warten.                                                                                                                           |

---

## 6. Für Entwickler:innen

```bash
npm run mcp:dev        # lokaler MCP-Server auf http://127.0.0.1:8787/mcp (liest SUPABASE_URL, SUPABASE_ANON_KEY)
npm run build:mcp      # erzeugt api/mcp.js neu (muss nach Änderungen an mcp/ oder src/lib committet werden)
npm run test:mcp       # Integrationstests: OAuth, alle Werkzeuge, Rechte (braucht `npx supabase start`)
npm test               # Unit-Tests (enthält mcp/src/server.test.ts)
npm run test:e2e       # Browser-Test der Zustimmungsseite (tests/e2e/mcp-consent.spec.ts)
```

Aufbau:

```
mcp/src/
  http.ts            Routing, OAuth-Metadaten, CORS, Anmeldung
  auth.ts            Token prüfen (JWKS), Client mit dem Token der Person
  context.ts         Freigabe (mcp_scope), Auflösen von Marken/Workspaces, Rollenprüfung
  tools/*.ts         die Werkzeuge nach Bereichen
  blocks.ts          Schemas und Aufbereitung der 22 Bausteine
  files.ts, images.ts, safe-fetch.ts   Upload, Vorschau, Umwandeln, sicherer Abruf
supabase/migrations/…_mcp_connector.sql   Auswahl (mcp_grants) und Erzwingung in der Datenbank
src/features/connections/                 Zustimmungsseite und „Verbundene Apps“
api/mcp.js           gebündelter Server (generiert) – die Vercel-Funktion
```

`api/mcp.js` wird bewusst als fertiges Bündel eingecheckt: Vercel braucht dann keinen eigenen Build-Schritt für die Funktion. Die CI prüft, dass das Bündel zum Quellcode passt.

**Eigener Server statt Vercel:** `node --import tsx mcp/src/dev-server.ts` (oder das Bündel `api/mcp.js` mit `http.createServer`) auf einem beliebigen Node-22-Host, per HTTPS erreichbar machen und die Adresse in Claude eintragen. `MCP_PUBLIC_URL` auf die öffentliche Adresse setzen.

**Umgebungsvariablen des Servers:**

| Name                              | Pflicht | Bedeutung                                                              |
| --------------------------------- | ------- | ---------------------------------------------------------------------- |
| `SUPABASE_URL` / `VITE_…` / `NEXT_PUBLIC_…`       | ja      | Projekt-URL (die Namen der Web-App funktionieren)                      |
| `SUPABASE_ANON_KEY` / `VITE_…` / `NEXT_PUBLIC_…`  | ja      | anon/publishable Key (nie den service_role Key)                        |
| `APP_URL`                         | nein    | Adresse der Web-App für Links in Antworten (Standard: Adresse des Servers) |
| `MCP_PUBLIC_URL`                  | nein    | Öffentliche Adresse des Servers, falls Proxy-Header fehlen             |
