'use client'

import { useEffect, useRef } from 'react'
import {
  trackMetaPurchase,
  type MetaCommerceItem,
} from '@/lib/meta-pixel'

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
  }, [items, orderId, value])

  return null
}
