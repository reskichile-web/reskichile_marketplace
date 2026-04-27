'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Folder, ChevronDown, Sparkles, MapPin, DollarSign } from 'lucide-react'
import {
  GiSkis, GiSnowboard, GiSkiBoot, GiWalkingBoot,
  GiSkier, GiWinterGloves, GiMonclerJacket,
  GiArmoredPants, GiLightBackpack,
  GiDuffelBag, GiMountaintop, GiFullMotorcycleHelmet,
  GiProtectionGlasses, GiRadarSweep, GiPhotoCamera,
} from 'react-icons/gi'
import { FaSkiingNordic } from 'react-icons/fa'
import { AlertTriangle, CheckCircle2, Star, PackageCheck } from 'lucide-react'
import { PRODUCT_TYPES, CONDITIONS, REGIONS } from '@/lib/constants'
import type { IconType } from 'react-icons'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TYPE_ICONS: Record<string, any> = {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CONDITION_ICONS: Record<string, any> = {
  nuevo_sellado: PackageCheck,
  nuevo: Sparkles,
  usado_como_nuevo: Star,
  usado_buen_estado: CheckCircle2,
  usado_aceptable: AlertTriangle,
}

interface Props {
  selectedTypes: string[]
  selectedConditions: string[]
  selectedRegions: string[]
  typeCounts: Record<string, number>
  conditionCounts: Record<string, number>
  regionCounts: Record<string, number>
  totalCount: number
}

export default function CatalogSidebar({
  selectedTypes,
  selectedConditions,
  selectedRegions,
  typeCounts,
  conditionCounts,
  regionCounts,
  totalCount,
}: Props) {
  const router = useRouter()
  const sp = useSearchParams()
  const [open, setOpen] = useState({ types: true, conditions: false, regions: false })

  function toggleSection(key: 'types' | 'conditions' | 'regions') {
    setOpen(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function toggleFilter(param: 'product_type' | 'condition' | 'region', value: string) {
    const current = (sp.get(param) || '').split(',').filter(Boolean)
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value]

    const params = new URLSearchParams(sp.toString())
    if (next.length) params.set(param, next.join(','))
    else params.delete(param)
    params.delete('page')

    router.push(`/catalogo?${params.toString()}`)
  }

  return (
    <div className="text-sm">
      {/* Productos */}
      <SectionHeader
        icon={<Folder className="w-4 h-4" />}
        label="Productos"
        count={totalCount}
        isOpen={open.types}
        onToggle={() => toggleSection('types')}
        active={selectedTypes.length > 0}
      />
      {open.types && (
        <TreeList>
          {Object.entries(PRODUCT_TYPES).map(([key, label]) => {
            const Icon = TYPE_ICONS[key] as IconType
            const checked = selectedTypes.includes(key)
            const count = typeCounts[key] || 0
            return (
              <TreeItem
                key={key}
                checked={checked}
                onChange={() => toggleFilter('product_type', key)}
                icon={Icon ? <Icon className="w-4 h-4 shrink-0" /> : null}
                label={label}
                count={count}
              />
            )
          })}
        </TreeList>
      )}

      {/* Condicion */}
      <SectionHeader
        icon={<Sparkles className="w-4 h-4" />}
        label="Condicion"
        isOpen={open.conditions}
        onToggle={() => toggleSection('conditions')}
        active={selectedConditions.length > 0}
      />
      {open.conditions && (
        <TreeList>
          {Object.entries(CONDITIONS).map(([key, label]) => {
            const Icon = CONDITION_ICONS[key]
            const checked = selectedConditions.includes(key)
            const count = conditionCounts[key] || 0
            return (
              <TreeItem
                key={key}
                checked={checked}
                onChange={() => toggleFilter('condition', key)}
                icon={Icon ? <Icon className="w-4 h-4 shrink-0" /> : null}
                label={label}
                count={count}
              />
            )
          })}
        </TreeList>
      )}

      {/* Region */}
      <SectionHeader
        icon={<MapPin className="w-4 h-4" />}
        label="Region"
        isOpen={open.regions}
        onToggle={() => toggleSection('regions')}
        active={selectedRegions.length > 0}
      />
      {open.regions && (
        <TreeList>
          {REGIONS.map(region => {
            const checked = selectedRegions.includes(region)
            const count = regionCounts[region] || 0
            return (
              <TreeItem
                key={region}
                checked={checked}
                onChange={() => toggleFilter('region', region)}
                icon={<MapPin className="w-3.5 h-3.5 shrink-0 text-gray-400" />}
                label={region}
                count={count}
              />
            )
          })}
        </TreeList>
      )}
    </div>
  )
}

function SectionHeader({
  icon,
  label,
  count,
  isOpen,
  onToggle,
  active,
}: {
  icon: React.ReactNode
  label: string
  count?: number
  isOpen: boolean
  onToggle: () => void
  active: boolean
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
        active ? 'bg-brand-50 text-brand-600' : 'hover:bg-gray-50 text-gray-700'
      }`}
    >
      <span className={active ? 'text-brand-500' : 'text-gray-400'}>{icon}</span>
      <span className="font-body font-semibold flex-1 text-left">{label}</span>
      {typeof count === 'number' && (
        <span className="bg-brand-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md min-w-[20px] text-center">
          {count}
        </span>
      )}
      <ChevronDown
        className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
      />
    </button>
  )
}

function TreeList({ children }: { children: React.ReactNode }) {
  return (
    <div className="ml-5 mt-1 mb-3 pl-4 border-l border-gray-200 space-y-0.5">
      {children}
    </div>
  )
}

function TreeItem({
  checked,
  onChange,
  icon,
  label,
  count,
}: {
  checked: boolean
  onChange: () => void
  icon: React.ReactNode
  label: string
  count: number
}) {
  return (
    <label
      className="relative flex items-center gap-2.5 py-1.5 px-2 cursor-pointer rounded hover:bg-gray-50 group"
    >
      {/* Horizontal connector line */}
      <span className="absolute -left-4 top-1/2 w-3 h-px bg-gray-200" aria-hidden />

      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-3.5 h-3.5 rounded border-gray-300 text-brand-500 focus:ring-brand-500/30 cursor-pointer shrink-0"
      />
      <span className="text-gray-500 group-hover:text-gray-700">{icon}</span>
      <span
        className={`flex-1 truncate ${
          checked ? 'text-brand-600 font-semibold' : 'text-gray-600'
        }`}
      >
        {label}
      </span>
      {count > 0 && (
        <span className="text-xs text-gray-400 tabular-nums">{count}</span>
      )}
    </label>
  )
}
