'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_REGEX = /^\+?[\d\s\-()]{8,15}$/
const PASSWORD_MIN = 6

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
    if (validationError) {
      setError(validationError)
      return
    }

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

    // Supabase con autoconfirm devuelve usuario con identities vacío si ya existe
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError('Ya existe una cuenta con este email. Intenta iniciar sesión.')
      setLoading(false)
      return
    }

    if (data.user) {
      await supabase.from('users').upsert({
        id: data.user.id,
        email: data.user.email,
        phone: phone.trim(),
      }, { onConflict: 'id' })
    }

    router.push('/perfil')
    router.refresh()
  }

  return (
    <div className="max-w-md mx-auto px-4 min-h-[calc(100vh-130px)] flex flex-col justify-center pb-10 mb-[200px]">
      <h1 className="font-body text-3xl font-black mb-6">Crear cuenta</h1>

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
          <label className="block text-sm font-medium mb-1">Teléfono (WhatsApp) *</label>
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
          className="w-full bg-brand-500 text-white py-2 rounded hover:bg-brand-600 disabled:opacity-50"
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

function translateError(message: string): string {
  if (message.includes('User already registered')) return 'Ya existe una cuenta con este email'
  if (message.includes('Password should be at least')) return 'La contraseña es muy corta'
  if (message.includes('Unable to validate email')) return 'El email ingresado no es válido'
  if (message.includes('Signup requires a valid password')) return 'Ingresa una contraseña válida'
  if (message.includes('rate limit')) return 'Demasiados intentos. Espera unos minutos.'
  return message
}
