'use client'

import { useEffect, useRef, useState } from 'react'
import Spinner from '@/components/Spinner'
import type {
  AddressSuggestion,
  AddressValidationSelection,
  ValidatedHomeAddress,
} from '@/lib/commerce/address'

interface Props {
  disabled?: boolean
  error?: string | null
  shippingClp?: number | null
  shippingLoading?: boolean
  onInvalidated: () => void
  onValidated: (
    address: ValidatedHomeAddress,
    addressValidationToken: string,
    addressContext: string
  ) => void
}

const money = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

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
  shippingClp,
  shippingLoading,
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
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setAddressContext(newUuid())
    setSessionToken(newUuid())
  }, [])

  useEffect(() => {
    if (selected || query.trim().length < 3 || !sessionToken || !addressContext) {
      setSuggestions([])
      setLoading(current => current === 'search' ? null : current)
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

  function beginEditing() {
    if (!selected || disabled || loading === 'validate') return
    requestSequence.current += 1
    setSelected(null)
    setSuggestions([])
    setLocalError('')
    setSessionToken(newUuid())
    onInvalidated()
    window.requestAnimationFrame(() => inputRef.current?.select())
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
        {selected ? 'Dirección confirmada' : 'Busca tu dirección'}
      </label>
      <div className="relative mt-2">
        <input
          ref={inputRef}
          id="checkout-address-search"
          required
          disabled={disabled || loading === 'validate'}
          type="text"
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls="checkout-address-suggestions"
          aria-autocomplete="list"
          aria-invalid={shownError ? true : undefined}
          autoComplete="street-address"
          maxLength={120}
          value={query}
          onClick={beginEditing}
          onChange={(event) => {
            if (selected) {
              requestSequence.current += 1
              setSelected(null)
              setSuggestions([])
              setSessionToken(newUuid())
            }
            setQuery(event.target.value)
            setLocalError('')
            onInvalidated()
          }}
          placeholder="Ej. Avenida Apoquindo 3000"
          className={`min-h-12 w-full rounded-xl border bg-white px-4 py-3 pr-11 text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${shownError ? 'border-red-400' : 'border-gray-200'}`}
        />
        {loading && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2" role="status">
            <Spinner size="sm" color="gray" />
            <span className="sr-only">{loading === 'search' ? 'Buscando dirección' : 'Confirmando dirección'}</span>
          </span>
        )}
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
        <div className="mt-3 rounded-2xl border border-gray-200 bg-white px-4 py-4 text-sm shadow-[0_10px_30px_rgba(15,23,42,0.05)] sm:px-5">
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">Dirección de entrega</p>
              <p className="mt-2 font-semibold text-gray-900">{selected.street} {selected.number}</p>
              <p className="mt-0.5 leading-5 text-gray-500">{selected.commune}, {selected.region}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">Despacho</p>
              {shippingLoading ? (
                <span className="mt-2 flex justify-end" role="status">
                  <Spinner size="sm" color="gray" />
                  <span className="sr-only">Calculando despacho</span>
                </span>
              ) : shippingClp != null ? (
                <p className="mt-1 font-body text-base font-black text-gray-900">{money.format(shippingClp)}</p>
              ) : (
                <p className="mt-1 text-xs text-gray-400">Por calcular</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
