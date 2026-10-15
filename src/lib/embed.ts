export interface EmbedInfo {
  provider: string
  src: string
  /** Seitenverhältnis (Breite/Höhe), falls fest */
  ratio?: number
}

function safeUrl(input: string): URL | null {
  try {
    const url = new URL(input.trim())
    return url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

/** Wandelt Video-Links (YouTube, Vimeo) in datenschutzfreundliche Embed-URLs um. */
export function videoEmbed(input: string): EmbedInfo | null {
  const url = safeUrl(input)
  if (!url) return null
  const host = url.hostname.replace(/^www\./, '')
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    const id = url.searchParams.get('v') ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{6,})/)?.[1]
    if (id) return { provider: 'YouTube', src: `https://www.youtube-nocookie.com/embed/${id}`, ratio: 16 / 9 }
  }
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0]
    if (id) return { provider: 'YouTube', src: `https://www.youtube-nocookie.com/embed/${id}`, ratio: 16 / 9 }
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = url.pathname.match(/(\d{5,})/)?.[1]
    if (id) return { provider: 'Vimeo', src: `https://player.vimeo.com/video/${id}?dnt=1`, ratio: 16 / 9 }
  }
  return null
}

/** Unterstützte Dienste für den Einbettungs-Baustein. */
export function genericEmbed(input: string): EmbedInfo | null {
  const video = videoEmbed(input)
  if (video) return video
  const url = safeUrl(input)
  if (!url) return null
  const host = url.hostname.replace(/^www\./, '')
  if (host.endsWith('figma.com')) {
    if (url.pathname.startsWith('/embed')) return { provider: 'Figma', src: url.toString() }
    return {
      provider: 'Figma',
      src: `https://www.figma.com/embed?embed_host=brandbench&url=${encodeURIComponent(url.toString())}`,
    }
  }
  if (host.endsWith('canva.com')) {
    const base = url
      .toString()
      .split('?')[0]
      .replace(/\/(edit|view)\/?$/, '/view')
    return { provider: 'Canva', src: `${base.endsWith('/view') ? base : `${base}/view`}?embed` }
  }
  if (host === 'miro.com') {
    const id = url.pathname.match(/\/app\/(?:board|live-embed)\/([^/]+)/)?.[1]
    if (id) return { provider: 'Miro', src: `https://miro.com/app/live-embed/${id}/` }
  }
  if (host === 'docs.google.com') {
    const src = url.toString().replace(/\/(edit|view)(\?.*)?(#.*)?$/, '/embed')
    return { provider: 'Google', src }
  }
  if (host === 'open.spotify.com') {
    return {
      provider: 'Spotify',
      src: `https://open.spotify.com/embed${url.pathname.replace(/^\/embed/, '')}`,
    }
  }
  if (host === 'soundcloud.com') {
    return {
      provider: 'SoundCloud',
      src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.toString())}&visual=true`,
    }
  }
  return { provider: host, src: url.toString() }
}
