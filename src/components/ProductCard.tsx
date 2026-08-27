'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PackageCheck } from 'lucide-react'
import { PRODUCT_TYPES } from '@/lib/constants'
import { track } from '@/lib/track'
import { getBrandLogoUrl } from '@/lib/brand-logos'

interface Props {
  id: string
  slug?: string | null
  title: string
  brand?: string | null
  productType: string
  price: number
  mainImageUrl?: string
  secondImageUrl?: string
  badge?: string
  recentlyPublished?: boolean
  recentBadgeIndex?: number
  sealed?: boolean
  /** Prioritize only the cards visible in the first viewport. */
  priority?: boolean
  /** When set, clicking the card beacons a 'click' event with this name (e.g. 'product_card' on the landing) */
  trackClickAs?: string
}

export default function ProductCard({ id, slug, title, brand, productType, price, mainImageUrl, secondImageUrl, badge, recentlyPublished = false, recentBadgeIndex = 0, sealed = false, priority = false, trackClickAs }: Props) {
  const [hovered, setHovered] = useState(false)
  const [secondRequested, setSecondRequested] = useState(false)
  const [secondLoaded, setSecondLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const brandLogoUrl = getBrandLogoUrl(brand || '')

  return (
    <Link
      href={`/producto/${slug || id}`}
      className="group pressable-subtle"
      onMouseEnter={() => {
        setHovered(true)
        setSecondRequested(true)
      }}
      onMouseLeave={() => setHovered(false)}
      onClick={() => {
        if (trackClickAs) track({ type: 'click', name: trackClickAs, product_id: id, category: productType })
      }}
    >
      <div className="relative aspect-[4/5] bg-gray-50 overflow-hidden">
        {recentlyPublished && (
          <span className="absolute left-2.5 top-2.5 z-10 -skew-x-12 rounded-[3px] bg-brand-400 px-2 py-1 shadow-sm md:left-3 md:top-3">
            <span className="flex skew-x-12 items-center gap-1 whitespace-nowrap">
              <svg
                className="recent-product-sparkle h-3 w-3 shrink-0 text-white"
                style={{ animationDelay: `${recentBadgeIndex}s` }}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M12 2.5 14.55 9.45 21.5 12l-6.95 2.55L12 21.5l-2.55-6.95L2.5 12l6.95-2.55Z" fill="currentColor" />
              </svg>
              <span className="font-body text-[7px] font-bold uppercase tracking-wider text-white md:text-[8px]">
                Nuevo
              </span>
            </span>
          </span>
        )}
        {(sealed || badge) && (
          <div className="absolute right-2.5 top-2.5 z-10 flex flex-col items-end gap-1.5 md:right-3 md:top-3">
            {sealed && (
              <span className="inline-flex items-center gap-1 rounded-[3px] border border-gray-200 bg-white px-2 py-1 font-body text-[7px] font-bold uppercase tracking-wider text-gray-900 shadow-sm md:text-[8px]">
                <PackageCheck className="h-3 w-3 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                Sellado
              </span>
            )}
            {badge && (
              <span className="font-body text-[10px] font-bold uppercase tracking-widest text-gray-600">
                {badge}
              </span>
            )}
          </div>
        )}
        {mainImageUrl && !imgError ? (
          <>
            {/* Primary image — base layer, always visible */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mainImageUrl}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover"
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : 'auto'}
              decoding="async"
              onError={() => setImgError(true)}
            />

            {secondImageUrl && secondRequested && (
              <div
                className="absolute inset-0 transition-[clip-path] duration-500 ease-out"
                style={{
                  clipPath: hovered && secondLoaded
                    ? 'circle(100% at 50% 50%)'
                    : 'circle(0% at 50% 50%)',
                }}
              >
                {/* The hover image is requested only after the visitor interacts
                    with this card, avoiding a second download for every result. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={secondImageUrl}
                  alt={`${title} - 2`}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="eager"
                  decoding="async"
                  onLoad={() => setSecondLoaded(true)}
                />
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="flex items-center gap-1.5 text-[10px] font-body font-bold uppercase tracking-widest text-gray-400">
          {brandLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brandLogoUrl}
              alt=""
              className="h-3 w-3 shrink-0 object-contain"
              onError={event => { event.currentTarget.style.display = 'none' }}
            />
          )}
          {PRODUCT_TYPES[productType]}
        </p>
        <h3 className="font-body font-semibold text-sm truncate mt-1">{title}</h3>
        <p className="font-body text-base font-bold text-black mt-0.5">
          ${price.toLocaleString('es-CL')}
        </p>
      </div>
    </Link>
  )
}
