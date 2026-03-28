'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { EASE_OUT_EXPO } from '@/lib/animations'

type PublishPhase = 'compressing' | 'uploading' | 'creating' | 'success'

interface Props {
  phase: PublishPhase
  imageProgress?: { current: number; total: number }
}

const PHASE_CONFIG: Record<PublishPhase, { label: string; sublabel?: string }> = {
  compressing: { label: 'Preparando fotos', sublabel: 'Optimizando calidad...' },
  uploading: { label: 'Subiendo fotos', sublabel: '' },
  creating: { label: 'Creando publicación', sublabel: 'Casi listo...' },
  success: { label: 'Publicado', sublabel: 'Redirigiendo...' },
}

const CONFETTI_COLORS = ['#2674bf', '#4a93d3', '#7eb1e1', '#22c55e', '#eab308', '#f97316']

function Confetti() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[100000]">
      {Array.from({ length: 24 }).map((_, i) => {
        const left = 10 + (i * 3.3) + (i % 3) * 5
        const delay = (i % 5) * 0.1
        const duration = 1.5 + (i % 3) * 0.5
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
        const size = 5 + (i % 3) * 2

        return (
          <div
            key={i}
            className="absolute rounded-sm"
            style={{
              left: `${left}%`,
              top: '-5%',
              width: size,
              height: size * 1.2,
              backgroundColor: color,
              opacity: 0.8,
              animation: `confetti-fall ${duration}s ${delay}s ease-in forwards`,
            }}
          />
        )
      })}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 0.9; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

function MountainIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 80" fill="none">
      <path d="M10 70 L35 25 L50 45 L65 20 L95 70 Z" fill="currentColor" opacity={0.08} />
      <path d="M10 70 L35 25 L50 45 L65 20 L95 70" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" fill="none" />
      <path d="M35 25 L42 35 L50 45" stroke="currentColor" strokeWidth={1} opacity={0.3} />
      <circle cx="85" cy="22" r="6" stroke="currentColor" strokeWidth={1.2} fill="none" opacity={0.2} />
    </svg>
  )
}

export default function PublishLoadingOverlay({ phase, imageProgress }: Props) {
  const config = PHASE_CONFIG[phase]
  const isSuccess = phase === 'success'

  const progressPercent = phase === 'uploading' && imageProgress
    ? Math.round((imageProgress.current / imageProgress.total) * 100)
    : phase === 'compressing' ? 15
    : phase === 'creating' ? 90
    : 100

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[99999] bg-white flex flex-col items-center justify-center px-6"
    >
      {/* Confetti on success */}
      {isSuccess && <Confetti />}

      {/* Background subtle pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <MountainIcon className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] text-brand-500 opacity-[0.03]" />
      </div>

      <div className="relative flex flex-col items-center max-w-xs w-full">
        {/* Logo */}
        <motion.img
          src="/logo.svg"
          alt=""
          className="h-8 mb-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        />

        {/* Icon / Checkmark */}
        <AnimatePresence mode="wait">
          {isSuccess ? (
            <motion.div
              key="check"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-8"
            >
              <motion.svg
                className="w-10 h-10 text-green-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <motion.path
                  d="M5 13l4 4L19 7"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                />
              </motion.svg>
            </motion.div>
          ) : (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-8"
            >
              {/* Animated dots */}
              <div className="flex items-center justify-center gap-1.5">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-3 h-3 rounded-full bg-brand-500"
                    animate={{
                      y: [0, -12, 0],
                      opacity: [0.3, 1, 0.3],
                    }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      delay: i * 0.15,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Text */}
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
            className="text-center mb-8"
          >
            <h2 className="font-body text-xl font-black text-gray-900">
              {config.label}
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {phase === 'uploading' && imageProgress
                ? `Foto ${imageProgress.current} de ${imageProgress.total}`
                : config.sublabel}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Progress bar */}
        {!isSuccess && (
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-brand-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        )}
      </div>
    </motion.div>
  )
}
