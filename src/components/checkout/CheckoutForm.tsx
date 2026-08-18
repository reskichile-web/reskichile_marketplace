'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { CHILE_REGIONS } from '@/lib/commerce/regions'

export interface CheckoutItemSummary {
  id: string
  slug?: string
  name: string
  priceClp: number
  quantity: number
  backHref?: string
  selectedSize?: string
}

interface Props {
  items: CheckoutItemSummary[]
  kind: 'products' | 'racks'
  enabled: boolean
  sandbox: boolean
  unavailableMessage?: string
}

interface Quote {
  subtotalClp: number
  discountClp: number
  shippingClp: number
  totalClp: number
}

const money = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  throw new Error('Este navegador no permite iniciar un pago seguro')
}

export default function CheckoutForm({ items, kind, enabled, sandbox, unavailableMessage }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [method, setMethod] = useState<'home' | 'pickup'>('home')
  const [region, setRegion] = useState('Metropolitana de Santiago')
  const [commune, setCommune] = useState('')
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [extra, setExtra] = useState('')
  const [pickupPointId, setPickupPointId] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quotedPayload, setQuotedPayload] = useState<Record<string, unknown> | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [loading, setLoading] = useState<'quote' | 'create' | null>(null)
  const [error, setError] = useState('')

  function payload(key: string): Record<string, unknown> {
    return {
      productIds: kind === 'products' ? items.map(item => item.id) : [],
      rackItems: kind === 'racks'
        ? items.map(item => ({
            slug: item.slug,
            size: item.selectedSize,
            quantity: item.quantity,
          }))
        : [],
      idempotencyKey: key,
      buyer: { name, email, phone },
      delivery: {
        method,
        region,
        commune,
        street: method === 'home' ? street : null,
        number: method === 'home' ? number : null,
        extra: extra || null,
        pickupPointId: method === 'pickup' ? pickupPointId : null,
      },
      couponCode: couponCode || null,
    }
  }

  function invalidateQuote() {
    if (quote) {
      setQuote(null)
      setQuotedPayload(null)
      setIdempotencyKey('')
    }
  }

  async function requestJson(path: string, body: Record<string, unknown>) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    })
    const data = (await response.json().catch(() => null)) as
      | Record<string, unknown>
      | null
    if (!response.ok) {
      throw new Error(
        data && typeof data.error === 'string'
          ? data.error
          : 'No pudimos procesar la solicitud.'
      )
    }
    return data || {}
  }

  async function handleQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!enabled || loading) return
    setError('')
    setLoading('quote')
    try {
      const key = newIdempotencyKey()
      const body = payload(key)
      const data = await requestJson('/api/checkout/quote', body)
      const nextQuote = {
        subtotalClp: Number(data.subtotalClp),
        discountClp: Number(data.discountClp),
        shippingClp: Number(data.shippingClp),
        totalClp: Number(data.totalClp),
      }
      if (!Object.values(nextQuote).every(Number.isSafeInteger)) {
        throw new Error('El servidor devolvió un total inválido.')
      }
      setIdempotencyKey(key)
      setQuotedPayload(body)
      setQuote(nextQuote)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No pudimos cotizar.')
    } finally {
      setLoading(null)
    }
  }

  async function handlePayment() {
    if (!quote || !quotedPayload || !idempotencyKey || loading) return
    setError('')
    setLoading('create')
    try {
      const data = await requestJson('/api/checkout/create', quotedPayload)
      const total = Number(data.totalClp)
      if (total !== quote.totalClp) {
        setQuote(null)
        setQuotedPayload(null)
        setIdempotencyKey('')
        throw new Error('El total cambió. Revísalo y vuelve a confirmar la compra.')
      }

      const token = typeof data.token === 'string' ? data.token : ''
      const urlValue = typeof data.url === 'string' ? data.url : ''
      const url = new URL(urlValue)
      const expectedHost = sandbox
        ? 'webpay3gint.transbank.cl'
        : 'webpay3g.transbank.cl'
      if (
        url.protocol !== 'https:' ||
        url.hostname !== expectedHost ||
        url.port ||
        url.pathname !== '/webpayserver/initTransaction' ||
        url.search ||
        url.hash ||
        !/^[A-Za-z0-9._~-]{10,128}$/.test(token)
      ) {
        throw new Error('Webpay devolvió un destino inválido. No continúes con el pago.')
      }

      const form = document.createElement('form')
      form.method = 'POST'
      form.action = url.toString()
      const tokenInput = document.createElement('input')
      tokenInput.type = 'hidden'
      tokenInput.name = 'token_ws'
      tokenInput.value = token
      form.appendChild(tokenInput)
      document.body.appendChild(form)
      form.submit()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No pudimos iniciar Webpay.')
      setLoading(null)
    }
  }

  const fieldClass = 'mt-1 w-full border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500'
  const backHref = items[0]?.backHref || (kind === 'racks' ? '/carrito' : '/catalogo')
  const itemSubtotal = items.reduce((total, item) => total + item.priceClp * item.quantity, 0)

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <Link href={backHref} className="text-sm text-gray-500 hover:text-brand-500">
          ← Volver al producto
        </Link>
        <h1 className="mt-3 font-body text-3xl font-black">Finalizar compra</h1>
        <p className="mt-2 text-sm text-gray-600">
          La tarjeta se ingresa únicamente en el sitio seguro de Webpay.
        </p>
      </div>

      {sandbox && (
        <div className="mb-6 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Ambiente de prueba: no uses datos bancarios reales y no se realizará un cobro real.
        </div>
      )}

      {!enabled && unavailableMessage && (
        <div className="mb-6 border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          {unavailableMessage}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <form onSubmit={handleQuote} onChange={invalidateQuote} className="space-y-7">
          <fieldset disabled={!enabled || loading !== null} className="space-y-4 disabled:opacity-60">
            <legend className="font-body text-xl font-black">Datos de contacto</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium sm:col-span-2">
                Nombre completo
                <input required autoComplete="name" maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} />
              </label>
              <label className="text-sm font-medium">
                Correo
                <input required type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClass} />
              </label>
              <label className="text-sm font-medium">
                Teléfono
                <input required type="tel" autoComplete="tel" maxLength={30} placeholder="+56 9 1234 5678" value={phone} onChange={(event) => setPhone(event.target.value)} className={fieldClass} />
              </label>
            </div>
          </fieldset>

          <fieldset disabled={!enabled || loading !== null} className="space-y-4 disabled:opacity-60">
            <legend className="font-body text-xl font-black">Entrega</legend>
            <div className="grid grid-cols-2 gap-3">
              <label className={'cursor-pointer border p-3 text-sm ' + (method === 'home' ? 'border-brand-500 bg-blue-50' : 'border-gray-200')}>
                <input type="radio" name="delivery" value="home" checked={method === 'home'} onChange={() => setMethod('home')} className="mr-2" />
                A domicilio
              </label>
              <label className={'cursor-pointer border p-3 text-sm ' + (method === 'pickup' ? 'border-brand-500 bg-blue-50' : 'border-gray-200')}>
                <input type="radio" name="delivery" value="pickup" checked={method === 'pickup'} onChange={() => setMethod('pickup')} className="mr-2" />
                Sucursal o punto
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Región
                <select required value={region} onChange={(event) => setRegion(event.target.value)} className={fieldClass}>
                  {CHILE_REGIONS.map((regionName) => <option key={regionName} value={regionName}>{regionName}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium">
                Comuna
                <input required autoComplete="address-level2" maxLength={100} value={commune} onChange={(event) => setCommune(event.target.value)} className={fieldClass} />
              </label>
              {method === 'home' ? (
                <>
                  <label className="text-sm font-medium">
                    Calle
                    <input required autoComplete="address-line1" maxLength={120} value={street} onChange={(event) => setStreet(event.target.value)} className={fieldClass} />
                  </label>
                  <label className="text-sm font-medium">
                    Número
                    <input required maxLength={20} value={number} onChange={(event) => setNumber(event.target.value)} className={fieldClass} />
                  </label>
                </>
              ) : (
                <label className="text-sm font-medium sm:col-span-2">
                  Sucursal o punto de retiro
                  <input required maxLength={120} placeholder="Identificador de prueba" value={pickupPointId} onChange={(event) => setPickupPointId(event.target.value)} className={fieldClass} />
                </label>
              )}
              <label className="text-sm font-medium sm:col-span-2">
                Depto., oficina o referencia (opcional)
                <input maxLength={160} value={extra} onChange={(event) => setExtra(event.target.value)} className={fieldClass} />
              </label>
            </div>
          </fieldset>

          <fieldset disabled={!enabled || loading !== null} className="disabled:opacity-60">
            <label className="text-sm font-medium">
              Cupón (opcional)
              <input maxLength={32} autoCapitalize="characters" value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} className={fieldClass} />
            </label>
          </fieldset>

          {error && <div role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          {!quote && (
            <button type="submit" disabled={!enabled || loading !== null} className="pressable w-full bg-gray-900 px-6 py-3 font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50">
              {loading === 'quote' ? 'Calculando…' : enabled ? 'Revisar total' : 'Pagos temporalmente deshabilitados'}
            </button>
          )}
        </form>

        <aside className="h-fit border border-gray-200 bg-gray-50 p-5 lg:sticky lg:top-28">
          <h2 className="font-body text-lg font-black">Resumen</h2>
          <div className="mt-5 space-y-4">
            {items.map(item => (
              <div key={`${item.id}-${item.selectedSize || ''}`} className="text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-700">{item.name}</span>
                  <span className="font-semibold">{money.format(item.priceClp * item.quantity)}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {item.selectedSize ? `Talla ${item.selectedSize} · ` : ''}
                  {item.quantity} {item.quantity === 1 ? 'unidad' : 'unidades'}
                </p>
              </div>
            ))}
          </div>
          {quote ? (
            <div className="mt-5 space-y-3 border-t border-gray-200 pt-4 text-sm">
              {quote.discountClp > 0 && <div className="flex justify-between text-emerald-700"><span>Descuento</span><span>-{money.format(quote.discountClp)}</span></div>}
              <div className="flex justify-between text-gray-600"><span>Despacho</span><span>{money.format(quote.shippingClp)}</span></div>
              <div className="flex justify-between border-t border-gray-200 pt-3 text-base font-black"><span>Total</span><span>{money.format(quote.totalClp)}</span></div>
              <button type="button" onClick={handlePayment} disabled={loading !== null} className="pressable mt-3 w-full bg-brand-500 px-5 py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
                {loading === 'create' ? 'Conectando con Webpay…' : 'Ir a Webpay'}
              </button>
              <p className="text-xs leading-5 text-gray-500">Serás redirigido a Transbank. ReskiChile no recibe ni almacena los datos de tu tarjeta.</p>
            </div>
          ) : (
            <div className="mt-5 border-t border-gray-200 pt-4">
              <div className="flex justify-between text-sm font-semibold">
                <span>Subtotal</span>
                <span>{money.format(itemSubtotal)}</span>
              </div>
              <p className="mt-3 text-xs leading-5 text-gray-500">Completa los datos para calcular el despacho y confirmar el total.</p>
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}
