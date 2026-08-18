'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  inventoryBySlug,
  type RackInventoryBySlug,
  type RackInventoryResponse,
} from '@/lib/rack-inventory'

export function useRackInventory() {
  const [inventory, setInventory] = useState<RackInventoryBySlug>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/racks/inventory', {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      if (!response.ok) throw new Error('inventory request failed')
      const data = await response.json() as RackInventoryResponse
      setInventory(inventoryBySlug(Array.isArray(data.products) ? data.products : []))
      setError(false)
    } catch {
      setInventory({})
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { inventory, loading, error, refresh }
}
