'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PopupMessage from '@/components/PopupMessage'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [popup, setPopup] = useState<{ message: string; type: 'error' | 'warning' } | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})

    const errors: Record<string, string> = {}
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) errors.email = 'Este campo es obligatorio'
    if (!password) errors.password = 'Este campo es obligatorio'
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
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
    <div className="max-w-md mx-auto px-4 min-h-[calc(100vh-130px)] flex flex-col justify-center pb-6 -mb-[40px]">
      <h1 className="font-body text-3xl font-black mb-6 text-brand-500">Iniciar sesión</h1>

      {popup && (
        <PopupMessage
          message={popup.message}
          type={popup.type}
          onClose={() => setPopup(null)}
          autoClose={popup.type === 'warning' ? 0 : 5000}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
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

        <div>
          <label className="block text-sm font-medium mb-1">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setFieldErrors(prev => { const n = {...prev}; delete n.password; return n }) }}
            className={`w-full border rounded px-3 py-2 ${fieldErrors.password ? 'border-red-400' : ''}`}
            autoComplete="current-password"
          />
          {fieldErrors.password && <p className="text-xs text-red-500 mt-1">{fieldErrors.password}</p>}
        </div>

        <div className="flex justify-end">
          <Link href="/auth/olvide-contrasena" className="text-xs text-gray-400 hover:text-brand-500 transition-colors">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-500 text-white py-2 rounded hover:bg-brand-600 disabled:opacity-50"
        >
          {loading ? (
            <svg className="w-5 h-5 mx-auto animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeLinecap="round" opacity={0.3} />
              <path d="M12 2a10 10 0 019.95 9" stroke="white" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : 'Ingresar'}
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

