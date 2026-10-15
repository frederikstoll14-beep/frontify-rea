# Frontify im Reverse Engineering: Bauplan für einen Klon zur Lehre („Brand Identity“, Master CPM / Sportkommunikation)

## 0. Methodik und Quellenlage

- **Zugriff:** Direkte Abrufe von `frontify.com`, `help.frontify.com`, `developer.frontify.com`, `intercom.help` und `web.archive.org` hat der Egress-Proxy dieser Umgebung blockiert (DNS-Fehler bzw. 403). Grundlage sind daher:
  - **Suchergebnis-Snippets** aus dem Frontify-Help-Center, dem Blog, den News und Fallstudien sowie aus G2/Capterra.
  - **Öffentliche GitHub-Repos von Frontify**, die abrufbar waren:
    - `Frontify/brand-sdk`: TypeScript-Typdefinitionen der App-Bridge. Sie zeigen das reale Domänenmodell (Document, Page, Section, Color, Asset, Project/Library, Targets …).
    - `Frontify/guideline-blocks`: Einstellungs-Schemas der Open-Source-Content-Blocks.
  - Ich habe nur Feldnamen und Struktur analysiert. Code wurde weder kopiert noch ausgeführt.
- **Kennzeichnung im Text:**
  - **[Q n]** = belegt durch Quelle n (Liste am Ende).
  - **[V]** = Vermutung oder eigene Ableitung, nicht verifiziert.
- **Aktualität:** Frontify stellt gerade um, unter anderem:
  - Legacy-Themes laufen aus, neue Themes heißen Classic, Muse, Paper.
  - Cover Pages werden bis 2027 abgelöst.
  - Ein neuer „Colors“-Block ersetzt den alten „Color“-Block.
  - Ich beschreibe den aktuellen Stand und nenne die Altnamen, weil sie in vielen Hilfeartikeln noch vorkommen.

---

## 1. Informationsarchitektur

### 1.1 Hierarchie (aus den SDK-Typen rekonstruiert)

```
Account / Instanz (eigene Domain, z. B. brand.firma.com)        [Q6][V: Domain-Muster]
 └─ Brand (im „Brandpanel“, mehrere Brands pro Account möglich)  [Q44][Q6]
     ├─ Essentials (markenweit: Farben/Paletten, Fonts)          [Q10]
     ├─ Guidelines  (früher: „Style Guide“ / „Portal“)           [Q39 Guideline.ts]
     │    ├─ Cover Page (optional; Templates: hub|explorer|story|cover|blank)  [Q39 CoverPage.ts]
     │    ├─ Document Group (Gruppierung in der Top-Navigation)  [Q39 DocumentGroup.ts]
     │    │    └─ Document  (Typ: Standard | Library | Link)     [Q39 Document.ts]
     │    │         ├─ Page Category (Kapitel)                   [Q39 DocumentCategory.ts]
     │    │         │    └─ Page (Seite) | Page-Link (externer Link)
     │    │         └─ Page (unkategorisiert)
     │    │              └─ Section (Abschnitt, Spaltenlayout)   [Q39 DocumentSection.ts][Q3]
     │    │                   └─ Block (Content Block, Settings-JSON + Assets)
     │    │                        └─ Heading-Block → erzeugt Unterpunkt in der Sidebar [Q4]
     └─ Libraries („Projects“ in der API, Feld project_type)     [Q39 Project.ts, Document.ts]
          MEDIALIBRARY | LOGOLIBRARY | ICONLIBRARY | DOCUMENTLIBRARY |
          TEMPLATELIBRARY | TEXTLIBRARY | BRANDUPDATELIBRARY
     └─ Workspace Projects (Creative Collaboration, Kanban-Workflow) [Q32]
```

**Wichtige Befunde:**

- **Document** ist die Einheit in der Top-Navigation einer Guideline [Q39]. Es gibt drei Varianten:
  - `DocumentStandard`: normales Dokument mit Kapiteln und Seiten.
  - `DocumentLibrary`: die „Library Page“, also die Frontend-Ansicht einer Backend-Library innerhalb der Guideline. Sie hat `mode` = Library-Typ und `settings.project` = Library-ID.
  - `DocumentLink`: externer Link mit `linkSettings`. Dazu gehören `newTab`, `display` (ICON_TEXT | ICON | TEXT), `iconPosition` sowie optional `iconUrl`/`fileId`.
- **Felder eines Documents** [Q39]: `title`, `slug`, `heading`, `subheading`, `description`, `logo`/`logoFileId`, `backgroundFileId`, `appearance`, `visibility`, `targets`, `sort`, `validFrom`/`validTo` (Soft-Delete/Gültigkeit), `viewCount`, `permanentLink`, `token`.
- **Libraries und Guidelines:** Eine Backend-Library kann mehrere Library Pages in verschiedenen Guidelines derselben Brand speisen [Q7]. Facetten und Filter werden pro Library Page konfiguriert, nicht pro Library [Q7]. Libraries erscheinen nur in der Top-Navigation über den Navigation Manager [Q7].
- **Page** [Q39 DocumentPage.ts]: `title`, `slug`, `sort`, `categoryId` (nullable), `parentId`, `visibility` (`EVERYONE` | `EDITOR`, also Entwurf), `targets`, `translations`, `viewCount`, `permanentLink`, `linkType`/`linkUrl` (eine Seite kann auch nur ein Link sein).
- **Section** [Q39]: `title`, `slug`, `sort`, `pageId`, `permanentLink`. Seit dem Feature „Guidelines Sections“ hat eine Section Spalten. Spaltenanzahl, Verhältnisse und Stil stellt man über „Quick Edit“ ein [Q3]. Hintergrund-Stile pro Section sind als „coming soon“ angekündigt [Q3].
- **Permalinks** gibt es für Dokumente, Seiten und Sections [Q39 permanentLink] (auch im Help-Center erwähnt).
- **Essentials** (Brand → Essentials):
  - Markenweite Farben (Paletten mit Namen und Beschreibung) und Fonts, die in mehreren Guidelines wiederverwendet werden [Q9][Q10].
  - Farben aus Essentials synchronisieren sich automatisch in alle „Colors“-Blocks [Q9].
  - Farben aus Essentials gelten bisher nur in Guidelines, nicht in Templates oder Libraries [Q9].
  - Es gibt eine Essentials-API für Farben und Fonts als strukturierte Daten [Q10].
- **Benennung bei Frontify** [Q6]:
  - „Brand Book“ = Cover plus eine Guideline.
  - „Brand Hub“ = Einstieg für mehrere Brands.
  - „Brand Portal“ = Zugang zu Guidelines, Templates, Libraries und Workspace.
  - Bei Multi-Brand-Setups erhält jede Sub-Brand eine eigene Cover Page unterhalb der Corporate Brand [Q6].

### 1.2 Navigation

- **Portal-Ebene** (`PortalNavigationItem`) [Q39 Guideline.ts]: CoverPage | DocumentGroup (hat Children) | Document | DocumentLibrary | DocumentLink. Diese Ebene ist die Top-Navigation bzw. das Mega-Menü.
- **Dokument-Ebene** (`DocumentNavigationItem`): PageCategory (hat Children) | DocumentPage | DocumentPageLink | DocumentPageHeading. Diese Ebene ist die Sidebar eines Dokuments.
- **Navigation Manager** [Q4]:
  - Pages und Kategorien per Drag & Drop sortieren.
  - Links auf andere Guidelines oder externe Systeme hinzufügen. Für interne Links empfiehlt Frontify relative Pfade.
  - Ein Heading-Block auf einer Seite erzeugt automatisch einen Unterpunkt in der Sidebar.
- **Seitensichtbarkeit:** Ein Augen-Icon pro Seite im Edit-Modus schaltet die Seite auf „Entwurf“. Dann sehen sie nur Editoren und Owner [Q31].
- **Theme-Layouts** [Q8]:
  - **Classic:** Header und Sidebar.
  - **Muse:** nur Sidebar.
  - **Paper:** volle Breite, Top-Navigation, Primary/Secondary/Mega-Menü.
  - **Custom:** per Code.
  - Das ThemeTemplate-Enum im SDK unterscheidet `documentPage | cover | library` [Q39]. Für jeden Seitentyp gibt es also ein eigenes Theme-Template.

### 1.3 URL-Muster

Hier gibt es keine Primärquelle.

- **[V] aus eigener Kenntnis öffentlicher Portale:**
  - Instanz: `https://<kunde>.frontify.com` oder Custom Domain (`brand.firma.com`).
  - Dokument: `/document/<id>#/<kategorie-slug>/<seiten-slug>`, Sections per Anker.
  - Kurz-Permalinks im Format `/d/<token>/<slug>`.
  - Library-Assets: `/document/<id>#/-/<…>` bzw. eine Asset-Detail-Route.
- **Belegt:** Es existieren Slugs für Document, Category, Page und Section sowie `permanentLink` und `token` [Q39].
- **Empfehlung für den Klon** (sprechend, ohne Hash-Routing):
  - `/{workspace}/{brand}`: Brand-Startseite bzw. Portal
  - `/{workspace}/{brand}/g/{guideline}/{kapitel}/{seite}#{section-slug}`
  - `/{workspace}/{brand}/library/{library-slug}?q=&tags=&type=`
  - `/{workspace}/{brand}/asset/{asset-id}`
  - Öffentlich: `/p/{share-token}` (read-only)

