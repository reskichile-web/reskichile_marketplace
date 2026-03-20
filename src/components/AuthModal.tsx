'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_REGEX = /^\+?[\d\s\-()]{8,15}$/
const PASSWORD_MIN = 6

type View = 'login' | 'register' | 'forgot'

export default function AuthModal({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('login')

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  function openLogin() { setView('login'); setOpen(true) }
  function openRegister() { setView('register'); setOpen(true) }
  function close() { setOpen(false) }

  return (
    <>
      <button onClick={openLogin} className={variant === 'mobile' ? 'text-[10px] text-gray-400 hover:text-gray-700 transition-colors' : 'text-xs text-gray-400 hover:text-gray-700 transition-colors font-normal'}>
        {variant === 'mobile' ? 'Ingresar' : 'Iniciar sesión'}
      </button>
      <span className={variant === 'mobile' ? 'text-gray-300 text-[10px]' : 'text-gray-200'}>|</span>
      <button onClick={openRegister} className={variant === 'mobile' ? 'text-[10px] text-gray-400 hover:text-gray-700 transition-colors' : 'text-xs text-gray-400 hover:text-gray-700 transition-colors font-normal'}>
        {variant === 'mobile' ? 'Registro' : 'Registrarse'}
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm" onClick={close} />

          {/* Modal — centered */}
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="relative bg-white w-full max-w-md rounded-xl shadow-2xl max-h-[85vh] flex flex-col">
              {/* Mountain header image */}
              <div className="relative h-20 overflow-hidden shrink-0 rounded-t-xl">
                <img
                  src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80&fit=crop&crop=top"
                  alt=""
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white to-transparent" />
              </div>

              {/* Close button */}
              <button
                onClick={close}
                className="absolute top-3 right-3 text-white/80 hover:text-white transition-colors z-10"
              >
                <svg className="w-5 h-5 drop-shadow" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Form content — scrollable */}
              <div className="px-8 pb-8 -mt-4 relative overflow-y-auto">
                {view === 'login' ? (
                  <LoginForm onSuccess={close} onSwitch={() => setView('register')} onForgot={() => setView('forgot')} />
                ) : view === 'register' ? (
                  <RegisterForm onSuccess={close} onSwitch={() => setView('login')} />
                ) : (
                  <ForgotPasswordForm onBack={() => setView('login')} />
                )}
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  )
}

function LoginForm({ onSuccess, onSwitch, onForgot }: { onSuccess: () => void; onSwitch: () => void; onForgot: () => void }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) { setError('Ingresa tu email'); return }
    if (!password) { setError('Ingresa tu contraseña'); return }

    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    })

    if (error) {
      setError(translateLoginError(error.message))
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
        onSuccess()
        router.push('/auth/cambiar-contrasena')
        router.refresh()
        return
      }

      if (profile?.is_admin) {
        onSuccess()
        router.push('/admin')
        router.refresh()
        return
      }
    }

    onSuccess()
    router.refresh()
  }

  return (
    <>
      <h2 className="font-body text-2xl font-black mb-6">Iniciar sesión</h2>

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

        <div className="flex justify-end">
          <button type="button" onClick={onForgot} className="text-xs text-gray-400 hover:text-brand-500 transition-colors">
            ¿Olvidaste tu contraseña?
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-500 text-white py-2.5 rounded-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>

      <p className="mt-5 text-sm text-center text-gray-500">
        ¿No tienes cuenta?{' '}
        <button onClick={onSwitch} className="text-brand-500 hover:underline font-medium">
          Regístrate
        </button>
      </p>
    </>
  )
}

function RegisterForm({ onSuccess, onSwitch }: { onSuccess: () => void; onSwitch: () => void }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
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
    if (validationError) { setError(validationError); return }

    setLoading(true)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    })

    if (error) {
      setError(translateRegisterError(error.message))
      setLoading(false)
      return
    }

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

    onSuccess()
    router.refresh()
  }

  return (
    <>
      <h2 className="font-body text-2xl font-black mb-6">Crear cuenta</h2>

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

      <p className="mt-5 text-sm text-center text-gray-500">
        ¿Ya tienes cuenta?{' '}
        <button onClick={onSwitch} className="text-brand-500 hover:underline font-medium">
          Inicia sesión
        </button>
      </p>
    </>
  )
}

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) { setError('Ingresa tu email'); return }

    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <>
        <div className="text-center py-4">
          <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-body text-xl font-black mb-2">Revisa tu email</h2>
          <p className="text-sm text-gray-500">
            Enviamos un link a <span className="font-medium text-gray-700">{email}</span> para restablecer tu contraseña.
          </p>
        </div>
        <button onClick={onBack} className="w-full mt-4 text-sm text-brand-500 hover:underline font-medium">
          Volver al inicio de sesión
        </button>
      </>
    )
  }

  return (
    <>
      <h2 className="font-body text-2xl font-black mb-2">Recuperar contraseña</h2>
      <p className="text-sm text-gray-500 mb-6">
        Ingresa tu email y te enviaremos un link para restablecer tu contraseña.
      </p>

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
            autoFocus
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-500 text-white py-2.5 rounded-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Enviando...' : 'Enviar link'}
        </button>
      </form>

      <p className="mt-5 text-sm text-center text-gray-500">
        <button onClick={onBack} className="text-brand-500 hover:underline font-medium">
          Volver al inicio de sesión
        </button>
      </p>
    </>
  )
}

function translateLoginError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'Email o contraseña incorrectos'
  if (message.includes('Email not confirmed')) return 'Tu email no ha sido confirmado. Revisa tu bandeja de entrada.'
  if (message.includes('rate limit')) return 'Demasiados intentos. Espera unos minutos.'
  if (message.includes('User not found')) return 'No existe una cuenta con este email'
  return message
}

function translateRegisterError(message: string): string {
  if (message.includes('User already registered')) return 'Ya existe una cuenta con este email'
  if (message.includes('Password should be at least')) return 'La contraseña es muy corta'
  if (message.includes('Unable to validate email')) return 'El email ingresado no es válido'
  if (message.includes('Signup requires a valid password')) return 'Ingresa una contraseña válida'
  if (message.includes('rate limit')) return 'Demasiados intentos. Espera unos minutos.'
  return message
}
