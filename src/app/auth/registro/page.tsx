'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import OtpInput from '@/components/OtpInput'
import PopupMessage from '@/components/PopupMessage'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const PASSWORD_MIN = 6

type Step = 'form' | 'otp' | 'success'

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<Step>('form')
  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [countryCode, setCountryCode] = useState('+56')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [popup, setPopup] = useState<{ message: string; type: 'error' | 'warning' } | null>(null)
  const [loading, setLoading] = useState(false)
  const [otpError, setOtpError] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  // Phone formatting: 9 1234 5678
  function formatPhone(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 9)
    if (digits.length <= 1) return digits
    if (digits.length <= 5) return `${digits[0]} ${digits.slice(1)}`
    return `${digits[0]} ${digits.slice(1, 5)} ${digits.slice(5)}`
  }

  function handlePhoneChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 9)
    setPhone(digits)
  }

  // Password strength
  const pwChecks = {
    length: password.length >= PASSWORD_MIN,
    upper: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
  }
  const pwStrength = Object.values(pwChecks).filter(Boolean).length
  const pwColors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500']


  function validate(): boolean {
    const errors: Record<string, string> = {}
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) errors.email = 'Este campo es obligatorio'
    else if (!EMAIL_REGEX.test(trimmedEmail)) errors.email = 'Ingresa un email válido'
    const digits = phone.replace(/\D/g, '')
    if (!digits) errors.phone = 'Este campo es obligatorio'
    else if (digits.length !== 9 || !digits.startsWith('9')) errors.phone = 'Formato: 9 XXXX XXXX (9 dígitos)'
    if (!password) errors.password = 'Este campo es obligatorio'
    else if (!pwChecks.length || !pwChecks.upper || !pwChecks.number) errors.password = 'La contraseña no cumple los requisitos'
    if (!confirmPassword) errors.confirmPassword = 'Este campo es obligatorio'
    else if (password !== confirmPassword) errors.confirmPassword = 'Las contraseñas no coinciden'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})

    if (!validate()) return

    setLoading(true)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    })

    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('429') || error.status === 429) {
        setPopup({ message: 'Has realizado demasiados intentos. Por seguridad, espera unos minutos antes de intentar nuevamente.', type: 'warning' })
      } else {
        setPopup({ message: 'No pudimos procesar tu solicitud. Verifica tus datos e intenta nuevamente.', type: 'error' })
      }
      setLoading(false)
      return
    }

    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setFieldErrors({ email: 'Ya existe una cuenta con este email' })
      setLoading(false)
      return
    }

    setLoading(false)
    setStep('otp')
    setResendCooldown(60)
  }

  async function handleOtpComplete(code: string) {
    setOtpError(false)
    setVerifying(true)

    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code,
      type: 'signup',
    })

    if (error) {
      setOtpError(true)
      setVerifying(false)
      return
    }

    // Now we have a session — save user profile with generic name
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const fullPhone = `${countryCode}${phone.replace(/\D/g, '')}`
      const genericName = `user${Math.floor(Math.random() * 90000) + 10000}`
      await supabase.from('users').upsert({
        id: user.id,
        email: user.email,
        name: genericName,
        phone: fullPhone,
      }, { onConflict: 'id' })
    }

    setStep('success')

    setTimeout(() => {
      router.push('/')
      router.refresh()
    }, 1500)
  }

  async function handleResend() {
    if (resendCooldown > 0) return

    const supabase = createClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
    })

    if (error) {
      setPopup({ message: 'No pudimos reenviar el código. Intenta nuevamente.', type: 'error' })
      return
    }

    setResendCooldown(60)
  }

  // ─── Step: Form ───
  if (step === 'form') {
    return (
      <div className="max-w-md mx-auto px-4 min-h-[calc(100vh-130px)] flex flex-col justify-center pb-6 -mb-[40px]">
        <h1 className="font-body text-3xl font-black mb-6 text-brand-500">Crear cuenta</h1>

        {popup && (
          <PopupMessage message={popup.message} type={popup.type} onClose={() => setPopup(null)} autoClose={popup.type === 'warning' ? 0 : 5000} />
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1">Email *</label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setFieldErrors(prev => { const n = {...prev}; delete n.email; return n }) }}
              className={`w-full border rounded px-3 py-2 ${fieldErrors.email ? 'border-red-400' : ''}`}
              placeholder="tu@email.com"
              autoComplete="email"
            />
            {fieldErrors.email && <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
          </div>

          {/* Phone with country code */}
          <div>
            <label className="block text-sm font-medium mb-1">Teléfono (WhatsApp) *</label>
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={e => setCountryCode(e.target.value)}
                className="border rounded px-2 py-2 text-sm w-24 shrink-0"
              >
                <option value="+56">🇨🇱 +56</option>
                <option value="+54">🇦🇷 +54</option>
                <option value="+55">🇧🇷 +55</option>
                <option value="+51">🇵🇪 +51</option>
                <option value="+57">🇨🇴 +57</option>
                <option value="+52">🇲🇽 +52</option>
                <option value="+1">🇺🇸 +1</option>
                <option value="+34">🇪🇸 +34</option>
              </select>
              <input
                type="tel"
                value={formatPhone(phone)}
                onChange={e => { handlePhoneChange(e.target.value); setFieldErrors(prev => { const n = {...prev}; delete n.phone; return n }) }}
                className={`w-full border rounded px-3 py-2 ${fieldErrors.phone ? 'border-red-400' : ''}`}
                placeholder="9 1234 5678"
                autoComplete="tel-national"
              />
            </div>
            {fieldErrors.phone ? (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">Los compradores te contactarán por WhatsApp</p>
            )}
          </div>

          {/* Password with strength meter */}
          <div>
            <label className="block text-sm font-medium mb-1">Contraseña *</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setFieldErrors(prev => { const n = {...prev}; delete n.password; return n }) }}
                className={`w-full border rounded px-3 py-2 pr-10 ${fieldErrors.password ? 'border-red-400' : ''}`}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
            {fieldErrors.password && <p className="text-xs text-red-500 mt-1">{fieldErrors.password}</p>}
            {/* Strength bars */}
            {password.length > 0 && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${i < pwStrength ? pwColors[pwStrength] : 'bg-gray-200'}`}
                    />
                  ))}
                </div>
                <div className="mt-1.5 space-y-0.5">
                  <p className={`text-xs flex items-center gap-1.5 ${pwChecks.length ? 'text-green-600' : 'text-gray-400'}`}>
                    {pwChecks.length ? '✓' : '○'} Mínimo {PASSWORD_MIN} caracteres
                  </p>
                  <p className={`text-xs flex items-center gap-1.5 ${pwChecks.upper ? 'text-green-600' : 'text-gray-400'}`}>
                    {pwChecks.upper ? '✓' : '○'} Una letra mayúscula
                  </p>
                  <p className={`text-xs flex items-center gap-1.5 ${pwChecks.number ? 'text-green-600' : 'text-gray-400'}`}>
                    {pwChecks.number ? '✓' : '○'} Un número
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm font-medium mb-1">Confirmar contraseña *</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setFieldErrors(prev => { const n = {...prev}; delete n.confirmPassword; return n }) }}
              className={`w-full border rounded px-3 py-2 ${fieldErrors.confirmPassword ? 'border-red-400' : ''}`}
              autoComplete="new-password"
            />
            {fieldErrors.confirmPassword && <p className="text-xs text-red-500 mt-1">{fieldErrors.confirmPassword}</p>}
            {!fieldErrors.confirmPassword && confirmPassword.length > 0 && password !== confirmPassword && (
              <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-500 text-white py-2.5 rounded-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="mt-4 text-sm text-center text-gray-600">
          ¿Ya tienes cuenta?{' '}
          <Link href="/auth/login" className="text-brand-500 hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    )
  }

  // ─── Step: OTP Verification ───
  if (step === 'otp') {
    return (
      <div className="max-w-md mx-auto px-4 min-h-[calc(100vh-130px)] flex flex-col justify-center pb-6 -mb-[40px]">
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
          <p className="text-sm font-semibold text-gray-900 mt-1">{email}</p>
        </div>

        {/* OTP Input */}
        <div className="mb-6">
          <OtpInput
            onComplete={handleOtpComplete}
            disabled={verifying}
            error={otpError}
          />
        </div>

        {/* Status */}
        {verifying && (
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-500">Verificando...</span>
          </div>
        )}

        {otpError && (
          <p className="text-center text-sm text-red-500 mb-4">
            Código incorrecto. Intenta de nuevo.
          </p>
        )}

        {popup && (
          <PopupMessage message={popup.message} type={popup.type} onClose={() => setPopup(null)} autoClose={popup.type === 'warning' ? 0 : 5000} />
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
              onClick={handleResend}
              className="text-xs text-brand-500 hover:underline font-medium"
            >
              Reenviar código
            </button>
          )}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => { setStep('form'); setPopup(null); setFieldErrors({}) }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            ← Volver al formulario
          </button>
        </div>
      </div>
    )
  }

  // ─── Step: Success ───
  return (
    <div className="max-w-md mx-auto px-4 min-h-[calc(100vh-130px)] flex flex-col justify-center pb-6 -mb-[40px]">
      <div className="text-center">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="font-body text-2xl font-black text-gray-900 mb-2">Cuenta creada</h1>
        <p className="text-sm text-gray-500">Redirigiendo...</p>
      </div>
    </div>
  )
}

