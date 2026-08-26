'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PRODUCT_TYPES, PRODUCT_ATTRIBUTES, CONDITIONS, VIEW_COUNT_VISIBILITY_THRESHOLD, formatAttributeValue, type AttributeField } from '@/lib/constants'
import type { ProductWithImages } from '@/lib/types'
import ProductGallery from '@/components/ProductGallery'
import ShareButton from '@/components/ShareButton'
import CopyLinkButton from '@/components/CopyLinkButton'
import ClaimListingsPrompt from '@/components/ClaimListingsPrompt'
import MarkSoldButton from '@/components/MarkSoldButton'
import { createClient } from '@/lib/supabase/client'
import { useViewer } from '@/lib/use-viewer'
import { Recycle, CheckCircle2, Star, Sparkles, PackageCheck, X, type LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import DescriptionCard from '@/components/DescriptionCard'
import { isProductOwner, showClaimListingsPrompt, showPublicProductActions } from '@/lib/product-view-state'

// Estado de fijaciones se guarda como label de condición — mismo set de
// iconos que usa el formulario de venta.
const CONDITION_LABEL_ICONS: Record<string, LucideIcon> = {
  [CONDITIONS.usado_aceptable]: Recycle,
  [CONDITIONS.usado_buen_estado]: CheckCircle2,
  [CONDITIONS.usado_como_nuevo]: Star,
  [CONDITIONS.nuevo]: Sparkles,
  [CONDITIONS.nuevo_sellado]: PackageCheck,
}

const SKI_BOOT_ATTRIBUTE_ORDER: Record<string, number> = {
  talla_mondo: 0,
  flex: 1,
  boa: 2,
  incluye_pines: 3,
  genero: 4,
}

export function orderMainProductAttributes(
  productType: string,
  fields: AttributeField[],
): AttributeField[] {
  if (productType !== 'botas_esqui') return fields

  return [...fields].sort((left, right) => {
    const leftOrder = SKI_BOOT_ATTRIBUTE_ORDER[left.key] ?? Number.MAX_SAFE_INTEGER
    const rightOrder = SKI_BOOT_ATTRIBUTE_ORDER[right.key] ?? Number.MAX_SAFE_INTEGER
    return leftOrder - rightOrder
  })
}

export function shouldDisplayMainAttribute(field: AttributeField, value: unknown): boolean {
  if (field.key === 'boa') return value === true
  if (value === undefined || value === '' || value === null) return false
  return !Array.isArray(value) || value.length > 0
}

interface Props {
  product: ProductWithImages
  sellerHidePhone: boolean
}

export default function ProductDetailClient({ product, sellerHidePhone }: Props) {
  const router = useRouter()
  // Viewer identity resolves client-side so the page can stay ISR-cached. No
  // permission-dependent actions render until that session check has settled.
  const { userId, isAdmin, loading } = useViewer()
  const [contacting, setContacting] = useState(false)
  const [chatOpening, setChatOpening] = useState(false)
  const [hidePhone, setHidePhone] = useState(sellerHidePhone)
  const [hidePhoneSaving, setHidePhoneSaving] = useState(false)
  const [privateViewCount, setPrivateViewCount] = useState<number | null>(null)

  // Prefetch the chat route so it opens instantly when the user clicks
  useEffect(() => {
    if (userId && product.seller_id && userId !== product.seller_id) {
      router.prefetch(`/mensajes/nuevo?product=${product.id}`)
    }
  }, [router, userId, product.id, product.seller_id])

  const images = (product.product_images || []).sort((a, b) => a.order - b.order)
  // Legacy/Reski listings may have no seller. An anonymous viewer also has a
  // null userId, and null === null must never grant owner controls.
  const isOwner = isProductOwner(userId, product.seller_id)
  const canEdit = isOwner || isAdmin
  const isCommerceProduct = product.commerce_owned === true
  const showPublicActions = showPublicProductActions({ loading, canEdit })

  // Keep the approved product page cacheable: once the viewer session resolves,
  // privately fetch the counter only for the owner/admin. The RPC enforces the
  // same authorization server-side, and low counts remain intentionally hidden.
  useEffect(() => {
    if (!userId || (!isOwner && !isAdmin)) {
      setPrivateViewCount(null)
      return
    }

    setPrivateViewCount(null)
    let active = true
    const supabase = createClient()
    supabase
      .rpc('product_view_counts', { p_ids: [product.id] })
      .then(({ data }) => {
        if (!active) return
        const count = Number(data?.[0]?.views ?? 0)
        setPrivateViewCount(count >= VIEW_COUNT_VISIBILITY_THRESHOLD ? count : null)
      })

    return () => { active = false }
  }, [userId, isOwner, isAdmin, product.id])

  // Frontend state validation: only an approved listing is publicly visible, so
  // sharing/copying it makes sense only when approved. Admins always keep the
  // share tools. For an owner viewing their own not-yet-approved listing we
  // show a friendly status card instead (the raw "pending" status is never
  // surfaced to the user — admins still see the real status elsewhere).
  const isApproved = product.status === 'approved'
  const showShareTools = isApproved || isAdmin
  const ownerStatusCard: Record<string, { title: string; body: string; tone: 'pending' | 'rejected' | 'neutral' }> = {
    pending: {
      title: 'En revisión',
      body: 'Tu publicación está siendo revisada por nuestro equipo. Te avisaremos por correo apenas la aprobemos y quede visible en el catálogo.',
      tone: 'pending',
    },
    missing_photos: {
      title: 'Faltan fotos',
      body: 'Necesitamos al menos 3 fotos para revisar tu publicación. Edítala para agregarlas y la revisaremos.',
      tone: 'pending',
    },
    draft: {
      title: 'Borrador',
      body: 'Esta publicación todavía no se ha enviado a revisión.',
      tone: 'neutral',
    },
    rejected: {
      title: 'Publicación no aprobada',
      body: product.rejection_reason || 'Tu publicación no fue aprobada. Edítala y vuelve a enviarla a revisión.',
      tone: 'rejected',
    },
    sold: {
      title: 'Vendido',
      body: 'Esta publicación está marcada como vendida y ya no aparece en el catálogo.',
      tone: 'neutral',
    },
    archived: {
      title: 'Archivada',
      body: 'Esta publicación está archivada y no aparece en el catálogo.',
      tone: 'neutral',
    },
  }
  const statusCard = ownerStatusCard[product.status]
  const cardTone = {
    pending: { wrap: 'bg-amber-50 border-amber-200', icon: 'text-amber-500', title: 'text-amber-900', body: 'text-amber-800' },
    rejected: { wrap: 'bg-red-50 border-red-200', icon: 'text-red-500', title: 'text-red-900', body: 'text-red-700' },
    neutral: { wrap: 'bg-gray-50 border-gray-200', icon: 'text-gray-400', title: 'text-gray-900', body: 'text-gray-600' },
  }
  const title = [product.brand, product.model].filter(Boolean).join(' ')
  const attrFields = PRODUCT_ATTRIBUTES[product.product_type] || []
  const attrs = (product.attributes || {}) as Record<string, unknown>
  const doesNotIncludeBindings =
    (product.product_type === 'esquis' || product.product_type === 'snowboards') &&
    attrs.incluye_fijaciones === false

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
          {/* Type + private view counter */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-brand-500 font-medium">{PRODUCT_TYPES[product.product_type]}</p>
            {privateViewCount != null && (
              <div className="flex items-center justify-end gap-1.5 text-xs text-gray-500 text-right">
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="font-medium text-gray-700 whitespace-nowrap">{privateViewCount} visitas</span>
              </div>
            )}
          </div>

          <h1 className="font-body text-2xl md:text-3xl font-black mt-1">{title}</h1>
          <p className="font-body text-2xl md:text-3xl font-semibold text-brand-500 mt-1">${product.price.toLocaleString('es-CL')}</p>

          {/* Condition */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
              <span className="text-sm text-gray-700">{CONDITIONS[product.condition] || product.condition}</span>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <DescriptionCard description={product.description} className="mt-4" />
          )}

          {/* Location */}
          <div className="flex items-center gap-1.5 mt-3 text-sm text-gray-500">
            <span>📍</span>
            {product.region}{product.comuna ? `, ${product.comuna}` : ''}
          </div>

          {/* Main attributes (non-sub-product) */}
          {(() => {
            // An "incluye_X" boolean only spawns the sub-product card when
            // there are X_* fields (e.g. incluye_fijaciones → fijaciones_*).
            // Plain booleans like incluye_pines render as normal attributes.
            const hasSubFields = (f: AttributeField) =>
              attrFields.some(s => s.key.startsWith(f.key.replace('incluye_', '') + '_'))
            const mainAttrs = orderMainProductAttributes(
              product.product_type,
              attrFields.filter(f =>
                !(f.key.startsWith('incluye_') && hasSubFields(f)) && !f.key.startsWith('fijaciones_')),
            )
            const hasValues = mainAttrs.some(f => shouldDisplayMainAttribute(f, attrs[f.key]))
            if (!hasValues) return null
            return (
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {mainAttrs.map(field => {
                  const val = attrs[field.key]
                  if (field.key === 'boa') {
                    if (val !== true) {
                      return product.product_type === 'botas_esqui'
                        ? <div key={field.key} aria-hidden="true" />
                        : null
                    }

                    return (
                      <div key={field.key} className="flex items-end">
                        <p
                          className="text-xs font-bold uppercase tracking-wider text-brand-500"
                          aria-label="Sistema BOA incluido"
                        >
                          Sistema BOA
                        </p>
                      </div>
                    )
                  }
                  if (!shouldDisplayMainAttribute(field, val)) return null
                  const displayVal = formatAttributeValue(field, val)
                  // "Tipo" (esquís) puede traer varios valores — ancho completo arriba
                  return (
                    <div key={field.key} className={field.key === 'tipo' ? 'col-span-2' : ''}>
                      <span className="text-gray-400 text-xs">{field.label}</span>
                      <p className="font-medium text-gray-900">{displayVal}</p>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {doesNotIncludeBindings && (
            <div className="mt-4 flex items-center gap-2 text-brand-500">
              <X className="h-4 w-4 shrink-0" strokeWidth={3} aria-hidden="true" />
              <p className="text-xs font-bold uppercase tracking-wider">
                No incluye fijaciones
              </p>
            </div>
          )}

          {/* Sub-product card (e.g. bindings included) */}
          {(() => {
            const includesKey = attrFields.find(f =>
              f.key.startsWith('incluye_') && f.type === 'boolean' &&
              attrFields.some(s => s.key.startsWith(f.key.replace('incluye_', '') + '_')))
            if (!includesKey || !attrs[includesKey.key]) return null

            const subPrefix = includesKey.key.replace('incluye_', '')
            const subAttrs = attrFields.filter(f => f.key.startsWith(subPrefix + '_'))
            const subName = includesKey.label.replace('Incluye ', '')

            return (
              <div className="mt-5 rounded-md bg-white border border-gray-200 p-4">
                <div className="flex items-center gap-2">
                  {/* Mismo tick animado del éxito de publicar/registro, en celeste */}
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="w-4 h-4 rounded-full bg-brand-500 flex items-center justify-center shrink-0"
                  >
                    <motion.svg
                      className="w-2.5 h-2.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth={3.5}
                      strokeLinecap="square"
                      strokeLinejoin="miter"
                    >
                      <motion.path
                        d="M5 13l4 4L19 7"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.4, delay: 0.2 }}
                      />
                    </motion.svg>
                  </motion.span>
                  <p className="text-xs font-bold text-brand-500 uppercase tracking-wider">
                    Incluye {subName}
                  </p>
                </div>
                <div className="h-px bg-gray-200 w-11/12 mt-2 mb-3" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {subAttrs.map(field => {
                    const val = attrs[field.key]
                    if (val === undefined || val === '' || val === null) return null
                    const displayVal = formatAttributeValue(field, val)
                    const shortLabel = field.label
                      .replace(/de las fijaciones|de los fijaciones/gi, '')
                      .replace(/Tipo de conexión/gi, 'Conexion')
                      .trim()
                    const EstadoIcon = field.key.endsWith('_estado') ? CONDITION_LABEL_ICONS[displayVal] : undefined
                    return (
                      <div key={field.key}>
                        <span className="text-gray-400 text-xs">{shortLabel}</span>
                        <p className="font-medium text-gray-900 flex items-center gap-1.5">
                          {EstadoIcon && <EstadoIcon className="w-4 h-4 shrink-0" />}
                          {displayVal}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Owner-only toggle: hide WhatsApp number on the public listing.
              Sits above all action buttons so the seller can flip it before
              anything else. */}
          {isOwner && (
            <label className="mt-6 flex items-center gap-2 text-xs text-gray-500 select-none cursor-pointer">
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

          {isCommerceProduct && isApproved && (
            <Link
              href={'/checkout?producto=' + product.id}
              className="pressable mt-6 flex w-full items-center justify-center bg-brand-500 px-4 py-3 font-semibold text-white hover:bg-brand-600"
            >
              Comprar con Webpay
            </Link>
          )}

          {/* Contact seller — WhatsApp + Chat. WhatsApp hidden if the seller
              opted out via the "ocultar mi número" toggle. */}
          {showPublicActions && !isCommerceProduct && product.seller_id && (
            <div className="mt-6 flex gap-2 w-full">
              {isApproved && !hidePhone && (
              <button
                onClick={handleContact}
                disabled={contacting}
                className="pressable flex-1 min-w-0 flex items-center justify-center gap-1.5 sm:gap-2 bg-green-600 text-white px-3 sm:px-4 py-3 hover:bg-green-700 disabled:opacity-50 font-medium text-xs sm:text-sm whitespace-nowrap"
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
                className="pressable flex-1 min-w-0 flex items-center justify-center gap-1.5 sm:gap-2 bg-brand-400 text-white px-3 sm:px-4 py-3 hover:bg-brand-500 disabled:opacity-50 font-medium text-xs sm:text-sm whitespace-nowrap"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 fill-current" viewBox="0 0 130 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M 125.328125 105.917969 L 79.207031 106.199219 L 91.21875 77.59375 L 88.070312 75.640625 L 85.644531 81.5 C 85.164062 75.546875 79.402344 64.65625 73.960938 60.59375 C 71.871094 49.996094 78.808594 39.613281 83.902344 35.816406 L 85.136719 36.730469 C 85.285156 35.503906 85.507812 34.371094 86.410156 33.464844 L 84.9375 33.90625 L 72.078125 3.714844 L 83.445312 34.339844 C 72.363281 38.070312 64.136719 49.117188 60.695312 60.363281 C 55.917969 56.828125 48.191406 55.667969 48.128906 64.433594 C 47.570312 66.101562 48.976562 70.683594 51 71.917969 C 41.523438 79.21875 37.628906 92.300781 35.871094 106.261719 L 2.761719 84.359375 L 34.992188 107.480469 L 28.78125 107.089844 C 32.582031 112.054688 33.863281 110.65625 41.722656 110.722656 C 41.816406 110.71875 44.214844 111.988281 44.664062 111.976562 C 45.113281 111.964844 43.589844 110.683594 43.660156 110.679688 L 73.621094 110.089844 L 58.941406 145.902344 C 61.566406 145.761719 66.949219 141.710938 67.820312 139.089844 C 71.148438 129.433594 74.472656 119.777344 77.800781 110.125 L 127.429688 109.769531 Z M 58.945312 70.539062 C 61.714844 68.261719 60.789062 63.207031 60.933594 63.210938 C 61.078125 63.210938 62.75 69.714844 59.382812 72.023438 C 56.6875 73.867188 52.453125 71.832031 52.492188 71.511719 C 52.53125 71.1875 56.472656 72.546875 58.945312 70.539062 Z M 52.632812 106.433594 C 47.894531 106.503906 43.222656 106.613281 38.613281 106.761719 C 41.347656 98.386719 49.527344 84.609375 53.179688 83.488281 C 56.949219 80.597656 60.058594 82.382812 61.183594 85.597656 C 54.335938 90.839844 59.28125 99.414062 68.007812 106.34375 C 62.964844 106.3125 57.839844 106.335938 52.636719 106.414062 Z M 71.214844 76.191406 C 66.613281 80.367188 72.210938 91.898438 71.03125 97.09375 C 70.269531 100.515625 68.0625 102.894531 67.925781 102.828125 C 67.785156 102.765625 69.707031 100.457031 70.351562 96.976562 C 70.976562 93.636719 69.882812 92.292969 69.195312 87.6875 C 68.769531 84.871094 67.605469 77.136719 70.660156 75.378906 C 72.746094 74.183594 76.121094 76.152344 76.078125 76.328125 C 76.035156 76.507812 73.074219 74.945312 71.21875 76.171875 Z M 71.214844 76.191406 " />
                </svg>
                {chatOpening ? 'Abriendo…' : 'Enviar mensaje'}
              </button>
            </div>
          )}

          {/* Anonymous seller fallback — only WhatsApp */}
          {showPublicActions && !isCommerceProduct && isApproved && !product.seller_id && (
            <div className="mt-6 w-full">
              <button
                onClick={handleContact}
                disabled={contacting}
                className="pressable w-full flex items-center justify-center gap-1.5 sm:gap-2 bg-green-600 text-white px-3 sm:px-4 py-3 hover:bg-green-700 disabled:opacity-50 font-medium text-xs sm:text-sm whitespace-nowrap"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.948 11.948 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.387 0-4.592-.838-6.313-2.234l-.44-.362-3.09 1.036 1.036-3.09-.362-.44A9.958 9.958 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z" />
                </svg>
                {contacting ? 'Conectando…' : 'WhatsApp'}
              </button>
            </div>
          )}

          {/* Share + Copy when the listing is publicly visible (approved) or
              when an admin is viewing. Otherwise the owner sees a friendly
              status card instead — you can't share a listing that isn't live. */}
          {showShareTools ? (
            <div className="mt-3 flex items-stretch gap-2">
              <ShareButton product={product} className="flex-1" />
              <CopyLinkButton product={product} className="w-12" />
            </div>
          ) : statusCard ? (
            <div className={`mt-3 rounded-xl border p-4 flex items-start gap-3 ${cardTone[statusCard.tone].wrap}`}>
              <svg className={`w-5 h-5 shrink-0 mt-0.5 ${cardTone[statusCard.tone].icon}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                {statusCard.tone === 'rejected' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008M12 21a9 9 0 100-18 9 9 0 000 18z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l3.75 2.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
              </svg>
              <div>
                <p className={`font-semibold text-sm ${cardTone[statusCard.tone].title}`}>{statusCard.title}</p>
                <p className={`text-sm mt-1 leading-relaxed ${cardTone[statusCard.tone].body}`}>{statusCard.body}</p>
              </div>
            </div>
          ) : null}

          {/* Owner marks their own live listing sold — above Edit */}
          {!isCommerceProduct && isOwner && product.status === 'approved' && (
            <div className="mt-3">
              <MarkSoldButton
                productId={product.id}
                productTitle={title}
                listedPrice={product.price}
                variant="detail"
              />
            </div>
          )}

          {canEdit && (
            <Link
              href={`/producto/${product.id}/editar`}
              className="pressable w-full mt-3 flex items-center justify-center gap-1.5 sm:gap-2 bg-gray-900 text-white px-3 sm:px-4 py-3 hover:bg-gray-800 font-medium text-xs sm:text-sm whitespace-nowrap"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
              </svg>
              Editar producto
            </Link>
          )}
        </div>
      </div>

      {/* Claim-your-listings prompt — page footer */}
      {showClaimListingsPrompt({ loading, canEdit, isCommerceProduct }) && (
        <div className="mt-10 md:mt-12 px-4 md:px-0 border-t border-gray-100 pt-6">
          <ClaimListingsPrompt isLoggedIn={!!userId} />
        </div>
      )}
    </div>
    </div>
  )
}
