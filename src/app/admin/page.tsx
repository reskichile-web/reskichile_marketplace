'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PRODUCT_TYPES, CONDITIONS } from '@/lib/constants'

interface AdminProduct {
  id: string
  product_type: string
  brand: string
  model: string | null
  condition: string
  price: number
  status: string
  created_at: string
  description: string | null
  region: string
  comuna: string
  seasons_used: string | null
  seller_id: string
  users: { name: string | null; email: string } | null
  product_images: { url: string; order: number }[]
}

export default function AdminPage() {
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  const loadProducts = useCallback(async () => {
    const supabase = createClient()
    let query = supabase
      .from('products')
      .select('*, users(name, email), product_images(*)')
      .order('created_at', { ascending: false })

    if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data } = await query
    setProducts((data as AdminProduct[]) || [])
    setLoading(false)
  }, [filter])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  async function handleApprove(productId: string) {
    const supabase = createClient()
    await supabase.from('products').update({ status: 'approved', rejection_reason: null }).eq('id', productId)
    loadProducts()
  }

  async function handleReject(productId: string) {
    if (!rejectionReason.trim()) {
      alert('Ingresa un motivo de rechazo')
      return
    }
    const supabase = createClient()
    await supabase.from('products').update({ status: 'rejected', rejection_reason: rejectionReason }).eq('id', productId)
    setRejectingId(null)
    setRejectionReason('')
    loadProducts()
  }

  if (loading) return <div className="max-w-6xl mx-auto mt-16 px-4">Cargando...</div>

  return (
    <div className="max-w-6xl mx-auto mt-8 px-4 pb-16">
      <h1 className="text-2xl font-bold mb-6">Panel de administración</h1>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded text-sm whitespace-nowrap ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            {f === 'pending' && 'Pendientes'}
            {f === 'approved' && 'Aprobados'}
            {f === 'rejected' && 'Rechazados'}
            {f === 'all' && 'Todos'}
          </button>
        ))}
      </div>

      {products.length === 0 ? (
        <p className="text-gray-500">No hay productos en esta categoría</p>
      ) : (
        <div className="space-y-4">
          {products.map(product => {
            const images = product.product_images?.sort((a, b) => a.order - b.order) || []
            const title = [product.brand, product.model].filter(Boolean).join(' ')

            return (
              <div key={product.id} className="border rounded-lg p-4">
                {/* Images - horizontal scroll on mobile */}
                <div className="flex gap-2 overflow-x-auto mb-3">
                  {images.slice(0, 4).map((img, i) => (
                    <img key={i} src={img.url} alt="" className="w-20 h-20 shrink-0 object-cover rounded" />
                  ))}
                  {images.length > 4 && (
                    <div className="w-20 h-20 shrink-0 bg-gray-100 rounded flex items-center justify-center text-sm text-gray-500">
                      +{images.length - 4}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0">
                  <p className="text-xs text-blue-600 font-medium">{PRODUCT_TYPES[product.product_type]}</p>
                  <h2 className="font-medium text-lg">{title}</h2>
                  <p className="text-sm text-gray-500">
                    {product.users?.name || product.users?.email || 'Desconocido'} · {new Date(product.created_at).toLocaleDateString('es-CL')}
                  </p>
                  <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1 text-sm">
                    <span>{CONDITIONS[product.condition]}</span>
                    <span>·</span>
                    <span>{product.region}, {product.comuna}</span>
                    {product.seasons_used && <><span>·</span><span>{product.seasons_used} temp.</span></>}
                  </div>
                  <p className="text-lg font-bold text-blue-600 mt-1">${product.price.toLocaleString('es-CL')}</p>
                  {product.description && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{product.description}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-3">
                  {product.status === 'pending' && (
                    <>
                      <button onClick={() => handleApprove(product.id)} className="flex-1 sm:flex-none bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">
                        Aprobar
                      </button>
                      <button onClick={() => setRejectingId(product.id)} className="flex-1 sm:flex-none bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700">
                        Rechazar
                      </button>
                    </>
                  )}
                  {product.status === 'rejected' && (
                    <button onClick={() => handleApprove(product.id)} className="flex-1 sm:flex-none bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">
                      Aprobar
                    </button>
                  )}
                  {product.status === 'approved' && (
                    <span className="text-green-600 text-sm font-medium">Aprobado</span>
                  )}
                </div>

                {rejectingId === product.id && (
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      placeholder="Motivo de rechazo"
                      className="flex-1 border rounded px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => handleReject(product.id)} className="flex-1 sm:flex-none bg-red-600 text-white px-4 py-2 rounded text-sm">
                        Confirmar
                      </button>
                      <button onClick={() => { setRejectingId(null); setRejectionReason('') }} className="flex-1 sm:flex-none border px-4 py-2 rounded text-sm">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
