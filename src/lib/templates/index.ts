import {
  applicationPage,
  colorChapter,
  contactChapter,
  coreChapter,
  DEFAULT_LIBRARIES,
  DEFAULT_TEXT_STYLES,
  imageryChapter,
  introChapter,
  logoChapter,
  typographyChapter,
  voiceChapter,
  type Wording,
} from './chapters'
import { chapter, heading, p, page, task, text, ul } from './builders'
import { demoTemplate } from './demo'
import type { BrandTemplate, BrandTemplateData, TemplateChapter } from './types'

function fullTemplate(w: Wording, applications: TemplateChapter, extra: Partial<BrandTemplateData>): BrandTemplateData {
  return {
    theme: { primary: '#15171F', accent: '#D9481F', headingFont: 'Barlow Condensed', bodyFont: 'Inter', heroStyle: 'brand' },
    home: {
      welcome: `Willkommen im Markenportal. Hier findest du alles zur Marke: Markenkern, Gestaltungsregeln, Logos, Bilder und Vorlagen.`,
      quickLinks: [],
      showColors: true,
      showLibraries: true,
    },
    palettes: [
      {
        name: 'Primärfarben',
        description: 'Die Hauptfarben der Marke',
        colors: [
          { name: 'Primärfarbe', hex: '#15171F', token: 'primary', usage: 'ca. 60 % – Flächen, Headlines' },
          { name: 'Akzentfarbe', hex: '#D9481F', token: 'accent', usage: 'ca. 10 % – Highlights, Buttons' },
          { name: 'Weiß', hex: '#FFFFFF', token: 'white', cmyk: '0/0/0/0', usage: 'ca. 30 % – Hintergründe' },
        ],
      },
      {
        name: 'Sekundärfarben',
        description: 'Ergänzende Farben für Grafiken und Infografiken',
        colors: [
          { name: 'Hellgrau', hex: '#EFEDE7', token: 'gray-light' },
          { name: 'Mittelgrau', hex: '#8C8F99', token: 'gray' },
        ],
      },
    ],
    fonts: [
      {
        family: 'Barlow Condensed',
        source: 'google',
        role: 'Headline',
        weights: [500, 600, 700],
        fallback: 'Arial Narrow, sans-serif',
        license: 'SIL Open Font License',
      },
      {
        family: 'Inter',
        source: 'google',
        role: 'Text',
        weights: [400, 500, 600, 700],
        fallback: 'Arial, sans-serif',
        license: 'SIL Open Font License',
      },
    ],
    textStyles: DEFAULT_TEXT_STYLES('Barlow Condensed', 'Inter'),
    libraries: DEFAULT_LIBRARIES,
    guidelines: [
      {
        title: 'Markenhandbuch',
        slug: 'markenhandbuch',
        description: 'Markenkern, Gestaltungsregeln und Anwendungen',
        icon: 'book-open',
        items: [
          introChapter(w),
          coreChapter(w),
          logoChapter(w),
          colorChapter(),
          typographyChapter(),
          imageryChapter(true),
          voiceChapter(w),
          applications,
          contactChapter(),
        ],
      },
    ],
    ...extra,
  }
}

const vereinWording: Wording = {
  subject: 'der Verein',
  accusative: 'den Verein',
  genitive: 'Vereins',
  audience: 'Mitglieder & Fans',
  logoName: 'Wappen',
}

const unternehmenWording: Wording = {
  subject: 'das Unternehmen',
  accusative: 'das Unternehmen',
  genitive: 'Unternehmens',
  audience: 'Kund:innen',
  logoName: 'Logo',
}

const verbandWording: Wording = {
  subject: 'der Verband',
  accusative: 'den Verband',
  genitive: 'Verbands',
  audience: 'Mitgliedsvereine',
  logoName: 'Logo',
}

const organisationWording: Wording = {
  subject: 'die Organisation',
  accusative: 'die Organisation',
  genitive: 'Organisation',
  audience: 'Zielgruppen',
  logoName: 'Logo',
}

