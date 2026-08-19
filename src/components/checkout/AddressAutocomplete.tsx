'use client'

import { useEffect, useRef, useState } from 'react'
import type {
  AddressSuggestion,
  AddressValidationSelection,
  ValidatedHomeAddress,
} from '@/lib/commerce/address'

interface Props {
  disabled?: boolean
  error?: string | null
  onInvalidated: () => void
  onValidated: (
    address: ValidatedHomeAddress,
    addressValidationToken: string,
    addressContext: string
  ) => void
}

function newUuid(): string {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    throw new Error('Este navegador no permite validar la dirección de forma segura.')
  }
  return crypto.randomUUID()
}

async function postJson(
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal
) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
    signal,
  })
  const data = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!response.ok) {
    throw new Error(
      data && typeof data.error === 'string'
        ? data.error
        : 'No pudimos validar la dirección.'
    )
  }
  return data || {}
}

export default function AddressAutocomplete({
  disabled,
  error,
  onInvalidated,
  onValidated,
}: Props) {
  const [query, setQuery] = useState('')
  const [addressContext, setAddressContext] = useState('')
  const [sessionToken, setSessionToken] = useState('')
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [selected, setSelected] = useState<ValidatedHomeAddress | null>(null)
  const [loading, setLoading] = useState<'search' | 'validate' | null>(null)
  const [localError, setLocalError] = useState('')
  const requestSequence = useRef(0)

  useEffect(() => {
    setAddressContext(newUuid())
    setSessionToken(newUuid())
  }, [])

  useEffect(() => {
    if (selected || query.trim().length < 3 || !sessionToken || !addressContext) {
      setSuggestions([])
      return
    }
    const sequence = ++requestSequence.current
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setLoading('search')
      setLocalError('')
      try {
        const data = await postJson('/api/checkout/address/autocomplete', {
          query,
          sessionToken,
          addressContext,
        }, controller.signal)
        if (sequence !== requestSequence.current || controller.signal.aborted) return
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions as AddressSuggestion[] : [])
      } catch (requestError) {
        if (sequence !== requestSequence.current || controller.signal.aborted) return
        setSuggestions([])
        setLocalError(requestError instanceof Error ? requestError.message : 'No pudimos buscar direcciones.')
      } finally {
        if (sequence === requestSequence.current && !controller.signal.aborted) setLoading(null)
      }
    }, 350)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [addressContext, query, selected, sessionToken])

  function startOver() {
    requestSequence.current += 1
    setSelected(null)
    setQuery('')
    setSuggestions([])
    setLocalError('')
    setSessionToken(newUuid())
    onInvalidated()
  }

  async function selectSuggestion(suggestion: AddressSuggestion) {
    if (loading || !sessionToken || !addressContext) return
    setLoading('validate')
    setLocalError('')
    setSuggestions([])
    try {
      const data = await postJson('/api/checkout/address/validate', {
        selectionToken: suggestion.selectionToken,
        sessionToken,
        addressContext,
      }) as unknown as AddressValidationSelection
      if (!data.address || typeof data.addressValidationToken !== 'string') {
        throw new Error('El servidor devolvió una dirección inválida.')
      }
      setSelected(data.address)
      setQuery(data.address.formatted_address)
      onValidated(data.address, data.addressValidationToken, addressContext)
    } catch (requestError) {
      setLocalError(requestError instanceof Error ? requestError.message : 'No pudimos validar la dirección.')
    } finally {
      setLoading(null)
    }
  }

  const shownError = error || localError

  return (
    <div className="sm:col-span-2">
      <label htmlFor="checkout-address-search" className="text-sm font-medium">
        Busca tu dirección
      </label>
      <div className="relative mt-2">
        <input
          id="checkout-address-search"
          required
          disabled={disabled || loading === 'validate'}
          type="search"
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls="checkout-address-suggestions"
          aria-autocomplete="list"
          aria-invalid={shownError ? true : undefined}
          autoComplete="street-address"
          maxLength={120}
          value={query}
          readOnly={Boolean(selected)}
          onChange={(event) => {
            setQuery(event.target.value)
            setLocalError('')
            onInvalidated()
          }}
          placeholder="Ej. Avenida Apoquindo 3000"
          className={`min-h-12 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${shownError ? 'border-red-400' : 'border-gray-200'}`}
        />
        {loading === 'search' && <span className="absolute right-3 top-3 text-xs text-gray-400">Buscando…</span>}
        {suggestions.length > 0 && (
          <div id="checkout-address-suggestions" role="listbox" className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                role="option"
                aria-selected="false"
                onClick={() => selectSuggestion(suggestion)}
                className="block w-full border-b border-gray-100 px-3 py-3 text-left last:border-0 hover:bg-gray-50"
              >
                <span className="block text-sm font-medium text-gray-900">{suggestion.mainText}</span>
                {suggestion.secondaryText && <span className="mt-0.5 block text-xs text-gray-500">{suggestion.secondaryText}</span>}
              </button>
            ))}
            <p className="px-3 py-2 text-right text-[10px] font-normal text-gray-500">
              <span translate="no">Google Maps</span>
            </p>
          </div>
        )}
      </div>
      {shownError && <p className="mt-1 text-xs text-red-500">{shownError}</p>}
      {selected && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold">Dirección confirmada</p>
              <p className="mt-1">{selected.street} {selected.number}</p>
              <p>{selected.commune}, {selected.region}</p>
            </div>
            <button type="button" onClick={startOver} className="text-xs font-semibold underline">
              Corregir
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
