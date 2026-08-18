'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PRODUCT_TYPES, REGIONS, PRODUCT_ATTRIBUTES } from '@/lib/constants'
import AttributeFieldsEditor from '@/components/AttributeFieldsEditor'
import { type ImageItem } from '@/components/SortableImageGrid'
import OtpInput from '@/components/OtpInput'
import Spinner from '@/components/Spinner'
import PopupMessage from '@/components/PopupMessage'
import BrandInput from '@/components/BrandInput'
import PhoneInput from '@/components/PhoneInput'
import { ChevronLeft, Recycle, CheckCircle2, Star, Sparkles, PackageCheck } from 'lucide-react'

// Full-screen overlay shown only during publish — framer-motion loads on demand.
const PublishLoadingOverlay = dynamic(() => import('@/components/PublishLoadingOverlay'), { ssr: false })

// Drag-and-drop photo grid pulls in dnd-kit (~30 KB); only needed once the user
// reaches the photos step, so code-split it out of the initial page bundle.
const SortableImageGrid = dynamic(() => import('@/components/SortableImageGrid'), {
  ssr: false,
  loading: () => <div className="h-32 rounded-lg bg-gray-50 animate-pulse" />,
})
import { buildImagePath } from '@/lib/storage-utils'
import { buildProductSlug } from '@/lib/slug-utils'
import { normalizeStoredPhone } from '@/lib/phone'
import {
  GiSkis, GiSnowboard, GiSkiBoot, GiWalkingBoot,
  GiSkier, GiWinterGloves, GiMonclerJacket,
  GiArmoredPants, GiLightBackpack,
  GiDuffelBag, GiMountaintop, GiFullMotorcycleHelmet,
  GiProtectionGlasses, GiRadarSweep, GiPhotoCamera,
} from 'react-icons/gi'
import { FaSkiingNordic } from 'react-icons/fa'

const MAX_IMAGES = 8
const MIN_IMAGES = 3

