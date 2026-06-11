'use client'

import type { AttributeField } from '@/lib/constants'

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

/**
 * Attribute editor used by the /vender form. Mirrors the styling of the
 * rest of the product form (labels text-sm font-medium, inputs px-3
 * py-2.5 rounded-lg, selection chips border-2 + brand-50). All fields are
 * optional here — required validation only applies in the full edit form.
 */
export default function AttributeFieldsEditor({ fields, values, onChange }: Props) {
  if (fields.length === 0) return null

  const chipCls = (selected: boolean) =>
    `px-3 py-2.5 rounded-lg border-2 text-sm whitespace-nowrap transition-all ${
      selected
        ? 'border-brand-500 bg-brand-50 text-brand-500 font-medium'
        : 'border-gray-100 text-gray-500 hover:border-gray-300'
    }`

  return (
    <div className="space-y-5">
      {fields.map(field => {
        if (field.type === 'multiselect') {
          const current = Array.isArray(values[field.key]) ? (values[field.key] as string[]) : []
          return (
            <div key={field.key}>
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
          const val = values[field.key]
          return (
            <div key={field.key}>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-1">
                {field.label}
                {field.info && <InfoTip text={field.info} />}
              </label>
              <div className="flex gap-2">
                {[{ v: true, l: 'Sí' }, { v: false, l: 'No' }].map(({ v, l }) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => onChange(field.key, val === v ? undefined : v)}
                    className={chipCls(val === v)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )
        }

        if (field.type === 'select') {
          return (
            <div key={field.key}>
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
