import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PRODUCT_TYPES, CONDITIONS, REGIONS, ITEMS_PER_PAGE } from '@/lib/constants'

interface Props {
  searchParams: {
    product_type?: string
    condition?: string
    brand?: string
    region?: string
    min_price?: string
    max_price?: string
    page?: string
  }
}

export default async function CatalogPage({ searchParams }: Props) {
  const supabase = createServerSupabaseClient()

  const page = parseInt(searchParams.page || '1')
  const offset = (page - 1) * ITEMS_PER_PAGE

  let query = supabase
    .from('products')
    .select('*, product_images(*)', { count: 'exact' })
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .range(offset, offset + ITEMS_PER_PAGE - 1)

  if (searchParams.product_type) query = query.eq('product_type', searchParams.product_type)
  if (searchParams.condition) query = query.eq('condition', searchParams.condition)
  if (searchParams.brand) query = query.ilike('brand', `%${searchParams.brand}%`)
  if (searchParams.region) query = query.eq('region', searchParams.region)
  if (searchParams.min_price) query = query.gte('price', parseInt(searchParams.min_price))
  if (searchParams.max_price) query = query.lte('price', parseInt(searchParams.max_price))

  const { data: products, count } = await query

  const totalPages = Math.ceil((count || 0) / ITEMS_PER_PAGE)

  function buildUrl(params: Record<string, string>) {
    const merged = { ...searchParams, ...params }
    const sp = new URLSearchParams()
    Object.entries(merged).forEach(([k, v]) => {
      if (v) sp.set(k, v)
    })
    return `/catalogo?${sp.toString()}`
  }

  return (
    <div className="max-w-6xl mx-auto mt-8 px-4 pb-16">
      <h1 className="text-2xl font-bold mb-6">Catálogo</h1>

      <form className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <select
            name="product_type"
            defaultValue={searchParams.product_type || ''}
            className="border rounded px-2 py-1.5 text-sm"
          >
            <option value="">Todos los productos</option>
            {Object.entries(PRODUCT_TYPES).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>

          <select
            name="condition"
            defaultValue={searchParams.condition || ''}
            className="border rounded px-2 py-1.5 text-sm"
          >
            <option value="">Cualquier estado</option>
            {Object.entries(CONDITIONS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>

          <select
            name="region"
            defaultValue={searchParams.region || ''}
            className="border rounded px-2 py-1.5 text-sm"
          >
            <option value="">Todas las regiones</option>
            {REGIONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <input
            name="brand"
            type="text"
            defaultValue={searchParams.brand || ''}
            placeholder="Marca"
            className="border rounded px-2 py-1.5 text-sm"
          />

          <input
            name="min_price"
            type="number"
            defaultValue={searchParams.min_price || ''}
            placeholder="Precio mín"
            className="border rounded px-2 py-1.5 text-sm"
          />

          <input
            name="max_price"
            type="number"
            defaultValue={searchParams.max_price || ''}
            placeholder="Precio máx"
            className="border rounded px-2 py-1.5 text-sm"
          />
        </div>

        <div className="flex gap-2 mt-3">
          <button type="submit" className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">
            Filtrar
          </button>
          <Link href="/catalogo" className="border px-4 py-1.5 rounded text-sm hover:bg-gray-100">
            Limpiar
          </Link>
        </div>
      </form>

      {!products || products.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No se encontraron productos</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => {
              const mainImage = product.product_images?.sort(
                (a: { order: number }, b: { order: number }) => a.order - b.order
              )[0]

              const title = [product.brand, product.model].filter(Boolean).join(' ')

              return (
                <Link
                  key={product.id}
                  href={`/producto/${product.id}`}
                  className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="aspect-square relative bg-gray-100">
                    {mainImage ? (
                      <img src={mainImage.url} alt={title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">Sin foto</div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-blue-600 font-medium">{PRODUCT_TYPES[product.product_type]}</p>
                    <h3 className="font-medium text-sm truncate">{title}</h3>
                    <p className="text-lg font-bold text-blue-600">${product.price.toLocaleString('es-CL')}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                        {CONDITIONS[product.condition] || product.condition}
                      </span>
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                        {product.region}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {page > 1 && (
                <Link href={buildUrl({ page: String(page - 1) })} className="border px-3 py-1 rounded hover:bg-gray-100 text-sm">
                  Anterior
                </Link>
              )}
              <span className="px-3 py-1 text-sm text-gray-600">Página {page} de {totalPages}</span>
              {page < totalPages && (
                <Link href={buildUrl({ page: String(page + 1) })} className="border px-3 py-1 rounded hover:bg-gray-100 text-sm">
                  Siguiente
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
