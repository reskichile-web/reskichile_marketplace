'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { PRODUCT_TYPES } from '@/lib/constants'

const TYPE_ICONS: Record<string, string> = {
  esquis: 'M12 2L8 22M16 2L12 22M4 8h16M4 16h12',
  snowboards: 'M12 2v20M8 4c4 2 4 6 4 8s0 6-4 8M16 4c-4 2-4 6-4 8s0 6 4 8',
  botas_esqui: 'M6 22V12a6 6 0 0112 0v10M9 2l3 5 3-5M8 12h8',
  botas_snowboard: 'M7 22V10a5 5 0 0110 0v12M9 6h6M9 14h6',
  bastones: 'M7 2l5 20M12 2l5 20M5 8h14',
  cascos: 'M4 14a8 8 0 1116 0H4zM8 14v4h8v-4M12 2v4',
  guantes: 'M6 14V8a2 2 0 014 0v6M10 8V4a2 2 0 014 0v10M14 6V4a2 2 0 014 0v10M6 14l-2 6h16l-2-6',
  fijaciones: 'M4 8h16v8H4zM8 8V6a4 4 0 018 0v2M8 16v2M16 16v2',
  parkas: 'M8 2h8l2 6v14H6V8zM6 8h12M10 2v4M14 2v4',
  pantalones: 'M8 2h8v8l-2 12H10L8 10z',
  antiparras: 'M2 10a4 4 0 014-4h12a4 4 0 014 4v0a4 4 0 01-4 4H6a4 4 0 01-4-4zM10 10a2 2 0 104 0M12 6v-2',
  mochilas: 'M8 22V6a4 4 0 018 0v16M6 10h12M10 2h4M8 14h8',
  bolsos: 'M4 8h16v12H4zM8 8V6a4 4 0 018 0v2M4 12h16',
  equipo_avalanchas: 'M12 2l8 18H4zM12 8v6M12 16h0',
  camaras_accion: 'M4 6h16v12H4zM9 6V4h6v2M12 10a2 2 0 100 4 2 2 0 000-4z',
  otros: 'M12 2L2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
}

interface Props {
  selected?: string
  onSelect?: (type: string) => void
}

export default function CategoryIconBar({ selected, onSelect }: Props) {
  const [hovered, setHovered] = useState<string | null>(null)
  const categories = Object.entries(PRODUCT_TYPES)

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2 px-1">
      {categories.map(([key, label], i) => {
        const isActive = selected === key
        const isHovered = hovered === key

        return (
          <motion.button
            key={key}
            type="button"
            onClick={() => onSelect?.(key)}
            onMouseEnter={() => setHovered(key)}
            onMouseLeave={() => setHovered(null)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className={`relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl shrink-0 transition-colors ${
              isActive
                ? 'bg-brand-500 text-white'
                : isHovered
                  ? 'bg-brand-50 text-brand-500'
                  : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <motion.svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
              animate={{
                scale: isActive || isHovered ? 1.15 : 1,
                rotate: isHovered && !isActive ? [0, -5, 5, 0] : 0,
              }}
              transition={{ duration: 0.3 }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={TYPE_ICONS[key] || TYPE_ICONS.otros} />
            </motion.svg>
            <span className="text-[9px] font-bold leading-tight whitespace-nowrap">{label}</span>

            {/* Active dot */}
            {isActive && (
              <motion.div
                layoutId="category-dot"
                className="absolute -bottom-1 w-1 h-1 bg-brand-500 rounded-full"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </motion.button>
        )
      })}
    </div>
  )
}
