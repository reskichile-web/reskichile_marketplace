export const EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as [number, number, number, number]

export const DURATION = {
  fast: 0.2,
  normal: 0.3,
  slow: 0.6,
} as const

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.normal, ease: EASE_OUT_EXPO } },
}

export const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: DURATION.normal, ease: EASE_OUT_EXPO } },
}

export const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
}

export const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: DURATION.normal, ease: EASE_OUT_EXPO } },
}
