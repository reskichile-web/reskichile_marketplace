'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, Menu } from 'lucide-react'
import { CONDITIONS, REGIONS } from '@/lib/constants'
import {
  TIPO_OPTIONS,
  GENERO_OPTIONS,
  LARGO_BUCKETS,
  ANCHO_BUCKETS,
  CONEXION_OPTIONS,
  type SkiCounts,
} from '@/lib/ski-filters'

interface Props {
  selectedConditions: string[]
  selectedRegions: string[]
  brand: string
  conditionCounts: Record<string, number>
  regionCounts: Record<string, number>
  isEsquisOnly: boolean
  skiCounts: SkiCounts
  selectedTipo: string[]
  selectedGenero: string[]
  selectedLargo: string[]
  selectedAncho: string[]
  selectedFij: string
  selectedConexion: string[]
}

type SectionKey =
  | 'conditions'
  | 'regions'
  | 'brand'
  | 'tipo'
  | 'genero'
  | 'largo'
  | 'ancho'
  | 'fij'
  | 'conexion'

export default function CatalogSidebar({
  selectedConditions,
  selectedRegions,
  brand,
  conditionCounts,
  regionCounts,
  isEsquisOnly,
  skiCounts,
  selectedTipo,
  selectedGenero,
  selectedLargo,
  selectedAncho,
  selectedFij,
  selectedConexion,
}: Props) {
  const router = useRouter()
  const sp = useSearchParams()
  const [hidden, setHidden] = useState(false)
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    conditions: false,
    regions: false,
    brand: false,
    tipo: true,
    genero: true,
    largo: true,
    ancho: false,
    fij: false,
    conexion: false,
  })

  function toggleSection(key: SectionKey) {
    setOpen(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function pushParams(mutator: (p: URLSearchParams) => void) {
    const params = new URLSearchParams(sp.toString())
    mutator(params)
    params.delete('page')
    router.push(`/catalogo?${params.toString()}`)
  }

  function toggleMulti(param: string, value: string, alsoClear?: string) {
    const current = (sp.get(param) || '').split(',').filter(Boolean)
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value]
    pushParams(p => {
      if (next.length) p.set(param, next.join(','))
      else p.delete(param)
      if (alsoClear) p.delete(alsoClear)
    })
  }

  function setBrandSearch(value: string) {
    pushParams(p => {
      if (value.trim()) p.set('brand', value.trim())
      else p.delete('brand')
    })
  }

  function setFij(value: '' | 'yes' | 'no') {
    pushParams(p => {
      if (value) p.set('fij', value)
      else p.delete('fij')
      if (value !== 'yes') p.delete('conexion')
    })
  }

  function clearAll() {
    router.push('/catalogo')
  }

  const skiHasFilters =
    isEsquisOnly &&
    (selectedTipo.length > 0 ||
      selectedGenero.length > 0 ||
      selectedLargo.length > 0 ||
      selectedAncho.length > 0 ||
      !!selectedFij ||
      selectedConexion.length > 0)

  const hasFilters =
    selectedConditions.length > 0 ||
    selectedRegions.length > 0 ||
    !!brand ||
    skiHasFilters

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

      {isEsquisOnly && (
        <>
          <Section
            label="Tipo"
            isOpen={open.tipo}
            onToggle={() => toggleSection('tipo')}
            active={selectedTipo.length > 0}
          >
            {TIPO_OPTIONS.map(opt => {
              const checked = selectedTipo.includes(opt.value)
              const count = skiCounts.tipo[opt.value] || 0
              if (count === 0 && !checked) return null
              return (
                <CheckRow
                  key={opt.value}
                  checked={checked}
                  onChange={() => toggleMulti('tipo', opt.value, 'ancho')}
                  label={opt.label}
                  count={count}
                />
              )
            })}
          </Section>

          <Section
            label="Género"
            isOpen={open.genero}
            onToggle={() => toggleSection('genero')}
            active={selectedGenero.length > 0}
          >
            {GENERO_OPTIONS.map(opt => {
              const checked = selectedGenero.includes(opt.value)
              const count = skiCounts.genero[opt.value] || 0
              if (count === 0 && !checked) return null
              return (
                <CheckRow
                  key={opt.value}
                  checked={checked}
                  onChange={() => toggleMulti('genero', opt.value)}
                  label={opt.label}
                  count={count}
                />
              )
            })}
          </Section>

          <Section
            label="Largo"
            isOpen={open.largo}
            onToggle={() => toggleSection('largo')}
            active={selectedLargo.length > 0}
          >
            {LARGO_BUCKETS.map(b => {
              const checked = selectedLargo.includes(b.key)
              const count = skiCounts.largo[b.key] || 0
              if (count === 0 && !checked) return null
              return (
                <CheckRow
                  key={b.key}
                  checked={checked}
                  onChange={() => toggleMulti('largo', b.key)}
                  label={b.label}
                  count={count}
                />
              )
            })}
          </Section>

          <Section
            label="Ancho (avanzado)"
            isOpen={open.ancho}
            onToggle={() => toggleSection('ancho')}
            active={selectedAncho.length > 0}
          >
            {ANCHO_BUCKETS.map(b => {
              const checked = selectedAncho.includes(b.key)
              const count = skiCounts.ancho[b.key] || 0
              if (count === 0 && !checked) return null
              return (
                <CheckRow
                  key={b.key}
                  checked={checked}
                  onChange={() => toggleMulti('ancho', b.key, 'tipo')}
                  label={b.label}
                  count={count}
                />
              )
            })}
          </Section>

          <Section
            label="Incluye fijaciones"
            isOpen={open.fij}
            onToggle={() => toggleSection('fij')}
            active={!!selectedFij}
          >
            <RadioRow
              label="Cualquiera"
              checked={selectedFij === ''}
              onChange={() => setFij('')}
            />
            <RadioRow
              label="Sí"
              count={skiCounts.fijYes}
              checked={selectedFij === 'yes'}
              onChange={() => setFij('yes')}
            />
            <RadioRow
              label="No"
              count={skiCounts.fijNo}
              checked={selectedFij === 'no'}
              onChange={() => setFij('no')}
            />
          </Section>

          {selectedFij === 'yes' && (
            <Section
              label="Conexión fijaciones"
              isOpen={open.conexion}
              onToggle={() => toggleSection('conexion')}
              active={selectedConexion.length > 0}
            >
              {CONEXION_OPTIONS.map(opt => {
                const checked = selectedConexion.includes(opt.value)
                const count = skiCounts.conexion[opt.value] || 0
                if (count === 0 && !checked) return null
                return (
                  <CheckRow
                    key={opt.value}
                    checked={checked}
                    onChange={() => toggleMulti('conexion', opt.value)}
                    label={opt.label}
                    count={count}
                  />
                )
              })}
            </Section>
          )}
        </>
      )}

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
              onChange={() => toggleMulti('condition', key)}
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
              onChange={() => toggleMulti('region', region)}
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

function RadioRow({
  checked,
  onChange,
  label,
  count,
}: {
  checked: boolean
  onChange: () => void
  label: string
  count?: number
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group">
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="w-3.5 h-3.5 border-gray-300 text-black focus:ring-black/20 cursor-pointer shrink-0"
      />
      <span
        className={`flex-1 truncate text-sm ${
          checked ? 'text-black font-medium' : 'text-gray-600 group-hover:text-black'
        }`}
      >
        {label}
      </span>
      {count != null && count > 0 && (
        <span className="text-xs text-gray-400 tabular-nums">{count}</span>
      )}
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
