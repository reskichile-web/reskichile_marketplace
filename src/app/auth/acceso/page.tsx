'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const PASSWORD_MIN = 6

export default function AccesoPage() {
  const router = useRouter()
  const [step, setStep] = useState<'email' | 'password'>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) { setError('Ingresa tu email'); return }

    setLoading(true)

    const supabase = createClient()

    // Check if user exists and needs password change
    // We use signInWithPassword with a dummy password to check if the user exists
    // Better approach: check the users table directly via an edge function or RPC
    // For now, we'll try to sign in and check the error
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password: '___check_exists___',
    })

    if (signInError) {
      // "Invalid login credentials" means user exists but wrong password
      if (signInError.message.includes('Invalid login credentials')) {
        // User exists — send reset password email
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        })

        if (resetError) {
          setError('Error al enviar el email. Intenta de nuevo.')
          setLoading(false)
          return
        }

        setStep('password')
        setLoading(false)
        return
      }

      // User doesn't exist
      router.push(`/auth/registro?email=${encodeURIComponent(trimmedEmail)}`)
      return
    }

    // If somehow login worked (shouldn't with dummy password)
    setLoading(false)
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">

          {step === 'email' ? (
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
          ) : (
            <>
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
                  <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <h2 className="font-body text-xl font-black mb-2">Revisa tu email</h2>
                <p className="text-sm text-gray-500">
                  Enviamos un link a <span className="font-medium text-gray-700">{email}</span> para que puedas crear tu contraseña y acceder a tu cuenta.
                </p>
              </div>

              <div className="mt-6 bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500">
                  <span className="font-medium text-gray-700">¿No recibes el email?</span> Revisa tu carpeta de spam. Si aún no llega,
                  <button
                    onClick={() => { setStep('email'); setError('') }}
                    className="text-brand-500 hover:underline ml-1"
                  >
                    intenta de nuevo
                  </button>.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
