import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import FeedbackWidget from '@/components/FeedbackWidget'

describe('feedback widget', () => {
  it('renders the friendly global entry point without opening the dialog', () => {
    const html = renderToStaticMarkup(<FeedbackWidget pagePath="/catalogo" />)

    expect(html).toContain('Deja tu comentario')
    expect(html).not.toContain('fixed bottom-')
    expect(html).toContain('fill="none"')
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).not.toContain('Reporta algo o deja un comentario')
  })
})
