import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import SortableImageGrid, { type ImageItem } from '@/components/SortableImageGrid'

function renderGrid(imageCount: number) {
  const images: ImageItem[] = Array.from({ length: imageCount }, (_, index) => ({
    id: `image-${index}`,
    url: `https://storage.example/image-${index}.jpg`,
  }))

  return renderToStaticMarkup(
    <SortableImageGrid
      images={images}
      onReorder={vi.fn()}
      onRemove={vi.fn()}
      onAdd={vi.fn()}
    />,
  )
}

describe('sortable image grid', () => {
  it('shows the add-photo tile while fewer than eight photos are loaded', () => {
    const html = renderGrid(7)

    expect(html).toContain('Agregar')
    expect(html).toContain('7/8 fotos')
  })

  it('hides the add-photo tile after eight photos are loaded', () => {
    const html = renderGrid(8)

    expect(html).not.toContain('Agregar')
    expect(html).toContain('8/8 fotos')
  })
})
