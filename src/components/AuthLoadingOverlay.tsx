'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { EASE_OUT_EXPO } from '@/lib/animations'

type AuthPhase = 'verifying' | 'success'

interface Props {
  phase: AuthPhase
}

const PHASE_CONFIG: Record<AuthPhase, { label: string; sublabel?: string }> = {
  verifying: { label: 'Verificando', sublabel: 'Creando tu cuenta...' },
  success: { label: '¡Cuenta creada!', sublabel: 'Redirigiendo...' },
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

export default function AuthLoadingOverlay({ phase }: Props) {
  const config = PHASE_CONFIG[phase]
  const isSuccess = phase === 'success'
  const progressPercent = isSuccess ? 100 : 70

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
              className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mb-8"
            >
              <motion.svg
                className="w-10 h-10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth={3.5}
                strokeLinecap="square"
                strokeLinejoin="miter"
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
            <p className="text-sm text-gray-400 mt-1">{config.sublabel}</p>
          </motion.div>
        </AnimatePresence>

        {/* Progress bar (hidden on success) */}
        {!isSuccess && (
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-brand-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        )}
      </div>
    </motion.div>
  )
}