### 1.4 Startseite des Portals (Cover Page / Brand Home)

- **Cover-Page-Datensatz** [Q39 CoverPage.ts]: `template` (`hub` | `explorer` | `story` | `cover` | `blank`), `title`, `url`, `draft`, `enabled`, `active`, `hideInNav`. Die Cover Page gehört zu genau einem Document.
- **Ablauf:**
  - Nach der Aktivierung ist die Cover Page zunächst Entwurf und nur für Editoren sichtbar [Q5].
  - Die Sichtbarkeit lässt sich pro Section einstellen: alle Viewer oder bestimmte Targets [Q5].
- **Ablösung:** Cover Pages bekommen keine neuen Features mehr und fallen 2027 weg (mindestens 6 Monate Vorlauf). Ersatz sind Document Pages mit dem **Cards Grid Block** [Q5].
  - Einstellungen des Cards Grid: Karten- und Bildverhältnis, Bildverhalten (None/Fit/Fill), Ausrichtung, Verlinkung jeder Karte [Q5][Q15].
- **Typischer Aufbau** (laut [Q6] „Teaser-Kacheln“ für verschiedene Zielgruppen, Rest **[V]**):
  - Hero mit Logo, Markenname, Claim und Cover-Bild.
  - Kachel-Grid: „Logo“, „Farben“, „Typografie“, „Bildwelt“, „Downloads/Media Library“, „Templates“.
  - Quick-Downloads, etwa Logo-Paket und Fonts.
  - Optional: News/Brand Updates und Kontakt.
- Ein Header-Link „Brand Portal“ (`enabled`, `label`, `url`) führt aus jeder Guideline zurück zum Portal [Q39 BrandportalLink.ts].

---

## 2. Guidelines-Editor

### 2.1 Grundmechanik

- **Edit-Modus:** Aktivierung über das Stift-Icon in der linken „Power Bar“ [Q7].
- **Blöcke einfügen** [Q1][Q18]:
  - Der **„+“-Button** zwischen Blöcken öffnet den **Block-Adder**.
  - Der Adder hat **Suchfeld und Kategorien**: Text/Layout, Media, „UI & Code“, Typografie/Sharing u. a.
- **Text-Block** [Q18]: Markdown-Shortcuts (`# ` → H1) und Spaltenwahl.
- **Block-Einstellungen:** Sidebar-Panel rechts. Aus den SDK-Schemas ergibt sich eine einheitliche Tab-Struktur [Q40]:
  - **main:** großes Dropdown oben, wählt die Block-Variante (z. B. Callout-Typ, Divider Linie/Spacer, Code-Sprache).
  - **basics:** Inhalt und Assets.
  - **layout:** Spalten, Gutter, Höhe, Ausrichtung, Padding.
  - **style:** Hintergrund, Rahmen, Radius, Farben.
  - **security:** „Global“ oder „Custom“, mit Asset-Viewer an/aus und Downloadable an/aus. Im SDK `PrivacySettings {assetViewerEnabled, assetDownloadEnabled}` [Q39].
- **Wiederkehrendes UI-Muster** [Q40]: Ein Schalter **„Custom“** wechselt zwischen Preset-Segmenten (**S/M/L** bzw. Auto/None) und einem **freien Pixel- oder Prozent-Input**. Das ist ein gutes Muster für den Klon.
- **Sections** [Q3]: Quick Edit für Spaltenanzahl, Verhältnisse und Stil. Blöcke werden in Spalten platziert.
- **Tabs-Block** [Q15]: Jeder Tab ist eine eigene Section und kann beliebige Blöcke enthalten.
- **Marketplace** [Q2]: Account-Admins installieren zusätzliche Blöcke. Danach stehen sie allen Editoren zur Verfügung. Frontify spricht von „40+“ vorgefertigten Blöcken (Snippet auf der Guidelines-Produktseite).
- **Wiederherstellen** [Q30]:
  - Undo per Ctrl/Cmd+Z oder Undo-Toast.
  - „Restore content“ in der Action-Toolbar (unten mittig) stellt gelöschte Blöcke, Sections und Tabs bis 90 Tage zurück.
  - Eine echte Versionierung von Seiten gibt es nicht.

### 2.2 Katalog der Content-Block-Typen

Bei Blöcken aus dem Open-Source-Repo [Q40] sind die Felder belegt, bei den übrigen stammen sie aus dem Help-Center. **[V]** markiert ergänzende Feldvorschläge für den Klon.

| Block | Zweck | Felder / Einstellungen |
|---|---|---|
| **Text** | Fließtext, Überschriften (H1–H4), Listen, Links | Spalten 1–4, Spalten-Gutter (Auto/S/M/L/custom px) [Q40]. Markdown-Shortcuts [Q18]. Textstile kommen aus dem Theme. |
| **Heading** | Überschrift, die einen Sidebar-Unterpunkt erzeugt | Titel, Slug/Anker → `DocumentPageHeading` in der Navigation [Q4][Q39] |
| **Image** | Einzelbild mit Bildunterschrift | Bild-Asset (Upload oder aus Library). Optionaler Link. Verhältnis None/1:1/4:3/3:2/16:9 oder custom. Autosizing None/Fit/Fill. Ausrichtung horizontal/vertikal, Fokuspunkt. Padding None/S/M/L/custom. Textposition Below/Above/Right/Left mit Verhältnis 2:1/1:1/1:2. Hintergrund, Rahmen, Eckenradius. Security: Asset-Viewer, Download [Q40]. |
| **Do & Don't** | Richtige und falsche Anwendung | Modus Text oder Text+Bild. Indikator-Stil Icons/Unterstreichung/Text. Do-Icon (Haken/Haken im Kreis), Don't-Icon (Kreuz/Kreuz im Kreis). Durchstreichung über Don't-Bild. Spalten 1–4, „immer nebeneinander“ bei 2 Spalten. Spalten- und Zeilen-Gutter. Bildhöhe Auto/S/M/L/custom, Fill/Fit. Eigene Do- und Don't-Farbe, Bildhintergrund, Rahmen, Radius [Q40][Q14]. Inhalt pro Item: Typ (do/dont), Titel, Text, Bild [V]. |
| **Callout** | Hinweis-Box | Typ Info/Note/Tip/Warning. Darstellung Light/Strong. Icon None/Info/Glühbirne/Megafon oder eigenes SVG. Breite Full/Hug mit Ausrichtung. Padding S/M/L oder custom (4 Seiten). Radius. Farbe kommt aus den globalen Theme-Settings [Q40]. |
| **Quote** | Zitat | Die Settings-Datei war nicht abrufbar (404). [V]: Zitattext, Autor/Quelle, Anführungszeichen-Stil (z. B. „“ « » oder keine), Größe/Ausrichtung, optional Linie links, Farbe. |
| **Divider / Spacer** | Trenner oder Abstand | Typ Linie/Spacer. Breite 10/25/50/100 % oder custom, Ausrichtung. Höhe S/M/L oder custom. Linienstil solid/dotted/dashed, Stärke, Farbe [Q40]. |
| **Color(s)** | Farbpaletten anzeigen | Neuer Block: Paletten aus Essentials plus eigene Farben im selben Block. Darstellung **Cards / Drops / List**. Layout/Abstand, Textausrichtung, angezeigte Farbwerte, Rahmen, Radius [Q9]. Farbräume pro Block zuschaltbar, HEX/RGB standardmäßig an, CMYK automatisch umgerechnet und überschreibbar [Q11]. Details zum Farbmodell in 2.3. |
| **Color Kit** | Paletten als Download | Paletten auswählen, Download-Button. ZIP mit `colors.ase`, `colors.less`, `colors.oco`, `colors.scss` [Q12] |
| **Gradient** | Farbverlauf | Option „CSS anzeigen“. Höhe S/M/L oder custom. Ausrichtung horizontal/vertikal oder Winkel [Q40]. Im Farbmodell: `gradient_type/direction/color_one/two` [Q39]. |
| **Font / Typography** | Schrift und Schriftschnitte präsentieren | Quellen: Google Fonts, Adobe Fonts, System, Monotype, self-hosted Upload [Q13]. Zeigt Schnitte und Gewichte, Liste anpassbar ([Q16] Blog). [V]: Beispieltext, Schriftgröße der Vorschau, Glyphen an/aus. |
| **Font Kit** | Font-Download | Nur bei self-hosted Fonts. ZIP mit TTF und Webfont [Q13] |
| **Glyphs** | Zeichensatz-Übersicht | Im Repo vorhanden [Q40]. Felder nicht abgerufen. [V]: Font, Zeichenbereich, Rastergröße. |
| **Asset Kit** | Asset-Paket zum Download, z. B. Logo-Paket | Thumbnails an/aus, Asset-Anzahl an/aus. Hintergrund, Rahmen, Radius für Block und Thumbnails. Farbe des Zählers [Q40]. Inhalt: Titel, Beschreibung, Liste von Assets, „Alle herunterladen“ [V]. |
| **Thumbnail Grid** | Raster aus Bild und Text, z. B. Logo-Varianten | Spalten 1–5, Gutter. Bildposition Below/Above/Right/Left. Bildbreite 25/33/50/75 % oder custom, Ausrichtung. Hintergrund, Rahmen, Radius. Security: Asset-Viewer [Q40] |
| **Cards Grid** | Kachelraster (Ersatz für die Cover Page) | Bild und Text je Karte, Link pro Karte. Karten- und Bildverhältnis, Ausrichtung, Bild-Fit None/Fit/Fill [Q15][Q5] |
| **Tabs** | Inhalte in Reitern | Jeder Tab ist eine Section mit beliebigen Blöcken [Q15] |
| **Accordion** | Auf- und zuklappbare Inhalte | **Nicht in Frontify-Quellen belegt.** Für den Klon trotzdem sinnvoll [V]: Items (Titel, Inhalt als Blöcke), „initial geöffnet“. |
| **Video** | Video aus Library oder Upload | In der Kategorie Media belegt [Q18]. [V]: Asset, Autoplay/Loop/Mute, Poster, Verhältnis, Download-Security. |
| **Audio** | Audiodatei, z. B. Sound-Logo | Audio-Asset, Textposition Above/Below, Security Download [Q40] |
| **Embed** | Drittanbieter per URL (iFrame) | URL, Höhe [Q1][V] |
| **Figma** | Figma-Frame | Vorschau als Bild oder live. Höhe S/M/L (400/600/800 px) oder custom. Vollbild, Zoom, Figma-Link anzeigen. Hintergrund, Rahmen, Radius [Q40][Q18] |
| **Storybook** | Komponenten einbetten | Storybook-URL [Q18] |
| **Code Snippet** | Code dokumentieren | Sprache (Default HTML, viele Sprachen). Überschrift an/aus, Zeilennummern an/aus. Farbschema, Rahmen, Radius [Q40][Q18] |
| **UI Pattern / CodeSandbox** | Live-Code-Beispiel | Template Vanilla/Static/React/Angular/Svelte/Vue. Präprozessor. Responsive-Vorschau, Reset, Sandbox-Link. Code anzeigen/editierbar/eingeklappt. Abhängigkeiten. Theme [Q40][Q18] |
| **Attributes / Developer Kit** | Design-Attribute bzw. Ein-Klick-Download von Patterns, Fonts, Icons, Farben | Laut Help-Kategorie „UI & Code“ [Q1]. Felder unbekannt. |
| **Icon Library (Block)** | Icon-Library mit Collections einbinden | [Q1] |
| **Template** | Druck- oder Digital-Template aus der Template Library | Template-Auswahl, Seitenzahl anzeigen. Vorschau Template/Custom/None. Bearbeitung Simple/Advanced. Textposition und -verhältnis, Vorschauhöhe, Fit/Fill. Button-Stil Primary/Secondary/Tertiary. Karten-Styling [Q40][Q36] |
| **Personal Note** | Interne Notiz, nur für Editoren oder für alle sichtbar | Augen-Icon für die Sichtbarkeit [Q16] |
| **Checklist** | Aufgabenliste mit Zuweisung an Teammitglieder | Items, Zuständige, Sichtbarkeit alle/Editoren, E-Mail-Benachrichtigung ([Q16] Blog) |
| **Annotations** | Bild mit nummerierten Hotspots und Erklärungen | Bild, Punkte (Position, Text), Punktfarbe, Rahmen, Download an/aus [Q17] |
| **Asset Submission** | Upload-Formular in der Guideline, auch für Personen ohne Account | Ziel-Library. Eingänge landen im Ordner „Asset Submission Inbox“, Unterordner nach Datum [Q19] |
| **Tables** | Tabellen | Im Help-Center gelistet [Q1-Suche]. Felder unbekannt. |
| **Typeform, Sketchfab, Animation Curve** | Spezialblöcke | Typeform: per SDK gebaut [Q46]. Sketchfab und Animation Curve liegen im Repo [Q40]. |