export const TEMPLATES: BrandTemplate[] = [
  {
    id: 'verein',
    name: 'Sportverein',
    description: 'Wappen, Vereinsfarben, Trikot, Spieltag, Stadion, Sponsoren, Social Media, Merch',
    orgType: 'verein',
    data: fullTemplate(
      vereinWording,
      chapter('Anwendungen', [
        applicationPage('Trikot & Teamwear', 'Heim-, Auswärts- und Ausweichtrikot, Trainingskleidung.', [
          'Wie sind Heim-, Auswärts- und Ausweichtrikot gestaltet?',
          'Wo sitzen Wappen, Sponsor, Rückennummer und Name? Welche Schrift gilt für Nummern?',
          'Welche Vorgaben macht der Verband (z. B. Ärmelbadge, Werbeflächen)?',
        ]),
        applicationPage('Spieltag & Stadion', 'Matchday-Grafiken, Stadion-Signage, Anzeigetafel, Durchsagen.', [
          'Welche Grafiken braucht ein Spieltag (Ankündigung, Aufstellung, Halbzeit, Ergebnis)?',
          'Wie sieht die Beschilderung im Stadion/in der Halle aus?',
          'Welche Rituale und Sounds (Einlaufmusik, Torhymne) gehören dazu?',
        ]),
        applicationPage('Social Media', 'Instagram, TikTok, YouTube, WhatsApp-Kanal.', [
          'Welche Kanäle mit welcher Rolle und Zielgruppe?',
          'Welche Formate (Reels, Storys, Karussells) und welche Templates?',
          'Wie gehen wir mit Kommentaren und Krisen um?',
        ]),
        applicationPage('Merchandise & Fanartikel', 'Schal, Mütze, Fanshop, Kollektionen.', [
          'Welche Produkte gibt es, und wie wird die Marke darauf eingesetzt?',
          'Gibt es Sonderkollektionen (Jubiläum, Retro)?',
        ]),
        applicationPage('Sponsoring & Partner', 'Logo-Kombinationen, Partnerwände, Sponsorenpakete.', [
          'Wie wird das Vereinslogo mit Partnerlogos kombiniert?',
          'Welche Werbeflächen und Pakete gibt es?',
        ]),
        applicationPage('Print & Geschäftsausstattung', 'Briefbogen, Visitenkarten, Mitgliedsausweis, Plakate.', [
          'Welche Druckerzeugnisse braucht der Verein?',
          'Welche Vorlagen stehen zum Download bereit?',
        ]),
      ]),
      {},
    ),
  },
  {
    id: 'unternehmen',
    name: 'Unternehmen / Sportmarke',
    description: 'Logo, Farben, Typografie, Produkt, Website, Social Media, Geschäftsausstattung',
    orgType: 'unternehmen',
    data: fullTemplate(
      unternehmenWording,
      chapter('Anwendungen', [
        applicationPage('Produkt & Packaging', 'Wie die Marke auf Produkten und Verpackungen erscheint.', [
          'Welche Produktlinien gibt es, und wie unterscheiden sie sich visuell?',
          'Welche Pflichtangaben und Platzierungsregeln gelten?',
        ]),
        applicationPage('Website & Digital', 'Website, App, Newsletter.', [
          'Welche UI-Elemente (Buttons, Formulare) gibt es?',
          'Wie werden Farben und Schriften digital eingesetzt?',
        ]),
        applicationPage('Social Media', 'Kanäle, Formate, Templates.', [
          'Welche Kanäle mit welcher Rolle?',
          'Welche Formate und Content-Säulen?',
        ]),
        applicationPage('Präsentationen', 'Präsentationsvorlagen und Folienregeln.', [
          'Welche Folientypen gibt es?',
          'Wie werden Diagramme und Tabellen gestaltet?',
        ]),
        applicationPage('Geschäftsausstattung', 'Briefbogen, Visitenkarten, E-Mail-Signatur.', [
          'Welche Elemente gibt es, und wo liegen die Vorlagen?',
        ]),
        applicationPage('Events & Messe', 'Stand, Roll-ups, Give-aways.', ['Wie tritt die Marke bei Events auf?']),
      ]),
      {},
    ),
  },
  {
    id: 'verband',
    name: 'Verband / Liga',
    description: 'Dachmarke, Wettbewerbe, Mitgliedsvereine, Kampagnen, Medien',
    orgType: 'verband',
    data: fullTemplate(
      verbandWording,
      chapter('Anwendungen', [
        applicationPage('Markenarchitektur', 'Dachmarke, Wettbewerbe, Programme, Kampagnen.', [
          'Wie verhalten sich Dachmarke, Wettbewerbsmarken und Kampagnen zueinander?',
          'Branded House oder House of Brands?',
          'Wie treten Mitgliedsvereine gemeinsam mit dem Verband auf?',
        ]),
        applicationPage('Wettbewerbe & Events', 'Meisterschaften, Pokal, Finals, Siegerehrungen.', [
          'Welche Wettbewerbe haben eigene Logos?',
          'Wie sehen Bühne, Pokal, Medaillen und Interviewwände aus?',
        ]),
        applicationPage('Kampagnen', 'Mitgliedergewinnung, Ehrenamt, Fair Play, Nachwuchs.', [
          'Welche Kampagnen gibt es, und wie hängen sie mit der Dachmarke zusammen?',
        ]),
        applicationPage('Social Media & Medien', 'Kanäle, Pressearbeit, Akkreditierung.', [
          'Welche Kanäle betreibt der Verband?',
          'Wie arbeiten wir mit Medien und Rechteinhabern?',
        ]),
        applicationPage('Print & Geschäftsausstattung', 'Briefbogen, Urkunden, Ausweise, Plakate.', [
          'Welche Vorlagen brauchen Verband und Mitgliedsvereine?',
        ]),
      ]),
      {},
    ),
  },
  {
    id: 'organisation',
    name: 'Organisation / Initiative',
    description: 'Allgemeine Struktur für Stiftungen, Initiativen, Events oder Personenmarken',
    orgType: 'organisation',
    data: fullTemplate(
      organisationWording,
      chapter('Anwendungen', [
        applicationPage('Digital', 'Website, Social Media, Newsletter.', ['Welche digitalen Kanäle gibt es?']),
        applicationPage('Print', 'Flyer, Plakate, Geschäftsausstattung.', ['Welche Druckerzeugnisse gibt es?']),
        applicationPage('Events', 'Veranstaltungen und Auftritte.', ['Wie tritt die Marke bei Events auf?']),
      ]),
      {},
    ),
  },
  {
    id: 'leer',
    name: 'Leer starten',
    description: 'Nur das Grundgerüst: ein Markenhandbuch mit Startseite und Standard-Bibliotheken',
    orgType: 'organisation',
    data: {
      theme: { primary: '#15171F', accent: '#D9481F', headingFont: 'Fraunces', bodyFont: 'Inter', heroStyle: 'brand' },
      home: { welcome: 'Willkommen im Markenportal.', showColors: true, showLibraries: true },
      libraries: DEFAULT_LIBRARIES,
      guidelines: [
        {
          title: 'Markenhandbuch',
          slug: 'markenhandbuch',
          icon: 'book-open',
          items: [
            page('Start', 'Erste Seite des Markenhandbuchs.', [
              heading('Willkommen'),
              text(p('Lege los: Klicke auf „Bearbeiten“ und füge mit „+“ Bausteine hinzu.')),
              task(ul(['Lege links neue Kapitel und Seiten an.', 'Pflege Farben und Schriften unter „Markenbasis“.'])),
            ]),
          ],
        },
      ],
    },
  },
  demoTemplate,
]

export function getTemplate(id: string): BrandTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id)
}

export type { BrandTemplate, BrandTemplateData } from './types'
