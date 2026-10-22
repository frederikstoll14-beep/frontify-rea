# Einrichtung: Brandbench online stellen

Dauer: ca. 20 Minuten. Kosten: 0 € (kostenlose Tarife von Supabase und Vercel reichen für einen Kurs).

Du brauchst:

- ein GitHub-Konto (das Repository liegt dort bereits)
- ein kostenloses Konto bei [Supabase](https://supabase.com) (Datenbank, Login, Dateispeicher)
- ein kostenloses Konto bei [Vercel](https://vercel.com) (Hosting der Web-App)

```
Browser ──► Vercel (statische Web-App) ──► Supabase (Postgres + Auth + Storage, Region Frankfurt)
```

---

## 1. Supabase-Projekt anlegen

1. Auf [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Name, z. B. `brandbench`, ein sicheres Datenbank-Passwort (gut aufheben).
3. **Region: Central EU (Frankfurt)**. Das ist wichtig für den Datenschutz (DSGVO).
4. Warten, bis das Projekt bereit ist (ca. 2 Minuten).

## 2. Datenbank einrichten

**Variante A: SQL-Editor (ohne Kommandozeile, empfohlen)**

1. Im Supabase-Dashboard links **SQL Editor** → **New query**.
2. Den kompletten Inhalt von [`supabase/migrations/20261015120000_markenkompass_schema.sql`](../supabase/migrations/20261015120000_markenkompass_schema.sql) einfügen.
3. **Run** klicken. Am Ende muss „Success. No rows returned“ stehen.

Das Skript legt an:

- alle Tabellen
- die Zugriffsregeln (Row Level Security)
- den privaten Datei-Speicher `brand-files`
- alle Funktionen für Einladungen, Vorlagen und Suche

**Variante B: Supabase-CLI**

```bash
npx supabase login
npx supabase link --project-ref DEIN-PROJEKT-REF
npx supabase db push
```

## 3. Login (Auth) konfigurieren

Im Dashboard unter **Authentication**:

1. **URL Configuration**
   - **Site URL**: die spätere Vercel-Adresse, z. B. `https://brandbench-xyz.vercel.app`. Du kannst sie nach Schritt 5 nachtragen.
   - **Redirect URLs**: dieselbe Adresse plus `/**`, also `https://brandbench-xyz.vercel.app/**`.
2. **Sign In / Providers → Email**
   - **Confirm email**: Hier gibt es zwei Wege.
     - **Aus (empfohlen für den Kursstart):** Alle können sich sofort registrieren und loslegen.
     - **An:** Neue Konten müssen ihre E-Mail bestätigen. Dafür brauchst du einen eigenen E-Mail-Versand (siehe unten).
   - **Minimum password length**: 8.

> **Wichtig zu E-Mails:** Der eingebaute E-Mail-Versand von Supabase ist stark begrenzt. Er schickt nur wenige Mails pro Stunde, und zwar nur an Mitglieder deines Supabase-Teams. Für Passwort-Zurücksetzen, Login-Links und E-Mail-Bestätigung richtest du einen eigenen SMTP-Dienst ein. Das geht unter **Project Settings → Authentication → SMTP**, z. B. mit Brevo, Resend oder dem SMTP-Server deiner Hochschule.
>
> Ohne SMTP funktioniert alles andere trotzdem: Registrierung (mit „Confirm email“ aus), Login per Passwort und Einladungen per Link.

## 4. Schlüssel kopieren

**Project Settings → API**. Du brauchst:

- **Project URL** (z. B. `https://abcdefgh.supabase.co`)
- **anon / publishable key** (darf öffentlich sein, er gibt nur das frei, was die Zugriffsregeln erlauben)

Den **service_role / secret key** brauchst du **nicht**. Gib ihn niemals weiter.

## 5. Web-App auf Vercel veröffentlichen

1. Auf [vercel.com/new](https://vercel.com/new) das GitHub-Repository `frontify-rea` importieren.
2. Framework: **Vite** (wird erkannt). Build Command `npm run build`, Output `dist`.
3. Unter **Environment Variables** eintragen:

   | Name                     | Wert                          |
   | ------------------------ | ----------------------------- |
   | `VITE_SUPABASE_URL`      | Project URL aus Schritt 4     |
   | `VITE_SUPABASE_ANON_KEY` | anon/publishable key          |
   | `VITE_APP_NAME`          | optional, Standard ist `Brandbench` |

   Hast du Supabase über die **Supabase-Integration von Vercel** verbunden, legt sie die Variablen als `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (bzw. `…_ANON_KEY`) an. Die App liest diese Namen ebenfalls, du musst nichts umbenennen. Achte darauf, dass die Variablen für **Production** (und für Vorschauen auch **Preview**) gelten.

4. **Deploy**. Nach ca. 1 Minute ist die App erreichbar. Änderst du später Variablen, musst du neu deployen (**Deployments → ⋯ → Redeploy**), weil die Werte beim Build eingebaut werden.
5. Die Vercel-Adresse in Supabase als **Site URL** und **Redirect URL** eintragen (Schritt 3).

Alternativen zu Vercel sind Netlify oder Cloudflare Pages. Die Datei `public/_redirects` ist schon vorbereitet. Wichtig ist bei jedem Anbieter, dass alle Pfade auf `index.html` umgeleitet werden.

## 6. Erste Schritte in der App

1. App öffnen → **Registrieren** (du wirst automatisch Owner deines ersten Workspaces).
2. **Workspace anlegen**, z. B. „Brand Identity · WS 2026/27“.
3. **Workspace → Mitglieder → Einladungslink für Gruppe erstellen** (Rolle „Mitglied“, gültig ein Semester) und den Link im Kurs teilen.
4. Optional: **Neue Marke → Vorlage „Beispiel: SV Rheinblick 1921“**. Dann hast du ein fertiges Demo-Portal zum Zeigen.

Wie du den Kurs damit organisierst, steht in [LEHRE.md](LEHRE.md).

## 7. Optional: Claude mit Brandbench verbinden

Brandbench lässt sich als Konnektor in Claude einbinden („Benutzerdefinierten Konnektor hinzufügen“). Dazu die Migration `20261022120000_mcp_connector.sql` im SQL-Editor ausführen und in Supabase unter **Authentication → OAuth Server** den OAuth-Server einschalten. Die Schritte stehen in [MCP.md](MCP.md).

---

## Häufige Probleme

| Problem | Lösung |
| ------- | ------ |
| Die App zeigt „Fast geschafft: Backend verbinden“ | Die Umgebungsvariablen fehlen oder sind ungültig; das konkrete Problem steht im gelben Kasten. In Vercel korrigieren und danach **Redeploy** (die Werte werden nur beim Build gelesen). |
| Registrierung meldet „Bitte bestätige zuerst deine E-Mail“ | „Confirm email“ ausschalten oder SMTP einrichten. |
| Nach dem Klick auf einen E-Mail-Link landet man auf `localhost` | Site URL und Redirect URLs in Supabase korrigieren (Schritt 3). |
| Upload bricht ab | Dateien dürfen max. 50 MB groß sein (Grenze des kostenlosen Supabase-Tarifs). |
| Schriften werden nicht angezeigt | Der Schriftname muss genau wie auf fonts.google.com geschrieben sein, z. B. `Barlow Condensed`. |
| Das Supabase-Projekt „schläft“ | Kostenlose Projekte pausieren nach 7 Tagen ohne Nutzung. Im Dashboard auf **Restore** klicken. |

## Updates einspielen

- Neue Versionen der App deployt Vercel automatisch bei jedem Push auf den verbundenen Branch.
- Kommen neue Datenbank-Migrationen hinzu (`supabase/migrations/*.sql`), führst du nur die **neuen** Dateien im SQL-Editor aus. Für den Claude-Konnektor ist das `20261022120000_mcp_connector.sql`.
