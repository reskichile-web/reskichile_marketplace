'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const PASSWORD_MIN = 6

export default function ChangePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      const { data: profile } = await supabase
        .from('users')
        .select('must_change_password')
        .eq('id', user.id)
        .single()

      if (!profile?.must_change_password) {
        router.push('/')
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

    // Update password in Auth
    const { error: authError } = await supabase.auth.updateUser({ password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // Clear the flag
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
    <div className="max-w-md mx-auto mt-24 px-4 text-gray-500 text-center">Verificando...</div>
  )

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="font-body text-2xl font-black text-gray-900">Actualiza tu contraseña</h1>
            <p className="text-sm text-gray-500 mt-2">
              Para continuar, necesitas crear una nueva contraseña para tu cuenta.
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
