'use client'

import { useState, useRef, useEffect } from 'react'
import { getBrandSuggestions } from '@/lib/brand-suggestions'
import { getBrandLogoUrl } from '@/lib/brand-logos'

interface Props {
  value: string
  onChange: (value: string) => void
  productType?: string
  placeholder?: string
  label?: string
  className?: string
  error?: boolean
}

export default function BrandInput({ value, onChange, productType, placeholder = 'Marca', label, className, error }: Props) {
  const [editing, setEditing] = useState(!value)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions = getBrandSuggestions(value, productType)
  const logoUrl = getBrandLogoUrl(value)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowSuggestions(false)
        if (value.trim()) setEditing(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [value])

  // When value is set externally (e.g. on load), switch to display mode
  useEffect(() => {
    if (value.trim()) setEditing(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function startEditing() {
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 10)
  }

  function selectBrand(brand: string) {
    onChange(brand)
    setShowSuggestions(false)
    setEditing(false)
  }

  // ─── Display mode (like InlineField) ───
  if (!editing && value.trim()) {
    return (
      <button type="button" onClick={startEditing} className="w-full text-left group">
        {label && (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            {label}
            <svg className="w-2.5 h-2.5 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </span>
        )}
        <p className="text-sm font-medium text-gray-900 group-hover:text-brand-500 transition-colors min-h-[20px] flex items-center gap-2">
          {logoUrl && (
            <img src={logoUrl} alt="" className="w-4 h-4 object-contain rounded" onError={e => (e.currentTarget.style.display = 'none')} />
          )}
          {value}
        </p>
      </button>
    )
  }

  // ─── Edit mode (input + suggestions) ───
  return (
    <div ref={ref} className="relative">
      {label && <span className="text-xs text-gray-400 block mb-1">{label}</span>}
      <div className="relative">
        {logoUrl && (
          <img
            src={logoUrl}
            alt=""
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 object-contain rounded"
            onError={e => (e.currentTarget.style.display = 'none')}
          />
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); setShowSuggestions(true) }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            // Small delay so suggestion clicks register
            setTimeout(() => {
              if (value.trim()) setEditing(false)
            }, 200)
          }}
          placeholder={placeholder}
          className={`w-full border rounded-lg py-2.5 ${logoUrl ? 'pl-10' : 'pl-3'} pr-3 text-sm ${error ? 'border-red-400' : ''} ${className || ''}`}
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
          {suggestions.map(brand => {
            const bLogo = getBrandLogoUrl(brand)
            return (
              <button
                key={brand}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => selectBrand(brand)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
              >
                {bLogo ? (
                  <img src={bLogo} alt="" className="w-4 h-4 object-contain rounded shrink-0" onError={e => (e.currentTarget.style.display = 'none')} />
                ) : (
                  <div className="w-4 h-4 shrink-0" />
                )}
                <span className="text-gray-700">{brand}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