### 2.3 Farbmodell (aus den SDK-Typen, belegt [Q39])

- **Palette:** `name`, `description`, `colors[]`. Gehört zu einer Guideline bzw. zu Essentials.
- **Color**, Kern:
  - `name`, `nameCss` (Token-Name), `sort`
  - `hex`, `red/green/blue/alpha`, abgeleitet `hue/saturation/lightness`
- **Druck und Industrie:**
  - `c/m/y/k`, `cmykCoated`, `cmykUncoated`, `cmykNewspaper`
  - `pantone`, `pantoneCoated`, `pantoneUncoated`, `pantoneCp`, `pantonePlastics`, `pantoneTextile`
  - `ral`, `ncs`, `hks`, `oracal` (Folien), `threeM` (3M-Folien), `lab`
- **Weitere Felder** (API-Variante): `usage` (Freitext „Verwendung“), `type`, `group`, `priority`, `opacity`/`css_value`, `reference_color` (Verweis auf eine Essentials-Farbe), `gradient_*`, `valid_from/valid_to`.
- **Verhalten:**
  - HEX und RGB sind immer da, weitere Farbräume schaltet man pro Block zu.
  - CMYK wird automatisch aus RGB umgerechnet und kann überschrieben werden.
  - Pantone, RAL, NCS usw. trägt man manuell ein [Q11].
- **Für den Klon:** Farbe immer als RGB(A) speichern und HEX/HSL ableiten. Alle Druckwerte als optionale Textfelder führen. Dazu „Verwendung/Anteil“ (z. B. 60 % Primär) und „Kontrast zu Weiß/Schwarz (WCAG)“ als berechnete Anzeige [V].

### 2.4 Typografie

- **Fonts** [Q13]:
  - Fünf Quellen: Google, Adobe, System, Monotype, self-hosted.
  - Empfohlen ist die zentrale Pflege in Essentials. Per Font-Block hinzugefügte Fonts gelten nur in dieser Guideline.
  - Alle Schnitte einer Familie müssen unter einer Familie gruppiert sein, sonst funktioniert Fett nicht.
  - Für Template-Rendering nur statische TTF/OTF.
- **Textstile:**
  - In den neuen Themes pflegt man „main fonts, type styles, buttons, accent colors“ direkt in der Theme- bzw. Color-Scheme-Sidebar [Q8].
  - Die genauen Felder sind nicht belegt. **[V] für den Klon:** Name (z. B. „H1 Headline“), Font-Familie, Schnitt/Gewicht, Größe (px/rem, optional pro Breakpoint), Zeilenhöhe, Laufweite, Text-Transform, Farbe (Token), Beispieltext, Verwendungshinweis.
- **Import:** Theme-Einstellungen (Layout, Typo, Buttons, Color Schemes) lassen sich aus einer anderen Guideline übernehmen [Q8].

### 2.5 Theme und Branding des Portals

Belegt [Q8][Q39]:

- Theme-Auswahl über das Pinsel-Icon in der Power Bar.
- Es gibt keinen Entwurfsmodus: Änderungen sind sofort live.
- Jedes Theme speichert seine eigenen Einstellungen.
- Color Schemes, Main Fonts, Type Styles, Buttons, Akzentfarben.
- Pro Document: Logo-Datei, Hintergrunddatei, Heading/Subheading, `appearance` (JSON).

**[V]** Für den Klon:

- Logo (hell/dunkel)
- Favicon
- Primär- und Akzentfarbe
- Hintergrund und Fläche
- Heading- und Body-Font
- Cover-Bild
- Radius
- Navigations-Layout (Sidebar oder Top)

---

## 3. Asset Management (Libraries/DAM)

| Thema | Befund |
|---|---|
| **Library-Typen** | Media, Logo, Icon, Document (Office-Dateien, Decks, Whitepaper), Template, Text, Brand Update [Q39][Q41] |
| **Upload-Regeln** | Media Library und Workspace nutzen eine Blocklist: fast alles erlaubt, außer ausführbaren Dateien und Dateien ohne Endung. Logo- und Icon-Library nutzen eine Allowlist, z. B. svg, png, ai, eps [Q24]. Icons müssen für die Umfärbung ein zusammenhängender Pfad sein, PNGs werden aus dem SVG generiert [Q47]. |
| **Asset-Felder (SDK)** | `title`, `fileName`, `extension`, `objectType`, `status`, `width/height`, `fileSize`, `previewUrl`, `genericUrl` (CDN mit Transformationsparametern), `originUrl`, `externalUrl` (Link-Asset), `revisionId`, `backgroundColor` (Vorschau-Hintergrund, wichtig für weiße Logos), `isDownloadProtected`, `creatorName` [Q39] |
| **Metadaten** | Custom Metadata mit 7 Typen: Text, Longtext, Number, Select, Multiselect, Date, URL. Je Feld Hilfetext und Default. Pflege durch Library-Owner und -Editoren [Q20]. Bulk-Pflege per CSV (Ablaufdatum, Copyright, Tags; bis 10.000 Zeilen) [Q20]. |
| **Tags** | Manuelle Tags und AI-Auto-Tagging (png/jpg/tif). AI-Treffer erscheinen in der Suche unter „Matches found by AI“ [Q21][Q41] |
| **Ordner & Collections** | Ordner = Ablagestruktur. Collections = kuratierte Bündel, privat oder öffentlich [Q21][Q41]. Ordner und Unterordner gibt es auch innerhalb von Collections (FAQ-Titel) [Q21]. |
| **Beziehungen & Anhänge** | Tab „Relations“ im Asset-Detail: bidirektionale „Related assets“ (Upload oder Auswahl) [Q23]. Anhänge an Dokumente, Icons und Logos, Bundles herunterladbar [Q41]. |
| **Versionierung** | Kein Help-Artikel gefunden. Im SDK gibt es `revisionId` [Q39]. [V]: „Datei ersetzen“ behält ID und URL und legt eine Revision an. Eine Versionsliste mit Wiederherstellung ist nicht belegt. |
| **Lebenszyklus** | Start- und Ablaufdatum pro Asset. Aktion bei Ablauf: Workflow-Status setzen, löschen oder nichts tun [Q20]. Zeitliche Einschränkungen in der Document Library [Q41]. |
| **Rechte & Lizenzen** | License Management für Bild-, Logo- und Dokument-Assets, Copyright-Status und -Hinweis [Q20] |
| **Download-Schutz** | Usage Settings pro Library: frei, „On request“ (Anfrageformular mit Verwendungszweck und eigenen Fragen; Admin genehmigt oder lehnt mit Begründung ab, Benachrichtigung per E-Mail; Auto-Approve möglich) [Q25]. Pro Block: Download und Asset-Viewer an/aus [Q40]. |
| **Konvertierung** | Beim Download: Format JPEG/PNG/WebP/AVIF/HEIF, Größen-Presets, Crop. Das Original bleibt unverändert. Vorerst nur für Media-Assets [Q22]. Admins definieren Download-Größen (Name, Breite, Methode Fit oder Crop um den Fokuspunkt). Maximum ist die Originalgröße [Q22]. Media Processing API: Parameter für Größe, Crop und Format an der Preview-URL [Q22]. |
| **Suche & Filter** | Library-Suche über Metadaten mit Relevanz-Ranking und Boolean AND/OR/NOT [Q21]. Filterleiste oben: Ersteller, Download-Schutz, Lizenzen, Datum, Tags, Workflow-Status, Custom Metadata mit Operatoren, Dateityp, Ausrichtung [Q21]. Library übergreifend: Fallback auf andere Libraries der Guideline. „Spotlight“ für Editoren über den ganzen Workspace. Natürlichsprachige Suche (Beta) [Q21]. |
| **Externe Einreichung** | Asset Submission Block [Q19] |
| **Analytics je Asset** | Views und Downloads nach Ort (Guideline, Seite, Library). Nur für Editoren und Admins [Q35]. |
| **Download-Links (API)** | Laut Drittquelle laufen sie standardmäßig nach 7 Tagen ab, Parameter „permanent“ möglich [Q45, Integrationsticket, nicht offiziell] |

