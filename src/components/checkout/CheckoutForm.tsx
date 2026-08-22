'use client'

import { FormEvent, Fragment, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  ChevronLeft,
  LockKeyhole,
  ShoppingBag,
  Truck,
} from 'lucide-react'
import PhoneInput from '@/components/PhoneInput'
import AddressAutocomplete from '@/components/checkout/AddressAutocomplete'
import { CHILE_REGIONS } from '@/lib/commerce/regions'
import {
  DEFAULT_COUNTRY,
  parseAndValidatePhone,
  type CountryOption,
} from '@/lib/phone'

export interface CheckoutItemSummary {
  id: string
  slug?: string
  name: string
  priceClp: number
  quantity: number
  backHref?: string
  selectedSize?: string
  imageUrl?: string
}

interface Props {
  items: CheckoutItemSummary[]
  kind: 'products' | 'racks'
  enabled: boolean
  sandbox: boolean
  unavailableMessage?: string
  addressValidationEnabled?: boolean
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

function CheckoutProgress({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  const steps = ['Datos', 'Envío', 'Pago']

  return (
    <div className="mt-7 max-w-xl">
      <p className="sr-only">Paso {currentStep} de 3</p>
      <ol
        aria-label="Progreso del checkout"
        className="grid grid-cols-[auto_minmax(24px,1fr)_auto_minmax(24px,1fr)_auto] items-start"
      >
        {steps.map((step, index) => {
          const stepNumber = (index + 1) as 1 | 2 | 3
          const completed = currentStep > stepNumber
          const active = currentStep === stepNumber
          return (
            <Fragment key={step}>
              <li aria-current={active ? 'step' : undefined} className="flex min-w-14 flex-col items-center">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                    active || completed
                      ? 'border-brand-500 bg-brand-500 text-white'
                      : 'border-gray-200 bg-white text-gray-400'
                  }`}
                >
                  {stepNumber}
                </span>
                <span className={`mt-2 text-[11px] font-medium sm:text-xs ${active || completed ? 'text-gray-900' : 'text-gray-400'}`}>
                  {step}
                </span>
              </li>
              {index < steps.length - 1 && (
                <li
                  aria-hidden="true"
                  className={`mt-[15px] h-px ${completed ? 'bg-brand-500' : 'bg-gray-200'}`}
                />
              )}
            </Fragment>
          )
        })}
      </ol>
    </div>
  )
}

export default function CheckoutForm({ items, kind, enabled, sandbox, unavailableMessage, addressValidationEnabled = false }: Props) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneCountry, setPhoneCountry] = useState<CountryOption['iso2']>(DEFAULT_COUNTRY.iso2)
  const [phoneError, setPhoneError] = useState('')
  const [method, setMethod] = useState<'home' | 'pickup'>('home')
  const [region, setRegion] = useState('Metropolitana de Santiago')
  const [commune, setCommune] = useState('')
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [extra, setExtra] = useState('')
  const [pickupPointId, setPickupPointId] = useState('')
  const [addressContext, setAddressContext] = useState<string | null>(null)
  const [addressValidationToken, setAddressValidationToken] = useState<string | null>(null)
  const [addressError, setAddressError] = useState('')
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
      buyer: { name, email, phone, phoneCountry },
      delivery: {
        method,
        region,
        commune,
        street: method === 'home' ? street : null,
        number: method === 'home' ? number : null,
        extra: extra || null,
        pickupPointId: method === 'pickup' ? pickupPointId : null,
        addressContext: method === 'home' ? addressContext : null,
        addressValidationToken: method === 'home' ? addressValidationToken : null,
      },
      couponCode: null,
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

  async function handleContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!enabled || loading) return

    const validPhone = parseAndValidatePhone(phone, phoneCountry)
    if (!validPhone) {
      setPhoneError('Ingresa un teléfono válido para el país seleccionado.')
      return
    }

    setPhoneError('')
    setError('')

    if (currentStep === 1) {
      setCurrentStep(2)
      return
    }

    if (currentStep !== 2) return

    if (method === 'home' && addressValidationEnabled && (!addressContext || !addressValidationToken)) {
      setAddressError('Busca y confirma la dirección antes de continuar.')
      return
    }
    setAddressError('')
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
      setCurrentStep(3)
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

  const fieldClass = 'mt-2 min-h-12 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100'
  const backHref = items[0]?.backHref || (kind === 'racks' ? '/carrito' : '/catalogo')
  const backLabel = kind === 'racks' ? 'Volver al carrito' : 'Volver al producto'
  const itemSubtotal = items.reduce((total, item) => total + item.priceClp * item.quantity, 0)
  const deliveryLines = method === 'home'
    ? [
        `${street} ${number}`.trim(),
        extra,
        [commune, region].filter(Boolean).join(', '),
      ].filter(Boolean)
    : [
        pickupPointId ? `Punto de retiro: ${pickupPointId}` : '',
        extra,
        [commune, region].filter(Boolean).join(', '),
      ].filter(Boolean)

  function returnToDelivery() {
    setQuote(null)
    setQuotedPayload(null)
    setIdempotencyKey('')
    setError('')
    setCurrentStep(2)
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-100">
        <div className="mx-auto flex h-[76px] max-w-6xl items-center px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Ir al inicio de ReskiChile">
            <Image src="/logo.svg" alt="ReskiChile" width={170} height={60} priority className="h-12 w-auto" />
          </Link>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link
              href={backHref}
              aria-label={backLabel}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-950 transition-colors hover:bg-gray-100 hover:text-brand-600"
            >
              <ChevronLeft className="h-6 w-6" strokeWidth={2.2} aria-hidden="true" />
            </Link>
            <h1 id="checkout-title" className="truncate font-body text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">
              Finalizar compra
            </h1>
          </div>
          <div className="inline-flex items-center gap-2 text-xs font-medium text-gray-500 sm:text-sm">
            <LockKeyhole className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
            Checkout seguro
          </div>
        </div>

        {sandbox && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            Ambiente de prueba: no uses datos bancarios reales y no se realizará un cobro real.
          </div>
        )}

        {!enabled && unavailableMessage && (
          <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm leading-6 text-brand-800">
            {unavailableMessage}
          </div>
        )}

        <div className="mt-9 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_390px] lg:gap-14">
          <section aria-labelledby="checkout-title">
            <CheckoutProgress currentStep={currentStep} />

            <form onSubmit={handleContinue} onChange={invalidateQuote} className="mt-10 space-y-10">
              <fieldset
                hidden={currentStep !== 1}
                disabled={currentStep !== 1 || !enabled || loading !== null}
                className="space-y-5 disabled:opacity-60"
              >
                <legend className="font-body text-xl font-black">Información de contacto</legend>
                <p className="-mt-4 text-sm leading-6 text-gray-500">Usaremos estos datos para confirmar tu compra y coordinar la entrega.</p>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="text-sm font-medium text-gray-800 sm:col-span-2">
                    Nombre completo
                    <input
                      required
                      autoComplete="name"
                      maxLength={100}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Nombre y apellido"
                      className={fieldClass}
                    />
                  </label>
                  <label className="text-sm font-medium text-gray-800">
                    Correo
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      maxLength={254}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="tu@email.com"
                      className={fieldClass}
                    />
                  </label>
                  <label className="text-sm font-medium text-gray-800">
                    Teléfono
                    <PhoneInput
                      id="checkout-phone"
                      required
                      error={phoneError}
                      onChange={(full, country) => {
                        setPhone(full)
                        setPhoneCountry(country.iso2)
                        if (phoneError) setPhoneError('')
                      }}
                      className="mt-2"
                      inputClassName="min-h-12 rounded-xl border-gray-200 px-4 py-3 text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                      selectClassName="min-h-12 rounded-xl border-gray-200 bg-white outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    />
                  </label>
                </div>
              </fieldset>

              <fieldset
                hidden={currentStep !== 2}
                disabled={currentStep !== 2 || !enabled || loading !== null}
                className="space-y-5 disabled:opacity-60"
              >
                <legend className="font-body text-xl font-black">Dirección de entrega</legend>
                <p className="-mt-4 text-sm leading-6 text-gray-500">Elige cómo quieres recibir tu compra.</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`cursor-pointer rounded-xl border p-4 transition-colors ${method === 'home' ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <input type="radio" name="delivery" value="home" checked={method === 'home'} onChange={() => setMethod('home')} className="accent-brand-500" />
                      A domicilio
                    </span>
                    <span className="mt-1 block pl-5 text-xs text-gray-500">Recibe en tu dirección</span>
                  </label>
                  <label className={`cursor-pointer rounded-xl border p-4 transition-colors ${method === 'pickup' ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <input type="radio" name="delivery" value="pickup" checked={method === 'pickup'} onChange={() => setMethod('pickup')} className="accent-brand-500" />
                      Punto de retiro
                    </span>
                    <span className="mt-1 block pl-5 text-xs text-gray-500">Retira donde te acomode</span>
                  </label>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  {method === 'home' && addressValidationEnabled ? (
                    <AddressAutocomplete
                      disabled={!enabled || loading !== null}
                      error={addressError}
                      onInvalidated={() => {
                        setAddressContext(null)
                        setAddressValidationToken(null)
                        setAddressError('')
                      }}
                      onValidated={(address, token, context) => {
                        setRegion(address.region)
                        setCommune(address.commune)
                        setStreet(address.street)
                        setNumber(address.number)
                        setAddressContext(context)
                        setAddressValidationToken(token)
                        setAddressError('')
                      }}
                    />
                  ) : (
                    <>
                      <label className="text-sm font-medium text-gray-800">
                        Región
                        <select required value={region} onChange={(event) => setRegion(event.target.value)} className={fieldClass}>
                          {CHILE_REGIONS.map((regionName) => <option key={regionName} value={regionName}>{regionName}</option>)}
                        </select>
                      </label>
                      <label className="text-sm font-medium text-gray-800">
                        Comuna
                        <input required autoComplete="address-level2" maxLength={100} value={commune} onChange={(event) => setCommune(event.target.value)} placeholder="Tu comuna" className={fieldClass} />
                      </label>
                      {method === 'home' ? (
                        <>
                          <label className="text-sm font-medium text-gray-800">
                            Calle
                            <input required autoComplete="address-line1" maxLength={120} value={street} onChange={(event) => setStreet(event.target.value)} placeholder="Nombre de la calle" className={fieldClass} />
                          </label>
                          <label className="text-sm font-medium text-gray-800">
                            Número
                            <input required maxLength={20} value={number} onChange={(event) => setNumber(event.target.value)} placeholder="1234" className={fieldClass} />
                          </label>
                        </>
                      ) : (
                        <label className="text-sm font-medium text-gray-800 sm:col-span-2">
                          Sucursal o punto de retiro
                          <input required maxLength={120} placeholder="Identificador de prueba" value={pickupPointId} onChange={(event) => setPickupPointId(event.target.value)} className={fieldClass} />
                        </label>
                      )}
                    </>
                  )}
                  <label className="text-sm font-medium text-gray-800 sm:col-span-2">
                    Depto., oficina o referencia <span className="font-normal text-gray-400">(opcional)</span>
                    <input maxLength={160} value={extra} onChange={(event) => setExtra(event.target.value)} placeholder="Ej. Depto. 502, dejar en conserjería" className={fieldClass} />
                  </label>
                </div>
              </fieldset>

              <fieldset
                hidden={currentStep !== 3}
                disabled={currentStep !== 3 || !enabled || loading !== null}
                className="space-y-5 disabled:opacity-60"
              >
                <legend className="font-body text-xl font-black">Medios de pago</legend>
                <p className="-mt-4 text-sm leading-6 text-gray-500">Selecciona cómo quieres pagar tu compra.</p>
                <label className="flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-brand-500 bg-brand-50/50 p-5 shadow-sm">
                  <input
                    type="radio"
                    name="payment-method"
                    value="webpay-plus"
                    checked
                    readOnly
                    className="h-4 w-4 shrink-0 accent-brand-500"
                  />
                  <Image
                    src="/webpay-plus-logo.svg"
                    alt="Webpay Plus"
                    width={150}
                    height={38}
                    className="h-auto w-[138px] sm:w-[150px]"
                  />
                </label>
              </fieldset>

              {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</div>}

              {currentStep === 1 && (
                <button
                  type="submit"
                  disabled={!enabled || loading !== null}
                  className="pressable flex w-full items-center justify-center gap-2 bg-brand-500 px-6 py-4 font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {enabled ? 'Continuar al envío' : 'Pagos temporalmente deshabilitados'}
                  {enabled && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                </button>
              )}

              {currentStep === 2 && (
                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    disabled={loading !== null}
                    className="pressable border border-gray-200 px-6 py-4 font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 sm:w-auto"
                  >
                    Volver a datos
                  </button>
                  <button
                    type="submit"
                    disabled={!enabled || loading !== null}
                    className="pressable flex flex-1 items-center justify-center gap-2 bg-brand-500 px-6 py-4 font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading === 'quote' ? 'Calculando despacho…' : 'Continuar al pago'}
                    {loading !== 'quote' && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
              )}

              {currentStep === 3 && (
                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={returnToDelivery}
                    disabled={loading !== null}
                    className="pressable border border-gray-200 px-6 py-4 font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 sm:w-auto"
                  >
                    Volver al envío
                  </button>
                  <button
                    type="button"
                    onClick={handlePayment}
                    disabled={!enabled || loading !== null}
                    className="pressable flex flex-1 items-center justify-center gap-2 bg-brand-500 px-6 py-4 font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading === 'create' ? 'Conectando…' : 'Continuar al pago'}
                    {loading !== 'create' && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
              )}
            </form>
          </section>

          <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] sm:p-6 lg:sticky lg:top-28">
            <h2 className="font-body text-xl font-black">Resumen de compra</h2>
            <div className="mt-6 space-y-5">
              {items.map(item => (
                <div key={`${item.id}-${item.selectedSize || ''}`} className="flex gap-4 text-sm">
                  <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-50">
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt={item.name} fill sizes="96px" className="object-cover" />
                    ) : (
                      <ShoppingBag className="h-7 w-7 text-gray-300" strokeWidth={1.5} aria-hidden="true" />
                    )}
                    {item.quantity > 1 && (
                      <span className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-900 px-1 text-[10px] font-bold text-white">
                        {item.quantity}
                      </span>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col py-1">
                    <p className="font-body text-sm font-bold leading-5 text-gray-900">{item.name}</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      {item.selectedSize ? `Talla ${item.selectedSize} · ` : ''}
                      {item.quantity} {item.quantity === 1 ? 'unidad' : 'unidades'}
                    </p>
                    <p className="mt-auto font-body text-sm font-black">{money.format(item.priceClp * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>

            {currentStep >= 2 && (
              <div className="mt-5 border-t border-gray-100 pt-4 text-xs leading-5 text-gray-500">
                <p className="font-bold uppercase tracking-[0.14em] text-gray-400">Contacto</p>
                <p className="mt-1 font-semibold text-gray-800">{name}</p>
                <p>{email}</p>
                <p>{phone}</p>
              </div>
            )}

            {currentStep >= 3 && quote && (
              <div className="mt-4 border-t border-gray-100 pt-4 text-xs leading-5 text-gray-500">
                <p className="font-bold uppercase tracking-[0.14em] text-gray-400">Entrega</p>
                <div className="mt-2 flex items-start gap-3">
                  <Truck className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" strokeWidth={1.8} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-800">{method === 'home' ? 'A domicilio' : 'Punto de retiro'}</p>
                    {deliveryLines.map(line => <p key={line}>{line}</p>)}
                  </div>
                  <span className="shrink-0 font-body text-sm font-black text-gray-900">
                    {money.format(quote.shippingClp)}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-6 space-y-3 border-t border-gray-100 pt-5 text-sm">
              <div className="flex justify-between gap-4 text-gray-600">
                <span>Subtotal</span>
                <span className="font-semibold text-gray-900">{money.format(quote?.subtotalClp ?? itemSubtotal)}</span>
              </div>
              {quote && quote.discountClp > 0 && (
                <div className="flex justify-between gap-4 text-emerald-700">
                  <span>Descuento</span>
                  <span className="font-semibold">-{money.format(quote.discountClp)}</span>
                </div>
              )}
              <div className="flex items-end justify-between gap-4 border-t border-gray-100 pt-4">
                <span className="font-body text-base font-black">{quote ? 'Total' : 'Total parcial'}</span>
                <span className="font-body text-2xl font-black text-brand-600">{money.format(quote?.totalClp ?? itemSubtotal)}</span>
              </div>
            </div>

          </aside>
        </div>
      </div>
    </div>
  )
}
