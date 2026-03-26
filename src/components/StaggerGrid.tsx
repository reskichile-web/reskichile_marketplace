'use client'

import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/animations'

interface GridProps {
  children: React.ReactNode
  className?: string
}

export function StaggerGrid({ children, className }: GridProps) {
  return (
    <motion.div
      className={className || 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5'}
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children }: { children: React.ReactNode }) {
  return (
    <motion.div variants={staggerItem}>
      {children}
    </motion.div>
  )
}
