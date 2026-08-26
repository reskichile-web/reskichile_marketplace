'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import Spinner from '@/components/Spinner'
import AdminTableSkeleton from '@/components/skeletons/AdminTableSkeleton'
import AdminInfiniteScroll from '@/components/admin/AdminInfiniteScroll'
import { PRODUCT_TYPES } from '@/lib/constants'
import { phoneToWhatsApp } from '@/lib/phone'
import { getAdminUserAccessStatus } from '@/lib/admin-user-status'

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
  avatar_url: string | null
  product_count: number
  email_confirmed_at: string | null
  email_deliverable: boolean | null
  last_activity: string | null
}

interface DetailProduct {
  id: string
  brand: string | null
  model: string | null
  status: string
  price: number
  sale_price: number | null
  slug: string | null
  created_at: string
  product_type: string
  product_images: { url: string; order: number }[]
}

interface DetailConversation {
  id: string
  created_at: string
  last_message_at: string | null
  buyer: { name: string | null } | null
  seller: { name: string | null } | null
  products: Pick<DetailProduct, 'id' | 'brand' | 'model' | 'slug' | 'product_type' | 'product_images'> | null
}

interface UserDetailResponse {
  auth: {
    last_sign_in_at: string | null
    email_confirmed_at: string | null
    created_at: string | null
  } | null
  products: DetailProduct[]
  conversations: DetailConversation[]
  invites: Array<{
    slug: string
    expires_at: string
    used_at: string | null
    created_at: string
    opened_at: string | null
  }>
}

