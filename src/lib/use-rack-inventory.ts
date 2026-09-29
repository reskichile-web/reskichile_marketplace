'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  fetchRackInventory,
  type RackInventoryBySlug,
} from '@/lib/rack-inventory'

export function useRackInventory() {
  const [inventory, setInventory] = useState<RackInventoryBySlug>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const next = await fetchRackInventory()
      setInventory(next)
      setError(false)
      return next
    } catch {
      setError(true)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { inventory, loading, error, refresh }
}
