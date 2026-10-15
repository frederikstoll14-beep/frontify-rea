import {
  accordion,
  assetsBlock,
  callout,
  cards,
  chapter,
  checklist,
  colorsBlock,
  divider,
  dosDonts,
  downloadKit,
  galleryBlock,
  heading,
  imageBlock,
  logosBlock,
  note,
  p,
  page,
  quote,
  table,
  task,
  text,
  typographyBlock,
  ul,
} from './builders'
import type { TemplateChapter, TemplateLibrary, TemplatePage } from './types'

/**
 * Wiederverwendbare Kapitel einer Brand Identity.
 * Die Leitfragen orientieren sich an etablierten Modellen der Markenführung
 * (identitätsbasierte Markenführung nach Burmann/Meffert, Markensteuerrad nach Esch).
 */

export interface Wording {
  /** "der Verein", "das Unternehmen", "der Verband" */
  subject: string
  /** "den Verein", "das Unternehmen", "den Verband" */
  accusative: string
  /** "Vereins", "Unternehmens", "Verbands" */
  genitive: string
  /** Mitglieder, Kund:innen, Mitgliedsvereine … */
  audience: string
  /** Wappen / Logo */
  logoName: string
}

export function introChapter(w: Wording): TemplateChapter {
  return chapter('Einführung', [
    page('Willkommen', `Wofür dieses Markenhandbuch da ist und wie du es nutzt.`, [
      heading('Über dieses Markenhandbuch'),
      text(
        p(
          `Dieses Markenhandbuch bündelt alles, was die Marke ausmacht: von der Haltung und den Werten bis zu Logo, Farben, Schrift, Bildsprache und konkreten Anwendungen. Es ist die gemeinsame Referenz für alle, die für ${w.accusative} kommunizieren: intern, mit Agenturen, Partnern und Medien.`,
          'Nutze die Navigation links, um durch die Kapitel zu springen. Logos, Bilder und Vorlagen findest du in den Bibliotheken oben.',
        ),
      ),
      task(
        ul([
          'Für wen ist dieses Handbuch gedacht (Ehrenamt, Geschäftsstelle, Agentur, Medien)?',
          'Wer ist Ansprechpartner:in für Fragen zur Marke?',
          'Welche Kapitel sind verbindlich, welche Empfehlung?',
        ]),
      ),
      cards(
        [
          { title: 'Markenkern', text: 'Wer wir sind, wofür wir stehen und wohin wir wollen.' },
          { title: 'Basiselemente', text: `${w.logoName}, Farben, Typografie und Bildsprache.` },
          { title: 'Anwendungen', text: 'So sieht die Marke im Alltag aus: digital, gedruckt, vor Ort.' },
        ],
        3,
      ),
    ]),
    page('Marke auf einen Blick', 'Die wichtigsten Fakten zur Marke auf einer Seite.', [
      quote('Hier steht euer Markenclaim.', `Claim des ${w.genitive}`),
      cards(
        [
          { title: 'Gegründet', text: 'Jahr, Ort, Gründungsgeschichte in einem Satz' },
          { title: 'Mission', text: 'Was wir jeden Tag tun' },
          { title: 'Vision', text: 'Wohin wir wollen' },
          { title: 'Werte', text: 'Drei bis fünf Werte' },
        ],
        4,
        'outline',
      ),
      colorsBlock('strip'),
      note(
        p(
          'Diese Seite ist der „Elevator Pitch“ der Marke. Am Ende des Projekts sollte sie ohne weitere Erklärung verständlich sein.',
        ),
      ),
    ]),
  ])
}

