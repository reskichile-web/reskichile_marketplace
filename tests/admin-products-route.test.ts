import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAdminProductsPage: vi.fn(),
}))

vi.mock('@/lib/admin-view-data', () => ({
  getAdminProductsPage: mocks.getAdminProductsPage,
}))

vi.mock('@/lib/admin-security', () => ({
  adminErrorResponse: () => ({
    message: 'Error',
    code: 'INTERNAL_ERROR',
    status: 500,
  }),
}))

import { GET } from '@/app/api/admin/products/route'

describe('admin products route filters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAdminProductsPage.mockResolvedValue({
      products: [],
      viewCounts: {},
      facets: { statusCounts: {}, brands: [] },
      totalCount: 0,
      nextOffset: 0,
      hasMore: false,
    })
  })

  it('forwards every selected type and brand to the paginated query', async () => {
    const params = new URLSearchParams({ offset: '30', time_sort: 'desc' })
    params.append('brand', 'Atomic')
    params.append('brand', 'Black Diamond, Inc.')
    params.append('brand', 'Atomic')
    params.append('type', 'esquis')
    params.append('type', 'botas_esqui')

    const response = await GET(new Request(`https://www.reskichile.cl/api/admin/products?${params}`))

    expect(response.status).toBe(200)
    expect(mocks.getAdminProductsPage).toHaveBeenCalledWith({
      offset: 30,
      limit: 30,
      status: 'all',
      brands: ['Atomic', 'Black Diamond, Inc.'],
      productTypes: ['esquis', 'botas_esqui'],
      search: '',
      timeSort: 'desc',
      viewSort: '',
    })
  })

  it('forwards product-view sorting independently from time sorting', async () => {
    const response = await GET(new Request(
      'https://www.reskichile.cl/api/admin/products?view_sort=desc',
    ))

    expect(response.status).toBe(200)
    expect(mocks.getAdminProductsPage).toHaveBeenCalledWith(expect.objectContaining({
      timeSort: '',
      viewSort: 'desc',
    }))
  })
})
