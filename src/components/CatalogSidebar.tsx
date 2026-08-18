'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
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
  selectedBrands: string[]
  minPrice?: number
  maxPrice?: number
  conditionCounts: Record<string, number>
  regionCounts: Record<string, number>
  brandCounts: Record<string, number>
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
  | 'price'
  | 'conditions'
  | 'regions'
  | 'brands'
  | 'tipo'
  | 'genero'
  | 'largo'
  | 'ancho'
  | 'fij'
  | 'conexion'

export default function CatalogSidebar({
  selectedConditions,
  selectedRegions,
  selectedBrands,
  minPrice,
  maxPrice,
  conditionCounts,
  regionCounts,
  brandCounts,
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
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    price: true,
    conditions: false,
    regions: false,
    brands: false,
    tipo: false,
    genero: false,
    largo: false,
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

  function setPrice(min: number | undefined, max: number | undefined) {
    pushParams(p => {
      if (min != null && !isNaN(min)) p.set('min_price', String(min))
      else p.delete('min_price')
      if (max != null && !isNaN(max)) p.set('max_price', String(max))
      else p.delete('max_price')
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
    selectedBrands.length > 0 ||
    minPrice != null ||
    maxPrice != null ||
    skiHasFilters

  // Sorted brand list by count desc
  const brandList = Object.entries(brandCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }))

  return (
    <div className="text-sm lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-2 lg:-mr-2">
      {/* 1. Precio */}
      <Section
        label="Precio"
        isOpen={open.price}
        onToggle={() => toggleSection('price')}
        active={minPrice != null || maxPrice != null}
      >
        <PriceRange
          minPrice={minPrice}
          maxPrice={maxPrice}
          onSubmit={setPrice}
        />
      </Section>

      {/* 2. Condición */}
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

      {/* 3. Género (esquis) */}
      {isEsquisOnly && (
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
      )}

      {/* 4. Atributos del producto (esquis) */}
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

      {/* 5. Marca (lista detectada) */}
      <Section
        label="Marca"
        isOpen={open.brands}
        onToggle={() => toggleSection('brands')}
        active={selectedBrands.length > 0}
      >
        {brandList.length === 0 && (
          <p className="text-xs text-gray-400">No hay marcas disponibles.</p>
        )}
        {brandList.map(({ name, count }) => {
          const checked = selectedBrands.includes(name)
          return (
            <CheckRow
              key={name}
              checked={checked}
              onChange={() => toggleMulti('brand', name)}
              label={name}
              count={count}
            />
          )
        })}
      </Section>

      {/* 6. Región */}
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
          {active && (
            <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-brand-500 align-middle" />
          )}
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

function PriceRange({
  minPrice,
  maxPrice,
  onSubmit,
}: {
  minPrice?: number
  maxPrice?: number
  onSubmit: (min: number | undefined, max: number | undefined) => void
}) {
  const [min, setMin] = useState(minPrice != null ? String(minPrice) : '')
  const [max, setMax] = useState(maxPrice != null ? String(maxPrice) : '')

  // Sync local state when URL changes externally (e.g. clearAll)
  useEffect(() => {
    setMin(minPrice != null ? String(minPrice) : '')
    setMax(maxPrice != null ? String(maxPrice) : '')
  }, [minPrice, maxPrice])

  function apply() {
    const minN = min === '' ? undefined : Number(min)
    const maxN = max === '' ? undefined : Number(max)
    onSubmit(minN, maxN)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={min}
          onChange={e => setMin(e.target.value.replace(/\D/g, ''))}
          onBlur={apply}
          onKeyDown={e => e.key === 'Enter' && apply()}
          placeholder="Mín"
          className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-black tabular-nums"
        />
        <span className="text-gray-400 text-sm">–</span>
        <input
          type="number"
          inputMode="numeric"
          value={max}
          onChange={e => setMax(e.target.value.replace(/\D/g, ''))}
          onBlur={apply}
          onKeyDown={e => e.key === 'Enter' && apply()}
          placeholder="Máx"
          className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-black tabular-nums"
        />
      </div>
      <p className="text-[10px] text-gray-400 uppercase tracking-wider">CLP</p>
    </div>
  )
}
