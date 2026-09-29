'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  SKI_RACK_SIZES,
  getSkiRackProduct,
  type SkiRackSize,
} from '@/lib/ski-rack-products'
import { RACK_EVENTS, rackEventDetail } from '@/lib/rack-analytics'
import { track } from '@/lib/track'
import { variantAvailability, type RackInventoryBySlug } from '@/lib/rack-inventory'

const STORAGE_KEY = 'reskichile:ski-rack-cart'
const CHANGE_EVENT = 'reskichile:ski-rack-cart-change'
const OPEN_EVENT = 'reskichile:ski-rack-cart-open'
export const MAX_CART_QUANTITY = 10

export interface SkiRackCartItem {
  slug: string
  size: SkiRackSize
  quantity: number
}

export interface SkiRackStockAdjustment extends SkiRackCartItem {
  previousQuantity: number
}

function stockLimit(available: number): number {
  return Number.isSafeInteger(available) && available > 0
    ? Math.min(MAX_CART_QUANTITY, available) : 0
}

export function remainingRackCartQuantity(
  items: SkiRackCartItem[], slug: string, size: SkiRackSize, available: number,
): number {
  const inCart = items.reduce((sum, item) => (
    item.slug === slug && item.size === size ? sum + item.quantity : sum
  ), 0)
  return Math.max(0, stockLimit(available) - inCart)
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

    const grouped = new Map<string, SkiRackCartItem>()
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const candidate = item as Record<string, unknown>
      if (
        typeof candidate.slug !== 'string' ||
        !getSkiRackProduct(candidate.slug) ||
        !validSize(candidate.size) ||
        !Number.isSafeInteger(candidate.quantity) || Number(candidate.quantity) <= 0
      ) {
        continue
      }

      const key = `${candidate.slug}:${candidate.size}`
      grouped.set(key, {
        slug: candidate.slug,
        size: candidate.size,
        quantity: Math.min(MAX_CART_QUANTITY, (grouped.get(key)?.quantity ?? 0) + Number(candidate.quantity)),
      })
    }
    return [...grouped.values()]
  } catch {
    return []
  }
}

function writeCart(items: SkiRackCartItem[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function addSkiRackCartItem(slug: string, size: SkiRackSize, quantity: number, available: number): number {
  if (typeof window === 'undefined' || !getSkiRackProduct(slug) || !validSize(size)
    || !Number.isSafeInteger(quantity) || quantity <= 0) return 0

  // Read at the moment of mutation, rather than trusting a React render's
  // snapshot. Repeated clicks include every unit already persisted.
  const items = readCart()
  const addedQuantity = Math.min(quantity, remainingRackCartQuantity(items, slug, size, available))
  if (addedQuantity <= 0) return 0
  const existing = items.find((item) => item.slug === slug && item.size === size)

  const previousQuantity = existing?.quantity || 0
  if (existing) {
    existing.quantity += addedQuantity
  } else {
    items.push({ slug, size, quantity: addedQuantity })
  }

  writeCart(items)
  const nextQuantity = previousQuantity + addedQuantity
  if (addedQuantity > 0) {
    track({
      type: 'click',
      name: RACK_EVENTS.cartAdd,
      category: rackEventDetail({ slug, size, qty: addedQuantity, cartQty: nextQuantity }),
    })
  }
  return addedQuantity
}

export function setSkiRackCartQuantity(slug: string, size: SkiRackSize, quantity: number, available: number) {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || stockLimit(available) === 0) return
  const items = readCart()
  const item = items.find(entry => entry.slug === slug && entry.size === size)
  if (!item) return
  const previousQuantity = item.quantity
  const nextQuantity = Math.min(stockLimit(available), quantity)
  if (previousQuantity === nextQuantity) return
  item.quantity = nextQuantity
  writeCart(items)
  track({
    type: 'click', name: RACK_EVENTS.cartQuantity,
    category: rackEventDetail({ slug, size, from: previousQuantity, to: nextQuantity }),
  })
}

/** Repair carts saved before this fix, only after a successful stock lookup. */
export function reconcileSkiRackCart(inventory: RackInventoryBySlug): SkiRackStockAdjustment[] {
  const changes: SkiRackStockAdjustment[] = []
  const items = readCart().flatMap(item => {
    const quantity = Math.min(item.quantity, stockLimit(variantAvailability(inventory[item.slug], item.size)))
    if (quantity !== item.quantity) changes.push({ ...item, previousQuantity: item.quantity, quantity })
    return quantity > 0 ? [{ ...item, quantity }] : []
  })
  if (changes.length > 0) writeCart(items)
  return changes
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

export function useSkiRackCart(verifiedInventory?: RackInventoryBySlug) {
  const [items, setItems] = useState<SkiRackCartItem[]>([])
  const [ready, setReady] = useState(false)
  const [stockAdjustments, setStockAdjustments] = useState<SkiRackStockAdjustment[]>([])

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

  useEffect(() => {
    if (!ready || !verifiedInventory) return
    const changes = reconcileSkiRackCart(verifiedInventory)
    if (changes.length > 0) setStockAdjustments(changes)
  }, [ready, verifiedInventory])

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
    setQuantity: setSkiRackCartQuantity,
    stockAdjustments,
    removeItem,
    clearCart,
  }
}