---

## 4. Nutzer und Rechte

| Rolle | Ebene | Rechte |
|---|---|---|
| **Account Admin** | Account | Vollzugriff auf Konfiguration. Exklusiv: User Management, Targets, Groups, Marketplace-Installation, Download-Requests [Q26][Q2][Q25] |
| **Owner** | pro Guideline / Library / Projekt | Bearbeiten und Löschen des gesamten Bereichs, Mitglieder verwalten. Im DAM als Einziger Library- und Usage-Settings [Q26] |
| **Editor** | pro Bereich | Inhalte anlegen und bearbeiten. Lädt Editoren und Viewer ein [Q26] |
| **Viewer** | pro Bereich | Nur lesen, nach Einladung [Q26] |
| **Translator** | nur Guideline | Übersetzt vorhandene Texte und Bilder in Sprachvarianten. Keine neuen Blöcke, keine Änderung am Master [Q26][Q33] |
| **Reviewer** | Workspace (inzwischen auch Guideline-Kommentare) | Viewer-Rechte plus Kommentieren und Feedback [Q26][Q29] |
| „Guest“ | – | Keine eigene Rolle belegt. Externe kommen über Public Link oder Viewer-Einladung. |

**Belegte Grundsätze und Mechanismen:**

- Account-Rollen geben keinen automatischen Zugriff. Man wird pro Space (Guideline, Library, Projekt) eingeladen [Q26][Q27].
- **Zugangswege** [Q27]:
  - Einladung.
  - SSO (SAML/OIDC, Auto-Viewer-Rechte, Enterprise).
  - „Request Access“ über ein Formular auf der Login-Seite. Admins genehmigen, die Formularfelder sind anpassbar.
- **Groups:** Nutzergruppen mit Mitgliedern und zugeordneten Targets. „Smart Groups“ gibt es nur im Enterprise-Plan [Q27].
- **Targets** (Zielgruppen):
  - Benannte Audiences mit Nutzern, Gruppen und Public Links [Q27][Q39].
  - Steuern die Sichtbarkeit von Documents, Pages und Cover-Sections [Q39][Q5].
  - Beim Public Link: „Restrict access using Targets“ [Q28].
  - Im SDK haben Target-Objekte `name`, `description`, `user_ids`, `group_ids`, `asset_ids` [Q39].
- **Öffentlich vs. geschützt** [Q28]:
  - Eine Guideline kann per **Public Link** öffentlich sein, ohne Login und Authentifizierung.
  - Optional: AGB/Terms-Zustimmung als Schranke und Einschränkung auf Targets.
  - **Kein Passwortschutz für Guidelines, Libraries oder Projekte.** Passwörter gibt es nur für geteilte Assets, Collections und Ordner [Q28].
- **Download-Requests:** siehe Abschnitt 3 [Q25].
- **Sichtbarkeit einzelner Seiten:** Entwurf, nur für Editoren [Q31][Q39].

**Empfehlung für den Klon:** Rollen pro Brand als Vererbungsbasis, mit optionalen Overrides pro Guideline oder Library. Dazu Share-Links mit Token, optionalem Passwort, Ablaufdatum und Download-Schalter. Damit geht der Klon bewusst über Frontify hinaus und deckt den Lehrfall „Dozent oder externer Juror sieht ohne Account“ ab [V].

---

## 5. Kollaboration

- **Kommentare in Guidelines** [Q29]:
  - Auf Seite, Section oder Block.
  - @Mentions, Antworten in Threads, „Resolve“.
  - Badge mit Zähler direkt am Inhalt.
  - Zentrale Kommentar-Sidebar mit offenen und erledigten Threads.
  - Berechtigt sind Editor, Translator und Reviewer. Viewer und Externe sehen keine Kommentare.
- **Workspace-Projekte** (Creative Collaboration) [Q32]:
  - Assets mit Kommentaren, punktgenau („point to a specific part“) oder allgemein.
  - Freigabe anfragen („request approval/feedback“).
  - **Workflow:** Kanban mit Status-Spalten. Schritte umbenennen, Verantwortliche zuweisen, festlegen, welcher Schritt die Freigabe ist.
  - Gespeicherte Workflows gelten nur für neue Projekte.
  - Video-Kommentare auf Sequenzen. Gruppen-Mentions und Rich-Text in Kommentaren (News 2023).
- **Änderungsverlauf** [Q30]:
  - Keine Seitenversionierung.
  - Ein „Changelog“ (Enterprise) protokolliert nur hinzugefügte Inhalte, nicht Bearbeitungen und nicht den Bearbeiter.
  - Gelöschtes lässt sich 90 Tage wiederherstellen.
- **Benachrichtigungen:**
  - E-Mail-Einstellungen pro Projekt [Q32].
  - Benachrichtigungen bei Download-Requests [Q25].
  - Checklist-Zuweisungen per Mail [Q16].
  - Newsletter-Abos in den persönlichen Einstellungen [Q37].
  - Glocke in der Power Bar [Q32 Power Bar].
- **Brand Updates / Newsletter** (Enterprise) [Q37]: gebrandete Newsletter an Gruppen oder Listen, Serien, Öffnungsraten.

---

## 6. Weitere Features

| Feature | Befund |
|---|---|
| **Templates (Publisher/„Creator“)** | Import aus Figma, Sketch oder InDesign in die Template Library. Pro Element (Text, Font, Farbe, Bild) editierbar oder gesperrt per Schloss-Icon. Nutzer erstellen eine „Publication“ und exportieren als PDF/PNG/JPG, optional mit Freigabe vor dem Download. Einbindung per Template-Block oder in Projekten. Template-Farben stammen aus den Color-Blöcken der verbundenen Guideline [Q36][Q9] |
| **Design-Token-Export** | Kein expliziter Token-Export (DTCG/JSON) belegt. Belegt sind: Color Kit (ASE, LESS, SCSS, OCO) [Q12], `nameCss` pro Farbe [Q39], Essentials-API für Farben und Fonts [Q10], Code-Anzeige im Gradient-Block [Q40]. Für den Klon [V]: Export als CSS-Variablen, JSON (W3C DTCG) und Tailwind-Config. |
| **Analytics** | Guideline Analytics: Seitenaufrufe und Downloads pro Seite/Dokument, Zeitraum Tag/Woche/Monat. Asset Analytics. Dashboard (Enterprise) mit Guideline-Traffic, Asset- und Template-Nutzung. Segment-Export als Add-on [Q35]. `viewCount` an Document und Page [Q39]. |
| **Suche** | Guideline-Suche: Titel und Headings ranken vor Fließtext, keine Operatoren, Editoren sehen auch Entwürfe. Library-Suche mit Boolean. Spotlight für den ganzen Workspace. Natürlichsprachig in der Beta [Q21] |
| **Mehrsprachigkeit** | Enterprise. Basissprache plus beliebig viele Sprachen. Sprachvarianten zuerst als Draft, nach dem Publish sichtbar. Translator-Rolle. AI-Übersetzung in der Beta [Q33]. SDK: `Language {isoCode, name, isDefault, isDraft}`, Titel und Slugs pro Sprache [Q39]. |
| **PDF-Export/Druck** | Share-Menü → Tab „Print and PDF“: ganze Guideline oder aktuelles Dokument, über den Druckdialog des Browsers („Save as PDF“) [Q34] |
| **Integrationen** | GraphQL-API mit OAuth 2.0 für Accounts, Brands, Projekte/Libraries, Assets, Guidelines [Q38]. Plugins für Figma, Adobe, Office, Browser-Extension [Q22][Q18]. |
| **AGB-Gate** | Terms & Conditions vor dem Zugriff über einen Public Link [Q28] |