type Step = 'type' | 'details' | 'photos' | 'auth' | 'success'
type PublicationMode = 'short' | 'detailed'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TYPE_ICON_COMPONENTS: Record<string, any> = {
  esquis: GiSkis,
  snowboards: GiSnowboard,
  botas_esqui: GiSkiBoot,
  botas_snowboard: GiWalkingBoot,
  bastones: GiSkier,
  cascos: GiFullMotorcycleHelmet,
  guantes: GiWinterGloves,
  fijaciones: FaSkiingNordic,
  parkas: GiMonclerJacket,
  pantalones: GiArmoredPants,
  antiparras: GiProtectionGlasses,
  mochilas: GiLightBackpack,
  bolsos: GiDuffelBag,
  equipo_avalanchas: GiRadarSweep,
  camaras_accion: GiPhotoCamera,
  otros: GiMountaintop,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CONDITION_ICONS: Record<string, any> = {
  usado_aceptable: Recycle,
  usado_buen_estado: CheckCircle2,
  usado_como_nuevo: Star,
  nuevo: Sparkles,
  nuevo_sellado: PackageCheck,
}

const CONDITION_ORDER = [
  { key: 'usado_aceptable', label: 'Aceptable' },
  { key: 'usado_buen_estado', label: 'Buen estado' },
  { key: 'usado_como_nuevo', label: 'Como nuevo' },
  { key: 'nuevo', label: 'Nuevo' },
  { key: 'nuevo_sellado', label: 'Sellado' },
]

const BRAND_PLACEHOLDERS: Record<string, string> = {
  esquis: 'Ej: Salomon, Atomic, Rossignol',
  snowboards: 'Ej: Burton, Capita, Jones',
  botas_esqui: 'Ej: Nordica, Lange, Head',
  botas_snowboard: 'Ej: Burton, DC, Vans',
  bastones: 'Ej: Leki, Black Diamond',
  cascos: 'Ej: Smith, Giro, POC',
  guantes: 'Ej: Reusch, Ziener, Dakine',
  fijaciones: 'Ej: Marker, Look, Union',
  parkas: 'Ej: The North Face, Arc\'teryx',
  pantalones: 'Ej: 686, Helly Hansen',
  antiparras: 'Ej: Oakley, Smith, Giro',
  mochilas: 'Ej: Osprey, Deuter, Mammut',
  bolsos: 'Ej: Burton, Dakine',
  equipo_avalanchas: 'Ej: BCA, Ortovox',
  camaras_accion: 'Ej: GoPro, DJI',
  otros: 'Ej: Marca del producto',
}

const MODEL_PLACEHOLDERS: Record<string, string> = {
  esquis: 'Ej: QST 106, Bent Chetler',
  snowboards: 'Ej: Custom X, DOA',
  botas_esqui: 'Ej: Speedmachine 120, Hawx',
  botas_snowboard: 'Ej: Ion, Ruler',
  bastones: 'Ej: Carbon 14 3D',
  cascos: 'Ej: Vantage MIPS, Code',
  guantes: 'Ej: Storm, Titan',
  fijaciones: 'Ej: Griffon 13, Squire',
  parkas: 'Ej: Purist, Perennia 3L',
  pantalones: 'Ej: Dragline Bib',
  antiparras: 'Ej: Flight Deck, MAG 4D',
  mochilas: 'Ej: Surgence 20L',
  bolsos: 'Ej: Gig Wheelie Bag',
  equipo_avalanchas: 'Ej: Tracker S',
  camaras_accion: 'Ej: Hero 12, Max 360',
  otros: 'Ej: Modelo',
}

export default function SellPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('type')
  const [loading, setLoading] = useState(false)
  const [popup, setPopup] = useState<{ message: string; type: 'error' | 'warning' } | null>(null)
  const [publishPhase, setPublishPhase] = useState<'compressing' | 'uploading' | 'creating' | 'success' | null>(null)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  // Per-image compression progress shown on the grid's "Agregar" tile
  const [compressing, setCompressing] = useState<{ current: number; total: number } | null>(null)

  // Form data
  const [productType, setProductType] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [modelConfirmed, setModelConfirmed] = useState(false)
  const [condition, setCondition] = useState('usado_como_nuevo')
  const [price, setPrice] = useState('')
  const [region, setRegion] = useState('')
  const [comuna, setComuna] = useState('')
  const [description, setDescription] = useState('')
  const [attrs, setAttrs] = useState<Record<string, unknown>>({})
  const [publicationMode, setPublicationMode] = useState<PublicationMode>('short')
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])

  // Preferences (saved on the users row for logged-in sellers; ignored
  // for anon publishes since there's no users record yet).
  const [hidePhone, setHidePhone] = useState(false)

  // Attributes ready to persist: drop empties so the JSONB stays clean
  function cleanedAttributes(): Record<string, unknown> {
    if (publicationMode === 'short') return {}

    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith('fijaciones_') && attrs.incluye_fijaciones !== true) continue
      if (v === undefined || v === null || v === '') continue
      if (Array.isArray(v) && v.length === 0) continue
      out[k] = v
    }
    const hasBindingsQuestion = (PRODUCT_ATTRIBUTES[productType] || [])
      .some(field => field.key === 'incluye_fijaciones')
    if (hasBindingsQuestion && out.incluye_fijaciones === undefined) {
      out.incluye_fijaciones = false
    }
    return out
  }
  // Chat-email notifications default on; not surfaced in the publish form
  // (managed later in profile preferences). Still persisted on the users row.
  const [notifyChatEmail] = useState(true)
  const [notifyRemindersEmail] = useState(true)
  const [termsAccepted, setTermsAccepted] = useState(false)

  // Auth (for non-logged-in users)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  // Admins may publish with 2 photos; everyone else needs 3
  const minImages = isAdmin ? 2 : MIN_IMAGES
  const [publishAnon, setPublishAnon] = useState(false)
  const [anonContact, setAnonContact] = useState('')
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register')
  const [authName, setAuthName] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPhone, setAuthPhone] = useState('')
  const [authCountryCode, setAuthCountryCode] = useState('+56')
  const [authPassword, setAuthPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [otpStep, setOtpStep] = useState(false)
  const [otpError, setOtpError] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setIsLoggedIn(!!user)
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('is_admin')
          .eq('id', user.id)
          .single()
        setIsAdmin(profile?.is_admin === true)
      }
    }
    check()
  }, [])

  // Resend OTP cooldown tick
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  const imageItems: ImageItem[] = images.map((_, i) => ({
    id: `img-${i}`,
    url: previews[i],
  }))

  // Progress
  const steps: Step[] = ['type', 'details', 'photos']
  if (!isLoggedIn) steps.push('auth')
  const currentStepIndex = steps.indexOf(step)
  const progress = ((currentStepIndex + 1) / steps.length) * 100

  function formatPhone(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 9)
    if (digits.length <= 1) return digits
    if (digits.length <= 5) return `${digits[0]} ${digits.slice(1)}`
    return `${digits[0]} ${digits.slice(1, 5)} ${digits.slice(5)}`
  }

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }

  function nextStep() {
    if (step === 'type') {
      if (!productType) return
      setStep('details')
      scrollTop()
    } else if (step === 'details') {
      const errors: Record<string, string> = {}
      if (!brand.trim()) errors.brand = 'Obligatorio'
      if (!condition) errors.condition = 'Selecciona una condición'
      if (!price || parseInt(price) <= 0) errors.price = 'Ingresa un precio válido'
      if (!region) errors.region = 'Selecciona una región'
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors)
        return
      }
      setFieldErrors({})
      setStep('photos')
      scrollTop()
    } else if (step === 'photos') {
      if (images.length < minImages) {
        setPopup({ message: `Debes subir al menos ${minImages} fotos`, type: 'error' })
        return
      }
      if (!termsAccepted) {
        setFieldErrors(prev => ({ ...prev, terms: 'Debes aceptar los Términos y Condiciones' }))
        return
      }
      if (isLoggedIn) {
        handlePublish()
      } else {
        setStep('auth')
        scrollTop()
      }
    }
  }

  function prevStep() {
    if (step === 'details') setStep('type')
    else if (step === 'photos') setStep('details')
    else if (step === 'auth') setStep('photos')
    scrollTop()
  }

  function headerBack() {
    if (step === 'auth' && otpStep) {
      setOtpStep(false)
      setOtpError(false)
      scrollTop()
      return
    }
    prevStep()
  }

  async function handlePublish(userId?: string) {
    setLoading(true)
    setPublishPhase('compressing')
    const supabase = createClient()

    let uid = userId
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser()
      uid = user?.id
    }

    if (!uid) {
      setPopup({ message: 'Ocurrio un error. Verifica tus datos e intenta de nuevo.', type: 'error' })
      setLoading(false)
      setPublishPhase(null)
      return
    }

    // Accounts created before phone became mandatory may not have one. Check
    // again at publish time so every new registered listing has WhatsApp.
    const { data: sellerProfile, error: sellerProfileError } = await supabase
      .from('users')
      .select('phone')
      .eq('id', uid)
      .single()

    if (sellerProfileError) {
      setPopup({ message: 'No pudimos verificar tu teléfono. Intenta nuevamente.', type: 'error' })
      setLoading(false)
      setPublishPhase(null)
      return
    }

    if (!normalizeStoredPhone(sellerProfile?.phone)) {
      setPopup({ message: 'Agrega un número de WhatsApp válido en tu perfil antes de publicar.', type: 'warning' })
      setLoading(false)
      setPublishPhase(null)
      return
    }

    setPublishPhase('creating')
    const priceInt = parseInt(price)

    // Persist seller-level preferences. Best-effort — if the row doesn't
    // exist yet (e.g. fresh OTP signup) we silently skip; product insert
    // still proceeds.
    await supabase
      .from('users')
      .update({
        hide_phone: hidePhone,
        notify_chat_email: notifyChatEmail,
        notify_reminders_email: notifyRemindersEmail,
      })
      .eq('id', uid)

    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        seller_id: uid,
        product_type: productType,
        brand: brand.trim(),
        model: model.trim() || null,
        condition,
        description: description.trim() || null,
        price: priceInt,
        region,
        comuna: comuna.trim() || '',
        attributes: cleanedAttributes(),
        status: 'pending',
        terms_accepted: true,
      })
      .select()
      .single()

    if (productError || !product) {
      setPopup({ message: 'Ocurrio un error. Verifica tus datos e intenta de nuevo.', type: 'error' })
      setLoading(false)
      setPublishPhase(null)
      return
    }

    // Set slug
    const slug = buildProductSlug(brand.trim(), model.trim() || null, product.id)
    await supabase.from('products').update({ slug }).eq('id', product.id)

    // Notify the seller their product entered review. Fire-and-forget: a failed
    // email must never block or delay publishing.
    fetch('/api/email/product-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: product.id }),
    }).catch(() => {})

    // Upload images
    setPublishPhase('uploading')
    setUploadProgress({ current: 0, total: images.length })

    for (let i = 0; i < images.length; i++) {
      setUploadProgress({ current: i + 1, total: images.length })
      const file = images[i]
      const ext = file.name.split('.').pop() || 'jpg'
      const path = buildImagePath(slug, i, ext)

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(path, file, { contentType: file.type })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        continue
      }

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(path)

      await supabase.from('product_images').insert({
        product_id: product.id,
        url: publicUrl,
        order: i,
      })
    }

    setPublishPhase('success')
    await new Promise(resolve => setTimeout(resolve, 1200))
    router.push(`/producto/${slug}`)
  }

  async function handleAuthSubmit() {
    const errors: Record<string, string> = {}
    if (!authName.trim()) errors.authName = 'Obligatorio'
    if (!authEmail.trim()) errors.authEmail = 'Obligatorio'
    const digits = authPhone.replace(/\D/g, '')
    if (!digits || digits.length !== 9 || !digits.startsWith('9')) errors.authPhone = '9 XXXX XXXX'
    if (!authPassword) errors.authPassword = 'Obligatorio'
    else if (authPassword.length < 6 || !/[A-Z]/.test(authPassword) || !/[0-9]/.test(authPassword)) errors.authPassword = 'No cumple los requisitos'
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    setLoading(true)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email: authEmail.trim().toLowerCase(),
      password: authPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { name: authName.trim() },
      },
    })

    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('429')) {
        setPopup({ message: 'Has realizado demasiados intentos. Espera unos minutos.', type: 'warning' })
      } else {
        setPopup({ message: 'Ocurrio un error. Verifica tus datos e intenta de nuevo.', type: 'error' })
      }
      setLoading(false)
      return
    }

    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setFieldErrors({ authEmail: 'Ya existe una cuenta con este email' })
      setLoading(false)
      return
    }

    // Phone will be saved after OTP verification (when session exists)

    setLoading(false)
    setOtpStep(true)
    setResendCooldown(60)
  }

  async function handleAnonPublish() {
    const normalizedPhone = normalizeStoredPhone(anonContact)
    if (!normalizedPhone) {
      setFieldErrors({ anonContact: 'Ingresa un número de WhatsApp válido' })
      return
    }
    setFieldErrors({})
    setLoading(true)

    const formData = new FormData()
    formData.append('product_type', productType)
    formData.append('brand', brand.trim())
    formData.append('model', model.trim())
    formData.append('condition', condition)
    formData.append('description', description.trim())
    formData.append('price', price)
    formData.append('region', region)
    formData.append('comuna', comuna.trim())
    formData.append('anon_contact', normalizedPhone)
    formData.append('attributes', JSON.stringify(cleanedAttributes()))
    images.forEach(file => formData.append('images', file))

    try {
      const res = await fetch('/api/publish-anon', { method: 'POST', body: formData })
      await res.json()

      if (!res.ok) {
        setPopup({ message: 'Ocurrio un error. Verifica tus datos e intenta de nuevo.', type: 'error' })
        setLoading(false)
        return
      }

      setLoading(false)
      setStep('success')
    } catch {
      setPopup({ message: 'Ocurrio un error. Verifica tus datos e intenta de nuevo.', type: 'error' })
      setLoading(false)
    }
  }

  async function handleLoginSubmit() {
    const errors: Record<string, string> = {}
    if (!authEmail.trim()) errors.authEmail = 'Obligatorio'
    if (!authPassword) errors.authPassword = 'Obligatorio'
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail.trim().toLowerCase(),
      password: authPassword,
    })

    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('429')) {
        setPopup({ message: 'Has realizado demasiados intentos. Espera unos minutos.', type: 'warning' })
      } else {
        setPopup({ message: 'Ocurrio un error. Verifica tus datos e intenta de nuevo.', type: 'error' })
      }
      setLoading(false)
      return
    }

    await handlePublish()
  }

  async function handleOtpComplete(code: string) {
    setOtpError(false)
    setLoading(true)
    const supabase = createClient()
    const { error, data } = await supabase.auth.verifyOtp({
      email: authEmail.trim().toLowerCase(),
      token: code,
      type: 'signup',
    })

    if (error) {
      setOtpError(true)
      setLoading(false)
      return
    }

    // Now we have a session — save phone number
    if (data.user) {
      const digits = authPhone.replace(/\D/g, '')
      const fullPhone = `${authCountryCode}${digits}`
      await supabase.from('users').upsert({
        id: data.user.id,
        email: data.user.email,
        name: authName.trim(),
        phone: fullPhone,
      }, { onConflict: 'id' })
    }

    // Publish with the new user
    await handlePublish(data.user?.id)
  }

  async function handleResend() {
    if (resendCooldown > 0) return
    const supabase = createClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: authEmail.trim().toLowerCase(),
    })
    if (error) {
      setPopup({ message: 'No pudimos reenviar el código. Intenta nuevamente.', type: 'error' })
      return
    }
    setResendCooldown(60)
  }

  // ─── RENDER ───

  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 pb-24">
      {/* Full-page publish overlay */}
      {publishPhase && (
        <PublishLoadingOverlay
          phase={publishPhase}
          imageProgress={publishPhase === 'uploading' ? uploadProgress : undefined}
        />
      )}

      {/* Progress bar — hidden on success */}
      {step !== 'success' && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
              {step !== 'type' && (
                <button
                  type="button"
                  onClick={headerBack}
                  aria-label="Volver al paso anterior"
                  className="-ml-2 rounded-full p-1 text-brand-500 transition-colors hover:bg-brand-50 hover:text-brand-600"
                >
                  <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
                </button>
              )}
              <h1 className="font-body text-2xl font-black text-brand-500">Publicar producto</h1>
            </div>
            <span className="text-xs text-gray-400">Paso {currentStepIndex + 1} de {steps.length}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {popup && (
        <PopupMessage message={popup.message} type={popup.type} onClose={() => setPopup(null)} autoClose={popup.type === 'warning' ? 0 : 5000} />
      )}

      {/* ─── Step 1: Type ─── */}
      {step === 'type' && (
        <div>
          <h2 className="font-body text-xl font-bold mb-6">¿Qué quieres vender?</h2>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(PRODUCT_TYPES).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => { setProductType(key); setAttrs({}); setPublicationMode('short'); setStep('details'); scrollTop() }}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center ${productType === key ? 'border-brand-500 bg-brand-50' : 'border-gray-100 hover:border-gray-300'}`}
              >
                {(() => {
                  const Icon = TYPE_ICON_COMPONENTS[key] || TYPE_ICON_COMPONENTS.otros
                  return <Icon className={`w-7 h-7 ${productType === key ? 'text-brand-500' : 'text-gray-400'}`} />
                })()}
                <span className="text-[11px] font-medium leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Step 2: Details ─── */}
      {step === 'details' && (
        <div className="space-y-5">
          <h2 className="font-body text-xl font-bold mb-2">Detalles de tu {PRODUCT_TYPES[productType]?.toLowerCase()}</h2>

          {/* Brand + Model row */}
          <div>
            <div className="grid grid-cols-2 gap-3">
              {/* Brand */}
              <div>
                <label className="block text-sm font-medium mb-1">Marca *</label>
                <BrandInput
                  value={brand}
                  onChange={v => { setBrand(v); setFieldErrors(prev => { const n = {...prev}; delete n.brand; return n }) }}
                  productType={productType}
                  placeholder={BRAND_PLACEHOLDERS[productType] || 'Marca'}
                  error={!!fieldErrors.brand}
                />
                {fieldErrors.brand && <p className="text-xs text-red-500 mt-1">{fieldErrors.brand}</p>}
              </div>

              {/* Model */}
              <div>
                <label className="block text-sm font-medium mb-1">Modelo</label>
                {modelConfirmed && model.trim() ? (
                  <button
                    type="button"
                    onClick={() => setModelConfirmed(false)}
                    className="w-full flex items-center bg-white rounded-lg px-3 py-2.5 text-left"
                  >
                    <span className="font-semibold text-sm">{model}</span>
                  </button>
                ) : (
                  <input
                    type="text"
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    onBlur={() => { if (model.trim()) setModelConfirmed(true) }}
                    className="w-full border rounded-lg px-3 py-2.5 text-sm"
                    placeholder={MODEL_PLACEHOLDERS[productType] || 'Modelo'}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Condition — visual bar */}
          <div>
            <label className="block text-sm font-medium mb-2">Condición *</label>
            {fieldErrors.condition && <p className="text-xs text-red-500 mb-2">{fieldErrors.condition}</p>}
            <div className="flex gap-1">
              {CONDITION_ORDER.map(cond => {
                const isSelected = condition === cond.key
                const Icon = CONDITION_ICONS[cond.key]
                return (
                  <button
                    key={cond.key}
                    type="button"
                    onClick={() => {
                      setCondition(cond.key)
                      setFieldErrors(prev => { const n = {...prev}; delete n.condition; return n })
                    }}
                    className={`flex-1 flex flex-col items-center gap-1.5 p-2.5 rounded-lg border-2 transition-all ${isSelected ? 'border-brand-500 bg-brand-50' : 'border-gray-100 hover:border-gray-300'}`}
                  >
                    <Icon className={`w-5 h-5 ${isSelected ? 'text-brand-500' : 'text-gray-400'}`} strokeWidth={1.5} />
                    <span className={`text-[10px] font-bold leading-tight ${isSelected ? 'text-brand-500' : 'text-gray-500'}`}>{cond.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium mb-1">Precio (CLP) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={price ? Number(price).toLocaleString('es-CL') : ''}
                onChange={e => {
                  const raw = e.target.value.replace(/\D/g, '')
                  setPrice(raw)
                  setFieldErrors(prev => { const n = {...prev}; delete n.price; return n })
                }}
                className={`w-full border rounded-lg pl-7 pr-3 py-2.5 ${fieldErrors.price ? 'border-red-400' : ''}`}
                placeholder="150.000"
              />
            </div>
            {fieldErrors.price && <p className="text-xs text-red-500 mt-1">{fieldErrors.price}</p>}
          </div>

          {/* Region & Comuna */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Región *</label>
              <select
                value={region}
                onChange={e => { setRegion(e.target.value); setFieldErrors(prev => { const n = {...prev}; delete n.region; return n }) }}
                className={`w-full border rounded-lg px-3 py-2.5 ${fieldErrors.region ? 'border-red-400' : ''}`}
              >
                <option value="">Seleccionar</option>
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {fieldErrors.region && <p className="text-xs text-red-500 mt-1">{fieldErrors.region}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Comuna</label>
              <input
                type="text"
                value={comuna}
                onChange={e => setComuna(e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5"
                placeholder="Ej: Las Condes"
              />
            </div>
          </div>

          {/* Next */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={prevStep} className="border px-6 py-3 rounded-lg hover:bg-gray-50 text-sm">
              Atrás
            </button>
            <button type="button" onClick={nextStep} className="flex-1 bg-brand-500 text-white py-3 rounded-lg font-medium hover:bg-brand-600 transition-colors">
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 3: Photos ─── */}
      {step === 'photos' && (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-body text-xl font-bold">Detalles de tu producto</h2>
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <span className="text-[11px] font-medium text-gray-500">Publicación:</span>
              <div
                className="inline-flex rounded-lg border border-white bg-white p-0.5 shadow-[0_3px_10px_rgba(15,23,42,0.11),inset_0_1px_0_rgba(255,255,255,1)] ring-1 ring-gray-100"
                role="group"
                aria-label="Extensión de la publicación"
              >
                {([
                  { value: 'short', label: 'Corta' },
                  { value: 'detailed', label: 'Detallada' },
                ] as const).map(option => {
                  const isActive = publicationMode === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPublicationMode(option.value)}
                      aria-pressed={isActive}
                      className={`rounded-md border px-2.5 py-1 text-[11px] leading-none transition-all ${
                        isActive
                          ? 'border-brand-600 bg-brand-500 font-bold text-white shadow-md shadow-brand-500/25'
                          : 'border-transparent bg-transparent font-medium text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">Descripción (opcional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 h-24 resize-none"
              placeholder="Describe el estado, detalles o cualquier información relevante..."
            />
          </div>

          {/* Detailed publication attributes, integrated directly in the form. */}
          {publicationMode === 'detailed' && (PRODUCT_ATTRIBUTES[productType] || []).length > 0 && (
            <div className="border-t border-gray-200 pt-5">
              <AttributeFieldsEditor
                fields={PRODUCT_ATTRIBUTES[productType] || []}
                values={attrs}
                onChange={(key, value) => setAttrs(prev => ({ ...prev, [key]: value }))}
              />
            </div>
          )}

          <SortableImageGrid
            images={imageItems}
            onReorder={(reordered) => {
              const newOrder = reordered.map(item => {
                const idx = parseInt(item.id.replace('img-', ''))
                return images[idx]
              })
              setImages(newOrder)
              setPreviews(newOrder.map(f => URL.createObjectURL(f)))
            }}
            onRemove={(id) => {
              const idx = parseInt(id.replace('img-', ''))
              const next = images.filter((_, i) => i !== idx)
              setImages(next)
              setPreviews(next.map(f => URL.createObjectURL(f)))
            }}
            onAdd={async (files) => {
              if (images.length + files.length > MAX_IMAGES) {
                setPopup({ message: `Máximo ${MAX_IMAGES} fotos`, type: 'error' })
                return
              }
              try {
                setCompressing({ current: 0, total: files.length })
                // Load the compressor on demand (~25 KB) instead of at page load.
                const { default: imageCompression } = await import('browser-image-compression')
                const compressed: File[] = []
                for (const f of files) {
                  const result = await imageCompression(f, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true })
                  compressed.push(result)
                  setCompressing(prev => ({ current: (prev?.current ?? 0) + 1, total: files.length }))
                }
                const next = [...images, ...compressed]
                setImages(next)
                setPreviews(next.map(f => URL.createObjectURL(f)))
              } finally {
                setCompressing(null)
              }
            }}
            compressing={compressing}
          />

          {/* Final details: preferences + terms in one white card.
              The user-level prefs (hide_phone, notify_*) only persist when
              there's a users record — for anon publishes we skip them
              server-side. */}
          <div className="border border-gray-200 rounded-xl bg-white p-4 space-y-3">
            <p className="text-xs font-light text-gray-400">Antes de publicar:</p>
            {isLoggedIn && (
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hidePhone}
                  onChange={e => setHidePhone(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                />
                <span className="text-sm text-gray-800">
                  Ocultar mi número de WhatsApp en mis publicaciones
                </span>
              </label>
            )}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={e => {
                  setTermsAccepted(e.target.checked)
                  if (e.target.checked) setFieldErrors(prev => { const n = {...prev}; delete n.terms; return n })
                }}
                className={`mt-0.5 rounded text-brand-500 focus:ring-brand-500 ${fieldErrors.terms ? 'border-red-400' : 'border-gray-300'}`}
              />
              <span className="text-sm text-gray-800">
                Acepto los Términos y Condiciones de ReskiChile.
              </span>
            </label>
            {fieldErrors.terms && <p className="text-xs text-red-500">{fieldErrors.terms}</p>}
          </div>

          {/* Navigation */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={prevStep} className="border px-6 py-3 rounded-lg hover:bg-gray-50 text-sm">
              Atrás
            </button>
            <button
              type="button"
              onClick={nextStep}
              disabled={loading}
              className="flex-1 bg-brand-500 text-white py-3 rounded-lg font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Publicando...' : isLoggedIn ? 'Publicar producto' : 'Siguiente'}
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 4: Auth (only if not logged in) ─── */}
      {step === 'auth' && !otpStep && (
        <div className="space-y-5">
          {/* Publish without account option */}
          <div className="border rounded-xl p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={publishAnon}
                onChange={e => setPublishAnon(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
              />
              <div>
                <span className="text-sm font-medium">Publicar sin cuenta</span>
                <p className="text-xs text-gray-400 mt-0.5">Solo necesitas un dato de contacto</p>
              </div>
            </label>

            {publishAnon && (
              <div className="mt-4 space-y-3">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-yellow-800 mb-2">Sin cuenta no tendrás acceso a:</p>
                  <ul className="space-y-1.5">
                    <li className="flex items-center gap-2 text-sm text-yellow-700">
                      <svg className="w-4 h-4 text-yellow-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      Estadísticas de visitas e interacciones
                    </li>
                    <li className="flex items-center gap-2 text-sm text-yellow-700">
                      <svg className="w-4 h-4 text-yellow-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      Sistema de ofertas de compradores
                    </li>
                    <li className="flex items-center gap-2 text-sm text-yellow-700">
                      <svg className="w-4 h-4 text-yellow-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      Subastas y permutas de productos
                    </li>
                    <li className="flex items-center gap-2 text-sm text-yellow-700">
                      <svg className="w-4 h-4 text-yellow-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      Editar o gestionar tu publicación
                    </li>
                  </ul>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Teléfono (WhatsApp) *</label>
                  <PhoneInput
                    required
                    error={fieldErrors.anonContact || null}
                    onChange={full => {
                      setAnonContact(full)
                      setFieldErrors(prev => { const n = {...prev}; delete n.anonContact; return n })
                    }}
                    inputClassName="text-sm py-2.5"
                    selectClassName="py-2.5"
                  />
                  {!fieldErrors.anonContact && (
                    <p className="text-xs text-gray-500 mt-1">Los compradores te contactarán a este número.</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={prevStep} className="border px-6 py-3 rounded-lg hover:bg-gray-50 text-sm">
                    Atrás
                  </button>
                  <button
                    type="button"
                    onClick={handleAnonPublish}
                    disabled={loading}
                    className="flex-1 bg-gray-900 text-white py-3 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors text-sm"
                  >
                    {loading ? 'Publicando...' : 'Publicar sin cuenta'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {!publishAnon && (
            <>
          {/* Toggle login/register */}
          <div className="flex rounded-lg border overflow-hidden">
            <button
              type="button"
              onClick={() => { setAuthMode('login'); setFieldErrors({}) }}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${authMode === 'login' ? 'bg-brand-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              Ya tengo cuenta
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('register'); setFieldErrors({}) }}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${authMode === 'register' ? 'bg-brand-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              Crear cuenta
            </button>
          </div>

          {authMode === 'login' ? (
            <>
              <p className="text-sm text-gray-500">Inicia sesión y tu producto se publicará automáticamente.</p>

              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={e => { setAuthEmail(e.target.value); setFieldErrors(prev => { const n = {...prev}; delete n.authEmail; return n }) }}
                  className={`w-full border rounded-lg px-3 py-2.5 ${fieldErrors.authEmail ? 'border-red-400' : ''}`}
                  placeholder="tu@email.com"
                />
                {fieldErrors.authEmail && <p className="text-xs text-red-500 mt-1">{fieldErrors.authEmail}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Contraseña</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={e => { setAuthPassword(e.target.value); setFieldErrors(prev => { const n = {...prev}; delete n.authPassword; return n }) }}
                  className={`w-full border rounded-lg px-3 py-2.5 ${fieldErrors.authPassword ? 'border-red-400' : ''}`}
                  placeholder="Tu contraseña"
                />
                {fieldErrors.authPassword && <p className="text-xs text-red-500 mt-1">{fieldErrors.authPassword}</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={prevStep} className="border px-6 py-3 rounded-lg hover:bg-gray-50 text-sm">
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={handleLoginSubmit}
                  disabled={loading}
                  className="flex-1 bg-brand-500 text-white py-3 rounded-lg font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Ingresando...' : 'Ingresar y publicar'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500">Tu producto se publicará automáticamente al verificar tu cuenta.</p>

              <div>
                <label className="block text-sm font-medium mb-1">Nombre *</label>
                <input
                  type="text"
                  value={authName}
                  onChange={e => { setAuthName(e.target.value); setFieldErrors(prev => { const n = {...prev}; delete n.authName; return n }) }}
                  className={`w-full border rounded-lg px-3 py-2.5 ${fieldErrors.authName ? 'border-red-400' : ''}`}
                  placeholder="Tu nombre"
                  autoComplete="name"
                />
                {fieldErrors.authName && <p className="text-xs text-red-500 mt-1">{fieldErrors.authName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={e => { setAuthEmail(e.target.value); setFieldErrors(prev => { const n = {...prev}; delete n.authEmail; return n }) }}
                  className={`w-full border rounded-lg px-3 py-2.5 ${fieldErrors.authEmail ? 'border-red-400' : ''}`}
                  placeholder="tu@email.com"
                />
                {fieldErrors.authEmail && <p className="text-xs text-red-500 mt-1">{fieldErrors.authEmail}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Teléfono (WhatsApp) *</label>
                <div className="flex gap-2">
                  <select
                    value={authCountryCode}
                    onChange={e => setAuthCountryCode(e.target.value)}
                    className="border rounded-lg px-2 py-2.5 text-sm w-24 shrink-0"
                  >
                    <option value="+56">🇨🇱 +56</option>
                    <option value="+54">🇦🇷 +54</option>
                    <option value="+55">🇧🇷 +55</option>
                    <option value="+1">🇺🇸 +1</option>
                  </select>
                  <input
                    type="tel"
                    value={formatPhone(authPhone)}
                    onChange={e => { setAuthPhone(e.target.value.replace(/\D/g, '').slice(0, 9)); setFieldErrors(prev => { const n = {...prev}; delete n.authPhone; return n }) }}
                    className={`w-full border rounded-lg px-3 py-2.5 ${fieldErrors.authPhone ? 'border-red-400' : ''}`}
                    placeholder="9 1234 5678"
                  />
                </div>
                {fieldErrors.authPhone && <p className="text-xs text-red-500 mt-1">{fieldErrors.authPhone}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Contraseña *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={authPassword}
                    onChange={e => { setAuthPassword(e.target.value); setFieldErrors(prev => { const n = {...prev}; delete n.authPassword; return n }) }}
                    className={`w-full border rounded-lg px-3 py-2.5 pr-10 ${fieldErrors.authPassword ? 'border-red-400' : ''}`}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d={showPassword ? 'M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88' : 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178zM15 12a3 3 0 11-6 0 3 3 0 016 0z'} />
                    </svg>
                  </button>
                </div>
                {fieldErrors.authPassword && <p className="text-xs text-red-500 mt-1">{fieldErrors.authPassword}</p>}
                {authPassword.length > 0 && (() => {
                  const checks = { length: authPassword.length >= 6, upper: /[A-Z]/.test(authPassword), number: /[0-9]/.test(authPassword) }
                  const strength = Object.values(checks).filter(Boolean).length
                  const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500']
                  return (
                    <div className="mt-2">
                      <div className="flex gap-1">
                        {[0, 1, 2].map(i => (
                          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < strength ? colors[strength] : 'bg-gray-200'}`} />
                        ))}
                      </div>
                      <div className="mt-1.5 space-y-0.5">
                        <p className={`text-xs ${checks.length ? 'text-green-600' : 'text-gray-400'}`}>{checks.length ? '✓' : '○'} Mínimo 6 caracteres</p>
                        <p className={`text-xs ${checks.upper ? 'text-green-600' : 'text-gray-400'}`}>{checks.upper ? '✓' : '○'} Una mayúscula</p>
                        <p className={`text-xs ${checks.number ? 'text-green-600' : 'text-gray-400'}`}>{checks.number ? '✓' : '○'} Un número</p>
                      </div>
                    </div>
                  )
                })()}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={prevStep} className="border px-6 py-3 rounded-lg hover:bg-gray-50 text-sm">
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={handleAuthSubmit}
                  disabled={loading}
                  className="flex-1 bg-brand-500 text-white py-3 rounded-lg font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Creando cuenta...' : 'Crear cuenta y publicar'}
                </button>
              </div>
            </>
          )}
            </>
          )}
        </div>
      )}

      {/* ─── OTP Verification (mismo diseño que /auth/registro) ─── */}
      {step === 'auth' && otpStep && (
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            {/* Animated envelope icon */}
            <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-5 animate-bounce-slow">
              <svg className="w-8 h-8 text-brand-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <h1 className="font-body text-2xl font-black text-gray-900">Verifica tu email</h1>
            <p className="text-sm text-gray-500 mt-2">
              Enviamos un código de 6 dígitos a
            </p>
            <p className="text-sm font-semibold text-gray-900 mt-1">{authEmail}</p>
            <div className="mt-4 flex items-center justify-center gap-1.5 text-amber-500 animate-pulse">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 11v5M12 8h.01" />
              </svg>
              <p className="text-xs font-medium">
                Si no lo ves en tu bandeja, <span className="font-bold">REVISAR SPAM</span>
              </p>
            </div>
          </div>

          {/* OTP Input */}
          <div className="mb-6">
            <OtpInput
              onComplete={handleOtpComplete}
              disabled={loading}
              error={otpError}
            />
          </div>

          {/* Status */}
          {loading && (
            <div className="flex items-center justify-center gap-2 mb-4">
              <Spinner size="sm" />
              <span className="text-sm text-gray-500">Verificando y publicando...</span>
            </div>
          )}

          {otpError && (
            <p className="text-center text-sm text-red-500 mb-4">
              Código incorrecto. Intenta de nuevo.
            </p>
          )}

          {/* Resend */}
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1">¿No recibiste el código?</p>
            {resendCooldown > 0 ? (
              <p className="text-xs text-gray-400">
                Reenviar en <span className="font-mono font-bold text-gray-600">{resendCooldown}s</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                className="text-xs text-brand-500 hover:underline font-medium"
              >
                Reenviar código
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Success (anon) ─── */}
      {step === 'success' && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-body text-2xl font-black text-gray-900 mb-2">Producto publicado</h2>
          <p className="text-sm text-gray-500 mb-1">Tu publicación está en revisión.</p>
          <p className="text-sm text-gray-500 mb-8">Te contactaremos a <strong>{anonContact}</strong> cuando esté aprobada.</p>
          <div className="flex flex-col gap-3 max-w-xs mx-auto">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="bg-brand-500 text-white py-3 rounded-lg font-medium hover:bg-brand-600 transition-colors"
            >
              Volver al inicio
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('type')
                setProductType('')
                setAttrs({})
                setPublicationMode('short')
                setBrand('')
                setModel('')
                setCondition('usado_como_nuevo')
                setPrice('')
                setImages([])
                setPreviews([])
                setDescription('')
                setAnonContact('')
                setPublishAnon(false)
              }}
              className="border py-3 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              Publicar otro producto
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
