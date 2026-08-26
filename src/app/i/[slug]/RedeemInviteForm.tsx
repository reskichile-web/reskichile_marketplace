'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PhoneInput from '@/components/PhoneInput'
import { parseAndValidatePhone } from '@/lib/phone'

const PASSWORD_MIN = 6

export default function RedeemInviteForm({ slug, requiresPhone }: { slug: string; requiresPhone: boolean }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fullPhone, setFullPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function validate(): string | null {
    if (!password) return 'Ingresa una contraseña'
    if (password.length < PASSWORD_MIN) return `Mínimo ${PASSWORD_MIN} caracteres`
    if (!/[A-Z]/.test(password)) return 'Debe tener al menos una mayúscula'
    if (!/[0-9]/.test(password)) return 'Debe tener al menos un número'
    if (password !== confirm) return 'Las contraseñas no coinciden'
    if (requiresPhone && !parseAndValidatePhone(fullPhone)) return 'Ingresa un número de teléfono válido'
    return null
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const v = validate()
    if (v) { setError(v); return }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/redeem-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, password, phone: requiresPhone ? fullPhone : undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo configurar la contraseña')

      // Sign in client-side so cookies land in the browser
      const supabase = createClient()
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: data.email,
        password,
      })
      if (signErr) throw signErr

      router.push('/')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 mt-6">
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded text-sm">{error}</div>
      )}

      {requiresPhone && (
        <div>
          <label className="block text-sm font-medium mb-1">Teléfono (WhatsApp) *</label>
          <PhoneInput required onChange={(phone) => setFullPhone(phone)} />
          <p className="text-xs text-gray-500 mt-1">
            Completa este dato pendiente para activar tu cuenta.
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Nueva contraseña</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full border rounded px-3 py-2"
          autoComplete="new-password"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand-500 text-white py-2.5 rounded-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Guardando...' : 'Guardar y entrar'}
      </button>
    </form>
  )
}
