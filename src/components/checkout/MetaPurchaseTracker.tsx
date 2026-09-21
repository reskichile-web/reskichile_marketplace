'use client'

import { useEffect, useRef } from 'react'
import {
  trackMetaPurchase,
  type MetaCommerceItem,
} from '@/lib/meta-pixel'
import { RACK_EVENTS, rackEventDetail } from '@/lib/rack-analytics'
import { track } from '@/lib/track'

const PURCHASE_STORAGE_PREFIX = 'reskichile:rack-purchase:'

export default function MetaPurchaseTracker({
  orderId,
  value,
  items,
}: {
  orderId: string
  value: number
  items: MetaCommerceItem[]
}) {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    trackMetaPurchase({ orderId, value, items })
    try {
      const storageKey = `${PURCHASE_STORAGE_PREFIX}${orderId}`
      if (!window.localStorage.getItem(storageKey)) {
        window.localStorage.setItem(storageKey, new Date().toISOString())
        track({
          type: 'click',
          name: RACK_EVENTS.purchase,
          category: rackEventDetail({
            order: orderId,
            units: items.reduce((total, item) => total + item.quantity, 0),
            value,
          }),
        })
      }
    } catch {
      // Purchase analytics must never affect the confirmed-order view.
    }
  }, [items, orderId, value])

  return null
}
