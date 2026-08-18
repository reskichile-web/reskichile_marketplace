'use client'

import { useEffect } from 'react'
import { useSkiRackCart } from '@/lib/ski-rack-cart'

export default function ClearSkiRackCart() {
  const { clearCart } = useSkiRackCart()

  useEffect(() => {
    clearCart()
  }, [clearCart])

  return null
}
