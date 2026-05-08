'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PRODUCT_TYPES, PRODUCT_ATTRIBUTES, CONDITIONS } from '@/lib/constants'
import type { ProductWithImages } from '@/lib/types'
import ProductGallery from '@/components/ProductGallery'
import { createClient } from '@/lib/supabase/client'

interface Props {
  product: ProductWithImages
  userId: string | null
  isAdmin: boolean
  sellerHidePhone: boolean
}

export default function ProductDetailClient({ product, userId, isAdmin, sellerHidePhone }: Props) {
  const router = useRouter()
  const [contacting, setContacting] = useState(false)
  const [chatOpening, setChatOpening] = useState(false)
  const [hidePhone, setHidePhone] = useState(sellerHidePhone)
  const [hidePhoneSaving, setHidePhoneSaving] = useState(false)

  // Prefetch the chat route so it opens instantly when the user clicks
  useEffect(() => {
    if (userId && product.seller_id && userId !== product.seller_id) {
      router.prefetch(`/mensajes/nuevo?product=${product.id}`)
    }
  }, [router, userId, product.id, product.seller_id])

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
    // Safari blocks window.open() that fires after an await — the user gesture
    // is consumed by the time fetch() resolves. Open a placeholder window
    // synchronously while we still have the gesture, then redirect it once
    // the URL arrives. If the placeholder was blocked anyway (strict popup
    // blocker), fall back to navigating the current tab.
    const placeholder = window.open('', '_blank')
    setContacting(true)
    try {
      const res = await fetch(`/api/contact/${product.id}`, { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        if (placeholder && !placeholder.closed) {
          placeholder.location.href = data.url
        } else {
          window.location.href = data.url
        }
      } else {
        if (placeholder && !placeholder.closed) placeholder.close()
        alert(data.error || 'Error al contactar')
      }
    } catch {
      if (placeholder && !placeholder.closed) placeholder.close()
      alert('Error al contactar al vendedor')
    }
    setContacting(false)
  }

  function handleChat() {
    if (!userId) {
      router.push(`/auth/login?redirect=/producto/${product.id}`)
      return
    }
    // Open the chat view immediately. The conversation is created lazily on the
    // first message inside ChatRoom, so this navigation is instant (no API call).
    setChatOpening(true)
    router.push(`/mensajes/nuevo?product=${product.id}`)
  }

  async function toggleHidePhone(next: boolean) {
    const prev = hidePhone
    setHidePhone(next)
    setHidePhoneSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('users').update({ hide_phone: next }).eq('id', userId!)
    setHidePhoneSaving(false)
    if (error) {
      setHidePhone(prev)
      alert('No se pudo guardar la preferencia')
    }
  }

  return (
    <div className="-mt-[35px] md:mt-0">
    <div className="max-w-4xl mx-auto md:mt-8 md:px-4 pb-16">
      <div className="grid md:grid-cols-2 md:gap-8">
        <ProductGallery images={images} title={title} />

        {/* Product info */}
        <div className="px-4 md:px-0 mt-4 md:mt-0">
          {/* Type */}
          <p className="text-sm text-brand-500 font-medium">{PRODUCT_TYPES[product.product_type]}</p>

          <h1 className="font-body text-2xl md:text-3xl font-black mt-1">{title}</h1>
          <p className="font-body text-2xl md:text-3xl font-semibold text-brand-500 mt-1">${product.price.toLocaleString('es-CL')}</p>

          {/* Condition + Seasons row */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
              <span className="text-sm text-gray-700">{CONDITIONS[product.condition] || product.condition}</span>
            </div>
            {product.seasons_used && (
              <span className="text-sm text-gray-500">{product.seasons_used} {parseInt(product.seasons_used) === 1 ? 'Temporada' : 'Temporadas'}</span>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <div className="mt-4">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{product.description}</p>
            </div>
          )}

          {/* Location */}
          <div className="flex items-center gap-1.5 mt-3 text-sm text-gray-500">
            <span>📍</span>
            {product.region}{product.comuna ? `, ${product.comuna}` : ''}
          </div>

          {/* Main attributes (non-sub-product) */}
          {(() => {
            const mainAttrs = attrFields.filter(f => !f.key.startsWith('incluye_') && !f.key.startsWith('fijaciones_'))
            const hasValues = mainAttrs.some(f => attrs[f.key] !== undefined && attrs[f.key] !== '' && attrs[f.key] !== null)
            if (!hasValues) return null
            return (
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {mainAttrs.map(field => {
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
            )
          })()}

          {/* Sub-product card (e.g. bindings included) */}
          {(() => {
            const includesKey = attrFields.find(f => f.key.startsWith('incluye_') && f.type === 'boolean')
            if (!includesKey || !attrs[includesKey.key]) return null

            const subPrefix = includesKey.key.replace('incluye_', '')
            const subAttrs = attrFields.filter(f => f.key.startsWith(subPrefix + '_'))
            const subName = includesKey.label.replace('Incluye ', '')

            return (
              <div className="mt-5 rounded-xl bg-gradient-to-br from-white to-brand-50 border border-brand-100 p-4">
                <p className="text-xs font-bold text-brand-500 uppercase tracking-wider mb-3">
                  Incluye {subName}
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {subAttrs.map(field => {
                    const val = attrs[field.key]
                    if (val === undefined || val === '' || val === null) return null
                    const displayVal = typeof val === 'boolean' ? (val ? 'Si' : 'No') : String(val)
                    const shortLabel = field.label
                      .replace(/de las fijaciones|de los fijaciones/gi, '')
                      .replace(/Tipo de conexión/gi, 'Conexion')
                      .trim()
                    return (
                      <div key={field.key}>
                        <span className="text-gray-400 text-xs">{shortLabel}</span>
                        <p className="font-medium text-gray-900">{displayVal}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Contact seller — WhatsApp + Chat. WhatsApp hidden if the seller
              opted out via the "ocultar mi número" toggle. */}
          {!isOwner && product.seller_id && (
            <div className="mt-6 flex gap-2 w-full">
              {!hidePhone && (
              <button
                onClick={handleContact}
                disabled={contacting}
                className="pressable flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-green-600 text-white px-3 sm:px-4 py-3 hover:bg-green-700 disabled:opacity-50 font-medium text-xs sm:text-sm whitespace-nowrap"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.948 11.948 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.387 0-4.592-.838-6.313-2.234l-.44-.362-3.09 1.036 1.036-3.09-.362-.44A9.958 9.958 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z" />
                </svg>
                {contacting ? 'Conectando…' : 'WhatsApp'}
              </button>
              )}

              <button
                onClick={handleChat}
                disabled={chatOpening}
                className="pressable flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-brand-400 text-white px-3 sm:px-4 py-3 hover:bg-brand-500 disabled:opacity-50 font-medium text-xs sm:text-sm whitespace-nowrap"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 fill-current" viewBox="0 0 130 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M 125.328125 105.917969 L 79.207031 106.199219 L 91.21875 77.59375 L 88.070312 75.640625 L 85.644531 81.5 C 85.164062 75.546875 79.402344 64.65625 73.960938 60.59375 C 71.871094 49.996094 78.808594 39.613281 83.902344 35.816406 L 85.136719 36.730469 C 85.285156 35.503906 85.507812 34.371094 86.410156 33.464844 L 84.9375 33.90625 L 72.078125 3.714844 L 83.445312 34.339844 C 72.363281 38.070312 64.136719 49.117188 60.695312 60.363281 C 55.917969 56.828125 48.191406 55.667969 48.128906 64.433594 C 47.570312 66.101562 48.976562 70.683594 51 71.917969 C 41.523438 79.21875 37.628906 92.300781 35.871094 106.261719 L 2.761719 84.359375 L 34.992188 107.480469 L 28.78125 107.089844 C 32.582031 112.054688 33.863281 110.65625 41.722656 110.722656 C 41.816406 110.71875 44.214844 111.988281 44.664062 111.976562 C 45.113281 111.964844 43.589844 110.683594 43.660156 110.679688 L 73.621094 110.089844 L 58.941406 145.902344 C 61.566406 145.761719 66.949219 141.710938 67.820312 139.089844 C 71.148438 129.433594 74.472656 119.777344 77.800781 110.125 L 127.429688 109.769531 Z M 58.945312 70.539062 C 61.714844 68.261719 60.789062 63.207031 60.933594 63.210938 C 61.078125 63.210938 62.75 69.714844 59.382812 72.023438 C 56.6875 73.867188 52.453125 71.832031 52.492188 71.511719 C 52.53125 71.1875 56.472656 72.546875 58.945312 70.539062 Z M 52.632812 106.433594 C 47.894531 106.503906 43.222656 106.613281 38.613281 106.761719 C 41.347656 98.386719 49.527344 84.609375 53.179688 83.488281 C 56.949219 80.597656 60.058594 82.382812 61.183594 85.597656 C 54.335938 90.839844 59.28125 99.414062 68.007812 106.34375 C 62.964844 106.3125 57.839844 106.335938 52.636719 106.414062 Z M 71.214844 76.191406 C 66.613281 80.367188 72.210938 91.898438 71.03125 97.09375 C 70.269531 100.515625 68.0625 102.894531 67.925781 102.828125 C 67.785156 102.765625 69.707031 100.457031 70.351562 96.976562 C 70.976562 93.636719 69.882812 92.292969 69.195312 87.6875 C 68.769531 84.871094 67.605469 77.136719 70.660156 75.378906 C 72.746094 74.183594 76.121094 76.152344 76.078125 76.328125 C 76.035156 76.507812 73.074219 74.945312 71.21875 76.171875 Z M 71.214844 76.191406 " />
                </svg>
                {chatOpening ? 'Abriendo…' : 'Enviar mensaje'}
              </button>
            </div>
          )}

          {/* Anonymous seller fallback — only WhatsApp */}
          {!isOwner && !product.seller_id && (
            <div className="mt-6 w-full">
              <button
                onClick={handleContact}
                disabled={contacting}
                className="pressable w-full inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-green-600 text-white px-3 sm:px-4 py-3 hover:bg-green-700 disabled:opacity-50 font-medium text-xs sm:text-sm whitespace-nowrap"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.948 11.948 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.387 0-4.592-.838-6.313-2.234l-.44-.362-3.09 1.036 1.036-3.09-.362-.44A9.958 9.958 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z" />
                </svg>
                {contacting ? 'Conectando…' : 'WhatsApp'}
              </button>
            </div>
          )}

          {/* Owner-only toggle: hide WhatsApp number on the public listing. */}
          {isOwner && (
            <label className="mt-3 flex items-center gap-2 text-xs text-gray-500 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={hidePhone}
                onChange={(e) => toggleHidePhone(e.target.checked)}
                disabled={hidePhoneSaving}
                className="w-3.5 h-3.5 accent-brand-500 cursor-pointer disabled:opacity-50"
              />
              <span>Ocultar mi número de WhatsApp</span>
            </label>
          )}

          {canEdit && (
            <Link
              href={`/producto/${product.id}/editar`}
              className="pressable w-full mt-3 inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-gray-900 text-white px-3 sm:px-4 py-3 hover:bg-gray-800 font-medium text-xs sm:text-sm whitespace-nowrap"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
              </svg>
              Editar producto
            </Link>
          )}
        </div>
      </div>
    </div>
    </div>
  )
}
