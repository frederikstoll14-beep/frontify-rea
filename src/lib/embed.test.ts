import { describe, expect, it } from 'vitest'
import { genericEmbed, videoEmbed } from './embed'

describe('embed', () => {
  it('erkennt YouTube-Links und nutzt youtube-nocookie', () => {
    expect(videoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.src).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    )
    expect(videoEmbed('https://youtu.be/dQw4w9WgXcQ')?.src).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    )
    expect(videoEmbed('https://www.youtube.com/shorts/abcdefgh')?.src).toContain('/embed/abcdefgh')
  })

  it('erkennt Vimeo-Links mit Do-Not-Track', () => {
    expect(videoEmbed('https://vimeo.com/123456789')?.src).toBe(
      'https://player.vimeo.com/video/123456789?dnt=1',
    )
  })

  it('lehnt unsichere oder ungültige Links ab', () => {
    expect(genericEmbed('http://example.com')).toBeNull()
    expect(genericEmbed('javascript:alert(1)')).toBeNull()
    expect(genericEmbed('kein link')).toBeNull()
  })

  it('wandelt Figma, Canva, Miro und Google-Links um', () => {
    expect(genericEmbed('https://www.figma.com/file/abc/Design')?.src).toContain('figma.com/embed?')
    expect(genericEmbed('https://www.canva.com/design/DAF123/edit')?.src).toBe(
      'https://www.canva.com/design/DAF123/view?embed',
    )
    expect(genericEmbed('https://miro.com/app/board/uXjVabc=/')?.src).toBe(
      'https://miro.com/app/live-embed/uXjVabc=/',
    )
    expect(genericEmbed('https://docs.google.com/presentation/d/xyz/edit')?.src).toBe(
      'https://docs.google.com/presentation/d/xyz/embed',
    )
  })
})
