'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  SKI_RACK_SIZES,
  getSkiRackProduct,
  type SkiRackSize,
} from '@/lib/ski-rack-products'

const STORAGE_KEY = 'reskichile:ski-rack-cart'
const CHANGE_EVENT = 'reskichile:ski-rack-cart-change'
export const MAX_CART_QUANTITY = 10

export interface SkiRackCartItem {
  slug: string
  size: SkiRackSize
  quantity: number
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

  if (existing) {
    existing.quantity = Math.min(MAX_CART_QUANTITY, existing.quantity + safeQuantity)
  } else {
    items.push({ slug, size, quantity: safeQuantity })
  }

  writeCart(items)
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
    item.quantity = Math.min(MAX_CART_QUANTITY, Math.max(1, Math.floor(quantity)))
    writeCart(items)
  }, [])

  const removeItem = useCallback((slug: string, size: SkiRackSize) => {
    writeCart(readCart().filter((item) => item.slug !== slug || item.size !== size))
  }, [])

  const clearCart = useCallback(() => writeCart([]), [])

  return {
    items,
    ready,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    setQuantity,
    removeItem,
    clearCart,
  }
}
