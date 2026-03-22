'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import PopupMessage from '@/components/PopupMessage'

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
  const [popup, setPopup] = useState<{ message: string; type: 'error' | 'warning' | 'info' } | null>(null)
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
    // Always use same filename to avoid orphaned files
    const path = `${userId}/avatar`

    // Delete old file first
    await supabase.storage.from('avatars').remove([path])

    // Upload new
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      setPopup({ message: 'Error al subir imagen. Intenta de nuevo.', type: 'error' })
      setUploadingAvatar(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const urlWithCache = publicUrl + '?t=' + Date.now()

    await supabase.from('users').update({ avatar_url: urlWithCache }).eq('id', userId)
    setAvatarUrl(urlWithCache)
    setUploadingAvatar(false)

    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleAvatarDelete() {
    if (!userId) return
    setUploadingAvatar(true)

    const supabase = createClient()
    await supabase.storage.from('avatars').remove([`${userId}/avatar`])
    await supabase.from('users').update({ avatar_url: null }).eq('id', userId)
    setAvatarUrl(null)
    setUploadingAvatar(false)

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

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
      setPopup({ message: 'Error al guardar. Intenta de nuevo.', type: 'error' })
    } else {
      setPopup({ message: 'Perfil actualizado', type: 'info' })
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="max-w-md mx-auto mt-16 px-4">Cargando...</div>
  }

  const initial = name ? name.charAt(0).toUpperCase() : email.charAt(0).toUpperCase()

  return (
    <div className="max-w-md mx-auto px-4 min-h-screen pb-16">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarUpload}
        className="hidden"
      />

      {/* Mobile header — flush with navbar */}
      <div className="md:hidden -mx-4 -mt-[95px] mb-6">
        <div className="relative h-48 overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1418985991508-e47386d96a71?w=800&q=80&fit=crop&crop=center"
            alt=""
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-white/20" />
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white via-white/80 to-transparent" />
        </div>
        <div className="relative -mt-12 flex flex-col items-center">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="relative group"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-24 h-24 rounded-full object-cover shadow-lg border-4 border-white" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-3xl font-black shadow-lg border-4 border-white">
                {initial}
              </div>
            )}
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
          <div className="flex items-center gap-2 mt-1">
            <button onClick={() => fileInputRef.current?.click()} className="text-[10px] text-gray-400 hover:text-brand-500">Cambiar foto</button>
            {avatarUrl && (
              <>
                <span className="text-gray-300 text-[10px]">·</span>
                <button onClick={handleAvatarDelete} className="text-[10px] text-gray-400 hover:text-red-500">Eliminar</button>
              </>
            )}
          </div>
          <h1 className="font-body text-xl font-black mt-1">{name || 'Mi perfil'}</h1>
          <p className="text-sm text-gray-500">{email}</p>
        </div>
      </div>

      {/* Desktop/Tablet header with 16:9 background */}
      <div className="hidden md:block -mx-4 -mt-[130px] mb-8">
        <div className="relative aspect-[16/5] max-h-[230px] overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1551524559-8af4e6624178?w=1400&q=80&fit=crop&crop=center"
            alt=""
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-white/20" />
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white via-white/80 to-transparent" />
        </div>
        <div className="relative -mt-10 flex items-end gap-6 max-w-md mx-auto">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="relative group shrink-0"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover shadow-sm border-4 border-white" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-2xl font-black shadow-sm border-4 border-white">
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
          <div className="pb-1">
            <h1 className="font-body text-2xl font-black">{name || 'Mi perfil'}</h1>
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-500">{email}</p>
              {avatarUrl && (
                <button onClick={handleAvatarDelete} className="text-[10px] text-gray-400 hover:text-red-500">Eliminar foto</button>
              )}
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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

      {/* Change password section */}
      <ChangePasswordSection onPopup={setPopup} />

      {popup && (
        <PopupMessage
          message={popup.message}
          type={popup.type}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  )
}

const PASSWORD_MIN = 6

function ChangePasswordSection({ onPopup }: { onPopup: (p: { message: string; type: 'error' | 'warning' | 'info' }) => void }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!password) { onPopup({ message: 'Ingresa una contraseña', type: 'error' }); return }
    if (password.length < PASSWORD_MIN) { onPopup({ message: `Mínimo ${PASSWORD_MIN} caracteres`, type: 'error' }); return }
    if (!/[A-Z]/.test(password)) { onPopup({ message: 'Debe tener al menos una mayúscula', type: 'error' }); return }
    if (!/[0-9]/.test(password)) { onPopup({ message: 'Debe tener al menos un número', type: 'error' }); return }
    if (password !== confirmPassword) { onPopup({ message: 'Las contraseñas no coinciden', type: 'error' }); return }

    setSaving(true)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      onPopup({ message: 'Error al cambiar contraseña', type: 'error' })
      setSaving(false)
      return
    }

    onPopup({ message: 'Contraseña actualizada', type: 'info' })
    setPassword('')
    setConfirmPassword('')
    setOpen(false)
    setSaving(false)
  }

  return (
    <div className="mt-8 pt-6 border-t border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">Contraseña</p>
          <p className="text-xs text-gray-400 mt-0.5">Cambia tu contraseña de acceso</p>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="text-sm text-brand-500 hover:text-brand-600 font-medium transition-colors"
        >
          {open ? 'Cancelar' : 'Cambiar'}
        </button>
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Nueva contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
              autoComplete="new-password"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">Mínimo {PASSWORD_MIN} caracteres, una mayúscula y un número</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Confirmar contraseña</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gray-900 text-white py-2.5 rounded-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando...' : 'Actualizar contraseña'}
          </button>
        </form>
      )}
    </div>
  )
}
