'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, Menu } from 'lucide-react'
import { PRODUCT_TYPES, CONDITIONS, REGIONS } from '@/lib/constants'

interface Props {
  selectedTypes: string[]
  selectedConditions: string[]
  selectedRegions: string[]
  brand: string
  typeCounts: Record<string, number>
  conditionCounts: Record<string, number>
  regionCounts: Record<string, number>
}

type SectionKey = 'types' | 'conditions' | 'regions' | 'brand'

export default function CatalogSidebar({
  selectedTypes,
  selectedConditions,
  selectedRegions,
  brand,
  typeCounts,
  conditionCounts,
  regionCounts,
}: Props) {
  const router = useRouter()
  const sp = useSearchParams()
  const [hidden, setHidden] = useState(false)
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    types: true,
    conditions: false,
    regions: false,
    brand: false,
  })

  function toggleSection(key: SectionKey) {
    setOpen(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function toggleFilter(param: 'product_type' | 'condition' | 'region', value: string) {
    const current = (sp.get(param) || '').split(',').filter(Boolean)
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value]
    const params = new URLSearchParams(sp.toString())
    if (next.length) params.set(param, next.join(','))
    else params.delete(param)
    params.delete('page')
    router.push(`/catalogo?${params.toString()}`)
  }

  function setBrandSearch(value: string) {
    const params = new URLSearchParams(sp.toString())
    if (value.trim()) params.set('brand', value.trim())
    else params.delete('brand')
    params.delete('page')
    router.push(`/catalogo?${params.toString()}`)
  }

  function clearAll() {
    router.push('/catalogo')
  }

  const hasFilters =
    selectedTypes.length > 0 ||
    selectedConditions.length > 0 ||
    selectedRegions.length > 0 ||
    !!brand

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => setHidden(false)}
        className="inline-flex items-center gap-2 text-xs font-body font-bold tracking-widest uppercase text-gray-700 hover:text-black transition-colors"
      >
        <Menu className="w-4 h-4" />
        Mostrar filtros
      </button>
    )
  }

  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={() => setHidden(true)}
        className="inline-flex items-center gap-2 text-xs font-body font-bold tracking-widest uppercase text-gray-700 hover:text-black transition-colors mb-6"
      >
        Ocultar filtros
        <Menu className="w-4 h-4" />
      </button>

      <Section
        label="Producto"
        isOpen={open.types}
        onToggle={() => toggleSection('types')}
        active={selectedTypes.length > 0}
      >
        {Object.entries(PRODUCT_TYPES).map(([key, label]) => {
          const checked = selectedTypes.includes(key)
          const count = typeCounts[key] || 0
          if (count === 0 && !checked) return null
          return (
            <CheckRow
              key={key}
              checked={checked}
              onChange={() => toggleFilter('product_type', key)}
              label={label}
              count={count}
            />
          )
        })}
      </Section>

      <Section
        label="Condición"
        isOpen={open.conditions}
        onToggle={() => toggleSection('conditions')}
        active={selectedConditions.length > 0}
      >
        {Object.entries(CONDITIONS).map(([key, label]) => {
          const checked = selectedConditions.includes(key)
          const count = conditionCounts[key] || 0
          if (count === 0 && !checked) return null
          return (
            <CheckRow
              key={key}
              checked={checked}
              onChange={() => toggleFilter('condition', key)}
              label={label}
              count={count}
            />
          )
        })}
      </Section>

      <Section
        label="Región"
        isOpen={open.regions}
        onToggle={() => toggleSection('regions')}
        active={selectedRegions.length > 0}
      >
        {REGIONS.map(region => {
          const checked = selectedRegions.includes(region)
          const count = regionCounts[region] || 0
          if (count === 0 && !checked) return null
          return (
            <CheckRow
              key={region}
              checked={checked}
              onChange={() => toggleFilter('region', region)}
              label={region}
              count={count}
            />
          )
        })}
      </Section>

      <Section
        label="Marca"
        isOpen={open.brand}
        onToggle={() => toggleSection('brand')}
        active={!!brand}
      >
        <BrandSearch defaultValue={brand} onSubmit={setBrandSearch} />
      </Section>

      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="mt-4 text-xs font-body tracking-wider uppercase text-gray-500 hover:text-black transition-colors"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  )
}

function Section({
  label,
  isOpen,
  onToggle,
  active,
  children,
}: {
  label: string
  isOpen: boolean
  onToggle: () => void
  active: boolean
  children: React.ReactNode
}) {
  return (
    <div className="border-t border-gray-200">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between py-4 text-left"
      >
        <span
          className={`text-xs font-body font-bold tracking-widest uppercase ${
            active ? 'text-black' : 'text-gray-700'
          }`}
        >
          {label}
          {active && <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-brand-500 align-middle" />}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && <div className="pb-5 space-y-2">{children}</div>}
    </div>
  )
}

function CheckRow({
  checked,
  onChange,
  label,
  count,
}: {
  checked: boolean
  onChange: () => void
  label: string
  count: number
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-3.5 h-3.5 rounded-sm border-gray-300 text-black focus:ring-black/20 cursor-pointer shrink-0"
      />
      <span
        className={`flex-1 truncate text-sm ${
          checked ? 'text-black font-medium' : 'text-gray-600 group-hover:text-black'
        }`}
      >
        {label}
      </span>
      {count > 0 && <span className="text-xs text-gray-400 tabular-nums">{count}</span>}
    </label>
  )
}

function BrandSearch({
  defaultValue,
  onSubmit,
}: {
  defaultValue: string
  onSubmit: (v: string) => void
}) {
  const [val, setVal] = useState(defaultValue)
  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        onSubmit(val)
      }}
      className="flex gap-2"
    >
      <input
        type="text"
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder="Marca..."
        className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-black"
      />
      <button
        type="submit"
        className="px-3 py-2 bg-black text-white text-xs font-bold uppercase tracking-wider rounded hover:bg-gray-800 transition-colors"
      >
        Ir
      </button>
    </form>
  )
}
