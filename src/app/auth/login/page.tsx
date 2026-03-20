'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      setError('Ingresa tu email')
      return
    }
    if (!password) {
      setError('Ingresa tu contraseña')
      return
    }

    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    })

    if (error) {
      setError(translateError(error.message))
      setLoading(false)
      return
    }

    // Check profile flags
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('is_admin, must_change_password')
        .eq('id', user.id)
        .single()

      if (profile?.must_change_password) {
        router.push('/auth/cambiar-contrasena')
        router.refresh()
        return
      }

      if (profile?.is_admin) {
        router.push('/admin')
        router.refresh()
        return
      }
    }

    router.push(redirect)
    router.refresh()
  }

  return (
    <div className="max-w-md mx-auto mt-16 px-4">
      <h1 className="font-body text-3xl font-black mb-6">Iniciar sesión</h1>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">
          {error}
        </div>
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
          <label className="block text-sm font-medium mb-1">Contraseña</label>
          <input
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2"
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-500 text-white py-2 rounded hover:bg-brand-600 disabled:opacity-50"
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>

      <p className="mt-4 text-sm text-center text-gray-600">
        ¿No tienes cuenta?{' '}
        <Link href="/auth/registro" className="text-brand-500 hover:underline">
          Regístrate
        </Link>
      </p>
    </div>
  )
}

function translateError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'Email o contraseña incorrectos'
  if (message.includes('Email not confirmed')) return 'Tu email no ha sido confirmado. Revisa tu bandeja de entrada.'
  if (message.includes('rate limit')) return 'Demasiados intentos. Espera unos minutos.'
  if (message.includes('User not found')) return 'No existe una cuenta con este email'
  return message
}