---

## 7. Priorisierung für das Studienprojekt (MoSCoW)

**Rahmen:** Studierende in Teams. Jedes Team legt die Brand Identity eines Unternehmens, Vereins oder Verbands an. Dozierende und Kommiliton:innen sehen zu, kommentieren und bewerten.

### MUST (MVP, ohne das ist die Lehre nicht machbar)

1. **Multi-Tenant-Grundgerüst:** Workspace (= Kurs/Semester) → Brand (= Team-Projekt). Mitgliedschaften mit Rollen Owner/Admin, Editor, Viewer.
   - *Begründung:* Mehrere Teams brauchen getrennte Marken und Dozenten-Zugriff auf alle.
2. **Auth und Einladungen** per E-Mail-Link, Rolle bei der Einladung.
   - *Begründung:* Mehrnutzerzugang ist Kernanforderung.
3. **Guideline-Struktur:** Guideline → Kapitel → Seite → Block, mit Sidebar-Navigation, Drag & Drop-Sortierung, Slugs und Ankern.
   - *Begründung:* Das ist die zentrale Informationsarchitektur einer Brand Identity.
4. **Edit- und View-Modus mit „+“-Block-Adder** und Block-Settings-Panel.
   - *Begründung:* Das ist der Kern der Bedienung.
5. **Kern-Blöcke:**
   - Text inklusive Headings (die Navigation erzeugen)
   - Bild
   - Farbpalette mit HEX/RGB/CMYK/Pantone/RAL/NCS/HKS, Name, Verwendung
   - Typografie: Font und Textstile
   - Logo/Asset-Grid (Thumbnail Grid) mit Download
   - Do & Don't
   - Callout
   - Divider/Spacer
   - Zitat
   - *Begründung:* Damit lassen sich die klassischen Kapitel einer Brand Identity abbilden: Markenkern, Logo, Farbe, Typo, Bildwelt, Tonalität, Anwendungen.
6. **Zentrale Farb- und Font-Pflege pro Brand** (Essentials-Prinzip), die Blöcke referenzieren.
   - *Begründung:* Single Source of Truth ist ein didaktischer Kernpunkt.
7. **Eine Media Library pro Brand:** Upload (mehrere Dateien), Ordner, Tags, Titel/Beschreibung, Vorschau, Suche nach Titel und Tag, Download des Originals.
   - *Begründung:* Logos, Bildwelt und Dokumente müssen ablegbar und teilbar sein.
8. **Portal-Startseite pro Brand** mit Cover-Bild, Logo, Claim und Kachel-Grid (Cards Grid) auf Kapitel und Library.
   - *Begründung:* Präsentationsfähigkeit, etwa für die Abschlusspräsentation.
9. **Portal-Branding:** Logo, Primär- und Akzentfarbe, Heading- und Body-Font aus den eigenen Brand-Daten.
   - *Begründung:* Das Portal soll die erstellte Identität selbst zeigen.
10. **Lesezugriff für Externe:** Viewer-Einladung oder öffentlicher Share-Link (Token) für die Guideline, schaltbar.
    - *Begründung:* Gäste wie Prüfer oder der fiktive Kunde sollen ohne Account schauen können.
11. **Seiten-Entwurf vs. veröffentlicht** (Sichtbarkeit EVERYONE/EDITOR).
    - *Begründung:* Teams arbeiten iterativ.

### SHOULD

1. **Kommentare** auf Seite, Block und Asset mit Threads, Resolve und @Mentions.
   - *Begründung:* Dozenten-Feedback direkt am Inhalt.
2. **Aktivitätsprotokoll und einfache Seiten-Snapshots** (Versionen wiederherstellen).
   - *Begründung:* Nachvollziehbarkeit, wer was beigetragen hat, ist für die Benotung relevant und geht bewusst über Frontify hinaus.
3. **Weitere Blöcke:** Tabs, Accordion, Video, Audio (Sound-Logo, Stadion-Jingle), Embed (YouTube/Vimeo/Figma), Download/Asset Kit, Color Kit (Export).
4. **Logo-Library-Logik:** Varianten-Metadaten (Farbversion, Format, Hintergrund hell/dunkel, Vorschau-Hintergrundfarbe).
5. **Custom Metadata** (Text, Select, Datum, URL) und **Collections**.
6. **Asset-Versionen:** Datei ersetzen mit Historie.
7. **Share-Links** mit Ablaufdatum, optionalem Passwort und Download-Schalter.
8. **Download-Konvertierung** von Bildern (PNG/JPG/WebP, Größen-Presets) über Storage-Transformationen.
9. **Token-Export** (CSS-Variablen, JSON) und **PDF-Export** über eine Print-Stylesheet-Ansicht.
10. **Globale Suche** über Seiten, Blöcke und Assets der eigenen Brands.
11. **Benachrichtigungen** in der App: Kommentare, Mentions, Einladungen.

*Begründung SHOULD:* Diese Funktionen machen den Klon im Lehralltag deutlich wertvoller, sind aber nicht nötig, um eine Brand Identity abzulegen.

### COULD

- Gruppen und Targets (zielgruppen-spezifische Sichtbarkeit).
- Download-Requests mit Freigabe.
- Ablaufdaten und Lizenzen für Assets.
- Analytics (Seitenaufrufe, Downloads).
- Mehrsprachigkeit (DE/EN) mit Translator-Rolle.
- Einfache Templates mit editierbaren Feldern, z. B. Matchday-Grafik oder Social-Post mit Gegner, Datum, Ergebnis, Export als PNG.
- Workspace-Projekte mit Kanban-Freigabe-Workflow und Pin-Kommentaren.
- AI-Tagging.
- Asset-Einreichungsformular für Externe.
- Mehrere Guidelines pro Brand, Sub-Brands (z. B. Verein → Frauen, Jugend, eSports).
- Newsletter/Brand Updates.
- Bewertungs- bzw. Rubrik-Modul für Dozierende (lehrspezifisch).

*Begründung COULD:* Enterprise-Funktionen mit hohem Aufwand und geringem Lerneffekt im Kurs.

### WON'T (im Semester)

- SSO/SAML.
- Marketplace bzw. SDK für Drittblöcke.
- Live-Figma-Sync.
- Storybook- und CodeSandbox-Blöcke.

---

## 8. Relationales Datenmodell (Postgres/Supabase, deckt Must und Should ab)

**Konventionen:**

- `uuid` als Primärschlüssel, `created_at`/`updated_at`/`created_by`.
- Soft-Delete per `deleted_at`. Spiegelt Frontifys `valid_to` und erlaubt das Wiederherstellen aus dem Papierkorb.
- Sortierung per `sort` (numeric für Fractional Indexing).
- **RLS über Brand-Mitgliedschaft.**

