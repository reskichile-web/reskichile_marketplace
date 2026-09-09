import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import AdminProductsClient from '@/components/admin/AdminProductsClient'

describe('admin products filter controls', () => {
  it('uses custom multi-select triggers instead of native selects', () => {
    const html = renderToStaticMarkup(
      <AdminProductsClient initialData={{
        products: [],
        viewCounts: {},
        facets: {
          statusCounts: {},
          brands: ['Atomic', 'K2'],
        },
        totalCount: 0,
        nextOffset: 0,
        hasMore: false,
      }} />,
    )

    expect(html).toContain('Todos los tipos')
    expect(html).toContain('Todas las marcas')
    expect(html.match(/aria-haspopup="menu"/g)).toHaveLength(2)
    expect(html).toContain('Ordenar por más vistas')
    expect(html).toContain('>Vistas<')
    expect(html).not.toContain('<select')
  })
})
