'use client'

import { useState, useEffect } from 'react'
import {
  COUNTRY_OPTIONS,
  DEFAULT_COUNTRY,
  parseLocalDigits,
  formatLocal,
  parseStoredPhone,
  toFullPhone,
  validateLocal,
  type CountryOption,
} from '@/lib/phone'

interface Props {
  // Stored full phone (e.g. "+56912345678") — pre-fills the input
  defaultStored?: string | null
  // Called with the full phone whenever it changes (or '' if local empty)
  onChange?: (full: string, country: CountryOption) => void
  // Optional explicit error from outside (e.g. server validation)
  error?: string | null
  // Show inline validation while user types (default true)
  inlineValidation?: boolean
  // Whether the field is required (affects validation messages)
  required?: boolean
  placeholder?: string
  className?: string
  inputClassName?: string
  selectClassName?: string
  id?: string
}

export default function PhoneInput({
  defaultStored,
  onChange,
  error,
  inlineValidation = true,
  required = false,
  placeholder,
  className = '',
  inputClassName = '',
  selectClassName = '',
  id,
}: Props) {
  const initial = parseStoredPhone(defaultStored)
  const [country, setCountry] = useState<CountryOption>(initial.country)
  const [local, setLocal] = useState<string>(initial.local)
  const [touched, setTouched] = useState<boolean>(false)

  // Re-sync if defaultStored changes externally (e.g. profile reload)
  useEffect(() => {
    if (defaultStored !== undefined && defaultStored !== null) {
      const next = parseStoredPhone(defaultStored)
      setCountry(next.country)
      setLocal(next.local)
    }
  }, [defaultStored])

  function emit(nextLocal: string, nextCountry: CountryOption) {
    if (!onChange) return
    onChange(nextLocal ? toFullPhone(nextLocal, nextCountry) : '', nextCountry)
  }

  function handleInput(raw: string) {
    const next = parseLocalDigits(raw, country)
    setLocal(next)
    emit(next, country)
  }

  function handleCountry(code: string) {
    const next = COUNTRY_OPTIONS.find((c) => c.code === code) || DEFAULT_COUNTRY
    setCountry(next)
    // re-clamp local to new country's expected length
    const re = local.slice(0, next.localLength)
    setLocal(re)
    emit(re, next)
  }

  const validationError =
    inlineValidation && touched && (required || local.length > 0)
      ? validateLocal(local, country)
      : null
  const shownError = error || validationError

  const fallbackPlaceholder =
    country.code === '+56'
      ? '9 1234 5678'
      : country.code === '+1'
      ? '(123) 456-7890'
      : '1234 5678'

  return (
    <div className={className}>
      <div className="flex gap-2">
        <select
          required={required}
          value={country.code}
          onChange={(e) => handleCountry(e.target.value)}
          className={`border rounded px-2 py-2 text-sm w-24 shrink-0 ${selectClassName}`}
          aria-label="Código de país"
        >
          {COUNTRY_OPTIONS.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.code}
            </option>
          ))}
        </select>
        <input
          id={id}
          type="tel"
          required={required}
          inputMode="tel"
          value={formatLocal(local, country)}
          onChange={(e) => handleInput(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={placeholder ?? fallbackPlaceholder}
          autoComplete="tel-national"
          aria-invalid={shownError ? true : undefined}
          className={`w-full border rounded px-3 py-2 ${shownError ? 'border-red-400' : ''} ${inputClassName}`}
        />
      </div>
      {shownError && <p className="text-xs text-red-500 mt-1">{shownError}</p>}
    </div>
  )
}
