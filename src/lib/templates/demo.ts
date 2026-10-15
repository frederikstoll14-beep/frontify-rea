import {
  accordion,
  assetsBlock,
  callout,
  cards,
  chapter,
  checklist,
  colorsBlock,
  dosDonts,
  downloadKit,
  galleryBlock,
  heading,
  logosBlock,
  p,
  page,
  quote,
  subheading,
  table,
  text,
  typographyBlock,
  ul,
} from './builders'
import { DEFAULT_LIBRARIES } from './chapters'
import type { BrandTemplate } from './types'

/**
 * Ausgefülltes Beispiel eines fiktiven Mehrspartenvereins.
 * Dient in der Lehre als Referenz, wie ein fertiges Markenportal aussehen kann.
 */
export const demoTemplate: BrandTemplate = {
  id: 'demo',
  name: 'Beispiel: SV Rheinblick 1921',
  description: 'Fertig ausgefülltes Demo-Portal eines fiktiven Sportvereins – ideal zum Ausprobieren',
  orgType: 'verein',
  data: {
    theme: {
      primary: '#0B3C7A',
      accent: '#FFC72C',
      headingFont: 'Barlow Condensed',
      bodyFont: 'Inter',
      heroStyle: 'brand',
      logoBackground: 'brand',
    },
    home: {
      welcome:
        'Willkommen im Markenportal des SV Rheinblick 1921 e.V. Hier findest du alles, was unseren Verein ausmacht – vom Wappen über die Vereinsfarben bis zur Spieltagsgrafik.',
      quickLinks: [
        { label: 'Logo-Paket herunterladen', url: 'library:logos' },
        { label: 'Vereinsfarben', url: 'page:markenhandbuch/vereinsfarben' },
      ],
      showColors: true,
      showLibraries: true,
    },
    palettes: [
      {
        name: 'Vereinsfarben',
        description: 'Blau und Weiß seit 1921 – der Rhein und die Gischt.',
        colors: [
          {
            name: 'Rheinblau',
            hex: '#0B3C7A',
            token: 'rheinblau',
            cmyk: '100/70/0/25',
            pantone: '2945 C',
            hks: 'HKS 43 K',
            ral: '5002',
            usage: 'Primärfarbe · ca. 60 %',
            description: 'Trägt die Marke: Trikot, Flächen, Headlines.',
          },
          {
            name: 'Gischtweiß',
            hex: '#FFFFFF',
            token: 'weiss',
            cmyk: '0/0/0/0',
            ral: '9016',
            usage: 'Grundfarbe · ca. 30 %',
            description: 'Hintergründe, Negativlogo, Ausweichtrikot.',
          },
          {
            name: 'Flutlichtgelb',
            hex: '#FFC72C',
            token: 'flutlichtgelb',
            cmyk: '0/22/90/0',
            pantone: '123 C',
            hks: 'HKS 4 K',
            ral: '1003',
            usage: 'Akzent · max. 10 %',
            description: 'Nur für Highlights: Tore, Siege, Calls-to-Action.',
          },
        ],
      },
      {
        name: 'Ergänzungsfarben',
        description: 'Für Infografiken, Statistik und digitale Oberflächen.',
        colors: [
          { name: 'Nachtblau', hex: '#071A35', token: 'nachtblau', cmyk: '100/80/30/70', usage: 'Dunkle Flächen, Text' },
          { name: 'Kieselgrau', hex: '#8C9196', token: 'kieselgrau', cmyk: '10/0/0/50', usage: 'Sekundärtext, Linien' },
          { name: 'Uferhell', hex: '#EEF2F7', token: 'uferhell', usage: 'Hintergrundflächen digital' },
        ],
      },
    ],
    fonts: [
      {
        family: 'Barlow Condensed',
        source: 'google',
        role: 'Headline',
        weights: [500, 600, 700, 800],
        fallback: 'Arial Narrow, sans-serif',
        license: 'SIL Open Font License – frei nutzbar',
        description: 'Kompakt, kräftig, sportlich. Für Headlines, Zahlen und Trikotnummern.',
      },
      {
        family: 'Inter',
        source: 'google',
        role: 'Text',
        weights: [400, 500, 600, 700],
        fallback: 'Arial, sans-serif',
        license: 'SIL Open Font License – frei nutzbar',
        description: 'Gut lesbar auf allen Bildschirmgrößen. Für Fließtexte und Interfaces.',
      },
    ],
    textStyles: [
      {
        name: 'Spieltag-Display',
        token: 'display',
        fontFamily: 'Barlow Condensed',
        fontWeight: 800,
        fontSize: 72,
        lineHeight: 0.95,
        textTransform: 'uppercase',
        sample: 'Heimspiel',
        usage: 'Matchday-Grafiken, Plakate',
      },
      {
        name: 'Headline 1',
        token: 'h1',
        fontFamily: 'Barlow Condensed',
        fontWeight: 700,
        fontSize: 44,
        lineHeight: 1.05,
        textTransform: 'uppercase',
        sample: 'Gemeinsam am Rhein',
      },
      {
        name: 'Headline 2',
        token: 'h2',
        fontFamily: 'Barlow Condensed',
        fontWeight: 600,
        fontSize: 28,
        lineHeight: 1.15,
        sample: 'Neuigkeiten aus dem Verein',
      },
      {
        name: 'Fließtext',
        token: 'body',
        fontFamily: 'Inter',
        fontWeight: 400,
        fontSize: 16,
        lineHeight: 1.6,
        sample: 'Seit 1921 ist der SV Rheinblick Heimat für alle, die Sport lieben.',
      },
      {
        name: 'Rückennummer',
        token: 'number',
        fontFamily: 'Barlow Condensed',
        fontWeight: 700,
        fontSize: 96,
        lineHeight: 1,
        sample: '10',
        usage: 'Trikot, Aufstellungsgrafik',
      },
      {
        name: 'Bildunterschrift',
        token: 'caption',
        fontFamily: 'Inter',
        fontWeight: 500,
        fontSize: 13,
        lineHeight: 1.4,
        letterSpacing: 0.02,
        sample: 'Foto: Vereinsarchiv',
      },
    ],
    libraries: DEFAULT_LIBRARIES,
    guidelines: [
      {
        title: 'Markenhandbuch',
        slug: 'markenhandbuch',
        description: 'Alles über den SV Rheinblick: Haltung, Erscheinungsbild, Anwendungen',
        icon: 'book-open',
        items: [
          chapter('Einführung', [
            page('Willkommen', 'Warum es dieses Handbuch gibt.', [
              heading('Ein Verein, ein Auftritt'),
              text(
                p(
                  'Über 1.200 Mitglieder, 14 Abteilungen, unzählige Ehrenamtliche – und ein gemeinsames Gesicht. Dieses Handbuch sorgt dafür, dass der SV Rheinblick überall als ein Verein erkennbar ist: auf dem Trikot der F-Jugend genauso wie auf dem Instagram-Kanal der ersten Mannschaft.',
                ),
              ),
              cards(
                [
                  { title: 'Für Abteilungen', text: 'Vorlagen für Plakate, Social Media und Aushänge.' },
                  { title: 'Für Partner', text: 'Logos, Farben und Regeln für gemeinsame Auftritte.' },
                  { title: 'Für Medien', text: 'Pressefotos, Wappen und Ansprechpartner.' },
                ],
                3,
              ),
            ]),
            page('Auf einen Blick', 'Der SV Rheinblick in 30 Sekunden.', [
              quote('Gemeinsam am Rhein.', 'Vereinsclaim seit 2019'),
              cards(
                [
                  { title: 'Gegründet', text: '1921 von Rheinschiffern und Hafenarbeitern' },
                  { title: 'Mitglieder', text: '1.200 in 14 Abteilungen' },
                  { title: 'Heimat', text: 'Sportpark am Rheinufer' },
                  { title: 'Werte', text: 'Zusammenhalt · Bodenständigkeit · Ehrgeiz' },
                ],
                4,
                'outline',
              ),
              colorsBlock('strip'),
            ]),
          ]),
          chapter('Markenkern', [
            page('Geschichte', 'Vom Hafenverein zum Sportpark am Rhein.', [
              heading('Unsere Wurzeln'),
              text(
                p(
                  '1921 gründeten Rheinschiffer und Hafenarbeiter den Verein, um nach Feierabend gemeinsam Fußball zu spielen. Aus der Hafenmannschaft wurde ein Mehrspartenverein, der heute Fußball, Handball, Schwimmen, Rudern und Leichtathletik vereint.',
                ),
              ),
              table([
                ['Jahr', 'Ereignis', 'Bedeutung für die Marke'],
                ['1921', 'Gründung am Hafen', 'Bodenständigkeit, Arbeiterwurzeln'],
                ['1968', 'Aufstieg in die Verbandsliga', 'Ehrgeiz, Stolz der Region'],
                ['1995', 'Eröffnung Sportpark am Rheinufer', 'Der Rhein wird Teil der Identität'],
                ['2021', '100-jähriges Jubiläum, neues Erscheinungsbild', 'Tradition trifft Moderne'],
              ]),
            ]),
            page('Vision & Mission', 'Wofür wir stehen.', [
              heading('Vision', 'Wohin wir wollen'),
              quote('Der Verein, in dem jede:r am Rhein Sport treiben möchte.'),
              heading('Mission', 'Was wir jeden Tag tun'),
              text(
                p(
                  'Wir bieten Menschen jeden Alters eine sportliche Heimat – mit qualifiziertem Training, fairen Beiträgen und einer Gemeinschaft, die über den Sport hinaus trägt.',
                ),
              ),
            ]),
            page('Werte', 'Was uns ausmacht.', [
              heading('Unsere Werte'),
              cards(
                [
                  {
                    title: 'Zusammenhalt',
                    text: 'Wir stehen füreinander ein – auf dem Platz, am Spielfeldrand und im Vereinsheim.',
                  },
                  {
                    title: 'Bodenständigkeit',
                    text: 'Wir vergessen nie, woher wir kommen. Ehrlich, direkt, ohne Allüren.',
                  },
                  {
                    title: 'Ehrgeiz',
                    text: 'Wir wollen besser werden – jede Mannschaft, jedes Training, jeder Mensch.',
                  },
                ],
                3,
              ),
            ]),
            page('Persönlichkeit & Tonalität', 'Wie wir sind und wie wir klingen.', [
              heading('Wäre der SV Rheinblick ein Mensch …'),
              text(
                p(
                  '… wäre er die Kapitänin, die nach dem Spiel als Letzte die Bälle einsammelt: verlässlich, herzlich, mit klarer Ansage, wenn es darauf ankommt.',
                ),
              ),
              dosDonts(
                [
                  { kind: 'do', title: 'Wir sagen', text: '„Was für ein Kampf! Danke für eure Stimmung, Rheinblick! 💙💛“' },
                  {
                    kind: 'dont',
                    title: 'Wir sagen nicht',
                    text: '„Hiermit informieren wir über das Spielergebnis der 1. Herren.“',
                  },
                  { kind: 'do', title: 'Du-Ansprache', text: 'Wir duzen auf allen Kanälen – außer in Verträgen.' },
                  { kind: 'dont', title: 'Häme', text: 'Wir machen uns nie über Gegner oder Schiedsrichter lustig.' },
                ],
                2,
              ),
            ]),
            page('Zielgruppen', 'Für wen wir da sind.', [
              heading('Personas'),
              cards(
                [
                  {
                    title: 'Lena, 34 – Jugendmama',
                    text: 'Bringt zwei Kinder zum Training, will verlässliche Infos per WhatsApp und Instagram.',
                  },
                  {
                    title: 'Karl, 67 – Ehrenmitglied',
                    text: 'Seit 50 Jahren dabei, liest die Vereinszeitung, kommt zu jedem Heimspiel.',
                  },
                  {
                    title: 'Deniz, 19 – Spieler 1. Herren',
                    text: 'Will Content für seinen eigenen Kanal und stolz das Trikot tragen.',
                  },
                ],
                3,
              ),
            ]),
          ]),
          chapter('Basiselemente', [
            page('Wappen', 'Das Rheinblick-Wappen und seine Varianten.', [
              heading('Das Wappen'),
              text(
                p(
                  'Das Wappen zeigt eine stilisierte Welle über dem Gründungsjahr. Die Welle steht für den Rhein und für die Bewegung des Sports.',
                ),
              ),
              logosBlock(),
              callout(
                'info',
                'Dateien',
                p('Alle Varianten liegen in der Bibliothek „Logos“ als SVG, PNG und PDF. Lade dort eure Dateien hoch.'),
              ),
              dosDonts(
                [
                  { kind: 'do', title: 'Auf Rheinblau oder Weiß', text: 'Immer mit Schutzzone in Wellenhöhe' },
                  { kind: 'dont', title: 'Nicht auf Flutlichtgelb', text: 'Zu wenig Kontrast, wirkt billig' },
                  { kind: 'dont', title: 'Nicht drehen oder verzerren', text: 'Das Wappen steht immer gerade' },
                  { kind: 'dont', title: 'Keine Effekte', text: 'Keine Schatten, Glanz oder 3D' },
                ],
                2,
              ),
            ]),
            page('Vereinsfarben', 'Blau, Weiß und ein Funken Flutlicht.', [
              heading('Vereinsfarben'),
              colorsBlock('cards'),
              subheading('Gewichtung'),
              text(p('Rheinblau trägt (60 %), Weiß schafft Ruhe (30 %), Flutlichtgelb setzt Akzente (max. 10 %).')),
              downloadKit(),
            ]),
            page('Typografie', 'Barlow Condensed und Inter.', [
              heading('Hausschriften'),
              typographyBlock('both'),
              callout(
                'tip',
                'Ersatzschrift',
                p('In Word, PowerPoint und E-Mails nutzt du <strong>Arial</strong>, wenn die Hausschriften fehlen.'),
              ),
            ]),
            page('Bildsprache', 'Nah dran, echt, mit Rhein im Hintergrund.', [
              heading('Bildstil'),
              text(
                p(
                  'Unsere Bilder sind nah am Geschehen: Schweiß, Jubel, Umarmungen. Wir zeigen echte Vereinsmitglieder, keine Models. Wo möglich, ist der Rhein oder das Flutlicht im Bild.',
                ),
              ),
              galleryBlock(),
              dosDonts([
                { kind: 'do', title: 'Emotion & Nähe', text: 'Gesichter, Gesten, Gemeinschaft' },
                { kind: 'dont', title: 'Leere Ränge', text: 'Keine Bilder, die den Verein kleiner wirken lassen' },
              ]),
            ]),
          ]),
          chapter('Anwendungen', [
            page('Trikot', 'Heim, Auswärts, Ausweich.', [
              heading('Trikotsatz'),
              table([
                ['Trikot', 'Grundfarbe', 'Akzent', 'Wappen'],
                ['Heim', 'Rheinblau', 'Weiß', 'Weiß, Brust links'],
                ['Auswärts', 'Gischtweiß', 'Rheinblau', 'Farbig, Brust links'],
                ['Ausweich', 'Nachtblau', 'Flutlichtgelb', 'Weiß, Brust links'],
              ]),
              galleryBlock(),
            ]),
            page('Spieltag', 'Grafiken rund ums Heimspiel.', [
              heading('Matchday-Grafiken'),
              text(p('Für jeden Spieltag gibt es vier Grafiken: Ankündigung, Aufstellung, Halbzeit, Endstand.')),
              galleryBlock(),
              checklist('Vor dem Posten prüfen', [
                'Richtiges Datum, Uhrzeit, Spielort',
                'Gegnerlogo nur mit Genehmigung',
                'Sponsor des Spieltags genannt',
                'Fotograf:in genannt',
              ]),
            ]),
            page('Social Media', 'Instagram, TikTok, WhatsApp-Kanal.', [
              heading('Kanäle'),
              table([
                ['Kanal', 'Rolle', 'Zielgruppe', 'Frequenz'],
                ['Instagram', 'Schaufenster & Spieltag', 'Fans, Spieler:innen', '4–5 × pro Woche'],
                ['TikTok', 'Behind the Scenes, Humor', 'Jugend', '2 × pro Woche'],
                ['WhatsApp-Kanal', 'Service & Termine', 'Eltern, Mitglieder', 'bei Bedarf'],
              ]),
              accordion([
                { title: 'Wer darf posten?', html: p('Die Social-Media-AG und benannte Abteilungsverantwortliche.') },
                {
                  title: 'Wie reagieren wir auf negative Kommentare?',
                  html: p('Sachlich, freundlich, nie öffentlich streiten. Beleidigungen werden gelöscht.'),
                },
              ]),
            ]),
          ]),
          chapter('Service', [
            page('Downloads', 'Alles zum Herunterladen.', [
              heading('Downloads'),
              assetsBlock('Logo-Paket', 'Wappen in allen Varianten'),
              assetsBlock('Vorlagen', 'Matchday-Templates, Briefbogen, Präsentation'),
              downloadKit(),
            ]),
            page('Kontakt', 'Wir helfen dir weiter.', [
              heading('Ansprechpartner:innen'),
              cards(
                [
                  { title: 'Markenverantwortung', text: 'Geschäftsstelle · marke@sv-rheinblick.example' },
                  { title: 'Presse', text: 'Pressewart · presse@sv-rheinblick.example' },
                  { title: 'Social Media', text: 'Social-Media-AG · social@sv-rheinblick.example' },
                ],
                3,
                'outline',
              ),
              callout('info', 'Hinweis', p('Der SV Rheinblick 1921 e.V. ist ein fiktiver Verein für Lehrzwecke.')),
              text(ul(['Alle Namen, Adressen und Daten sind erfunden.'])),
            ]),
          ]),
        ],
      },
    ],
  },
}
