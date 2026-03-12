'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PRODUCT_TYPES, CONDITIONS, PRODUCT_ATTRIBUTES } from '@/lib/constants'
import type { ProductWithImages } from '@/lib/types'

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [product, setProduct] = useState<ProductWithImages | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentImage, setCurrentImage] = useState(0)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [contacting, setContacting] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      const { data } = await supabase
        .from('products')
        .select('*, product_images(*)')
        .eq('id', params.id)
        .single()

      if (data) setProduct(data as ProductWithImages)
      setLoading(false)
    }
    load()
  }, [params.id])

  async function handleContact() {
    if (!user) {
      router.push(`/auth/login?redirect=/producto/${params.id}`)
      return
    }
    setContacting(true)
    try {
      const res = await fetch(`/api/contact/${params.id}`, { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.open(data.url, '_blank')
      } else {
        alert(data.error || 'Error al contactar')
      }
    } catch {
      alert('Error al contactar al vendedor')
    }
    setContacting(false)
  }

  if (loading) return <div className="max-w-4xl mx-auto mt-16 px-4">Cargando...</div>
  if (!product) return <div className="max-w-4xl mx-auto mt-16 px-4">Producto no encontrado</div>

  const images = (product.product_images || []).sort((a, b) => a.order - b.order)
  const isOwner = user?.id === product.seller_id
  const title = [product.brand, product.model].filter(Boolean).join(' ')
  const attrFields = PRODUCT_ATTRIBUTES[product.product_type] || []
  const attrs = (product.attributes || {}) as Record<string, unknown>

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4 pb-16">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Image gallery */}
        <div>
          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
            {images.length > 0 ? (
              <img src={images[currentImage]?.url} alt={title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">Sin fotos</div>
            )}
          </div>
          {images.length > 1 && (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-2">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setCurrentImage(i)}
                  className={`aspect-square rounded overflow-hidden border-2 ${i === currentImage ? 'border-blue-600' : 'border-transparent'}`}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product info */}
        <div>
          <p className="text-sm text-blue-600 font-medium">{PRODUCT_TYPES[product.product_type]}</p>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-3xl font-bold text-blue-600 mt-2">${product.price.toLocaleString('es-CL')}</p>

          <div className="mt-6 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-gray-50 p-2 rounded">
                <span className="text-gray-500">Estado:</span>{' '}
                <span className="font-medium">{CONDITIONS[product.condition]}</span>
              </div>
              {product.seasons_used && (
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-gray-500">Temporadas:</span>{' '}
                  <span className="font-medium">{product.seasons_used}</span>
                </div>
              )}
              <div className="bg-gray-50 p-2 rounded">
                <span className="text-gray-500">Región:</span>{' '}
                <span className="font-medium">{product.region}</span>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <span className="text-gray-500">Comuna:</span>{' '}
                <span className="font-medium">{product.comuna}</span>
              </div>

              {/* Dynamic attributes */}
              {attrFields.map(field => {
                const val = attrs[field.key]
                if (val === undefined || val === '' || val === null) return null
                let displayVal: string
                if (typeof val === 'boolean') {
                  displayVal = val ? 'Sí' : 'No'
                } else {
                  displayVal = String(val)
                }
                return (
                  <div key={field.key} className="bg-gray-50 p-2 rounded">
                    <span className="text-gray-500">{field.label}:</span>{' '}
                    <span className="font-medium">{displayVal}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {product.description && (
            <div className="mt-6">
              <h2 className="font-medium mb-2">Descripción</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{product.description}</p>
            </div>
          )}

          {!isOwner && (
            <button
              onClick={handleContact}
              disabled={contacting}
              className="w-full mt-6 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-lg"
            >
              {contacting ? 'Conectando...' : 'Contactar vendedor por WhatsApp'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