export function coreChapter(w: Wording): TemplateChapter {
  return chapter('Markenkern', [
    page('Markenherkunft', 'Woher kommt die Marke? Geschichte, Wurzeln, Region.', [
      heading('Unsere Geschichte'),
      text(p('Beschreibe hier die Geschichte und Herkunft der Marke.')),
      task(
        ul([
          `Wann, wo und warum wurde ${w.subject} gegründet?`,
          'Welche Meilensteine, Erfolge oder Krisen prägen die Identität bis heute?',
          'Welche regionale, kulturelle oder soziale Verankerung gibt es?',
          'Welche Traditionen, Rituale oder Mythen sind Teil der Marke?',
        ]),
      ),
      table([
        ['Jahr', 'Ereignis', 'Bedeutung für die Marke'],
        ['', '', ''],
        ['', '', ''],
      ]),
    ]),
    page('Vision & Mission', 'Wofür wir stehen und wohin wir wollen.', [
      heading('Vision', 'Wohin wir wollen'),
      quote('Eure Vision in einem Satz.'),
      heading('Mission', 'Was wir jeden Tag tun'),
      text(p('Beschreibe die Mission: Was leistet die Marke für wen, und warum?')),
      task(
        ul([
          'Vision: langfristig, inspirierend, in 5–10 Jahren. Wie sieht die Welt aus, wenn wir erfolgreich sind?',
          'Mission: konkret, gegenwärtig. Was tun wir, für wen und wie?',
          'Purpose: Warum gibt es uns über Erfolg oder Umsatz hinaus?',
        ]),
      ),
    ]),
    page('Werte', 'Die Werte, die unser Handeln leiten.', [
      heading('Unsere Werte'),
      cards(
        [
          { title: 'Wert 1', text: 'Was bedeutet dieser Wert konkret? Woran merkt man ihn?' },
          { title: 'Wert 2', text: 'Was bedeutet dieser Wert konkret? Woran merkt man ihn?' },
          { title: 'Wert 3', text: 'Was bedeutet dieser Wert konkret? Woran merkt man ihn?' },
        ],
        3,
      ),
      task(
        ul([
          'Drei bis fünf Werte sind besser als zehn.',
          'Jeder Wert braucht ein Beispiel aus dem Alltag („Das heißt für uns …“).',
          'Grenzen sie euch vom Wettbewerb ab, oder sagt sie jede Marke („Leidenschaft“)?',
        ]),
      ),
    ]),
    page('Markenpersönlichkeit', 'Wäre die Marke ein Mensch – wie wäre sie?', [
      heading('Persönlichkeit'),
      text(
        p(
          'Beschreibe die Marke als Person: Charakter, Auftreten, Sprache. Als Orientierung dienen z. B. die Dimensionen nach Aaker (Aufrichtigkeit, Erregung/Spannung, Kompetenz, Kultiviertheit, Robustheit).',
        ),
      ),
      cards(
        [
          { title: 'Wir sind …', text: 'z. B. bodenständig' },
          { title: 'Wir sind …', text: 'z. B. mutig' },
          { title: 'Wir sind …', text: 'z. B. nahbar' },
          { title: 'Wir sind …', text: 'z. B. ehrgeizig' },
        ],
        4,
        'outline',
      ),
      dosDonts([
        { kind: 'do', title: 'Das sind wir', text: 'selbstbewusst, aber nicht arrogant' },
        { kind: 'dont', title: 'Das sind wir nicht', text: 'laut um jeden Preis' },
      ]),
    ]),
    page('Positionierung', 'Wofür wir in den Köpfen unserer Zielgruppen stehen wollen.', [
      heading('Positionierung'),
      quote(
        'Für [Zielgruppe] ist [Markenname] die/der/das [Kategorie], die/der [Nutzen bietet], weil [Beleg].',
      ),
      text(p('Formuliert eure Positionierung und begründet sie.')),
      heading('Wettbewerbsumfeld'),
      table([
        ['Wettbewerber', 'Positionierung', 'Stärken', 'Abgrenzung von uns'],
        ['', '', '', ''],
        ['', '', '', ''],
      ]),
      task(
        ul([
          'Was ist das eine, wofür wir bekannt sein wollen?',
          'Welche Belege (Reason Why) stützen die Positionierung?',
          'Wo liegt der freie Raum im Wettbewerbsumfeld?',
        ]),
      ),
    ]),
    page('Zielgruppen & Stakeholder', `Für wen wir kommunizieren: ${w.audience}, Partner, Öffentlichkeit.`, [
      heading('Zielgruppen'),
      cards(
        [
          { title: 'Persona 1', text: 'Name, Alter, Situation, Bedürfnisse, Mediennutzung' },
          { title: 'Persona 2', text: 'Name, Alter, Situation, Bedürfnisse, Mediennutzung' },
          { title: 'Persona 3', text: 'Name, Alter, Situation, Bedürfnisse, Mediennutzung' },
        ],
        3,
      ),
      heading('Stakeholder-Übersicht'),
      table([
        ['Stakeholder', 'Erwartung an uns', 'Kanäle', 'Priorität'],
        [w.audience, '', '', 'hoch'],
        ['Sponsoren & Partner', '', '', ''],
        ['Medien', '', '', ''],
        ['Öffentlichkeit / Region', '', '', ''],
      ]),
    ]),
    page('Markensteuerrad', 'Die Marke in vier Dimensionen (nach Esch).', [
      heading('Markensteuerrad'),
      text(
        p(
          'Das Markensteuerrad fasst die Identität zusammen. Links stehen die rationalen Aspekte (Hard Facts), rechts die emotionalen (Soft Facts). Im Zentrum steht die Markenkompetenz.',
        ),
      ),
      cards(
        [
          { title: 'Markenkompetenz – Wer bin ich?', text: 'Herkunft, Rolle, zentrale Kompetenz' },
          { title: 'Markennutzen – Was biete ich an?', text: 'Funktionaler und emotionaler Nutzen' },
          { title: 'Markenattribute – Über welche Eigenschaften verfüge ich?', text: 'Fakten, Leistungen' },
          { title: 'Markentonalität – Wie bin ich?', text: 'Persönlichkeit, Gefühle, Erlebnisse' },
          { title: 'Markenbild – Wie trete ich auf?', text: 'Visuelle und auditive Erscheinung' },
        ],
        2,
        'outline',
      ),
    ]),
  ])
}

