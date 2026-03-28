'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PRODUCT_TYPES, PRODUCT_ATTRIBUTES } from '@/lib/constants'
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
    <div className="max-w-4xl mx-auto mt-8 px-4 pb-16">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Image gallery */}
        <ProductGallery images={images} title={title} />

        {/* Product info */}
        <div>
          <p className="text-sm text-brand-500 font-medium">{PRODUCT_TYPES[product.product_type]}</p>
          <h1 className="font-body text-3xl font-black">{title}</h1>
          <div className="flex items-center gap-4 mt-2">
            <p className="font-body text-3xl font-semibold text-brand-500">${product.price.toLocaleString('es-CL')}</p>
            {!isOwner && (
              <button className="bg-brand-500 text-white px-5 py-2 rounded-lg font-medium text-sm hover:bg-brand-600 transition-colors">
                Hacer oferta
              </button>
            )}
          </div>

          {/* Condition scale */}
          <div className="mt-6">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-3">Estado del producto</p>
            <div className="flex items-stretch gap-1">
              {([
                { key: 'nuevo_sellado', label: 'Sellado', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg> },
                { key: 'nuevo', label: 'Nuevo', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg> },
                { key: 'usado_como_nuevo', label: 'Como nuevo', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg> },
                { key: 'usado_buen_estado', label: 'Buen estado', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z" /></svg> },
                { key: 'usado_aceptable', label: 'Aceptable', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.645-5.645a.563.563 0 010-.795l.39-.39a.563.563 0 01.795 0L11.42 12.8l4.46-4.46a.563.563 0 01.795 0l.39.39a.563.563 0 010 .795L11.42 15.17z" /></svg> },
              ] as { key: string; label: string; icon: React.ReactNode }[]).map((cond, i) => {
                const isActive = product.condition === cond.key
                const condKeys = ['nuevo_sellado', 'nuevo', 'usado_como_nuevo', 'usado_buen_estado', 'usado_aceptable']
                const activeIdx = condKeys.indexOf(product.condition)
                const isBefore = i <= activeIdx

                return (
                  <div key={cond.key} className="flex-1 text-center">
                    <div className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${isActive ? 'bg-brand-500 text-white' : isBefore ? 'bg-brand-50 text-brand-500' : 'bg-gray-50 text-gray-300'}`}>
                      {cond.icon}
                      <span className="text-[10px] font-bold leading-tight">{cond.label}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {product.seasons_used && (
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-gray-500">Temporadas:</span>{' '}
                  <span className="font-medium">{product.seasons_used}</span>
                </div>
              )}
              <div className="bg-gray-50 p-2 rounded">
                <span className="text-gray-500">Region:</span>{' '}
                <span className="font-medium">{product.region}</span>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <span className="text-gray-500">Comuna:</span>{' '}
                <span className="font-medium">{product.comuna}</span>
              </div>

              {attrFields.map(field => {
                const val = attrs[field.key]
                if (val === undefined || val === '' || val === null) return null
                const displayVal = typeof val === 'boolean' ? (val ? 'Si' : 'No') : String(val)
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
              <h2 className="font-body font-medium tracking-sub mb-2">Descripcion</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{product.description}</p>
            </div>
          )}

          {!isOwner && (
            <button
              onClick={handleContact}
              disabled={contacting}
              className="pressable w-full mt-6 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-lg"
            >
              {contacting ? 'Conectando...' : 'Contactar vendedor por WhatsApp'}
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
  )
}
