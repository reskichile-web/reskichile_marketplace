'use client'

import { useEffect, useState } from 'react'
import { subscribeToSkiRackCartOpen } from '@/lib/ski-rack-cart'
import SkiRackCartDrawer from './SkiRackCartDrawer'

export default function SkiRackCartDrawerHost() {
  const [open, setOpen] = useState(false)

  useEffect(() => subscribeToSkiRackCartOpen(() => setOpen(true)), [])

  return open ? <SkiRackCartDrawer open onClose={() => setOpen(false)} /> : null
}
