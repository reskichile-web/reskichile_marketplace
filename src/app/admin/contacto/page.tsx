'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PRODUCT_TYPES } from '@/lib/constants'

interface ContactRow {
  product_id: string
  brand: string
  model: string | null
  product_type: string
  price: number
  status: string
  seller_name: string | null
  seller_email: string | null
  seller_phone: string | null
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  sold: 'bg-blue-100 text-blue-700',
  archived: 'bg-gray-100 text-gray-500',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  sold: 'Vendido',
  archived: 'Archivado',
}

export default function ContactoPage() {
  const [rows, setRows] = useState<ContactRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [checkedUsers, setCheckedUsers] = useState<Set<string>>(new Set())
  const [checkedProducts, setCheckedProducts] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('products')
        .select('id, brand, model, product_type, price, status, seller_id, users(name, email, phone)')
        .order('created_at', { ascending: false })

      const mapped: ContactRow[] = (data || []).map((p: Record<string, unknown>) => {
        const user = p.users as { name: string | null; email: string | null; phone: string | null } | null
        return {
          product_id: p.id as string,
          brand: p.brand as string,
          model: p.model as string | null,
          product_type: p.product_type as string,
          price: p.price as number,
          status: p.status as string,
          seller_name: user?.name || null,
          seller_email: user?.email || null,
          seller_phone: user?.phone || null,
        }
      })

      setRows(mapped)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter(r => {
      const text = [r.seller_name, r.seller_email, r.brand, r.model].filter(Boolean).join(' ').toLowerCase()
      return text.includes(q)
    })
  }, [rows, search])

  function toggleUser(id: string) {
    setCheckedUsers(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleProduct(id: string) {
    setCheckedProducts(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const checkedCount = filtered.filter(r => checkedUsers.has(r.product_id) && checkedProducts.has(r.product_id)).length

  if (loading) return (
    <div className="max-w-7xl mx-auto mt-0 px-8 pt-4 text-gray-500">Cargando...</div>
  )

  return (
    <div className="max-w-7xl mx-auto mt-0 px-8 pt-4 pb-16">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-body text-2xl font-black text-gray-900">Contacto</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} publicaciones · {checkedCount} completadas
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email, marca o modelo..."
          className="w-full border rounded px-3 py-2 text-sm"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50/50 text-left text-gray-500">
                <th className="px-4 py-3 font-medium w-10">
                  <span className="text-[10px] uppercase tracking-wider">User</span>
                </th>
                <th className="px-4 py-3 font-medium w-10">
                  <span className="text-[10px] uppercase tracking-wider">Prod</span>
                </th>
                <th className="px-4 py-3 font-medium">Vendedor</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Contacto</th>
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Precio</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No hay resultados
                  </td>
                </tr>
              ) : filtered.map(row => {
                const bothChecked = checkedUsers.has(row.product_id) && checkedProducts.has(row.product_id)
                const title = [row.brand, row.model].filter(Boolean).join(' ')

                return (
                  <tr
                    key={row.product_id}
                    className={`border-b last:border-0 transition-colors ${bothChecked ? 'bg-brand-50/60' : 'hover:bg-gray-50'}`}
                  >
                    {/* User check */}
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={checkedUsers.has(row.product_id)}
                        onChange={() => toggleUser(row.product_id)}
                        className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 cursor-pointer"
                      />
                    </td>
                    {/* Product check */}
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={checkedProducts.has(row.product_id)}
                        onChange={() => toggleProduct(row.product_id)}
                        className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 cursor-pointer"
                      />
                    </td>
                    {/* Seller */}
                    <td className="px-4 py-3">
                      {row.seller_name ? (
                        <div>
                          <span className="font-medium text-gray-900">{row.seller_name}</span>
                          <span className="block md:hidden text-xs text-gray-500 mt-0.5">
                            {row.seller_email || '—'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">Sin usuario</span>
                      )}
                    </td>
                    {/* Contact */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="space-y-0.5">
                        {row.seller_email && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.093-9.75-6.093" />
                            </svg>
                            {row.seller_email}
                          </div>
                        )}
                        {row.seller_phone && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                            </svg>
                            {row.seller_phone}
                          </div>
                        )}
                        {!row.seller_email && !row.seller_phone && (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </div>
                    </td>
                    {/* Product */}
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium text-gray-900">{title}</span>
                        <span className="block text-xs text-gray-400">
                          {PRODUCT_TYPES[row.product_type] || row.product_type}
                        </span>
                      </div>
                    </td>
                    {/* Price */}
                    <td className="px-4 py-3 hidden sm:table-cell font-medium text-brand-500">
                      ${row.price.toLocaleString('es-CL')}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[row.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[row.status] || row.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
