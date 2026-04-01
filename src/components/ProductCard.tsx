'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PRODUCT_TYPES } from '@/lib/constants'

interface Props {
  id: string
  title: string
  productType: string
  price: number
  mainImageUrl?: string
  secondImageUrl?: string
}

export default function ProductCard({ id, title, productType, price, mainImageUrl, secondImageUrl }: Props) {
  const [hovered, setHovered] = useState(false)
  const [secondLoaded, setSecondLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)

  return (
    <Link
      href={`/producto/${id}`}
      className="group pressable-subtle"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative aspect-[4/5] bg-gray-100 overflow-hidden rounded-lg">
        {mainImageUrl && !imgError ? (
          <>
            {/* Primary image — base layer, always visible */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mainImageUrl}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              onError={() => setImgError(true)}
            />

            {secondImageUrl && (
              <>
                {/* Preload second image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={secondImageUrl} alt="" className="hidden" onLoad={() => setSecondLoaded(true)} />

                {/* Second image — on top, expands from center on hover, contracts on unhover */}
                <div
                  className="absolute inset-0 transition-[clip-path] duration-500 ease-out"
                  style={{
                    clipPath: hovered && secondLoaded
                      ? 'circle(100% at 50% 50%)'
                      : 'circle(0% at 50% 50%)',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={secondImageUrl}
                    alt={`${title} - 2`}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
              </>
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
        <p className="text-xs text-gray-400">{PRODUCT_TYPES[productType]}</p>
        <h3 className="font-body font-semibold text-sm truncate">{title}</h3>
        <p className="font-body text-lg font-black text-brand-500 mt-0.5">
          ${price.toLocaleString('es-CL')}
        </p>
      </div>
    </Link>
  )
}
