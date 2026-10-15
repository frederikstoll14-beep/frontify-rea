# Frontify → Markenkompass: Funktionsabgleich

Grundlage ist die Analyse in [REVERSE-ENGINEERING-FRONTIFY.md](REVERSE-ENGINEERING-FRONTIFY.md). Sie wurde aus öffentlichen Quellen erstellt: Help-Center, SDK-Typen, Produktseiten. Markenkompass übernimmt die **Bedienlogik** von Frontify, also Portal, Guidelines mit Bausteinen, Essentials und Libraries. Gestaltung, Code und Namen sind eigenständig. Für die Lehre ergänzt der Nachbau einiges, was Frontify nicht oder nur im Enterprise-Tarif bietet.

Legende: ✅ umgesetzt · 🟡 vereinfacht · ➕ geht über Frontify hinaus · ⏳ nicht umgesetzt

## Informationsarchitektur

| Frontify | Markenkompass | Status |
| --- | --- | --- |
| Account / Instanz | Workspace (z. B. Kurs) | ✅ |
| Brand (mehrere pro Account) | Marke (beliebig viele pro Workspace) | ✅ |
| Brand Portal / Cover Page / Cards Grid | Startseite mit Hero, Claim, Farbleiste, Handbüchern, Bibliotheken, Schnellzugriff | ✅ |
| Guidelines (mehrere pro Brand) | Markenhandbücher (mehrere pro Marke, einzeln als Entwurf verbergbar) | ✅ |
| Document → Category → Page | Handbuch → Kapitel → Seite | 🟡 (Document und Category zusammengefasst) |
| Sections mit Spalten | Bausteinbreiten 1/1, 2/3, 1/2, 1/3, 1/4 im 12er-Raster | 🟡 |
| Heading erzeugt Sidebar-Anker | Überschrift-Baustein → „Auf dieser Seite“ mit Ankern | ✅ |
| Seiten-Entwurf (Augen-Icon) | Seite/Kapitel/Handbuch als Entwurf | ✅ |
| Navigation Manager | Kapitel/Seiten anlegen, umbenennen, sortieren, verschieben | ✅ |
| Libraries als Seiten in Guidelines | Bibliotheken in der Hauptnavigation, Assets in Bausteinen einbindbar | 🟡 |

## Guideline-Bausteine

| Frontify-Block | Markenkompass-Baustein | Status |
| --- | --- | --- |
| Text, Heading | Text (Rich Text, 1–2 Spalten), Überschrift (mit Dachzeile) | ✅ |
| Callout | Hinweis (Info, Tipp, Achtung, Verbot) | ✅ |
| Quote | Zitat (Claim/Leitsatz) | ✅ |
| Divider / Spacer | Trenner | ✅ |
| Color(s) mit Essentials-Sync | Farben (Karten, Liste, Streifen; Werte-Auswahl; WCAG-Kontrast; Abstufungen) | ✅ ➕ |
| Color Kit (ASE, LESS, SCSS …) | Farb- & Token-Export (CSS, SCSS, JSON/W3C, Tailwind, ASE) | ✅ |
| Font / Typography, Font Kit | Typografie (Schriften + Textstile, Download eigener Schriftdateien) | ✅ |
| Do & Don't | Do & Don't (mit Bild, Durchstreichung) | ✅ |
| Thumbnail Grid / Cards Grid | Karten (Werte, Personas, Links) | ✅ |
| Image | Bild (Hintergrund, Format, Download) | ✅ |
| Asset Kit | Dateien & Downloads (ZIP) | ✅ |
| Logo (Library) | Logos (Varianten auf Hintergründen, Download mit Formatumwandlung) | ✅ |
| Video, Audio | Video (YouTube/Vimeo/Upload), Audio (Sound-Logo, Hymne) | ✅ |
| Figma, Embed, Storybook | Einbettung (Figma, Canva, Miro, Google, Spotify, SoundCloud …) | ✅ |
| Code Snippet | Code | ✅ |
| Tabs | Akkordeon | 🟡 |
| Checklist | Checkliste (Häkchen je Person im Browser) | 🟡 |
| Personal Note | Team-Notiz (nur im Bearbeitungsmodus) | ✅ |
| Tables | Tabelle | ✅ |
| Annotations | Pin-Kommentare auf Bildern in der Bibliothek | 🟡 |
| Galerie (Media) | Galerie (Bildwelt/Moodboard) | ✅ |
| Template-Block, CodeSandbox, Glyphs, Gradient | – | ⏳ |

## Essentials / Markenbasis

