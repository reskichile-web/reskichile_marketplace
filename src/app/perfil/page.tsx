'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ProfilePage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [instagram, setInstagram] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setEmail(user.email ?? '')

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile) {
        setName(profile.name || '')
        setPhone(profile.phone || '')
        setInstagram(profile.instagram || '')
      }
      setLoading(false)
    }

    loadProfile()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const trimmedName = name.trim()
    const trimmedPhone = phone.trim()
    const trimmedInstagram = instagram.trim().replace(/^@/, '')

    if (trimmedPhone && !/^569\d{8}$/.test(trimmedPhone)) {
      setMessage('Error: El teléfono debe tener formato 569XXXXXXXX (11 dígitos)')
      setSaving(false)
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('users')
      .update({
        name: trimmedName || null,
        phone: trimmedPhone || null,
        instagram: trimmedInstagram || null,
      })
      .eq('id', user.id)

    if (error) {
      setMessage('Error al guardar: ' + error.message)
    } else {
      setMessage('Perfil actualizado correctamente')
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="max-w-md mx-auto mt-16 px-4">Cargando...</div>
  }

  return (
    <div className="max-w-md mx-auto mt-16 px-4">
      <h1 className="font-body text-3xl font-black mb-6">Mi perfil</h1>

      {message && (
        <div className={`p-3 rounded mb-4 text-sm ${message.includes('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            disabled
            className="w-full border rounded px-3 py-2 bg-gray-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Nombre</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="Tu nombre"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Teléfono (con código de país)</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="56912345678"
          />
          <p className="text-xs text-gray-500 mt-1">
            Formato: 56 + 9 dígitos. Este número se usará para que compradores te contacten por WhatsApp.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Instagram</label>
          <input
            type="text"
            value={instagram}
            onChange={e => setInstagram(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="@tuusuario"
          />
          <p className="text-xs text-gray-500 mt-1">
            Tu usuario de Instagram para que compradores puedan contactarte.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-brand-500 text-white py-2 rounded hover:bg-brand-600 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  )
}
