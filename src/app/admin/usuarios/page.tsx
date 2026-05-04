'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
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

type InviteState = 'idle' | 'loading' | 'sent' | 'error'

function buildWaLink(phone: string, name: string | null, link: string): string {
  const clean = phone.replace(/\D/g, '')
  const number = clean.startsWith('56') ? clean : `56${clean}`
  const firstName = name ? name.split(' ')[0] : ''
  const greeting = firstName ? `Hola ${firstName}, ` : 'Hola, '
  const text = `${greeting}te enviamos el link para activar tu cuenta en ReskiChile: ${link}`
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

function InviteButtons({ user }: { user: UserWithProducts }) {
  const [emailState, setEmailState] = useState<InviteState>('idle')
  const [waLink, setWaLink] = useState<string | null>(null)
  const [waLoading, setWaLoading] = useState(false)

  const getLink = useCallback(async (): Promise<string | null> => {
    const res = await fetch('/api/admin/invite-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, email: user.email, name: user.name }),
    })
    const data = await res.json()
    if (!res.ok || !data.link) return null
    return data.link
  }, [user.id, user.email, user.name])

  async function sendEmail() {
    setEmailState('loading')
    const link = await getLink()
    if (!link) { setEmailState('error'); setTimeout(() => setEmailState('idle'), 3000); return }
    setEmailState('sent')
    setTimeout(() => setEmailState('idle'), 4000)
  }

  async function openWhatsApp() {
    if (!user.phone) return
    if (waLink) { window.open(waLink, '_blank'); return }
    setWaLoading(true)
    const link = await getLink()
    setWaLoading(false)
    if (!link) return
    const url = buildWaLink(user.phone, user.name, link)
    setWaLink(url)
    window.open(url, '_blank')
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={sendEmail}
        disabled={emailState === 'loading' || emailState === 'sent'}
        className={`text-xs px-2.5 py-1 rounded font-medium border transition-all ${
          emailState === 'sent'
            ? 'bg-green-50 text-green-700 border-green-200'
            : emailState === 'error'
            ? 'bg-red-50 text-red-600 border-red-200'
            : emailState === 'loading'
            ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-wait'
            : 'bg-white text-gray-600 border-gray-200 hover:border-brand-400 hover:text-brand-600'
        }`}
      >
        {emailState === 'loading' ? '...' : emailState === 'sent' ? '✓ Enviado' : emailState === 'error' ? 'Error' : 'Correo'}
      </button>

      {user.phone && (
        <button
          onClick={openWhatsApp}
          disabled={waLoading}
          className={`text-xs px-2.5 py-1 rounded font-medium border transition-all ${
            waLoading
              ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-wait'
              : 'bg-white text-green-700 border-green-200 hover:bg-green-50'
          }`}
        >
          {waLoading ? '...' : 'WhatsApp'}
        </button>
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
