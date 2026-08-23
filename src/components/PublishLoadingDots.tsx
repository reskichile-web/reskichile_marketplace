'use client'

import { motion } from 'framer-motion'

export default function PublishLoadingDots({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center gap-1.5 ${className}`}
      data-testid="publish-loading-dots"
      role="status"
      aria-label="Procesando"
    >
      {[0, 1, 2].map(index => (
        <motion.span
          key={index}
          className="h-3 w-3 rounded-full bg-brand-500"
          animate={{
            y: [0, -12, 0],
            opacity: [0.3, 1, 0.3],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: index * 0.15,
            ease: 'easeInOut',
          }}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}
