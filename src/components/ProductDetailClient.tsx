'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PRODUCT_TYPES, PRODUCT_ATTRIBUTES, CONDITIONS } from '@/lib/constants'
import type { ProductWithImages } from '@/lib/types'
import ProductGallery from '@/components/ProductGallery'

interface Props {
  product: ProductWithImages
  userId: string | null
  isAdmin: boolean
}

export default function ProductDetailClient({ product, userId, isAdmin }: Props) {
  const router = useRouter()
  const [contacting, setContacting] = useState(false)

  const images = (product.product_images || []).sort((a, b) => a.order - b.order)
  const isOwner = userId === product.seller_id
  const canEdit = isOwner || isAdmin
  const title = [product.brand, product.model].filter(Boolean).join(' ')
  const attrFields = PRODUCT_ATTRIBUTES[product.product_type] || []
  const attrs = (product.attributes || {}) as Record<string, unknown>

  async function handleContact() {
    if (!userId) {
      router.push(`/auth/login?redirect=/producto/${product.id}`)
      return
    }
    setContacting(true)
    try {
      const res = await fetch(`/api/contact/${product.id}`, { method: 'POST' })
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

  return (
    <div className="-mt-[95px] md:mt-0">
    <div className="max-w-4xl mx-auto md:mt-8 md:px-4 pb-16">
      <div className="grid md:grid-cols-2 md:gap-8">
        <ProductGallery images={images} title={title} />

        {/* Product info */}
        <div className="px-4 md:px-0 mt-4 md:mt-0">
          {/* Type + Location row */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-brand-500 font-medium">{PRODUCT_TYPES[product.product_type]}</p>
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <span>📍</span>
              {product.region}{product.comuna ? `, ${product.comuna}` : ''}
            </p>
          </div>

          <h1 className="font-body text-2xl md:text-3xl font-black mt-1">{title}</h1>
          <p className="font-body text-2xl md:text-3xl font-semibold text-brand-500 mt-1">${product.price.toLocaleString('es-CL')}</p>

          {/* Condition — icon + text inline */}
          <div className="flex items-center gap-2 mt-4">
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
            <span className="text-sm text-gray-700">{CONDITIONS[product.condition] || product.condition}</span>
          </div>

          {/* Details — no background, label on top, value below */}
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {product.seasons_used && (
              <div>
                <span className="text-gray-400 text-xs">Temporadas</span>
                <p className="font-medium text-gray-900">{product.seasons_used}</p>
              </div>
            )}

            {attrFields.map(field => {
              const val = attrs[field.key]
              if (val === undefined || val === '' || val === null) return null
              const displayVal = typeof val === 'boolean' ? (val ? 'Si' : 'No') : String(val)
              return (
                <div key={field.key}>
                  <span className="text-gray-400 text-xs">{field.label}</span>
                  <p className="font-medium text-gray-900">{displayVal}</p>
                </div>
              )
            })}
          </div>

          {product.description && (
            <div className="mt-6">
              <span className="text-gray-400 text-xs">Descripcion</span>
              <p className="text-sm text-gray-700 whitespace-pre-wrap mt-0.5">{product.description}</p>
            </div>
          )}

          {/* Contact seller */}
          {!isOwner && (
            <button
              onClick={handleContact}
              disabled={contacting}
              className="pressable inline-flex items-center gap-2 mt-6 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.948 11.948 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.387 0-4.592-.838-6.313-2.234l-.44-.362-3.09 1.036 1.036-3.09-.362-.44A9.958 9.958 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z" />
              </svg>
              {contacting ? 'Conectando...' : 'Contactar Vendedor'}
            </button>
          )}

          {canEdit && (
            <Link
              href={`/producto/${product.id}/editar`}
              className="block w-full mt-3 text-center border border-brand-500 text-brand-500 py-2.5 rounded-lg hover:bg-brand-50 font-medium text-sm"
            >
              Editar producto
            </Link>
          )}
        </div>
      </div>
    </div>
    </div>
  )
}
