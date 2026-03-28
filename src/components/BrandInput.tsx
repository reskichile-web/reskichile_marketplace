'use client'

import { useState, useRef, useEffect } from 'react'
import { getBrandSuggestions } from '@/lib/brand-suggestions'
import { getBrandLogoUrl } from '@/lib/brand-logos'

interface Props {
  value: string
  onChange: (value: string) => void
  productType?: string
  placeholder?: string
  className?: string
  error?: boolean
}

export default function BrandInput({ value, onChange, productType, placeholder = 'Marca', className, error }: Props) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions = getBrandSuggestions(value, productType)
  const logoUrl = getBrandLogoUrl(value)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
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
          onFocus={() => { setFocused(true); setShowSuggestions(true) }}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className={`w-full border rounded-lg py-2.5 ${logoUrl ? 'pl-10' : 'pl-3'} pr-3 text-sm ${error ? 'border-red-400' : ''} ${className || ''}`}
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
          {suggestions.map(brand => {
            const bLogo = getBrandLogoUrl(brand)
            return (
              <button
                key={brand}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  onChange(brand)
                  setShowSuggestions(false)
                  inputRef.current?.blur()
                }}
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
