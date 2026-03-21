'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import OtpInput from '@/components/OtpInput'

const PASSWORD_MIN = 6

type Step = 'email' | 'otp' | 'password' | 'success'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefilledEmail = searchParams.get('email') || ''
  const alreadySent = searchParams.get('sent') === '1'
  const [step, setStep] = useState<Step>(alreadySent && prefilledEmail ? 'otp' : 'email')
  const [email, setEmail] = useState(prefilledEmail)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [otpError, setOtpError] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(alreadySent ? 60 : 0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) { setError('Ingresa tu email'); return }

    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail)

    if (error) {
      setError(error.message)
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
      type: 'recovery',
    })

    if (error) {
      setOtpError(true)
      setVerifying(false)
      return
    }

    setVerifying(false)
    setStep('password')
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!password) { setError('Ingresa una contraseña'); return }
    if (password.length < PASSWORD_MIN) { setError(`Mínimo ${PASSWORD_MIN} caracteres`); return }
    if (!/[A-Z]/.test(password)) { setError('Debe tener al menos una mayúscula'); return }
    if (!/[0-9]/.test(password)) { setError('Debe tener al menos un número'); return }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return }

    setLoading(true)

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    // Clear must_change_password flag
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('users').update({ must_change_password: false }).eq('id', user.id)
    }

    setStep('success')
    setTimeout(() => {
      router.push('/')
      router.refresh()
    }, 1500)
  }

  async function handleResend() {
    if (resendCooldown > 0) return
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase())

    if (error) {
      setError(error.message)
      return
    }
    setResendCooldown(60)
  }

  // ─── Step: Email ───
  if (step === 'email') {
    return (
      <div className="max-w-md mx-auto px-4 min-h-[calc(100vh-130px)] flex flex-col justify-center pb-6">
        <h1 className="font-body text-2xl font-black mb-2">Recuperar contraseña</h1>
        <p className="text-sm text-gray-500 mb-6">
          Te enviaremos un código de verificación a tu email.
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>
        )}

        <form onSubmit={handleEmailSubmit} className="space-y-4">
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
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-500 text-white py-2.5 rounded-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Enviando...' : 'Enviar código'}
          </button>
        </form>

        <p className="mt-5 text-sm text-center text-gray-500">
          <Link href="/auth/login" className="text-brand-500 hover:underline font-medium">
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    )
  }

  // ─── Step: OTP ───
  if (step === 'otp') {
    return (
      <div className="max-w-md mx-auto px-4 min-h-[calc(100vh-130px)] flex flex-col justify-center pb-6">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-brand-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 className="font-body text-2xl font-black text-gray-900">Ingresa el código</h1>
          <p className="text-sm text-gray-500 mt-2">
            Enviamos un código de 6 dígitos a
          </p>
          <p className="text-sm font-semibold text-gray-900 mt-1">{email}</p>
        </div>

        <div className="mb-6">
          <OtpInput
            onComplete={handleOtpComplete}
            disabled={verifying}
            error={otpError}
          />
        </div>

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

        <div className="text-center">
          <p className="text-xs text-gray-400 mb-1">¿No recibiste el código?</p>
          {resendCooldown > 0 ? (
            <p className="text-xs text-gray-400">
              Reenviar en <span className="font-mono font-bold text-gray-600">{resendCooldown}s</span>
            </p>
          ) : (
            <button onClick={handleResend} className="text-xs text-brand-500 hover:underline font-medium">
              Reenviar código
            </button>
          )}
        </div>

        <div className="mt-8 text-center">
          <button onClick={() => { setStep('email'); setError('') }} className="text-xs text-gray-400 hover:text-gray-600">
            ← Usar otro email
          </button>
        </div>
      </div>
    )
  }

  // ─── Step: New Password ───
  if (step === 'password') {
    return (
      <div className="max-w-md mx-auto px-4 min-h-[calc(100vh-130px)] flex flex-col justify-center pb-6">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h1 className="font-body text-2xl font-black text-gray-900">Email verificado</h1>
          <p className="text-sm text-gray-500 mt-2">
            Ahora elige tu nueva contraseña.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nueva contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
              autoComplete="new-password"
              autoFocus
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
            {loading ? 'Guardando...' : 'Guardar contraseña'}
          </button>
        </form>
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
        <h1 className="font-body text-2xl font-black text-gray-900 mb-2">Contraseña actualizada</h1>
        <p className="text-sm text-gray-500">Redirigiendo...</p>
      </div>
    </div>
  )
}