export function logoChapter(w: Wording): TemplateChapter {
  return chapter(w.logoName, [
    page(`${w.logoName}-Varianten`, `Das ${w.logoName} und seine Varianten.`, [
      heading(`Unser ${w.logoName}`),
      text(p(`Beschreibe Aufbau und Bedeutung des ${w.logoName}s: Symbolik, Formen, Farben, Geschichte.`)),
      logosBlock(),
      task(
        ul([
          'Welche Varianten gibt es (Hauptlogo, Bildmarke, Wortmarke, einfarbig, negativ)?',
          'Wann wird welche Variante eingesetzt?',
          'Lade die Dateien in die Logo-Bibliothek und verknüpfe sie hier.',
        ]),
      ),
    ]),
    page('Schutzzone & Mindestgröße', 'Damit das Logo immer gut zur Geltung kommt.', [
      heading('Schutzzone'),
      imageBlock('Schutzzone: Der Freiraum entspricht der Höhe von …'),
      heading('Mindestgröße'),
      table([
        ['Variante', 'Print (mm)', 'Digital (px)'],
        ['Hauptlogo', '', ''],
        ['Bildmarke', '', ''],
      ]),
    ]),
    page('Richtige Anwendung', 'Do’s und Don’ts im Umgang mit dem Logo.', [
      heading('Do’s & Don’ts'),
      dosDonts(
        [
          {
            kind: 'do',
            title: 'Auf ruhigem Hintergrund',
            text: 'Ausreichend Kontrast, Schutzzone einhalten',
          },
          { kind: 'dont', title: 'Nicht verzerren', text: 'Proportionen niemals verändern' },
          { kind: 'dont', title: 'Keine fremden Farben', text: 'Nur freigegebene Farbvarianten nutzen' },
          { kind: 'dont', title: 'Keine Effekte', text: 'Keine Schatten, Verläufe oder Konturen' },
        ],
        2,
      ),
    ]),
  ])
}

