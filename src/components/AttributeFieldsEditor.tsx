'use client'

import type { AttributeField } from '@/lib/constants'
import BrandInput from '@/components/BrandInput'

/** Tiny info icon with a hover tooltip (used next to attribute labels). */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group/info align-middle">
      <svg className="w-3 h-3 text-gray-300 hover:text-gray-500 cursor-help" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/info:block bg-gray-900 text-white text-[10px] leading-snug rounded-lg px-2.5 py-1.5 w-44 text-center z-30 shadow-lg">
        {text}
      </span>
    </span>
  )
}

interface Props {
  fields: AttributeField[]
  values: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
}

function nextGenderSelection(current: string[], value: string, selected: boolean): string[] {
  if (selected) return current.filter(item => item !== value)
  if (value === 'unisex') return ['unisex', ...current.filter(item => !['hombre', 'mujer'].includes(item))]
  if (value === 'hombre' || value === 'mujer') {
    return [...current.filter(item => item !== 'unisex'), value]
  }
  return [...current, value]
}

export function AttributeButtonSelect({
  field,
  value,
  onChange,
}: {
  field: AttributeField
  value: unknown
  onChange: (value: string) => void
}) {
  return (
    <div className="sm:col-span-2">
      <label className="flex items-center gap-1.5 text-sm font-medium mb-2">
        {field.label}
        {field.info && <InfoTip text={field.info} />}
      </label>
      <div className={`grid gap-2 ${field.key === 'flex' ? 'grid-cols-4 sm:grid-cols-6' : 'grid-cols-3 sm:grid-cols-4'}`}>
        {(field.options || []).map(option => {
          const selected = value === option
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option)}
              className={`min-h-11 rounded-lg border-2 px-2 py-2 text-sm tabular-nums transition-colors ${
                selected
                  ? 'border-brand-500 bg-brand-50 font-bold text-brand-600'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-gray-900'
              }`}
            >
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Attribute editor used by the /vender form. Mirrors the styling of the
 * rest of the product form (labels text-sm font-medium, inputs px-3
 * py-2.5 rounded-lg, selection chips border-2 + brand-50). Required fields
 * are validated by the publication flow before the product is created.
 */
export default function AttributeFieldsEditor({ fields, values, onChange }: Props) {
  if (fields.length === 0) return null

  const visibleFields = fields.filter(field => (
    !field.key.startsWith('fijaciones_') || values.incluye_fijaciones === true
  ))

  const chipCls = (selected: boolean) =>
    `px-3 py-2.5 rounded-lg border-2 text-sm whitespace-nowrap transition-all ${
      selected
        ? 'border-brand-500 bg-brand-50 text-brand-500 font-medium'
        : 'border-gray-100 text-gray-500 hover:border-gray-300'
    }`

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {visibleFields.map(field => {
        if (field.type === 'multiselect') {
          const current = Array.isArray(values[field.key]) ? (values[field.key] as string[]) : []
          return (
            <div key={field.key} className="sm:col-span-2">
              <label className="flex items-center gap-1.5 text-sm font-medium mb-1">
                {field.label}
                {field.info && <InfoTip text={field.info} />}
              </label>
              <div className="flex flex-wrap gap-2">
                {(field.choices || []).map(opt => {
                  const selected = current.includes(opt.value)
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        const next = selected
                          ? current.filter(v => v !== opt.value)
                          : field.key === 'genero'
                            ? nextGenderSelection(current, opt.value, selected)
                            : [...current, opt.value]
                        onChange(field.key, next)
                      }}
                      className={chipCls(selected)}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        }

        if (field.type === 'boolean') {
          const val = field.key === 'incluye_fijaciones' && values[field.key] === undefined
            ? false
            : values[field.key]
          return (
            <div key={field.key} className="sm:col-span-2">
              <label className="flex items-center gap-1.5 text-sm font-medium mb-1">
                {field.label}
                {field.info && <InfoTip text={field.info} />}
              </label>
              <div className="flex gap-2">
                {[{ v: true, l: 'Sí' }, { v: false, l: 'No' }].map(({ v, l }) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => onChange(
                      field.key,
                      field.key === 'incluye_fijaciones' && v === false
                        ? false
                        : field.key === 'boa'
                          ? v
                          : val === v ? undefined : v,
                    )}
                    className={chipCls(val === v)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )
        }

        if (field.type === 'button-select') {
          return (
            <AttributeButtonSelect
              key={field.key}
              field={field}
              value={values[field.key]}
              onChange={value => onChange(field.key, value)}
            />
          )
        }

        if (field.type === 'select') {
          return (
            <div key={field.key} className="sm:col-span-2">
              <label className="flex items-center gap-1.5 text-sm font-medium mb-1">
                {field.label}
                {field.info && <InfoTip text={field.info} />}
              </label>
              <select
                value={(values[field.key] as string) || ''}
                onChange={e => onChange(field.key, e.target.value || undefined)}
                className="w-full border rounded-lg px-3 py-2.5 bg-white"
              >
                <option value="">Sin especificar</option>
                {(field.options || []).map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          )
        }

        if (field.key === 'fijaciones_marca') {
          return (
            <BrandInput
              key={field.key}
              value={(values[field.key] as string) || ''}
              onChange={value => onChange(field.key, value || undefined)}
              productType="fijaciones"
              placeholder="Marca de las fijaciones"
              label={field.label}
            />
          )
        }

        return (
          <div key={field.key}>
            <label className="flex items-center gap-1.5 text-sm font-medium mb-1">
              {field.label}
              {field.info && <InfoTip text={field.info} />}
            </label>
            <input
              type={field.type === 'number' ? 'number' : 'text'}
              value={(values[field.key] as string) || ''}
              onChange={e => onChange(field.key, e.target.value || undefined)}
              placeholder={field.placeholder}
              className="w-full border rounded-lg px-3 py-2.5"
            />
          </div>
        )
      })}
    </div>
  )
}
