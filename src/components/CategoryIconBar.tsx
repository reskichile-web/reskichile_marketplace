'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { PRODUCT_TYPES } from '@/lib/constants'
import {
  GiSkis, GiSnowboard, GiSkiBoot, GiWalkingBoot,
  GiSkier, GiWinterGloves, GiMonclerJacket,
  GiArmoredPants, GiLightBackpack,
  GiDuffelBag, GiMountaintop, GiFullMotorcycleHelmet,
  GiProtectionGlasses, GiRadarSweep,
  GiPhotoCamera,
} from 'react-icons/gi'
import { FaSkiingNordic } from 'react-icons/fa'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TYPE_ICON_COMPONENTS: Record<string, any> = {
  esquis: GiSkis,
  snowboards: GiSnowboard,
  botas_esqui: GiSkiBoot,
  botas_snowboard: GiWalkingBoot,
  bastones: GiSkier,
  cascos: GiFullMotorcycleHelmet,
  guantes: GiWinterGloves,
  fijaciones: FaSkiingNordic,
  parkas: GiMonclerJacket,
  pantalones: GiArmoredPants,
  antiparras: GiProtectionGlasses,
  mochilas: GiLightBackpack,
  bolsos: GiDuffelBag,
  equipo_avalanchas: GiRadarSweep,
  camaras_accion: GiPhotoCamera,
  otros: GiMountaintop,
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
            <motion.div
              animate={{
                scale: isActive || isHovered ? 1.15 : 1,
                rotate: isHovered && !isActive ? [0, -5, 5, 0] : 0,
              }}
              transition={{ duration: 0.3 }}
            >
              {(() => {
                const Icon = TYPE_ICON_COMPONENTS[key] || TYPE_ICON_COMPONENTS.otros
                return <Icon className="w-6 h-6" />
              })()}
            </motion.div>
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
