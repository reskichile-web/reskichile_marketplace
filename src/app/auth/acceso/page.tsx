'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const PASSWORD_MIN = 6

export default function AccesoPage() {
  const router = useRouter()
  const [step, setStep] = useState<'email' | 'password' | 'done'>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) { setError('Ingresa tu email'); return }

    setLoading(true)

    // Check if email exists via API
    const res = await fetch('/api/auth/check-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmedEmail }),
    })
    const data = await res.json()

    if (data.exists) {
      // User exists → show password form
      setStep('password')
      setLoading(false)
    } else {
      // User doesn't exist → redirect to register
      router.push(`/auth/registro?email=${encodeURIComponent(trimmedEmail)}`)
    }
  }

  function validatePassword(): string | null {
    if (!password) return 'Ingresa una contraseña'
    if (password.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`
    if (!/[A-Z]/.test(password)) return 'La contraseña debe tener al menos una mayúscula'
    if (!/[0-9]/.test(password)) return 'La contraseña debe tener al menos un número'
    if (password !== confirmPassword) return 'Las contraseñas no coinciden'
    return null
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const validationError = validatePassword()
    if (validationError) { setError(validationError); return }

    setLoading(true)

    // Change password via API (uses service role)
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Error al cambiar la contraseña')
      setLoading(false)
      return
    }

    // Now sign in with the new password
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (signInError) {
      setError('Contraseña actualizada pero hubo un error al iniciar sesión. Intenta desde el login.')
      setLoading(false)
      return
    }

    setStep('done')
    setLoading(false)

    // Redirect after brief delay
    setTimeout(() => {
      router.push('/')
      router.refresh()
    }, 2000)
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">

          {step === 'email' && (
            <>
              <div className="mb-6">
                <h1 className="font-body text-2xl font-black text-gray-900">Acceder a tu cuenta</h1>
                <p className="text-sm text-gray-500 mt-2">
                  Ingresa tu email para configurar tu acceso a ReskiChile.
                </p>
              </div>

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
                  {loading ? 'Verificando...' : 'Continuar'}
                </button>
              </form>

              <p className="mt-5 text-sm text-center text-gray-500">
                ¿Ya tienes contraseña?{' '}
                <Link href="/auth/login" className="text-brand-500 hover:underline font-medium">
                  Inicia sesión
                </Link>
              </p>
            </>
          )}

          {step === 'password' && (
            <>
              <div className="mb-6">
                <h1 className="font-body text-2xl font-black text-gray-900">Crea tu contraseña</h1>
                <p className="text-sm text-gray-500 mt-2">
                  Configura una contraseña para <span className="font-medium text-gray-700">{email}</span>
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

              <p className="mt-5 text-sm text-center text-gray-500">
                <button onClick={() => { setStep('email'); setError('') }} className="text-brand-500 hover:underline font-medium">
                  Usar otro email
                </button>
              </p>
            </>
          )}

          {step === 'done' && (
            <div className="text-center py-6">
              <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="font-body text-xl font-black mb-2">Listo</h2>
              <p className="text-sm text-gray-500">
                Tu contraseña ha sido configurada. Redirigiendo...
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
