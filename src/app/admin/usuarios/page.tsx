'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminTableSkeleton from '@/components/skeletons/AdminTableSkeleton'

interface UserWithProducts {
  id: string
  email: string
  name: string | null
  phone: string | null
  instagram: string | null
  is_admin: boolean
  must_change_password: boolean
  keep: boolean | null
  created_at: string
  product_count: number
}

function cleanPhone(phone: string): string {
  const p = phone.replace(/[^\d+]/g, '')
  if (p.startsWith('+')) return p.slice(1)
  if (p.startsWith('56')) return p
  if (p.startsWith('9')) return '56' + p
  return p
}

function InviteButtons({ user }: { user: UserWithProducts }) {
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBodyDraft, setEmailBodyDraft] = useState('')
  const [preparing, setPreparing] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendStatus, setSendStatus] = useState<'idle' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [successPopup, setSuccessPopup] = useState(false)
  const [waError, setWaError] = useState('')

  const firstName = user.name?.split(' ')[0] || ''
  const greeting = firstName ? `Hola ${firstName},` : 'Hola,'

  function buildWaMessage(link: string): string {
    return `${firstName ? `Hola ${firstName}, ` : 'Hola, '}te enviamos el link para activar tu cuenta en ReSkiChile y configurar tu contraseña: ${link}`
  }

  function buildEmailBody(link: string): string {
    return `${greeting}

Te damos la bienvenida a **ReSkiChile**. Tu cuenta ya está creada y solo falta que configures tu contraseña para entrar.

Haz click en el siguiente link para definirla (expira en 24 horas):

${link}

Cualquier duda, respondé este correo.

Saludos,
Equipo ReSkiChile`
  }

  async function fetchInviteLink(): Promise<string | null> {
    const res = await fetch('/api/admin/invite-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email }),
    })
    const data = await res.json()
    if (!res.ok || !data.link) {
      setErrorMsg(data.error || 'No se pudo generar el link')
      return null
    }
    return data.link as string
  }

  async function openWhatsApp() {
    if (!user.phone) return
    setWaError('')
    const popup = window.open('about:blank', '_blank')
    const link = await fetchInviteLink()
    if (!link) {
      popup?.close()
      setWaError('No se pudo generar el link')
      setTimeout(() => setWaError(''), 4000)
      return
    }
    const url = `https://wa.me/${cleanPhone(user.phone)}?text=${encodeURIComponent(buildWaMessage(link))}`
    if (popup) popup.location.href = url
    else window.open(url, '_blank')
  }

  async function openEmailModal() {
    setErrorMsg('')
    setSendStatus('idle')
    setPreparing(true)
    const link = await fetchInviteLink()
    setPreparing(false)
    if (!link) {
      setSendStatus('error')
      setEmailModalOpen(true)
      setEmailSubject(`Configura tu acceso a ReSkiChile`)
      setEmailBodyDraft('')
      return
    }
    setEmailSubject(`Configura tu acceso a ReSkiChile`)
    setEmailBodyDraft(buildEmailBody(link))
    setEmailModalOpen(true)
  }

  async function sendEmail() {
    setSending(true)
    setSendStatus('idle')
    try {
      const res = await fetch('/api/admin/contact-seller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: user.email, subject: emailSubject, body: emailBodyDraft }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al enviar')
      setEmailModalOpen(false)
      setSuccessPopup(true)
    } catch (e) {
      setSendStatus('error')
      setErrorMsg(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={openEmailModal}
          disabled={preparing}
          className={`text-xs px-2.5 py-1 rounded font-medium border transition-all ${
            preparing
              ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-wait'
              : 'bg-white text-gray-600 border-gray-200 hover:border-brand-400 hover:text-brand-600'
          }`}
        >
          {preparing ? '...' : 'Correo'}
        </button>

        {user.phone && (
          <button
            onClick={openWhatsApp}
            className="text-xs px-2.5 py-1 rounded font-medium border bg-white text-green-700 border-green-200 hover:bg-green-50 transition-all"
          >
            WhatsApp
          </button>
        )}

        {waError && <span className="text-xs text-red-600">{waError}</span>}
      </div>

      {/* Success popup */}
      {successPopup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={() => setSuccessPopup(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-center" onClick={e => e.stopPropagation()}>
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-body text-lg font-black text-gray-900 mb-1">Correo enviado</h3>
            <p className="text-sm text-gray-500 mb-5">El link de acceso fue enviado a {user.email}.</p>
            <button
              onClick={() => setSuccessPopup(false)}
              className="w-full bg-brand-500 text-white font-medium text-sm py-2.5 rounded-lg hover:bg-brand-600"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}

      {/* Email modal */}
      {emailModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !sending && setEmailModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-body text-lg font-black text-gray-900">Enviar invitación</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Desde <span className="font-medium text-gray-700">reskichile@gmail.com</span> · Para <span className="font-medium text-gray-700">{user.email}</span>
                </p>
              </div>
              <button onClick={() => !sending && setEmailModalOpen(false)} disabled={sending} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-3 overflow-y-auto flex-1">
              <div>
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide block mb-1">Asunto</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  disabled={sending}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-brand-500 focus:outline-none disabled:bg-gray-50"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Mensaje</label>
                  <span className="text-[10px] text-gray-400">Usa <code className="bg-gray-100 px-1 rounded">**palabra**</code> para negrita</span>
                </div>
                <textarea
                  value={emailBodyDraft}
                  onChange={e => setEmailBodyDraft(e.target.value)}
                  disabled={sending}
                  rows={14}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-light leading-relaxed focus:border-brand-500 focus:outline-none disabled:bg-gray-50 resize-none"
                />
              </div>

              {sendStatus === 'error' && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {errorMsg}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setEmailModalOpen(false)}
                disabled={sending}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={sendEmail}
                disabled={sending || !emailSubject.trim() || !emailBodyDraft.trim()}
                className="px-5 py-2 text-sm bg-brand-500 text-white font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-2"
              >
                {sending ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                    </svg>
                    Enviando...
                  </>
                ) : 'Enviar correo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function UsuariosPage() {
  const [users, setUsers] = useState<UserWithProducts[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'pending_access'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data: usersData } = await supabase
        .from('users')
        .select('id, email, name, phone, instagram, is_admin, must_change_password, keep, created_at')
        .order('created_at', { ascending: false })

      const { data: products } = await supabase
        .from('products')
        .select('seller_id')

      const productCounts: Record<string, number> = {}
      products?.forEach(p => {
        productCounts[p.seller_id] = (productCounts[p.seller_id] || 0) + 1
      })

      const merged = (usersData || []).map(u => ({
        ...u,
        product_count: productCounts[u.id] || 0,
      }))

      setUsers(merged)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    return users.filter(u => {
      if (filter === 'active' && (u.keep !== true || u.must_change_password)) return false
      if (filter === 'inactive' && u.keep !== false) return false
      if (filter === 'pending_access' && (!u.must_change_password || u.keep === false)) return false
      if (search) {
        const q = search.toLowerCase()
        const match = [u.email, u.name, u.phone].filter(Boolean).join(' ').toLowerCase()
        if (!match.includes(q)) return false
      }
      return true
    })
  }, [users, filter, search])

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.keep === true && !u.must_change_password).length,
    inactive: users.filter(u => u.keep === false).length,
    pendingAccess: users.filter(u => u.must_change_password && u.keep !== false).length,
  }), [users])

  if (loading) return <AdminTableSkeleton />

  const showInviteCol = filter === 'pending_access' || filtered.some(u => u.keep === true && u.must_change_password)

  return (
    <div className="max-w-7xl mx-auto mt-0 px-4 md:px-8 pt-4 pb-16">
      <div className="mb-6">
        <h1 className="font-body text-2xl font-black text-gray-900">Usuarios</h1>
        <p className="text-sm text-gray-500 mt-1">{stats.total} usuarios registrados</p>
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-6">
        <div className="flex gap-2 overflow-x-auto">
          {([
            { key: 'all', label: 'Todos', count: stats.total },
            { key: 'active', label: 'Activos', count: stats.active },
            { key: 'pending_access', label: 'Acceso pendiente', count: stats.pendingAccess },
            { key: 'inactive', label: 'Inactivos', count: stats.inactive },
          ] as const).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded text-sm whitespace-nowrap ${filter === f.key ? 'bg-brand-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              {f.label}
              <span className="ml-1 opacity-70">({f.count})</span>
            </button>
          ))}
        </div>

        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por email, nombre o teléfono..."
          className="w-full border rounded px-3 py-2 text-sm"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50/50 text-left text-gray-500">
              <th className="px-5 py-3 font-medium">Usuario</th>
              <th className="px-5 py-3 font-medium hidden sm:table-cell">Teléfono</th>
              <th className="px-5 py-3 font-medium hidden md:table-cell">Fecha</th>
              <th className="px-5 py-3 font-medium text-center">Publicaciones</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              {showInviteCol && <th className="px-5 py-3 font-medium">Invitación</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={showInviteCol ? 6 : 5} className="px-5 py-8 text-center text-gray-400">
                  No hay usuarios que coincidan
                </td>
              </tr>
            ) : filtered.map(user => (
              <tr key={user.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-5 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{user.name || 'Sin nombre'}</span>
                      {user.is_admin && (
                        <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded" style={{ color: '#F5B800', background: '#FFF8E1' }}>
                          admin
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">{user.email}</span>
                  </div>
                </td>
                <td className="px-5 py-3 hidden sm:table-cell text-gray-600">
                  {user.phone || '—'}
                </td>
                <td className="px-5 py-3 hidden md:table-cell text-gray-500">
                  {new Date(user.created_at).toLocaleDateString('es-CL')}
                </td>
                <td className="px-5 py-3 text-center">
                  {user.product_count > 0 ? (
                    <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded-full text-xs font-medium">
                      {user.product_count}
                    </span>
                  ) : (
                    <span className="text-gray-300">0</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  {user.keep === false ? (
                    <span className="text-xs px-2 py-1 rounded-full font-medium bg-red-100 text-red-700">
                      Inactivo
                    </span>
                  ) : user.must_change_password ? (
                    <span className="text-xs px-2 py-1 rounded-full font-medium bg-yellow-100 text-yellow-700">
                      Sin acceso
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full font-medium bg-green-100 text-green-700">
                      Activo
                    </span>
                  )}
                </td>
                {showInviteCol && (
                  <td className="px-5 py-3">
                    {user.keep === true && user.must_change_password ? (
                      <InviteButtons user={user} />
                    ) : (
                      <span className="text-gray-200">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
