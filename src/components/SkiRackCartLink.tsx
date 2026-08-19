'use client'

import Link from 'next/link'
import { shouldShowSkiRackCart, useSkiRackCart } from '@/lib/ski-rack-cart'

export default function SkiRackCartLink({ showWhenEmpty = false }: { showWhenEmpty?: boolean }) {
  const { itemCount, ready } = useSkiRackCart()

  if (!shouldShowSkiRackCart({ itemCount, ready, showWhenEmpty })) return null

  return (
    <Link
      href="/carrito"
      className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center text-gray-700 transition-colors hover:text-brand-500"
      aria-label={itemCount ? `Carrito, ${itemCount} productos` : 'Carrito'}
    >
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386a1.5 1.5 0 011.455 1.136L5.4 5.37m0 0h14.35l-1.5 7.5H6.9L5.4 5.37zM8.25 20.25a.75.75 0 100-1.5.75.75 0 000 1.5zm8.25 0a.75.75 0 100-1.5.75.75 0 000 1.5zM7.2 12.87l-.45 2.25a1.5 1.5 0 001.47 1.8h9.03" />
      </svg>
      {itemCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[9px] font-bold leading-none text-white">
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      )}
    </Link>
  )
}