```sql
-- ===== Identität & Mandanten =====
create type workspace_role as enum ('owner','admin','member');
create type space_role     as enum ('owner','editor','reviewer','translator','viewer');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null, avatar_url text, locale text default 'de'
);

create table workspaces (               -- Kurs/Semester/Organisation („Account“)
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text unique not null,
  created_by uuid references profiles, created_at timestamptz default now()
);
create table workspace_members (
  workspace_id uuid references workspaces on delete cascade,
  user_id uuid references profiles on delete cascade,
  role workspace_role not null default 'member',
  primary key (workspace_id, user_id)
);

create table brands (                    -- Unternehmen/Verein/Verband
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  name text not null, slug text not null, description text,
  logo_asset_id uuid,                    -- FK nachträglich auf assets
  theme jsonb not null default '{}',     -- Portal-Branding: farben(token-refs), fonts, radius, nav_layout
  deleted_at timestamptz,
  unique (workspace_id, slug)
);

create table brand_members (             -- Vererbungsbasis für alle Inhalte der Brand
  brand_id uuid references brands on delete cascade,
  user_id uuid references profiles on delete cascade,
  role space_role not null,
  primary key (brand_id, user_id)
);

create table groups (                    -- SHOULD/COULD
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  name text not null
);
create table group_members (group_id uuid references groups on delete cascade,
  user_id uuid references profiles on delete cascade, primary key (group_id,user_id));

create table invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  brand_id uuid references brands on delete cascade,
  email citext not null, role space_role not null,
  token text unique not null, expires_at timestamptz not null,
  accepted_at timestamptz, invited_by uuid references profiles
);

-- ===== Essentials: Farben, Fonts, Textstile (brand-weit) =====
create table color_palettes (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands on delete cascade,
  name text not null, description text, sort numeric not null default 0
);
create table colors (
  id uuid primary key default gen_random_uuid(),
  palette_id uuid not null references color_palettes on delete cascade,
  name text not null, token_name text,              -- z. B. 'brand-primary' (≙ nameCss)
  r smallint not null, g smallint not null, b smallint not null,
  alpha numeric(4,3) not null default 1,
  hex text generated always as (...) stored,       -- oder in App berechnen
  c numeric, m numeric, y numeric, k numeric,
  cmyk_coated text, cmyk_uncoated text,
  pantone text, pantone_coated text, pantone_uncoated text,
  ral text, ncs text, hks text, lab text, oracal text, three_m text,
  usage text, description text,                     -- „Primärfarbe, 60 % Flächenanteil“
  sort numeric not null default 0
);

create type font_source as enum ('upload','google','adobe','system','other');
create table fonts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands on delete cascade,
  family text not null, source font_source not null,
  source_ref text,                                  -- Google-Family-Name / Kit-ID
  license_note text, download_allowed boolean default false,
  fallback_stack text default 'system-ui, sans-serif'
);
create table font_files (
  id uuid primary key default gen_random_uuid(),
  font_id uuid not null references fonts on delete cascade,
  weight smallint not null default 400, style text not null default 'normal',
  format text not null, storage_path text not null  -- woff2/ttf/otf
);
create table text_styles (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands on delete cascade,
  name text not null,                               -- „H1“, „Body“, „Caption“
  font_id uuid references fonts on delete set null,
  weight smallint, font_style text default 'normal',
  size_px numeric, line_height numeric, letter_spacing_em numeric,
  text_transform text, color_id uuid references colors on delete set null,
  sample_text text, usage text, sort numeric default 0
);

-- ===== Guidelines =====
create type visibility as enum ('everyone','editors');
create table guidelines (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands on delete cascade,
  title text not null, slug text not null,
  heading text, subheading text, cover_asset_id uuid,
  is_public boolean not null default false,         -- Public-Link an/aus
  public_token text unique,                         -- /p/{token}
  require_terms boolean default false, terms_text text,
  sort numeric default 0, deleted_at timestamptz,
  unique (brand_id, slug)
);

create type nav_item_kind as enum ('chapter','library','link');
create table chapters (                             -- ≙ DocumentCategory (+ Document vereinfacht)
  id uuid primary key default gen_random_uuid(),
  guideline_id uuid not null references guidelines on delete cascade,
  kind nav_item_kind not null default 'chapter',
  title text not null, slug text not null,
  library_id uuid,                                  -- wenn kind='library'
  link_url text, link_new_tab boolean default true, -- wenn kind='link'
  sort numeric default 0, deleted_at timestamptz,
  unique (guideline_id, slug)
);

create table pages (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references chapters on delete cascade,
  title text not null, slug text not null,
  visibility visibility not null default 'editors', -- Entwurf bis veröffentlicht
  link_url text,                                    -- Seite als reiner Link (optional)
  sort numeric default 0, view_count int default 0,
  updated_by uuid references profiles, updated_at timestamptz default now(),
  deleted_at timestamptz,
  unique (chapter_id, slug)
);

create table sections (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references pages on delete cascade,
  title text, slug text,                            -- Anker
  layout jsonb not null default '{"columns":[1]}',  -- Verhältnisse, z. B. [1,1] / [2,1]
  style jsonb not null default '{}',                -- Hintergrund, Padding
  sort numeric default 0, deleted_at timestamptz
);

create table blocks (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references sections on delete cascade,
  column_index smallint not null default 0,
  parent_block_id uuid references blocks on delete cascade, -- Tabs/Accordion-Kinder
  type text not null,               -- 'text','heading','image','colors','typography','dos_donts',...
  content jsonb not null default '{}',   -- Inhalt (Rich-Text als ProseMirror/TipTap-JSON, Items)
  settings jsonb not null default '{}',  -- Layout/Style/Security je Block-Schema
  sort numeric default 0, deleted_at timestamptz,
  updated_at timestamptz default now(), updated_by uuid references profiles
);
-- Referenzen von Blöcken auf Assets/Farben/Textstile (für Sync & "wo verwendet")
create table block_refs (
  block_id uuid references blocks on delete cascade,
  ref_type text not null check (ref_type in ('asset','color','palette','text_style','font')),
  ref_id uuid not null, slot text not null default 'default', sort numeric default 0,
  primary key (block_id, ref_type, ref_id, slot)
);

create table page_revisions (                       -- SHOULD: Snapshot je Speichern/Publish
  id bigserial primary key,
  page_id uuid not null references pages on delete cascade,
  snapshot jsonb not null,                          -- sections+blocks
  created_by uuid references profiles, created_at timestamptz default now(), note text
);

-- ===== Libraries / Assets =====
create type library_kind as enum ('media','logo','icon','document','template');
create type download_policy as enum ('open','request','blocked');
create table libraries (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands on delete cascade,
  kind library_kind not null, name text not null, slug text not null,
  download_policy download_policy not null default 'open',
  download_presets jsonb default '[]',  -- [{name,width,height,method:'fit'|'crop',format}]
  unique (brand_id, slug)
);
alter table chapters add foreign key (library_id) references libraries on delete set null;

create table folders (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries on delete cascade,
  parent_id uuid references folders on delete cascade,
  name text not null, sort numeric default 0
);

create table assets (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries on delete cascade,
  folder_id uuid references folders on delete set null,
  title text not null, description text,
  current_version_id uuid,                           -- FK nach asset_versions
  external_url text,                                 -- Link-Asset (YouTube etc.)
  preview_bg text,                                   -- z. B. '#000' für weißes Logo
  focal_x numeric, focal_y numeric,
  copyright text, valid_from timestamptz, expires_at timestamptz,
  download_protected boolean default false,
  created_by uuid references profiles, created_at timestamptz default now(),
  deleted_at timestamptz,
  search tsvector                                    -- title/description/tags/metadata
);
create table asset_versions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets on delete cascade,
  version_no int not null,
  storage_path text not null, file_name text not null, ext text not null,
  mime text not null, size_bytes bigint not null, width int, height int,
  preview_path text, checksum text, note text,
  created_by uuid references profiles, created_at timestamptz default now(),
  unique (asset_id, version_no)
);
alter table assets add foreign key (current_version_id) references asset_versions;

create table asset_attachments (id uuid primary key default gen_random_uuid(),
  asset_id uuid references assets on delete cascade, storage_path text, file_name text);
create table asset_relations (a uuid references assets on delete cascade,
  b uuid references assets on delete cascade, primary key (a,b), check (a < b));

create table tags (id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands on delete cascade, name citext not null, unique(brand_id,name));
create table asset_tags (asset_id uuid references assets on delete cascade,
  tag_id uuid references tags on delete cascade, source text default 'manual',
  primary key (asset_id, tag_id));

create type meta_type as enum ('text','longtext','number','select','multiselect','date','url');
create table metadata_fields (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries on delete cascade,
  name text not null, type meta_type not null, options jsonb, help_text text,
  default_value jsonb, required boolean default false, sort numeric default 0
);
create table asset_metadata (
  asset_id uuid references assets on delete cascade,
  field_id uuid references metadata_fields on delete cascade,
  value jsonb not null, primary key (asset_id, field_id)
);

create table collections (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands on delete cascade,
  name text not null, description text, is_public boolean default false
);
create table collection_assets (collection_id uuid references collections on delete cascade,
  asset_id uuid references assets on delete cascade, sort numeric default 0,
  primary key (collection_id, asset_id));

-- ===== Teilen & Freigaben =====
create table share_links (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands on delete cascade,
  target_type text not null check (target_type in ('guideline','asset','collection','folder')),
  target_id uuid not null,
  token text unique not null, password_hash text,
  allow_download boolean default true, expires_at timestamptz,
  created_by uuid references profiles, created_at timestamptz default now(), revoked_at timestamptz
);
create table download_requests (                    -- COULD
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets on delete cascade,
  requester_id uuid references profiles, requester_email citext,
  purpose text, answers jsonb, status text default 'pending'
    check (status in ('pending','approved','rejected')),
  decided_by uuid references profiles, decision_reason text, decided_at timestamptz
);

-- ===== Kollaboration =====
create table comments (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands on delete cascade,
  target_type text not null check (target_type in ('page','section','block','asset')),
  target_id uuid not null,
  parent_id uuid references comments on delete cascade,  -- Thread
  body jsonb not null,                                   -- Rich-Text inkl. Mentions
  pin_x numeric, pin_y numeric,                          -- Annotation auf Bild (0..1)
  resolved_at timestamptz, resolved_by uuid references profiles,
  author_id uuid not null references profiles, created_at timestamptz default now()
);
create table comment_mentions (comment_id uuid references comments on delete cascade,
  user_id uuid references profiles on delete cascade, primary key (comment_id,user_id));

create table notifications (
  id bigserial primary key, user_id uuid not null references profiles on delete cascade,
  type text not null, payload jsonb not null, read_at timestamptz, created_at timestamptz default now()
);
create table activity_log (
  id bigserial primary key, brand_id uuid references brands on delete cascade,
  actor_id uuid references profiles, action text not null,   -- 'block.update','asset.upload',...
  entity_type text not null, entity_id uuid not null, diff jsonb, created_at timestamptz default now()
);
create table analytics_events (                    -- COULD
  id bigserial primary key, brand_id uuid, event text check (event in ('page_view','download')),
  entity_type text, entity_id uuid, user_id uuid, share_link_id uuid, created_at timestamptz default now()
);
```

**Rechte und RLS:**

- **Helper:**
  - `brand_role(brand_id) returns space_role`: liest `brand_members`. Ist der Nutzer Workspace-`owner` oder `admin`, liefert die Funktion implizit `owner`. Dozierende sehen so alle Teams.
  - `has_brand_role(brand_id, min space_role)` mit der Rangfolge viewer < translator < reviewer < editor < owner.