| Frontify | Markenkompass | Status |
| --- | --- | --- |
| Paletten mit Name/Beschreibung | ✅ | ✅ |
| HEX, RGB, CMYK, Pantone, RAL, NCS, HKS | alle, plus HSL und automatische CMYK-Näherung | ✅ |
| `nameCss` | Token-Name je Farbe/Textstil | ✅ |
| Verwendung/Anteil | Feld „Verwendung“ (z. B. „60 %“) | ✅ |
| Fonts: Google, Upload, System | Web-Fonts (DSGVO-freundlich über Bunny Fonts), Upload (WOFF2/TTF/OTF), System | ✅ |
| Type Styles im Theme | Textstile (Größe, Zeilenhöhe, Laufweite, Schnitt, Versalien) | ✅ |
| Theme / Branding des Portals | Primär-/Akzentfarbe, Heading-/Body-Schrift, Logo, Titelbild | ✅ |

## Asset Management

| Frontify | Markenkompass | Status |
| --- | --- | --- |
| Media/Logo/Icon/Document/Template Library | Bibliotheken: Bilder & Medien, Logos, Icons, Dokumente, Vorlagen, Audio & Video | ✅ |
| Upload, Vorschau | Mehrfach-Upload per Drag & Drop, automatische Vorschaubilder (Bild, SVG, Video) | ✅ |
| Tags, Collections | Tags, Sammlungen, Filter nach Typ/Tag/Sammlung, Suche | ✅ |
| Custom Metadata | Copyright, Lizenz/Nutzungsrechte, Ablaufdatum, Beschreibung | 🟡 |
| Versionen (`revisionId`) | Neue Version hochladen, Versionsliste, Wiederherstellen | ✅ ➕ |
| Download-Konvertierung | PNG/JPG/WebP in 512/1024/2048 px, auch aus SVG | ✅ |
| Download-Schutz pro Asset | „Download für Leser:innen erlauben“, Downloads für Gäste schaltbar | ✅ |
| Asset-Detail mit Kommentaren | Detail-Panel mit Hintergrundwahl, Metadaten, Versionen, Pin-Kommentaren | ✅ |
| Bulk-Aktionen | ZIP-Download, Tag vergeben, in Sammlung/Bibliothek verschieben, löschen | ✅ |
| Download-Requests mit Freigabe | – | ⏳ |
| AI-Tagging, Custom-Metadata-Felder | – | ⏳ |

## Nutzer, Rechte, Teilen

| Frontify | Markenkompass | Status |
| --- | --- | --- |
| Rollen Owner/Editor/Viewer | Workspace: Owner/Admin/Mitglied · Marke: Admin/Bearbeiten/Ansehen | ✅ |
| Einladung per E-Mail | E-Mail-Einladung (wird bei Registrierung automatisch eingelöst) | ✅ |
| – | Einladungslink für ganze Gruppen (Rolle, Ablauf, Nutzungen) | ➕ |
| Public Link | Öffentlicher Freigabelink mit Ablaufdatum und Download-Schalter | ✅ ➕ |
| Targets / Gruppen | Sichtbarkeit pro Marke: „Workspace“ oder „Privat“ | 🟡 |
| SSO, Request Access | – | ⏳ |

## Zusammenarbeit

| Frontify | Markenkompass | Status |
| --- | --- | --- |
| Kommentare (Seite/Block), Threads, Resolve | Seiten- und Asset-Kommentare, Antworten, „Erledigt“, Sammelansicht „Feedback“ | ✅ |
| Änderungsprotokoll (Enterprise, nur Hinzufügen) | Aktivitätsverlauf: Anlegen, Ändern, Löschen, neue Versionen, Mitglieder | ✅ ➕ |
| Keine Seitenversionen | Versionen pro Seite (z. B. „Abgabe 1“) inkl. Wiederherstellung | ➕ |
| Undo gelöschter Blöcke | „Rückgängig“ nach dem Löschen eines Bausteins | ✅ |
| Workspace-Projekte mit Kanban-Freigaben | – | ⏳ |

## Weitere Funktionen

| Frontify | Markenkompass | Status |
| --- | --- | --- |
| Guideline-Suche | Suche über Seiten, Inhalte, Dateien, Farben (Strg/⌘ + K) | ✅ |
| PDF-Export über Druckdialog | Druckansicht eines ganzen Handbuchs mit Deckblatt und Inhaltsverzeichnis | ✅ |
| Templates/Creator | – (Vorlagen als Dateien in der Bibliothek „Vorlagen“) | ⏳ |
| Mehrsprachigkeit | – | ⏳ |
| Analytics | – | ⏳ |
| – | Vorlagen für Verein, Unternehmen, Verband, Organisation mit Leitfragen | ➕ |
| – | JSON-Export/-Import ganzer Marken (Backup, Vorlagen weitergeben) | ➕ |
| – | Mobile-first-Oberfläche, Dark Mode | ➕ |
