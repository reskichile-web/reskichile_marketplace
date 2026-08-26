'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PRODUCT_TYPES } from '@/lib/constants'
import { track } from '@/lib/track'

interface Props {
  id: string
  slug?: string | null
  title: string
  productType: string
  price: number
  mainImageUrl?: string
  secondImageUrl?: string
  badge?: string
  /** Prioritize only the cards visible in the first viewport. */
  priority?: boolean
  /** When set, clicking the card beacons a 'click' event with this name (e.g. 'product_card' on the landing) */
  trackClickAs?: string
}

export default function ProductCard({ id, slug, title, productType, price, mainImageUrl, secondImageUrl, badge, priority = false, trackClickAs }: Props) {
  const [hovered, setHovered] = useState(false)
  const [secondRequested, setSecondRequested] = useState(false)
  const [secondLoaded, setSecondLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)

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
        {badge && (
          <span className="absolute top-3 right-3 z-10 text-[10px] tracking-widest font-body font-bold uppercase text-gray-600">
            {badge}
          </span>
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
        <p className="text-[10px] tracking-widest uppercase text-gray-400 font-body font-bold">{PRODUCT_TYPES[productType]}</p>
        <h3 className="font-body font-semibold text-sm truncate mt-1">{title}</h3>
        <p className="font-body text-base font-bold text-black mt-0.5">
          ${price.toLocaleString('es-CL')}
        </p>
      </div>
    </Link>
  )
}
