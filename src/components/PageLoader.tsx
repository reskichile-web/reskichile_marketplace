'use client'

import { motion, AnimatePresence } from 'framer-motion'
import Spinner from './Spinner'
import { fadeIn } from '@/lib/animations'

interface Props {
  loading: boolean
  children: React.ReactNode
  className?: string
  skeleton?: React.ReactNode
}

export default function PageLoader({ loading, children, className, skeleton }: Props) {
  return (
    <AnimatePresence mode="wait">
      {loading ? (
        skeleton ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {skeleton}
          </motion.div>
        ) : (
          <motion.div
            key="loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={className}
          >
            <div className="flex items-center justify-center min-h-[40vh]">
              <Spinner size="lg" />
            </div>
          </motion.div>
        )
      ) : (
        <motion.div
          key="content"
          variants={fadeIn}
          initial="hidden"
          animate="visible"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
