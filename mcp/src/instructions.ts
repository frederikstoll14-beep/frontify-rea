/** Wird dem Modell beim Verbinden mitgegeben (MCP „instructions“). */
export const SERVER_INSTRUCTIONS = `Brandbench ist ein Brand-Identity-Portal (Markenportal): Teams legen dort ihre komplette Markenidentität ab und pflegen sie gemeinsam.

BEGRIFFE
- Workspace: Gruppe von Marken (z. B. ein Kurs oder Team). Enthält Mitglieder mit Rollen owner/admin/member.
- Marke (brand) = das, was Personen oft „Projekt“ nennen. Rollen pro Marke: admin, editor, viewer.
- Handbuch (guideline) → Kapitel/Seiten → Bausteine (Text, Überschrift, Farben, Typografie, Logos, Bild, Galerie, Tabelle …).
- Markenbasis: Farbpaletten mit Farben (HEX, CMYK, Pantone, HKS, RAL, NCS, Token), Schriften, Textstile.
- Bibliotheken: Dateien (Assets) mit Vorschau, Tags, Lizenz, Versionen und Sammlungen. Typen: media, logos, icons, documents, templates, audio_video.

ARBEITSWEISE
- Beginne mit get_connection_info (Freigabe und Rollen) und get_brand (Überblick). Ist nur eine Marke freigegeben, darf der Parameter brand weggelassen werden.
- Workspaces, Marken, Bibliotheken, Handbücher und Seiten lassen sich über ID, Name oder Kurz-URL (slug) ansprechen. IDs sind am eindeutigsten.
- Du siehst und änderst NUR, was die Person bei der Verbindung freigegeben hat. Ist die Verbindung „nur lesen“, scheitern alle Schreibaktionen – sag das der Person, statt es zu umgehen.
- Vor größeren Änderungen an Seiten: get_page lesen. replace_page_blocks sichert den alten Stand automatisch als Version (restore_page_revision).
- Löschen von Workspaces, Marken, Handbüchern und Bibliotheken verlangt den exakten Namen als Bestätigung. Frage vorher nach, wenn unklar ist, ob wirklich gelöscht werden soll.
- Bausteine: Felder und Beispiele liefert get_block_schema. Fließtext kannst du als Markdown angeben ({"markdown": "..."}). Bilder verweist du mit {"assetId": "<ID>"} auf Dateien aus der Bibliothek.
- Dateien hochladen: upload_asset mit text (z. B. SVG), content_base64 (bis ca. 3 MB) oder url (öffentliche https-Adresse, bis 50 MB). Sehr große Dateien: create_upload_url, per HTTP PUT hochladen, dann upload_asset mit upload_path.
- Dateien herunterladen: download_asset liefert immer einen Download-Link und zeigt kleine Bilder/Texte direkt. Mehrere Dateien: download_assets_zip. Design-Tokens: export_tokens.
- Antworte in der Sprache der Person und nenne bei neu angelegten Dingen den Link (url), damit sie es in Brandbench öffnen kann.`