// "9 jun 2026 · 18:43" — compact Reski-style date+time
function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '')
  const time = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  return `${date} · ${time}`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '')
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
    return `${greeting}

Como publicaste en ReSkiChile la temporada pasada y aún tienes productos activos, te creamos una cuenta para que puedas seguir gestionándolos.

Solo falta que definas tu contraseña para terminar el registro:

${link}

El link es seguro y único para ti — no lo compartas con nadie. Expira en 7 días.

Equipo ReSkiChile`
  }

  function buildEmailBody(link: string): string {
    return `${greeting}

Te damos la bienvenida a ReSkiChile.

Como publicaste con nosotros la temporada pasada y aún tienes productos activos, nos dimos el trabajo de crearte una cuenta para que puedas seguir gestionándolos sin volver a registrarte.

Para terminar el registro solo falta que definas tu contraseña:

${link}

El link es seguro y único para ti, no lo compartas con nadie. Expira en 7 días.

Cualquier duda, responde este correo.

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
    const wa = phoneToWhatsApp(user.phone)
    if (!wa) return
    setWaError('')
    const popup = window.open('about:blank', '_blank')
    const link = await fetchInviteLink()
    if (!link) {
      popup?.close()
      setWaError('No se pudo generar el link')
      setTimeout(() => setWaError(''), 4000)
      return
    }
    const url = `https://wa.me/${wa}?text=${encodeURIComponent(buildWaMessage(link))}`
    if (popup) popup.location.href = url
    else window.open(url, '_blank')
  }

  async function openEmailModal() {
    setErrorMsg('')
    setSendStatus('idle')
    setEmailSubject('Configura tu acceso a ReSkiChile')
    setEmailBodyDraft('')
    setEmailModalOpen(true)
    setPreparing(true)
    const link = await fetchInviteLink()
    setPreparing(false)
    if (!link) {
      setSendStatus('error')
      return
    }
    setEmailBodyDraft(buildEmailBody(link))
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
          className="text-xs px-2.5 py-1 rounded font-medium border bg-white text-gray-600 border-gray-200 hover:border-brand-400 hover:text-brand-600 transition-all"
        >
          Correo
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
            <p className="text-sm text-gray-500 mb-5">La invitación fue enviada correctamente a {user.email}.</p>
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
                <h3 className="font-body text-lg font-black text-gray-900">Enviar correo</h3>
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
                <div className="relative">
                  <textarea
                    value={emailBodyDraft}
                    onChange={e => setEmailBodyDraft(e.target.value)}
                    disabled={sending || preparing}
                    rows={14}
                    placeholder={preparing ? 'Generando link de acceso...' : ''}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-light leading-relaxed focus:border-brand-500 focus:outline-none disabled:bg-gray-50 resize-none"
                  />
                  {preparing && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <svg className="w-6 h-6 animate-spin text-brand-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                      </svg>
                    </div>
                  )}
                </div>
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
                disabled={sending || preparing || !emailSubject.trim() || !emailBodyDraft.trim()}
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
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [nextOffset, setNextOffset] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [stats, setStats] = useState({ total: 0, active: 0, pendingAccess: 0, inactive: 0 })
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'pending_access'>('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const loadingRef = useRef(false)
  const requestRef = useRef<AbortController | null>(null)
  const requestedHealthDomainsRef = useRef(new Set<string>())

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [search])

  const hydrateEmailHealth = useCallback(async (pageUsers: UserWithProducts[]) => {
    const domains = [...new Set(pageUsers
      .filter(user => !user.email_confirmed_at)
      .map(user => (user.email.split('@')[1] || '').toLowerCase())
      .filter(Boolean))]
      .filter(domain => !requestedHealthDomainsRef.current.has(domain))
    if (domains.length === 0) return
    domains.forEach(domain => requestedHealthDomainsRef.current.add(domain))
    try {
      const response = await fetch(`/api/admin/email-health?domains=${encodeURIComponent(domains.join(','))}`)
      const data = await response.json()
      if (!response.ok || !data.domains) return
      const health = data.domains as Record<string, boolean>
      setUsers(current => current.map(user => {
        if (user.email_confirmed_at) return user
        const domain = (user.email.split('@')[1] || '').toLowerCase()
        return domain in health ? { ...user, email_deliverable: health[domain] } : user
      }))
    } catch {
      // Email health is supplemental and must never block the user list.
    }
  }, [])

  const load = useCallback(async (offset = 0, append = false) => {
    if (append && loadingRef.current) return
    if (!append) requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    loadingRef.current = true
    setError('')
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const params = new URLSearchParams({ offset: String(offset) })
      if (filter !== 'all') params.set('status', filter)
      if (debouncedSearch) params.set('search', debouncedSearch)
      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No pudimos cargar los usuarios')
      const incoming = (data.users || []) as UserWithProducts[]
      setUsers(current => append
        ? [...current, ...incoming.filter(user => !current.some(existing => existing.id === user.id))]
        : incoming)
      if (data.stats) setStats(data.stats)
      setCurrentUserId(data.currentUserId || null)
      setHasMore(Boolean(data.hasMore))
      setNextOffset(Number(data.nextOffset || 0))
      setTotalCount(Number(data.totalCount || 0))
      void hydrateEmailHealth(incoming)
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return
      setError(loadError instanceof Error ? loadError.message : 'No pudimos cargar los usuarios')
    } finally {
      if (requestRef.current === controller) {
        setLoading(false)
        setLoadingMore(false)
        loadingRef.current = false
      }
    }
  }, [debouncedSearch, filter, hydrateEmailHealth])

  useEffect(() => {
    setExpandedId(null)
    void load(0)
  }, [load])

  useEffect(() => () => requestRef.current?.abort(), [])

  const loadMore = useCallback(() => {
    void load(nextOffset, true)
  }, [load, nextOffset])

  function handleUserDeleted(deletedId: string) {
    const deleted = users.find(user => user.id === deletedId)
    const deletedStatus = deleted ? getAdminUserAccessStatus(deleted) : null
    setUsers(prev => prev.filter(u => u.id !== deletedId))
    setExpandedId(prev => (prev === deletedId ? null : prev))
    setTotalCount(current => Math.max(0, current - 1))
    setStats(current => ({
      ...current,
      total: Math.max(0, current.total - 1),
      active: deletedStatus === 'active' ? Math.max(0, current.active - 1) : current.active,
      pendingAccess: deletedStatus === 'pending_access'
        ? Math.max(0, current.pendingAccess - 1)
        : current.pendingAccess,
      inactive: deletedStatus === 'inactive' ? Math.max(0, current.inactive - 1) : current.inactive,
    }))
  }

  const filtered = users

  if (loading) return <AdminTableSkeleton />

  const showInviteCol = filter === 'pending_access' || filtered.some(u => u.keep === true && u.must_change_password)

  return (
    <div className="max-w-7xl mx-auto mt-0 px-4 md:px-8 pt-4 pb-16">
      <div className="mb-6">
        <h1 className="font-body text-2xl font-black text-gray-900">Usuarios</h1>
        <p className="text-sm text-gray-500 mt-1">
          {stats.total} usuarios registrados{totalCount !== stats.total ? ` · ${totalCount} resultados` : ''}
        </p>
      </div>

      {error && <p className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

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
              <th className="px-5 py-3 font-medium hidden md:table-cell">Último ingreso</th>
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
            ) : filtered.map(user => {
              const isExpanded = expandedId === user.id
              return (
                <React.Fragment key={user.id}>
                  <tr
                    className={`border-b last:border-0 cursor-pointer ${isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
                    onClick={() => setExpandedId(isExpanded ? null : user.id)}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <svg
                          className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.5}
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        <Avatar url={user.avatar_url} name={user.name} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 truncate">{user.name || 'Sin nombre'}</span>
                            {user.is_admin && (
                              <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded shrink-0" style={{ color: '#F5B800', background: '#FFF8E1' }}>
                                admin
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 truncate flex items-center gap-1">
                            <span className="truncate">{user.email}</span>
                            <EmailHealthIcon user={user} />
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 hidden sm:table-cell text-gray-600">
                      {user.phone || '—'}
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell text-gray-500 whitespace-nowrap">
                      {user.last_activity ? fmtDateTime(user.last_activity) : <span className="text-gray-300">—</span>}
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
                      {getAdminUserAccessStatus(user) === 'inactive' ? (
                        <span className="text-xs px-2 py-1 rounded-full font-medium bg-red-100 text-red-700">
                          Inactivo
                        </span>
                      ) : getAdminUserAccessStatus(user) === 'pending_access' ? (
                        <span
                          className="text-xs px-2 py-1 rounded-full font-medium bg-yellow-100 text-yellow-700"
                          title="Sin contraseña definida"
                        >
                          Acceso pendiente
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-full font-medium bg-green-100 text-green-700">
                          Activo
                        </span>
                      )}
                    </td>
                    {showInviteCol && (
                      <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                        {user.keep === true && user.must_change_password ? (
                          <InviteButtons user={user} />
                        ) : (
                          <span className="text-gray-200">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                  {isExpanded && (
                    <tr className="bg-gray-50 border-b">
                      <td colSpan={showInviteCol ? 6 : 5} className="px-5 py-5">
                        <UserDetailPanel
                          user={user}
                          isSelf={user.id === currentUserId}
                          onDeleted={() => handleUserDeleted(user.id)}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      <AdminInfiniteScroll
        hasMore={hasMore}
        loading={loadingMore}
        error={error}
        onLoadMore={loadMore}
        label="Cargando más usuarios"
      />
    </div>
  )
}

function initialsOf(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map(p => p[0]?.toUpperCase() ?? '').join('') || '?'
}

function Avatar({ url, name, size = 36 }: { url: string | null; name: string | null; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="rounded-full bg-gray-200 text-gray-500 flex items-center justify-center shrink-0 text-xs font-bold"
      style={{ width: size, height: size }}
    >
      {initialsOf(name)}
    </div>
  )
}

// Visual indicator next to the email address. Three states:
//   - confirmed (user clicked the OTP/confirm link)  → solid green check
//   - deliverable (domain has MX records) but unconfirmed → outline gray check
//   - undeliverable (no MX records — typo or fake)  → red warning
function EmailHealthIcon({ user }: { user: UserWithProducts }) {
  if (user.email_confirmed_at) {
    return (
      <svg className="w-3.5 h-3.5 text-green-600 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <title>Correo confirmado por el usuario</title>
        <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1 14.4l-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7z" />
      </svg>
    )
  }
  if (user.email_deliverable === false) {
    return (
      <svg className="w-3.5 h-3.5 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <title>Dominio sin servidor de correo — probablemente inválido</title>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    )
  }
  if (user.email_deliverable === true) {
    return (
      <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
        <title>Dominio válido, pero el usuario aún no confirmó</title>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    )
  }
  return null
}

// Session-scoped cache: re-expanding a row shows the detail instantly
// instead of refetching the whole payload every time.
const detailCache = new Map<string, UserDetailResponse>()

function UserDetailPanel({ user, isSelf, onDeleted }: { user: UserWithProducts; isSelf: boolean; onDeleted: () => void }) {
  const [detail, setDetail] = useState<UserDetailResponse | null>(detailCache.get(user.id) ?? null)
  const [loading, setLoading] = useState(!detailCache.has(user.id))
  const [error, setError] = useState('')

  useEffect(() => {
    if (detailCache.has(user.id)) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/admin/user-detail/${user.id}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error')
        detailCache.set(user.id, data)
        if (!cancelled) setDetail(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error desconocido')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user.id])

  const confirmed = Boolean(detail?.auth?.email_confirmed_at || user.email_confirmed_at)

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      {/* Header: avatar + name + email + tiny id */}
      <div className="flex items-center gap-4 mb-5">
        <Avatar url={user.avatar_url} name={user.name} size={64} />
        <div className="min-w-0">
          <h3 className="font-body font-black text-lg text-gray-900 truncate">{user.name || 'Sin nombre'}</h3>
          <p className="text-sm text-gray-500 truncate">{user.email}</p>
          <p className="text-[9px] font-mono text-gray-300 truncate select-all">{user.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3 mb-5">
        <DetailRow label="Teléfono" value={user.phone || '—'} />
        <DetailRow label="Instagram" value={user.instagram ? `@${user.instagram}` : '—'} />
        <DetailRow label="Rol" value={user.is_admin ? 'Admin' : 'Usuario'} />
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Estado</p>
          {getAdminUserAccessStatus(user) === 'inactive' ? (
            <span className="inline-block mt-0.5 text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">Inactivo</span>
          ) : getAdminUserAccessStatus(user) === 'pending_access' ? (
            <span className="inline-block mt-0.5 text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-700">Acceso pendiente</span>
          ) : (
            <span className="inline-block mt-0.5 text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">Activo</span>
          )}
        </div>
        <DetailRow label="Registro" value={fmtDateTime(user.created_at)} />
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Confirmación</p>
          <p className="text-sm text-gray-900 flex items-center gap-1.5 mt-0.5">
            {confirmed ? (
              <>
                <span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                Confirmado
              </>
            ) : (
              <>
                <span className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center shrink-0">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </span>
                Sin confirmar
              </>
            )}
          </p>
        </div>
        {detail?.auth?.last_sign_in_at && (
          <DetailRow label="Último ingreso" value={fmtDateTime(detail.auth.last_sign_in_at)} />
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 border-t border-gray-100">
          <Spinner size="md" color="brand" />
          <span className="text-xs text-gray-400">Cargando detalle…</span>
        </div>
      ) : error ? (
        <p className="text-xs text-red-500 py-4 border-t border-gray-100">{error}</p>
      ) : detail ? (
        <>
          {/* Products as cards */}
          <div className="border-t border-gray-100 pt-4 mb-4">
            <h4 className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-2.5">
              Productos ({detail.products.length})
            </h4>
            {detail.products.length === 0 ? (
              <p className="text-xs text-gray-400">Sin productos.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {detail.products.map(p => {
                  const img = (p.product_images || []).slice().sort((a, b) => a.order - b.order)[0]
                  const title = [p.brand, p.model].filter(Boolean).join(' ') || 'Sin título'
                  return (
                    <div key={p.id} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-lg p-2.5">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img.url} alt="" loading="lazy" decoding="async" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 19.5h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
                          </svg>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-900 truncate">{title}</p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {PRODUCT_TYPES[p.product_type] || p.product_type} · ${p.price.toLocaleString('es-CL')}
                          {p.sale_price != null && p.sale_price !== p.price && (
                            <span className="text-green-600"> · vendido en ${p.sale_price.toLocaleString('es-CL')}</span>
                          )}
                        </p>
                        <p className="flex items-center gap-1.5 mt-1">
                          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold" style={statusBadgeStyle(p.status)}>
                            {p.status}
                          </span>
                          <span className="text-[10px] text-gray-400">{fmtDate(p.created_at)}</span>
                        </p>
                      </div>
                      <Link
                        href={`/producto/${p.slug || p.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Ver publicación"
                        className="shrink-0 w-7 h-7 rounded-lg bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </Link>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Conversations as cards */}
          <div className="border-t border-gray-100 pt-4 mb-4">
            <h4 className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-2.5">
              Conversaciones ({detail.conversations.length})
            </h4>
            {detail.conversations.length === 0 ? (
              <p className="text-xs text-gray-400">Sin conversaciones.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {detail.conversations.map(c => {
                  const img = (c.products?.product_images || []).slice().sort((a, b) => a.order - b.order)[0]
                  const title = [c.products?.brand, c.products?.model].filter(Boolean).join(' ') || 'Producto eliminado'
                  const who = `${c.buyer?.name || 'Anónimo'} ↔ ${c.seller?.name || 'Anónimo'}`
                  return (
                    <div key={c.id} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-lg p-2.5">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img.url} alt="" loading="lazy" decoding="async" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                          </svg>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-900 truncate">{title}</p>
                        <p className="text-[11px] text-gray-400 truncate">{who}</p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {fmtDateTime(c.last_message_at || c.created_at)}
                        </p>
                      </div>
                      {c.products && (
                        <Link
                          href={`/producto/${c.products.slug || c.products.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Ver publicación"
                          className="shrink-0 w-7 h-7 rounded-lg bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                          </svg>
                        </Link>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Invites — always visible */}
          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-2.5">
              Invitaciones ({detail.invites.length})
            </h4>
            {detail.invites.length === 0 ? (
              <p className="text-xs text-gray-400">No se han enviado invitaciones aún.</p>
            ) : (
              <div className="space-y-1.5">
                {detail.invites.map(inv => {
                  const expired = !inv.used_at && new Date(inv.expires_at).getTime() < Date.now()
                  return (
                    <div key={inv.slug} className="flex items-center gap-2.5 text-xs">
                      <code className="bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-700">{inv.slug}</code>
                      {inv.used_at ? (
                        <span className="flex items-center gap-1.5 text-green-600 font-bold">
                          <span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                          Usado el {fmtDate(inv.used_at)}
                        </span>
                      ) : expired ? (
                        <span className="flex items-center gap-1.5 text-red-500 font-bold">
                          <span className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </span>
                          Expirado
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-amber-600 font-bold">
                          <span className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center shrink-0">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5" />
                              <circle cx="12" cy="12" r="9" />
                            </svg>
                          </span>
                          Pendiente
                        </span>
                      )}
                      <span className="text-gray-400">enviado {fmtDate(inv.created_at)}</span>
                      {!inv.used_at && inv.opened_at && (
                        <span className="text-gray-400">· abierto {fmtDate(inv.opened_at)}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      ) : null}

      <DangerZone user={user} isSelf={isSelf} productCount={detail?.products.length ?? user.product_count} onDeleted={onDeleted} />
    </div>
  )
}

function DangerZone({ user, isSelf, productCount, onDeleted }: { user: UserWithProducts; isSelf: boolean; productCount: number; onDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  if (isSelf || user.is_admin) return null

  async function handleDelete() {
    setDeleting(true)
    setErrorMsg('')
    try {
      const res = await fetch(`/api/admin/delete-user/${user.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar')
      setOpen(false)
      onDeleted()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="border-t border-gray-100 pt-4 mt-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs text-gray-500">
          Eliminar este usuario borra su cuenta, sus publicaciones ({productCount}) y todas sus conversaciones. No se puede deshacer.
        </p>
        <button
          onClick={() => { setConfirmText(''); setErrorMsg(''); setOpen(true) }}
          className="shrink-0 text-xs px-3 py-1.5 rounded font-medium bg-red-600 text-white hover:bg-red-700 transition-all"
        >
          Eliminar usuario
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !deleting && setOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-body text-lg font-black text-gray-900">Eliminar usuario</h3>
              <p className="text-xs text-gray-500 mt-0.5">Esta acción es permanente.</p>
            </div>

            <div className="px-6 py-4 space-y-3">
              <p className="text-sm text-gray-700">
                Se borrará la cuenta de <span className="font-semibold">{user.name || user.email}</span>, sus {productCount} publicaciones y todas sus conversaciones.
              </p>
              <div>
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide block mb-1">
                  Escribe <code className="bg-gray-100 px-1 rounded normal-case">{user.email}</code> para confirmar
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  disabled={deleting}
                  autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none disabled:bg-gray-50"
                />
              </div>
              {errorMsg && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {errorMsg}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || confirmText.trim().toLowerCase() !== user.email.toLowerCase()}
                className="px-5 py-2 text-sm bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                    </svg>
                    Eliminando...
                  </>
                ) : 'Eliminar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">{label}</p>
      <p className={`text-sm text-gray-900 truncate ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  )
}

function statusBadgeStyle(status: string): React.CSSProperties {
  switch (status) {
    case 'approved':  return { background: '#DCFCE7', color: '#166534' }
    case 'pending':   return { background: '#FEF3C7', color: '#92400E' }
    case 'rejected':  return { background: '#FEE2E2', color: '#991B1B' }
    case 'sold':      return { background: '#DBEAFE', color: '#1E40AF' }
    case 'archived':  return { background: '#E5E7EB', color: '#4B5563' }
    case 'missing_photos': return { background: '#FFEDD5', color: '#9A3412' }
    default:          return { background: '#F3F4F6', color: '#6B7280' }
  }
}
