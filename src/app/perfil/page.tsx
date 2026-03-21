'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

function useHideFooterImage() {
  useEffect(() => {
    const footer = document.querySelector('footer > div:first-child') as HTMLElement
    if (footer && window.innerWidth < 768) {
      footer.style.display = 'none'
      return () => { footer.style.display = '' }
    }
  }, [])
}

export default function ProfilePage() {
  useHideFooterImage()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [instagram, setInstagram] = useState('')
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [message, setMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setEmail(user.email ?? '')
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile) {
        setName(profile.name || '')
        setPhone(profile.phone || '')
        setInstagram(profile.instagram || '')
        setAvatarUrl(profile.avatar_url || null)
      }
      setLoading(false)
    }

    loadProfile()
  }, [])

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return

    setUploadingAvatar(true)

    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setMessage('Error al subir imagen: ' + uploadError.message)
      setUploadingAvatar(false)
      return
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)

    // Save to profile
    await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', userId)
    setAvatarUrl(publicUrl + '?t=' + Date.now())
    setUploadingAvatar(false)
  }

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

  const initial = name ? name.charAt(0).toUpperCase() : email.charAt(0).toUpperCase()

  return (
    <div className="max-w-md mx-auto px-4 min-h-screen pb-16">
      {/* Mobile header — flush with navbar, compensate layout spacer */}
      <div className="md:hidden -mx-4 -mt-[95px] mb-6">
        <div className="relative h-44 overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=800&q=80&fit=crop&crop=bottom"
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/0 to-transparent" />
        </div>
        <div className="relative -mt-12 flex flex-col items-center">
          {/* Avatar with upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="relative group"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="w-24 h-24 rounded-full object-cover shadow-lg border-4 border-white"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-3xl font-black shadow-lg border-4 border-white">
                {initial}
              </div>
            )}
            {/* Camera overlay */}
            <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            </div>
            {uploadingAvatar && (
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            className="hidden"
          />
          <p className="text-[10px] text-gray-400 mt-1">Toca para cambiar foto</p>
          <h1 className="font-body text-xl font-black mt-1">{name || 'Mi perfil'}</h1>
          <p className="text-sm text-gray-500">{email}</p>
        </div>
      </div>

      {/* Desktop header */}
      <div className="hidden md:flex items-center gap-6 mt-16 mb-8">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingAvatar}
          className="relative group shrink-0"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="w-20 h-20 rounded-full object-cover shadow-sm"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-2xl font-black shadow-sm">
              {initial}
            </div>
          )}
          <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <svg className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
          </div>
          {uploadingAvatar && (
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </button>
        <div>
          <h1 className="font-body text-3xl font-black">{name || 'Mi perfil'}</h1>
          <p className="text-sm text-gray-500">{email}</p>
        </div>
      </div>

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
          className="w-full bg-brand-500 text-white py-2.5 rounded-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  )
}