export function colorChapter(): TemplateChapter {
  return chapter('Farben', [
    page('Farbpalette', 'Unsere Farben mit allen Werten für Print und Digital.', [
      heading('Farbpalette'),
      text(
        p(
          'Die Farben werden zentral unter „Markenbasis → Farben“ gepflegt und erscheinen automatisch überall dort, wo sie eingebunden sind.',
        ),
      ),
      colorsBlock('cards'),
      task(
        ul([
          'Welche Farben sind Primärfarben, welche Sekundär- und Akzentfarben?',
          'Hinterlege für jede Farbe HEX/RGB (digital), CMYK/Pantone bzw. HKS (Print) und ggf. RAL (Beschilderung, Textil).',
          'Achte auf ausreichende Kontraste für Barrierefreiheit (WCAG).',
        ]),
      ),
      downloadKit(),
    ]),
    page('Farbanwendung', 'Wie die Farben im Verhältnis zueinander eingesetzt werden.', [
      heading('Gewichtung'),
      text(p('Beschreibe das Mengenverhältnis der Farben (z. B. 60 % Primärfarbe, 30 % Weiß, 10 % Akzent).')),
      imageBlock('Beispiel für die Farbverteilung'),
      dosDonts([
        { kind: 'do', title: 'Klare Hierarchie', text: 'Primärfarbe trägt, Akzentfarbe setzt Highlights' },
        {
          kind: 'dont',
          title: 'Zu viele Farben',
          text: 'Nicht alle Farben gleichzeitig gleich stark einsetzen',
        },
      ]),
    ]),
  ])
}

export function typographyChapter(): TemplateChapter {
  return chapter('Typografie', [
    page('Schriften', 'Unsere Hausschriften.', [
      heading('Hausschriften'),
      typographyBlock('fonts'),
      task(
        ul([
          'Welche Schrift für Headlines, welche für Fließtext?',
          'Ist die Schrift frei verfügbar (z. B. Google Fonts) oder lizenzpflichtig?',
          'Welche Ersatzschrift gilt für Office-Anwendungen (z. B. Arial)?',
        ]),
      ),
    ]),
    page('Textstile', 'Hierarchie und Satzregeln.', [
      heading('Textstile & Hierarchie'),
      typographyBlock('styles'),
      callout(
        'info',
        'Satzregeln',
        ul(['Flattersatz linksbündig', 'Keine Versalien in Fließtexten', 'Zeilenlänge max. 70 Zeichen']),
      ),
    ]),
  ])
}

export function imageryChapter(sporty: boolean): TemplateChapter {
  return chapter('Bildsprache', [
    page('Fotografie', 'Wie unsere Bilder aussehen und wirken.', [
      heading('Bildstil'),
      text(p('Beschreibe den Bildstil: Motive, Perspektiven, Licht, Farbstimmung, Bildbearbeitung.')),
      galleryBlock(),
      dosDonts([
        {
          kind: 'do',
          title: sporty ? 'Echte Emotionen' : 'Authentische Momente',
          text: sporty
            ? 'Jubel, Einsatz, Gemeinschaft, Nähe zum Geschehen'
            : 'Echte Menschen in echten Situationen',
        },
        { kind: 'dont', title: 'Gestellte Stockfotos', text: 'Austauschbare, sterile Motive vermeiden' },
      ]),
      task(
        ul([
          'Welche Motivwelten gibt es (z. B. Action, Porträt, Fans, Detail, Umfeld)?',
          'Wie werden Bilder bearbeitet (Kontrast, Farbstimmung, Filter)?',
          'Welche Bildrechte gelten, und wie werden Fotograf:innen genannt?',
        ]),
      ),
    ]),
    page('Grafische Elemente', 'Formen, Muster, Icons und Gestaltungsraster.', [
      heading('Grafische Elemente'),
      text(p('Beschreibe wiederkehrende Gestaltungselemente: Formen, Linien, Muster, Texturen, Icons.')),
      galleryBlock(),
      heading('Icons'),
      assetsBlock('Icon-Set', 'Alle Icons im einheitlichen Stil'),
    ]),
  ])
}

export function voiceChapter(w: Wording): TemplateChapter {
  return chapter('Sprache & Tonalität', [
    page('Tonalität', 'Wie wir klingen.', [
      heading('So klingen wir'),
      text(p('Beschreibe die Tonalität der Marke in drei bis vier Eigenschaften.')),
      dosDonts(
        [
          { kind: 'do', title: 'Wir sagen', text: '„Gemeinsam schaffen wir das.“' },
          { kind: 'dont', title: 'Wir sagen nicht', text: '„Es wird hiermit mitgeteilt, dass …“' },
          { kind: 'do', title: 'Wir sagen', text: 'Beispiel für einen typischen Social-Media-Post' },
          { kind: 'dont', title: 'Wir sagen nicht', text: 'Beispiel, wie es nicht klingen soll' },
        ],
        2,
      ),
      task(
        ul([
          'Duzen oder Siezen? Gilt das für alle Kanäle?',
          'Wie gendern wir?',
          `Wie sprechen wir ${w.audience} an, wie Partner und Medien?`,
        ]),
      ),
    ]),
    page('Wording & Schreibweisen', 'Begriffe, Namen, Schreibweisen.', [
      heading('Schreibweisen'),
      table([
        ['Richtig', 'Falsch', 'Hinweis'],
        ['', '', ''],
        ['', '', ''],
      ]),
      heading('Glossar'),
      accordion([
        { title: 'Begriff 1', html: p('Erklärung') },
        { title: 'Begriff 2', html: p('Erklärung') },
      ]),
    ]),
  ])
}

