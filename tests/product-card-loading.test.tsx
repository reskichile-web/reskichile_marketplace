import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ProductCard from '@/components/ProductCard'

describe('product card image loading', () => {
  it('does not request the hover image before interaction', () => {
    const html = renderToStaticMarkup(
      <ProductCard
        id="product-1"
        title="Atomic Backland"
        productType="esquis"
        price={500000}
        mainImageUrl="https://storage.example/main.jpg"
        secondImageUrl="https://storage.example/hover.jpg"
      />,
    )

    expect(html).toContain('main.jpg')
    expect(html).toContain('loading="lazy"')
    expect(html).not.toContain('hover.jpg')
  })

  it('loads an above-the-fold primary image eagerly', () => {
    const html = renderToStaticMarkup(
      <ProductCard
        id="product-1"
        title="Atomic Backland"
        productType="esquis"
        price={500000}
        mainImageUrl="https://storage.example/main.jpg"
        priority
      />,
    )

    expect(html).toContain('loading="eager"')
    expect(html).toContain('fetchPriority="high"')
  })

  it('shows a curated brand logo in the text corner when available', () => {
    const html = renderToStaticMarkup(
      <ProductCard
        id="product-1"
        title="Atomic Backland"
        brand="Atomic"
        productType="esquis"
        price={500000}
      />,
    )

    expect(html).toContain('/brand-logos/atomic.png')
  })
})
