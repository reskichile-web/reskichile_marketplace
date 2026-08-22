import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import ApprovalStoryModal from '@/components/admin/ApprovalStoryModal'

const product = {
  id: '92000000-0000-4000-8000-000000000001',
  title: 'Dynafit Radical',
  slug: 'dynafit-radical',
}

describe('approval Story modal', () => {
  it('blocks while approval and rendering are in progress', () => {
    const html = renderToStaticMarkup(
      <ApprovalStoryModal
        state={{ phase: 'working', operation: 'approve', product }}
        onClose={vi.fn()}
        onRetry={vi.fn()}
      />,
    )
    expect(html).toContain('Aprobando producto y generando Story…')
    expect(html).toContain('aria-modal="true"')
    expect(html).not.toContain('Cerrar')
  })

  it('shows the real cache-busted JPEG and no publish action', () => {
    const html = renderToStaticMarkup(
      <ApprovalStoryModal
        state={{
          phase: 'ready',
          product,
          story: {
            id: 'capture-id',
            status: 'ready',
            jpegPublicUrl: 'https://storage.example/story.jpg',
            updatedAt: '2026-08-21T15:00:00.000Z',
            width: 1080,
            height: 1920,
            format: 'jpeg',
          },
        }}
        onClose={vi.fn()}
        onRetry={vi.fn()}
      />,
    )
    expect(html).toContain('Producto aprobado · Story preparada')
    expect(html).toContain('story.jpg?v=')
    expect(html).toContain('1080×1920')
    expect(html).toContain('Abrir Story')
    expect(html).not.toContain('Publicar ahora')
  })

  it('offers a capture-only retry after rendering failed', () => {
    const html = renderToStaticMarkup(
      <ApprovalStoryModal
        state={{
          phase: 'capture-failed',
          product,
          story: {
            id: 'capture-id',
            status: 'failed',
            jpegPublicUrl: null,
            updatedAt: '2026-08-21T15:00:00.000Z',
            width: 1080,
            height: 1920,
            format: 'jpeg',
            error: 'Render fallido',
          },
        }}
        onClose={vi.fn()}
        onRetry={vi.fn()}
      />,
    )
    expect(html).toContain('Producto aprobado, pero no pudimos generar la Story')
    expect(html).toContain('Reintentar captura')
  })
})
