'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  SKI_RACK_SIZES,
  getSkiRackProduct,
  type SkiRackSize,
} from '@/lib/ski-rack-products'
import { RACK_EVENTS, rackEventDetail } from '@/lib/rack-analytics'
import { track } from '@/lib/track'

const STORAGE_KEY = 'reskichile:ski-rack-cart'
const CHANGE_EVENT = 'reskichile:ski-rack-cart-change'
const OPEN_EVENT = 'reskichile:ski-rack-cart-open'
export const MAX_CART_QUANTITY = 10

export interface SkiRackCartItem {
  slug: string
  size: SkiRackSize
  quantity: number
}

export function shouldShowSkiRackCart({
  itemCount,
  ready,
  showWhenEmpty,
}: {
  itemCount: number
  ready: boolean
  showWhenEmpty: boolean
}) {
  return showWhenEmpty || (ready && itemCount > 0)
}

function validSize(value: unknown): value is SkiRackSize {
  return SKI_RACK_SIZES.includes(value as SkiRackSize)
}

function readCart(): SkiRackCartItem[] {
  if (typeof window === 'undefined') return []

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(parsed)) return []

    return parsed.flatMap((item): SkiRackCartItem[] => {
      if (!item || typeof item !== 'object') return []
      const candidate = item as Record<string, unknown>
      if (
        typeof candidate.slug !== 'string' ||
        !getSkiRackProduct(candidate.slug) ||
        !validSize(candidate.size) ||
        !Number.isInteger(candidate.quantity)
      ) {
        return []
      }

      return [{
        slug: candidate.slug,
        size: candidate.size,
        quantity: Math.min(MAX_CART_QUANTITY, Math.max(1, Number(candidate.quantity))),
      }]
    })
  } catch {
    return []
  }
}

function writeCart(items: SkiRackCartItem[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function addSkiRackCartItem(slug: string, size: SkiRackSize, quantity: number) {
  if (typeof window === 'undefined' || !getSkiRackProduct(slug) || !validSize(size)) return

  const safeQuantity = Math.min(MAX_CART_QUANTITY, Math.max(1, Math.floor(quantity)))
  const items = readCart()
  const existing = items.find((item) => item.slug === slug && item.size === size)

  const previousQuantity = existing?.quantity || 0
  if (existing) {
    existing.quantity = Math.min(MAX_CART_QUANTITY, existing.quantity + safeQuantity)
  } else {
    items.push({ slug, size, quantity: safeQuantity })
  }

  writeCart(items)
  const nextQuantity = items.find(item => item.slug === slug && item.size === size)?.quantity || 0
  const addedQuantity = Math.max(0, nextQuantity - previousQuantity)
  if (addedQuantity > 0) {
    track({
      type: 'click',
      name: RACK_EVENTS.cartAdd,
      category: rackEventDetail({ slug, size, qty: addedQuantity, cartQty: nextQuantity }),
    })
  }
}

export function openSkiRackCart() {
  if (typeof window === 'undefined') return
  const items = readCart()
  track({
    type: 'click',
    name: RACK_EVENTS.cartOpen,
    category: rackEventDetail({
      lines: items.length,
      units: items.reduce((total, item) => total + item.quantity, 0),
    }),
  })
  window.dispatchEvent(new Event(OPEN_EVENT))
}

export function subscribeToSkiRackCartOpen(listener: () => void) {
  if (typeof window === 'undefined') return () => undefined
  window.addEventListener(OPEN_EVENT, listener)
  return () => window.removeEventListener(OPEN_EVENT, listener)
}

export function useSkiRackCart() {
  const [items, setItems] = useState<SkiRackCartItem[]>([])
  const [ready, setReady] = useState(false)

  const refresh = useCallback(() => {
    setItems(readCart())
    setReady(true)
  }, [])

  useEffect(() => {
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener(CHANGE_EVENT, refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener(CHANGE_EVENT, refresh)
    }
  }, [refresh])

  const setQuantity = useCallback((slug: string, size: SkiRackSize, quantity: number) => {
    const items = readCart()
    const item = items.find((entry) => entry.slug === slug && entry.size === size)
    if (!item) return
    const previousQuantity = item.quantity
    const nextQuantity = Math.min(MAX_CART_QUANTITY, Math.max(1, Math.floor(quantity)))
    if (previousQuantity === nextQuantity) return
    item.quantity = nextQuantity
    writeCart(items)
    track({
      type: 'click',
      name: RACK_EVENTS.cartQuantity,
      category: rackEventDetail({ slug, size, from: previousQuantity, to: nextQuantity }),
    })
  }, [])

  const removeItem = useCallback((slug: string, size: SkiRackSize) => {
    const items = readCart()
    const removed = items.find(item => item.slug === slug && item.size === size)
    writeCart(items.filter((item) => item.slug !== slug || item.size !== size))
    if (removed) {
      track({
        type: 'click',
        name: RACK_EVENTS.cartRemove,
        category: rackEventDetail({ slug, size, qty: removed.quantity }),
      })
    }
  }, [])

  const clearCart = useCallback(() => {
    const items = readCart()
    writeCart([])
    if (items.length > 0) {
      track({
        type: 'click',
        name: RACK_EVENTS.cartClear,
        category: rackEventDetail({
          lines: items.length,
          units: items.reduce((total, item) => total + item.quantity, 0),
        }),
      })
    }
  }, [])

  return {
    items,
    ready,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    setQuantity,
    removeItem,
    clearCart,
  }
}