export function applicationPage(title: string, intro: string, questions: string[]): TemplatePage {
  return page(title, intro, [
    heading(title),
    text(p('Beschreibe, wie die Marke hier eingesetzt wird.')),
    galleryBlock(),
    task(ul(questions)),
  ])
}

export function contactChapter(): TemplateChapter {
  return chapter('Service', [
    page('Downloads', 'Alle wichtigen Dateien auf einen Blick.', [
      heading('Downloads'),
      assetsBlock('Logo-Paket', 'Alle Logo-Varianten in den gängigen Formaten'),
      assetsBlock('Vorlagen', 'Präsentationen, Social-Media-Templates, Briefbogen'),
      downloadKit(),
    ]),
    page('Kontakt', 'Wer bei Fragen zur Marke hilft.', [
      heading('Ansprechpartner:innen'),
      cards(
        [
          { title: 'Markenverantwortung', text: 'Name, Funktion, E-Mail' },
          { title: 'Presse & Medien', text: 'Name, Funktion, E-Mail' },
          { title: 'Freigaben', text: 'Wer gibt Anwendungen frei?' },
        ],
        3,
        'outline',
      ),
      divider(),
      checklist('Vor jeder Veröffentlichung prüfen', [
        'Richtige Logo-Variante und Schutzzone',
        'Nur Farben aus der Markenpalette',
        'Hausschriften verwendet',
        'Bildrechte geklärt',
        'Tonalität passt',
      ]),
    ]),
  ])
}

export const DEFAULT_LIBRARIES: TemplateLibrary[] = [
  { name: 'Logos', kind: 'logos', slug: 'logos', description: 'Alle Logo-Varianten in allen Formaten' },
  { name: 'Bildwelt', kind: 'media', slug: 'bildwelt', description: 'Fotos und Key Visuals' },
  {
    name: 'Icons & Grafiken',
    kind: 'icons',
    slug: 'icons',
    description: 'Icons, Muster, grafische Elemente',
  },
  {
    name: 'Vorlagen',
    kind: 'templates',
    slug: 'vorlagen',
    description: 'Social Media, Präsentationen, Print',
  },
  { name: 'Dokumente', kind: 'documents', slug: 'dokumente', description: 'Präsentationen, PDFs, Briefings' },
  {
    name: 'Audio & Video',
    kind: 'audio_video',
    slug: 'audio-video',
    description: 'Sound-Logo, Clips, Trailer',
  },
]

export const DEFAULT_TEXT_STYLES = (heading: string, body: string) => [
  {
    name: 'Display',
    token: 'display',
    fontFamily: heading,
    fontWeight: 700,
    fontSize: 64,
    lineHeight: 1.0,
    sample: 'Display',
  },
  { name: 'Headline 1', token: 'h1', fontFamily: heading, fontWeight: 700, fontSize: 40, lineHeight: 1.1 },
  { name: 'Headline 2', token: 'h2', fontFamily: heading, fontWeight: 600, fontSize: 28, lineHeight: 1.2 },
  { name: 'Headline 3', token: 'h3', fontFamily: heading, fontWeight: 600, fontSize: 20, lineHeight: 1.3 },
  { name: 'Fließtext', token: 'body', fontFamily: body, fontWeight: 400, fontSize: 16, lineHeight: 1.6 },
  {
    name: 'Bildunterschrift',
    token: 'caption',
    fontFamily: body,
    fontWeight: 400,
    fontSize: 13,
    lineHeight: 1.4,
  },
]
