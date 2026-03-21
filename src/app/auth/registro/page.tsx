'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import OtpInput from '@/components/OtpInput'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_REGEX = /^\+?[\d\s\-()]{8,15}$/
const PASSWORD_MIN = 6

type Step = 'form' | 'otp' | 'success'

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<Step>('form')
  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
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

  function validate(): string | null {
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedPhone = phone.trim()

    if (!trimmedEmail) return 'Ingresa tu email'
    if (!EMAIL_REGEX.test(trimmedEmail)) return 'Ingresa un email válido'
    if (!trimmedPhone) return 'Ingresa tu número de teléfono'
    if (!PHONE_REGEX.test(trimmedPhone)) return 'Ingresa un número de teléfono válido'
    if (!password) return 'Ingresa una contraseña'
    if (password.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`
    if (!/[A-Z]/.test(password)) return 'La contraseña debe tener al menos una mayúscula'
    if (!/[0-9]/.test(password)) return 'La contraseña debe tener al menos un número'
    if (password !== confirmPassword) return 'Las contraseñas no coinciden'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setLoading(true)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    })

    if (error) {
      setError(translateError(error.message))
      setLoading(false)
      return
    }

    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError('Ya existe una cuenta con este email. Intenta iniciar sesión.')
      setLoading(false)
      return
    }

    // Save phone to users table
    if (data.user) {
      await supabase.from('users').upsert({
        id: data.user.id,
        email: data.user.email,
        phone: phone.trim(),
      }, { onConflict: 'id' })
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

    setStep('success')

    // Brief delay to show success, then redirect
    setTimeout(() => {
      router.push('/')
      router.refresh()
    }, 1500)
  }

  async function handleResend() {
    if (resendCooldown > 0) return
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
    })

    if (error) {
      setError(error.message)
      return
    }

    setResendCooldown(60)
  }

  // ─── Step: Form ───
  if (step === 'form') {
    return (
      <div className="max-w-md mx-auto px-4 min-h-[calc(100vh-130px)] flex flex-col justify-center pb-6">
        <h1 className="font-body text-3xl font-black mb-6">Crear cuenta</h1>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="tu@email.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Teléfono (WhatsApp)</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="+56 9 1234 5678"
              autoComplete="tel"
            />
            <p className="text-xs text-gray-500 mt-1">
              Los compradores te contactarán por WhatsApp
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
              autoComplete="new-password"
            />
            <p className="text-xs text-gray-500 mt-1">
              Mínimo {PASSWORD_MIN} caracteres, una mayúscula y un número
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Confirmar contraseña</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
              autoComplete="new-password"
            />
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
      <div className="max-w-md mx-auto px-4 min-h-[calc(100vh-130px)] flex flex-col justify-center pb-6">
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

        {error && (
          <p className="text-center text-sm text-red-500 mb-4">{error}</p>
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
            onClick={() => { setStep('form'); setError('') }}
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
    <div className="max-w-md mx-auto px-4 min-h-[calc(100vh-130px)] flex flex-col justify-center pb-6">
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

function translateError(message: string): string {
  if (message.includes('User already registered')) return 'Ya existe una cuenta con este email'
  if (message.includes('Password should be at least')) return 'La contraseña es muy corta'
  if (message.includes('Unable to validate email')) return 'El email ingresado no es válido'
  if (message.includes('Signup requires a valid password')) return 'Ingresa una contraseña válida'
  if (message.includes('rate limit')) return 'Demasiados intentos. Espera unos minutos.'
  return message
}
