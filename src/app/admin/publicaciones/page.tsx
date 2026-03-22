'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PRODUCT_TYPES, PRODUCT_STATUSES, CONDITIONS } from '@/lib/constants'

interface AdminProduct {
  id: string
  product_type: string
  brand: string
  model: string | null
  price: number
  status: string
  created_at: string
  seller_id: string
  condition: string
  region: string
  comuna: string
  seasons_used: string | null
  description: string | null
  rejection_reason: string | null
  attributes: Record<string, unknown> | null
  users: { name: string | null; email: string; phone: string | null } | null
  product_images: { url: string; order: number }[]
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  missing_photos: 'bg-orange-100 text-orange-700',
  sold: 'bg-brand-100 text-brand-700',
  archived: 'bg-gray-100 text-gray-500',
}

export default function PublicacionesPage() {
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadProducts = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('products')
      .select('id, product_type, brand, model, price, status, created_at, seller_id, condition, region, comuna, seasons_used, description, rejection_reason, attributes, users(name, email, phone), product_images(url, order)')
      .order('created_at', { ascending: false })

    setProducts((data as unknown as AdminProduct[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const brands = useMemo(() => {
    const set = new Set(products.map(p => p.brand))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [products])

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (brandFilter && p.brand !== brandFilter) return false
      if (typeFilter && p.product_type !== typeFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const title = [p.brand, p.model].filter(Boolean).join(' ').toLowerCase()
        const seller = (p.users?.name || p.users?.email || '').toLowerCase()
        if (!title.includes(q) && !seller.includes(q)) return false
      }
      return true
    })
  }, [products, statusFilter, brandFilter, typeFilter, search])

  async function handleStatusChange(productId: string, status: string, extra?: Record<string, unknown>) {
    const supabase = createClient()
    const { error } = await supabase.from('products').update({ status, ...extra }).eq('id', productId)
    if (error) {
      console.error('Status update error:', error.message)
      alert('Error al cambiar estado: ' + error.message)
      return
    }
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, status, ...extra } as AdminProduct : p))
  }

  async function handleApprove(productId: string) {
    await handleStatusChange(productId, 'approved', { rejection_reason: null })
  }

  async function handleReject(productId: string) {
    if (!rejectionReason.trim()) {
      alert('Ingresa un motivo de rechazo')
      return
    }
    await handleStatusChange(productId, 'rejected', { rejection_reason: rejectionReason })
    setRejectingId(null)
    setRejectionReason('')
  }

  async function handleMarkSold(productId: string) {
    await handleStatusChange(productId, 'sold')
  }

  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(productId: string) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta publicación? Esta acción no se puede deshacer.')) return
    setDeletingId(productId)
    const supabase = createClient()
    await supabase.from('product_images').delete().eq('product_id', productId)
    await supabase.from('products').delete().eq('id', productId)
    setExpandedId(null)
    await loadProducts()
    setDeletingId(null)
  }


  if (loading) return (
    <div className="max-w-7xl mx-auto mt-0 px-8 pt-4 text-gray-500">Cargando...</div>
  )

  return (
    <div className="max-w-7xl mx-auto mt-0 px-8 pt-4 pb-16">

      {/* Filters */}
      <div className="space-y-3 mb-6">
        {/* Status tabs */}
        <div className="flex gap-1.5 overflow-x-auto">
          {(['all', 'pending', 'approved', 'missing_photos', 'rejected', 'sold', 'archived', 'draft'] as const).map(f => {
            const count = f === 'all' ? products.length : products.filter(p => p.status === f).length
            return (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${statusFilter === f ? 'bg-gray-900 text-white' : count === 0 ? 'bg-gray-50 text-gray-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {f === 'all' ? 'Todos' : PRODUCT_STATUSES[f] || f}
                <span className="ml-1 opacity-60">{count}</span>
              </button>
            )
          })}
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar marca, modelo o vendedor..."
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm sm:w-40"
          >
            <option value="">Todos los tipos</option>
            {Object.entries(PRODUCT_TYPES).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <select
            value={brandFilter}
            onChange={e => setBrandFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm sm:w-40"
          >
            <option value="">Todas las marcas</option>
            {brands.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500 mb-3">{filtered.length} productos</p>

      {filtered.length === 0 ? (
        <p className="text-gray-500">No hay productos que coincidan</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-4 font-medium">Producto</th>
                <th className="pb-2 pr-4 font-medium hidden sm:table-cell">Precio</th>
                <th className="pb-2 pr-4 font-medium hidden md:table-cell">Vendedor</th>
                <th className="pb-2 pr-4 font-medium hidden md:table-cell">Fecha</th>
                <th className="pb-2 pr-4 font-medium">Estado</th>
                <th className="pb-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(product => {
                const title = [product.brand, product.model].filter(Boolean).join(' ')
                const seller = product.users?.name || product.users?.email || 'Desconocido'
                const isExpanded = expandedId === product.id
                const images = (product.product_images || []).sort((a, b) => a.order - b.order)
                const attrs = product.attributes as Record<string, unknown> | null

                return (
                  <React.Fragment key={product.id}>
                    <tr className={`border-b hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-gray-50' : ''}`} onClick={() => setExpandedId(isExpanded ? null : product.id)}>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <svg className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          {images.length > 0 ? (
                            <img src={images[0].url} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center shrink-0">
                              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                          <div>
                            <span className="font-medium">{title}</span>
                            <span className="ml-2 text-xs text-gray-400">{PRODUCT_TYPES[product.product_type] || product.product_type}</span>
                            <span className="block sm:hidden text-xs text-gray-500 mt-0.5">
                              ${product.price.toLocaleString('es-CL')} · {seller}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 hidden sm:table-cell font-medium text-brand-500">
                        ${product.price.toLocaleString('es-CL')}
                      </td>
                      <td className="py-3 pr-4 hidden md:table-cell text-gray-600">
                        {seller}
                      </td>
                      <td className="py-3 pr-4 hidden md:table-cell text-gray-500">
                        {new Date(product.created_at).toLocaleDateString('es-CL')}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[product.status] || ''}`}>
                          {PRODUCT_STATUSES[product.status] || product.status}
                        </span>
                      </td>
                      <td className="py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1.5">
                          {product.status === 'pending' && (
                            <>
                              <button onClick={() => handleApprove(product.id)} className="text-xs bg-green-600 text-white px-2.5 py-1 rounded hover:bg-green-700">
                                Aprobar
                              </button>
                              <button onClick={() => setRejectingId(product.id)} className="text-xs bg-red-600 text-white px-2.5 py-1 rounded hover:bg-red-700">
                                Rechazar
                              </button>
                            </>
                          )}
                          {product.status === 'rejected' && (
                            <button onClick={() => handleApprove(product.id)} className="text-xs bg-green-600 text-white px-2.5 py-1 rounded hover:bg-green-700">
                              Aprobar
                            </button>
                          )}
                          {product.status === 'approved' && (
                            <button onClick={() => handleMarkSold(product.id)} className="text-xs border border-brand-500 text-brand-500 px-2.5 py-1 rounded hover:bg-brand-50">
                              Vendido
                            </button>
                          )}
                          <Link href={`/producto/${product.id}/editar`} className="text-xs border px-2.5 py-1 rounded hover:bg-gray-100">
                            Editar
                          </Link>
                          <button onClick={() => handleDelete(product.id)} disabled={deletingId === product.id} className="text-xs border border-red-200 text-red-500 px-2.5 py-1 rounded hover:bg-red-50 disabled:opacity-50 flex items-center gap-1">
                            {deletingId === product.id ? (
                              <>
                                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Eliminando
                              </>
                            ) : 'Eliminar'}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr className="border-b bg-gray-50/50">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4">
                            {/* Images */}
                            {images.length > 0 && (
                              <div className="flex gap-2 overflow-x-auto md:flex-col md:w-24">
                                {images.map((img, i) => (
                                  <img key={i} src={img.url} alt="" className="w-20 h-20 shrink-0 object-cover rounded" />
                                ))}
                              </div>
                            )}

                            {/* Details */}
                            <div className="space-y-3">
                              {/* Basic info */}
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                                <div>
                                  <span className="text-gray-500">Tipo</span>
                                  <p className="font-medium">{PRODUCT_TYPES[product.product_type] || product.product_type}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Condición</span>
                                  <p className="font-medium">{CONDITIONS[product.condition] || product.condition}</p>
                                </div>
                                {product.seasons_used && (
                                  <div>
                                    <span className="text-gray-500">Temporadas</span>
                                    <p className="font-medium">{product.seasons_used}</p>
                                  </div>
                                )}
                                <div>
                                  <span className="text-gray-500">Ubicación</span>
                                  <p className="font-medium">{product.region}{product.comuna ? `, ${product.comuna}` : ''}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Precio</span>
                                  <p className="font-medium text-brand-500">${product.price.toLocaleString('es-CL')}</p>
                                </div>
                              </div>

                              {/* Seller info */}
                              <div className="border-t pt-2">
                                <span className="text-xs text-gray-500 uppercase tracking-wide">Vendedor</span>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm mt-1">
                                  <div>
                                    <span className="text-gray-500">Nombre</span>
                                    <p className="font-medium">{product.users?.name || 'Sin nombre'}</p>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Email</span>
                                    <p className="font-medium">{product.users?.email}</p>
                                  </div>
                                  {product.users?.phone && (
                                    <div>
                                      <span className="text-gray-500">Teléfono</span>
                                      <p className="font-medium">{product.users.phone}</p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Dynamic attributes */}
                              {attrs && Object.keys(attrs).length > 0 && (
                                <div className="border-t pt-2">
                                  <span className="text-xs text-gray-500 uppercase tracking-wide">Atributos</span>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm mt-1">
                                    {Object.entries(attrs).map(([key, value]) => (
                                      <div key={key}>
                                        <span className="text-gray-500">{key.replace(/_/g, ' ')}</span>
                                        <p className="font-medium">{String(value)}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Description */}
                              {product.description && (
                                <div className="border-t pt-2">
                                  <span className="text-xs text-gray-500 uppercase tracking-wide">Descripción</span>
                                  <p className="text-sm mt-1">{product.description}</p>
                                </div>
                              )}

                              {/* Rejection reason */}
                              {product.rejection_reason && (
                                <div className="border-t pt-2">
                                  <span className="text-xs text-red-500 uppercase tracking-wide">Motivo de rechazo</span>
                                  <p className="text-sm text-red-600 mt-1">{product.rejection_reason}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>

          {/* Rejection modal inline */}
          {rejectingId && (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <h3 className="font-medium mb-3">Motivo de rechazo</h3>
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="Escribe el motivo..."
                  className="w-full border rounded px-3 py-2 text-sm mb-3"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setRejectingId(null); setRejectionReason('') }} className="border px-4 py-2 rounded text-sm">
                    Cancelar
                  </button>
                  <button onClick={() => handleReject(rejectingId)} className="bg-red-600 text-white px-4 py-2 rounded text-sm">
                    Rechazar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