- **Policies:**
  - SELECT auf Inhalte: ab `viewer`. Seiten mit `visibility='editors'` erst ab `editor`.
  - INSERT/UPDATE/DELETE auf Inhalte: ab `editor`.
  - Mitgliederverwaltung, Brand-Settings, Löschen: `owner`.
  - Kommentare schreiben: ab `reviewer`.
- **Brand-Auflösung:** Tiefe Tabellen (`blocks`, `sections` …) lösen die Brand über Joins auf. Performanter ist eine denormalisierte Spalte `brand_id` in `pages` und `blocks`, die ein Trigger pflegt.
- **Öffentliche Reads:**
  - Nicht über RLS, sondern über eine Server-Funktion bzw. RPC `get_public_guideline(token)`.
  - Die Funktion nutzt eine explizite Spalten-Whitelist und gibt nur Seiten mit `visibility='everyone'` zurück.
  - Sie prüft Passwort und Ablaufdatum des Share-Links.
- **Storage:**
  - Bucket `brand-assets/{brand_id}/{asset_id}/{version}`, privat.
  - Auslieferung per Signed URL bzw. Transform-URL, nach Rechteprüfung.
  - Fonts in einem eigenen Bucket. Sie werden für die Portal-Darstellung per `@font-face` mit Signed URLs geladen [V].
- **Einordnung:** Gruppen- und Target-Sichtbarkeit (COULD) später über eine Tabelle `audiences` plus `audience_members` (User/Gruppe) und eine `audience_ids uuid[]`-Spalte an `chapters` und `pages`.

**Vereinfachung gegenüber Frontify:** Frontify trennt Document → Category → Page. Der Klon fasst „Document“ und „Category“ zu `chapters` mit `kind` zusammen. Das reicht für eine Guideline pro Brand. Mehrere Top-Level-Dokumente sind über mehrere `guidelines` pro Brand abgebildet.

---

## 9. UI-Beobachtungen und Layout-Muster (vertraut, aber eigenständig)

**Was Frontify macht (belegt):**

- **Power Bar** [Q32][Q7][Q8][Q35]: schmale, vertikale Werkzeugleiste ganz links mit kontextabhängigen Tools.
  - Stift (Edit-Modus)
  - Navigation Manager
  - Pinsel (Theme)
  - Teilen (Public Link, Print/PDF)
  - Analytics
  - Benachrichtigungen, Profil
  - Vollbild (blendet die Power Bar aus)
- **Navigation:** Je nach Theme Top-Navigation mit Mega-Menü, Sidebar mit Kapiteln und Seiten oder beides. Headings erscheinen als Unterpunkte [Q8][Q4].
- **Editing:**
  - „+“ zwischen Blöcken öffnet den Block-Adder mit Suche und Kategorien [Q1][Q18].
  - Block-Einstellungen öffnen sich in einem Seitenpanel mit den Tabs Main/Basics/Layout/Style/Security [Q40].
  - Sections haben Quick Edit für Spalten [Q3].
  - Eine schwebende **Action-Toolbar unten mittig** bietet „Restore content“ und den Kommentar-Einstieg [Q30][Q29].
  - **Augen-Icon** pro Seite für den Entwurfsstatus [Q31].
  - Kommentar-Badges mit Zähler direkt am Block, Kommentar-Sidebar [Q29].
- **Library:**
  - Filterleiste oben mit Facetten, Raster mit Thumbnails, Mehrfachauswahl mit Bulk-Aktionen [Q21][Q47].
  - **Asset-Detailansicht:** großes Preview mit Sidebar-Tabs (Info/Metadaten, Relations, Anhänge, Kommentare, Analytics) und Download mit Format- und Größenwahl [Q23][Q22][Q35].
- **Kritik aus Reviews** [Q43]:
  - Steile Lernkurve im Backend und unübersichtliche Einstellungen.
  - Schwache Mobile-Darstellung.
  - Starre Banner und Header.
  - Suche bei großen Libraries.
  - Gewünscht ist Drag & Drop für Portalseiten.

**Empfehlungen für den Klon** (vertraut in der Bedienlogik, eigenständig in Gestaltung und Benennung) **[V]:**

1. **Eigene Begriffe:**
   - „Markenhandbuch“ statt Guidelines
   - „Kapitel“ und „Seiten“
   - „Bausteine“ statt Content Blocks
   - „Mediathek“
   - „Markenbasis“ statt Essentials
   - „Freigabelink“
2. **Layout:**
   - Statt einer Icon-Leiste links eine **Topbar mit Kontextaktionen**: Bearbeiten-Toggle als deutlicher Schalter („Ansehen | Bearbeiten“), Teilen, Kommentare, Mehr.
   - Links die Kapitel-Sidebar (auf Mobile als Drawer), rechts das Einstellungs-Panel nur im Edit-Modus.
   - Mobile-first, weil genau das bei Frontify kritisiert wird.
