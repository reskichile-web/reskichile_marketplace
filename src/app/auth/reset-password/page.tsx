'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Spinner from '@/components/Spinner'

const PASSWORD_MIN = 6

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login?error=expired_link')
        return
      }
      setChecking(false)
    }
    check()
  }, [router])

  function validate(): string | null {
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
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    // Clear must_change_password flag
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('users')
        .update({ must_change_password: false })
        .eq('id', user.id)
    }

    router.push('/')
    router.refresh()
  }

  if (checking) return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center">
        <Spinner size="lg" className="mx-auto mb-4" />
        <p className="text-sm text-gray-500">Verificando...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="font-body text-2xl font-black text-gray-900">Nueva contraseña</h1>
            <p className="text-sm text-gray-500 mt-2">
              Elige tu nueva contraseña para acceder a tu cuenta.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
      </div>
    </div>
  )
}
