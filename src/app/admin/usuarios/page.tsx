'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageLoader from '@/components/PageLoader'

interface UserWithProducts {
  id: string
  email: string
  name: string | null
  phone: string | null
  instagram: string | null
  is_admin: boolean
  must_change_password: boolean
  created_at: string
  product_count: number
}

export default function UsuariosPage() {
  const [users, setUsers] = useState<UserWithProducts[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'with_products' | 'no_products' | 'pending_access'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      // Get all users
      const { data: usersData } = await supabase
        .from('users')
        .select('id, email, name, phone, instagram, is_admin, must_change_password, created_at')
        .order('created_at', { ascending: false })

      // Get product counts per seller
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
      if (filter === 'with_products' && u.product_count === 0) return false
      if (filter === 'no_products' && u.product_count > 0) return false
      if (filter === 'pending_access' && !u.must_change_password) return false
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
    withProducts: users.filter(u => u.product_count > 0).length,
    noProducts: users.filter(u => u.product_count === 0).length,
    pendingAccess: users.filter(u => u.must_change_password).length,
  }), [users])

  if (loading) return (
    <PageLoader loading={true} className="max-w-7xl mx-auto mt-0 px-8 pt-4"><div /></PageLoader>
  )

  return (
    <div className="max-w-7xl mx-auto mt-0 px-8 pt-4 pb-16">
      <div className="mb-6">
        <h1 className="font-body text-2xl font-black text-gray-900">Usuarios</h1>
        <p className="text-sm text-gray-500 mt-1">{stats.total} usuarios registrados</p>
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-6">
        <div className="flex gap-2 overflow-x-auto">
          {([
            { key: 'all', label: 'Todos', count: stats.total },
            { key: 'with_products', label: 'Con publicaciones', count: stats.withProducts },
            { key: 'no_products', label: 'Sin publicaciones', count: stats.noProducts },
            { key: 'pending_access', label: 'Acceso pendiente', count: stats.pendingAccess },
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
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
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
                  {user.must_change_password ? (
                    <span className="text-xs px-2 py-1 rounded-full font-medium bg-yellow-100 text-yellow-700">
                      Sin acceso
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full font-medium bg-green-100 text-green-700">
                      Activo
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