3. **Block-Einfügen:**
   - Hover-„+“ zwischen Blöcken, zusätzlich **Slash-Befehl** („/farbe“, „/logo“) im Text-Baustein.
   - Kategorien: Text, Marke (Farben, Typo, Logo, Do & Don't), Medien, Struktur (Tabs, Accordion, Divider), Teilen (Download, Asset-Paket).
4. **Einstellungs-Panel:** Drei Tabs (Inhalt, Layout, Stil) mit dem bewährten Muster „Preset S/M/L, sonst ‚Eigener Wert‘“. Security nur als Schalter „Download erlauben“.
5. **Drag & Drop** für Bausteine, Sections und die Navigation, sichtbar mit Griff-Icon.
6. **Startseite:** Hero (Cover, Logo, Claim) plus Karten-Grid zu den Kapiteln und zur Mediathek, plus Quick-Downloads („Logo-Paket“, „Farben als ASE/CSS“).
7. **Asset-Detail als Seitenpanel (Sheet)** statt eigener Seite: Vorschau mit wählbarem Hintergrund (hell, dunkel, Markenfarbe), Metadaten, Versionen, Verknüpfungen, Kommentare mit Pins, Download-Button mit Format und Größe.
8. **Farb-Baustein:** Karten mit großer Farbfläche, Klick kopiert den Wert, Umschalter für die Werte (HEX/RGB/CMYK/Pantone/RAL/NCS), Kontrast-Badge (WCAG AA/AAA).
9. **Typo-Baustein:** Live-Vorschau mit echtem Font, Tabelle der Textstile (Größe, Zeilenhöhe, Gewicht, Laufweite), Beispieltext editierbar.
10. **Sportbezug als Vorlage-Inhalte** (Seed-Templates):
    - Kapitel „Wappen/Logo“, „Vereinsfarben/Trikot“, „Typo“, „Bildsprache Spieltag“, „Sponsoren-Platzierung“, „Social Media“, „Merch“.
    - Didaktisch nützlich, nicht Teil von Frontify.

---

## Quellen

**Methodischer Hinweis:** Die help.frontify.com-Artikel konnte ich wegen der Proxy-Sperre nicht direkt abrufen. Ihre Inhalte stammen aus Suchergebnis-Snippets. Die GitHub-Dateien habe ich direkt gelesen.

- **[Q1]** How to add content blocks: https://help.frontify.com/en/articles/133908-how-to-add-content-blocks
- **[Q2]** Marketplace for content blocks: https://help.frontify.com/en/articles/9583764-frontify-marketplace-for-content-blocks
- **[Q3]** Guidelines Sections: https://help.frontify.com/en/articles/9813621-guidelines-sections
- **[Q4]** Navigation Manager: https://help.frontify.com/en/articles/6972753-navigation-manager
- **[Q5]** Cover pages vs. document pages: https://help.frontify.com/en/articles/13914735-cover-pages-vs-document-pages · Cover pages: https://help.frontify.com/en/articles/1365153-cover-pages
- **[Q6]** How to structure your brand in Frontify: https://help.frontify.com/en/articles/1922418-how-to-structure-your-brand-in-frontify
- **[Q7]** Connect library to guideline: https://help.frontify.com/en/articles/5429716-how-do-i-connect-the-library-to-the-guideline
- **[Q8]** Themes:
  - https://help.frontify.com/en/articles/11831481-get-started-with-themes
  - https://help.frontify.com/en/articles/10908057-themes-general-faq
  - https://help.frontify.com/en/articles/10921779-color-schemes-faq
  - https://help.frontify.com/en/articles/11832375-work-with-the-paper-theme
  - https://help.frontify.com/en/articles/13571369-update-to-the-classic-theme
- **[Q9]** Colors block (Essentials): https://help.frontify.com/en/articles/16188816-create-connected-color-palettes-with-the-new-colors-block
- **[Q10]** Essentials: https://help.frontify.com/en/articles/11991875-essentials · Essentials API: https://help.frontify.com/en/articles/14704616-essentials-api-colors-and-fonts
- **[Q11]** Color codes: https://help.frontify.com/en/articles/5431883-how-do-i-add-different-color-codes-to-the-color-block · CMYK: https://help.frontify.com/en/articles/5431855-how-do-i-add-the-cmyk-color-values-to-the-colors-block
- **[Q12]** Color Kit: https://help.frontify.com/en/articles/6717921-color-kit-block · Color Swatches: https://help.frontify.com/en/articles/1309828-color-swatches
- **[Q13]** Fonts: https://help.frontify.com/en/articles/1220370-how-to-use-your-own-font-in-frontify · Font Kit: https://help.frontify.com/en/articles/6127779-font-kit-content-block
- **[Q14]** Do and Don't: https://help.frontify.com/en/articles/2388957-do-and-don-t-block
- **[Q15]** Tabs: https://help.frontify.com/en/articles/11554165-tabs · Cards grid: https://help.frontify.com/en/articles/13868178-cards-grid-block
- **[Q16]** Personal notes: https://help.frontify.com/style-guide/personal-notes · Blog „Beloved features“: https://frontify.com/blog/beloved-features-in-frontify-style-guide
- **[Q17]** Annotations: https://help.frontify.com/en/articles/1336437-annotations
- **[Q18]** Weitere Block-Artikel:
  - Text: https://help.frontify.com/en/articles/6951442-text-block
  - Content editor: https://help.frontify.com/en/articles/8075347-content-editor
  - Code Snippet: https://help.frontify.com/en/articles/6799929-code-snippet-block
  - Storybook: https://help.frontify.com/en/articles/3766324-storybook-content-block
  - CodeSandbox: https://help.frontify.com/en/articles/8926360-codesandbox-block
  - Figma: https://help.frontify.com/en/articles/6588621-figma-content-block
- **[Q19]** Asset submission: https://help.frontify.com/en/articles/8805625-asset-submission-block
- **[Q20]** Metadata & tags: https://help.frontify.com/en/articles/4057240-metadata-and-tags-in-libraries · Bulk metadata: https://help.frontify.com/en/articles/12530343-bulk-metadata-manager-app
- **[Q21]** Suche und Filter:
  - Asset filters: https://help.frontify.com/en/articles/2932835-asset-filters
  - Search in libraries: https://help.frontify.com/en/articles/4775943-search-in-libraries
  - Search types: https://help.frontify.com/en/articles/13917932-understanding-search-types-in-frontify
  - Guideline search: https://help.frontify.com/en/articles/8485762-guideline-search
  - Natural language search: https://help.frontify.com/en/articles/12276844-natural-language-search
  - Spotlight: https://help.frontify.com/en/articles/12098826-workspace-spotlight-search
- **[Q22]** Transformationen und Downloads:
  - Asset transformations: https://help.frontify.com/en/articles/13352262-asset-transformations
  - Media library transformation: https://help.frontify.com/en/articles/3928019-media-library-asset-transformation
  - Download sizes: https://help.frontify.com/en/articles/5306578-can-i-customize-the-download-sizes-for-my-asset
  - Dynamic media: https://help.frontify.com/en/articles/14034315-dynamic-media-services
  - Browser extension: https://help.frontify.com/en/articles/16799843-browser-extension
- **[Q23]** Asset relations: https://help.frontify.com/media-library/asset-relations
- **[Q24]** Uploading assets: https://help.frontify.com/en/articles/5810426-uploading-assets-to-frontify
- **[Q25]** Download request form: https://help.frontify.com/en/articles/2988180-custom-download-request-form
- **[Q26]** User roles: https://help.frontify.com/getting-started/user-roles-and-permissions · https://help.frontify.com/articles/1356460-user-roles-and-permissions
- **[Q27]** Nutzerverwaltung:
  - User management: https://help.frontify.com/en/articles/2864440-user-management-overview
  - Groups: https://help.frontify.com/en/articles/3790133-how-to-create-user-groups
  - Access management: https://help.frontify.com/en/articles/1922454-user-access-management
  - Request access: https://help.frontify.com/en/articles/1221098-request-access
  - SSO: https://help.frontify.com/en/articles/451481-sso-fast-and-convenient-login-for-employees
- **[Q28]** Teilen:
  - Public sharing: https://help.frontify.com/en/articles/742528-public-sharing
  - Password protection: https://help.frontify.com/en/articles/5428791-is-password-protection-possible-for-a-guideline-folder-asset-etc
  - Sharing: https://help.frontify.com/en/articles/5431919-how-can-i-share-my-guidelines-or-assets-with-employees-or-external-people
  - Terms: https://help.frontify.com/en/articles/2860628-terms-conditions
- **[Q29]** Page commenting: https://help.frontify.com/en/articles/13742547-guideline-page-commenting · Feedback form: https://help.frontify.com/en/articles/15075070-can-i-add-a-contact-or-feedback-form-to-my-frontify-guidelines
- **[Q30]** Deleted content: https://help.frontify.com/en/articles/15444879-how-do-i-find-deleted-content-and-can-i-get-it-back · https://help.frontify.com/en/articles/12496588-how-to-restore-deleted-content-in-your-guidelines
- **[Q31]** Hide pages: https://help.frontify.com/en/articles/5306836-can-i-hide-guideline-pages-that-i-am-not-ready-to-have-live-in-my-environment
- **[Q32]** Workspace und Workflow:
  - Workflow: https://help.frontify.com/workspace/how-to-get-started-with-workflow
  - Power Bar: https://help.frontify.com/en/articles/497003-the-power-bar · https://help.frontify.com/en/articles/481583-the-powerbar
  - Projects: https://help.frontify.com/en/collections/2870409-projects
  - News commenting: https://news.frontify.com/22765-enjoy-a-new-way-of-commenting-your-projects
  - Blog Workflow: https://frontify.com/blog/introducing-workflow
- **[Q33]** Multi-language: https://help.frontify.com/en/articles/1369259-multi-language-feature · AI translation: https://help.frontify.com/en/articles/12231379-how-do-you-use-ai-translation-in-your-guidelines
- **[Q34]** PDF export: https://help.frontify.com/en/articles/14718558-guidelines-export-pdf-and-print · https://help.frontify.com/en/articles/506278-guidelines-export-pdf-and-print-legacy-theme
- **[Q35]** Analytics:
  - https://help.frontify.com/en/articles/11524847-understanding-guideline-analytics
  - https://help.frontify.com/en/articles/11784815-asset-analytics-via-library
  - https://help.frontify.com/en/articles/5055865-analytics-dashboard-overview
- **[Q36]** Templates:
  - https://help.frontify.com/en/articles/2388448-getting-started-with-frontify-digital-and-print-templates
  - https://help.frontify.com/en/articles/3589960-creating-publications
  - https://help.frontify.com/en/articles/5682743-setting-up-templates
- **[Q37]** Newsletter: https://help.frontify.com/en/articles/5190768-getting-started-with-newsletters · https://help.frontify.com/en/articles/10362475-newsletter-notifications-and-applications
- **[Q38]** GraphQL API: https://help.frontify.com/en/articles/5402357-what-is-the-frontify-graphql-api · Dev tools: https://help.frontify.com/en/articles/5402354-overview-of-frontify-developer-tools · https://developer.frontify.com
- **[Q39]** Frontify Brand SDK, App-Bridge-Typen (direkt gelesen): https://github.com/Frontify/brand-sdk/tree/main/packages/app-bridge/src/types
  - Gelesen: Color.ts, ColorPalette.ts, Document.ts, DocumentPage.ts, DocumentSection.ts, DocumentCategory.ts, DocumentGroup.ts, CoverPage.ts, Guideline.ts, Asset.ts, Project.ts, Targets.ts, Template.ts, Language.ts, PrivacySettings.ts, ThemeTemplate.ts, BrandportalLink.ts, DocumentBlockTemplate.ts
- **[Q40]** Frontify Guideline Blocks, Settings-Schemas (direkt gelesen): https://github.com/Frontify/guideline-blocks/tree/main/packages
  - Gelesen: text, image, dos-donts, callout, divider, code-snippet, thumbnail-grid, gradient, template, asset-kit, audio, figma, ui-pattern
- **[Q41]** Hintergrund zu Libraries:
  - DAM-Whitepaper: https://info.frontify.com/hubfs/2023_12_en_whitepaper_digital-asset-management.pdf
  - Year in Review: https://frontify.com/de/blog/a-year-in-review
  - Product Roundup Aug 2020: https://frontify.com/en/blog/product-roundup-august-2020
  - Product Roundup Apr 2019: https://frontify.com/blog/product-roundup-april-2019-part-2
- **[Q42]** Fallstudien Sport: https://www.frontify.com/en/cases/bvb-and-frontify/ · https://www.frontify.com/en/cases/frontify-for-bayer-04-leverkusen/ · https://www.frontify.com/en/built-with-frontify/kansas-city-chiefs
- **[Q43]** Reviews: https://www.g2.com/products/frontify/reviews · https://capterra.com/p/183904/Frontify/reviews/
- **[Q44]** CI HUB zur Brand-Struktur: https://support.ci-hub.com/ci-hub-brand-connector/how-to-add-brand-asset-categories-in-frontify
- **[Q45]** Integrationsticket zur Ablaufzeit von Download-URLs (Drittquelle): https://jira.magnolia-cms.com/browse/FRONTIFY-15
- **[Q46]** Typeform-Block mit Brand SDK: https://www.frontify.com/de/blog/building-a-typeform-content-block/
- **[Q47]** Icon Library: https://help.frontify.com/en/articles/2727924-introducing-the-icon-library

**Offene Lücken (für eine zweite Runde mit Direktzugriff):**

- Genaue Felder von Quote, Typography/Text-Styles, Accordion (nicht belegt), Tables, Video und Embed.
- Asset-Versionierung in der Oberfläche.
- Exakte URL-Struktur öffentlicher Portale.
- Vollständige Rechte-Matrix je Objekt.
- Der Inhalt von `help.frontify.com/llms.txt`: ein maschinenlesbarer Index des Help-Centers, laut Suche vorhanden, aber hier blockiert.