'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PRODUCT_TYPES, PRODUCT_ATTRIBUTES } from '@/lib/constants'
import type { ProductWithImages } from '@/lib/types'

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [product, setProduct] = useState<ProductWithImages | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentImage, setCurrentImage] = useState(0)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [contacting, setContacting] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('is_admin')
          .eq('id', user.id)
          .single()
        setIsAdmin(profile?.is_admin ?? false)
      }

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
  const canEdit = isOwner || isAdmin
  const title = [product.brand, product.model].filter(Boolean).join(' ')
  const attrFields = PRODUCT_ATTRIBUTES[product.product_type] || []
  const attrs = (product.attributes || {}) as Record<string, unknown>

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4 pb-16">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Image gallery — swipeable */}
        <div>
          <div
            className="relative aspect-[4/5] bg-gray-100 rounded-lg overflow-hidden touch-pan-y"
            onTouchStart={(e) => {
              const touch = e.touches[0]
              ;(e.currentTarget as HTMLElement).dataset.startX = String(touch.clientX)
            }}
            onTouchEnd={(e) => {
              const startX = Number((e.currentTarget as HTMLElement).dataset.startX || 0)
              const endX = e.changedTouches[0].clientX
              const diff = startX - endX
              if (Math.abs(diff) > 50 && images.length > 1) {
                if (diff > 0) {
                  setCurrentImage(prev => (prev + 1) % images.length)
                } else {
                  setCurrentImage(prev => (prev - 1 + images.length) % images.length)
                }
              }
            }}
          >
            {images.length > 0 ? (
              <img src={images[currentImage]?.url} alt={title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">Sin fotos</div>
            )}

            {/* Arrow buttons — desktop */}
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setCurrentImage(prev => (prev - 1 + images.length) % images.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition-colors hidden md:flex"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => setCurrentImage(prev => (prev + 1) % images.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition-colors hidden md:flex"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}

            {/* Dots indicator */}
            {images.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentImage(i)}
                    className={`w-2 h-2 rounded-full transition-colors ${i === currentImage ? 'bg-white' : 'bg-white/40'}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

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
                { key: 'nuevo_sellado', label: 'Sellado', icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                )},
                { key: 'nuevo', label: 'Nuevo', icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                )},
                { key: 'usado_como_nuevo', label: 'Como nuevo', icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                  </svg>
                )},
                { key: 'usado_buen_estado', label: 'Buen estado', icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z" />
                  </svg>
                )},
                { key: 'usado_aceptable', label: 'Aceptable', icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.645-5.645a.563.563 0 010-.795l.39-.39a.563.563 0 01.795 0L11.42 12.8l4.46-4.46a.563.563 0 01.795 0l.39.39a.563.563 0 010 .795L11.42 15.17z" />
                  </svg>
                )},
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
              <h2 className="font-body font-medium tracking-sub mb-2">Descripción</h2>
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

          {canEdit && (
            <Link
              href={`/producto/${params.id}/editar`}
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
