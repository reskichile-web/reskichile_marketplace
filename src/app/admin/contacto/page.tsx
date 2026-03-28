'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PRODUCT_TYPES } from '@/lib/constants'
import AdminTableSkeleton from '@/components/skeletons/AdminTableSkeleton'

interface ContactRow {
  product_id: string
  seller_id: string | null
  brand: string
  model: string | null
  product_type: string
  price: number
  sale_price: number | null
  status: string
  contact_user_checked: boolean
  contact_product_checked: boolean
  seller_name: string | null
  seller_email: string | null
  seller_phone: string | null
  seller_keep: boolean | null
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  missing_photos: 'bg-orange-100 text-orange-700',
  sold: 'bg-blue-100 text-blue-700',
  archived: 'bg-gray-100 text-gray-500',
}

export default function ContactoPage() {
  const [rows, setRows] = useState<ContactRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'default' | 'user' | 'product' | 'both'>('default')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('products')
        .select('id, brand, model, product_type, price, sale_price, status, contact_user_checked, contact_product_checked, seller_id, users(name, email, phone, keep)')
        .order('created_at', { ascending: false })

      if (error) console.error('Fetch error:', error.message)

      const mapped: ContactRow[] = (data || []).map((p: Record<string, unknown>) => {
        const user = p.users as { name: string | null; email: string | null; phone: string | null; keep: boolean | null } | null
        return {
          product_id: p.id as string,
          seller_id: p.seller_id as string | null,
          brand: p.brand as string,
          model: p.model as string | null,
          product_type: p.product_type as string,
          price: p.price as number,
          sale_price: p.sale_price as number | null,
          status: p.status as string,
          contact_user_checked: (p.contact_user_checked as boolean) || false,
          contact_product_checked: (p.contact_product_checked as boolean) || false,
          seller_name: user?.name || null,
          seller_email: user?.email || null,
          seller_phone: user?.phone || null,
          seller_keep: user?.keep ?? null,
        }
      })

      setRows(mapped)
      setLoading(false)
    }
    load()
  }, [])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: rows.length }
    rows.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1 })
    return counts
  }, [rows])

  const filtered = useMemo(() => {
    let result = rows
    if (statusFilter !== 'all') {
      result = result.filter(r => r.status === statusFilter)
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(r => {
        const text = [r.seller_name, r.seller_email, r.brand, r.model].filter(Boolean).join(' ').toLowerCase()
        return text.includes(q)
      })
    }
    if (sortBy !== 'default') {
      result = [...result].sort((a, b) => {
        if (sortBy === 'user') return (b.contact_user_checked ? 1 : 0) - (a.contact_user_checked ? 1 : 0)
        if (sortBy === 'product') return (b.contact_product_checked ? 1 : 0) - (a.contact_product_checked ? 1 : 0)
        const aBoth = a.contact_user_checked && a.contact_product_checked ? 1 : 0
        const bBoth = b.contact_user_checked && b.contact_product_checked ? 1 : 0
        return bBoth - aBoth
      })
    }
    return result
  }, [rows, statusFilter, search, sortBy])

  async function updateField(productId: string, field: string, value: unknown) {
    const supabase = createClient()
    const { error } = await supabase.from('products').update({ [field]: value }).eq('id', productId)
    if (error) {
      console.error('Update error:', field, error.message)
      return
    }
    setRows(prev => prev.map(r => r.product_id === productId ? { ...r, [field]: value } : r))
  }

  const checkedCount = filtered.filter(r => r.contact_user_checked && r.contact_product_checked).length

  if (loading) return <AdminTableSkeleton />

  return (
    <div className="max-w-7xl mx-auto mt-0 px-8 pt-4 pb-16">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-body text-2xl font-black text-gray-900">Contacto</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} publicaciones · {checkedCount} completadas
          </p>
        </div>
        <button
          onClick={() => setSortBy(sortBy === 'both' ? 'default' : 'both')}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${sortBy === 'both' ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Completadas primero
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto">
        {([
          ['all', 'Todos'],
          ['pending', 'Pendiente'],
          ['approved', 'Aprobado'],
          ['missing_photos', 'Faltan fotos'],
          ['rejected', 'Rechazado'],
          ['sold', 'Vendido'],
          ['archived', 'Archivado'],
        ] as [string, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${statusFilter === key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {label} <span className="opacity-60">{statusCounts[key] || 0}</span>
          </button>
        ))}
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email, marca o modelo..."
          className="w-full border rounded px-3 py-2 text-sm"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50/50 text-left text-gray-500">
                <th className="px-4 py-3 font-medium w-10">
                  <button onClick={() => setSortBy(sortBy === 'user' ? 'default' : 'user')} className={`text-[10px] uppercase tracking-wider ${sortBy === 'user' ? 'text-brand-500' : ''}`}>
                    User {sortBy === 'user' ? '↓' : ''}
                  </button>
                </th>
                <th className="px-4 py-3 font-medium w-10">
                  <button onClick={() => setSortBy(sortBy === 'product' ? 'default' : 'product')} className={`text-[10px] uppercase tracking-wider ${sortBy === 'product' ? 'text-brand-500' : ''}`}>
                    Prod {sortBy === 'product' ? '↓' : ''}
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">Vendedor</th>
                <th className="px-4 py-3 font-medium w-10">
                  <span className="text-[10px] uppercase tracking-wider">Keep</span>
                </th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Contacto</th>
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Precio</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">P. Venta</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    No hay resultados
                  </td>
                </tr>
              ) : filtered.map(row => {
                const bothChecked = row.contact_user_checked && row.contact_product_checked
                const title = [row.brand, row.model].filter(Boolean).join(' ')

                return (
                  <tr
                    key={row.product_id}
                    className={`border-b last:border-0 transition-colors ${bothChecked ? 'bg-brand-500 text-white' : 'hover:bg-gray-50'}`}
                  >
                    {/* User check */}
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={row.contact_user_checked}
                        onChange={() => updateField(row.product_id, 'contact_user_checked', !row.contact_user_checked)}
                        className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 cursor-pointer"
                      />
                    </td>
                    {/* Product check */}
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={row.contact_product_checked}
                        onChange={() => updateField(row.product_id, 'contact_product_checked', !row.contact_product_checked)}
                        className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 cursor-pointer"
                      />
                    </td>
                    {/* Seller */}
                    <td className="px-4 py-3">
                      {row.seller_name ? (
                        <div>
                          <span className={`font-medium ${bothChecked ? 'text-white' : 'text-gray-900'}`}>{row.seller_name}</span>
                          <span className={`block md:hidden text-xs mt-0.5 ${bothChecked ? 'text-white/70' : 'text-gray-500'}`}>
                            {row.seller_email || '—'}
                          </span>
                        </div>
                      ) : (
                        <span className={`text-xs ${bothChecked ? 'text-white/50' : 'text-gray-300'}`}>Sin usuario</span>
                      )}
                    </td>
                    {/* Keep/Delete toggle */}
                    <td className="px-4 py-3 text-center">
                      {row.seller_id ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const next = row.seller_keep === true ? false : row.seller_keep === false ? null : true
                            const supabase = createClient()
                            supabase.from('users').update({ keep: next }).eq('id', row.seller_id!).then(() => {
                              setRows(prev => prev.map(r => r.seller_id === row.seller_id ? { ...r, seller_keep: next } : r))
                            })
                          }}
                          className={`text-xs px-2 py-1 rounded-full font-bold transition-colors ${
                            row.seller_keep === true
                              ? 'bg-green-100 text-green-700'
                              : row.seller_keep === false
                                ? 'bg-red-100 text-red-600'
                                : bothChecked ? 'bg-white/20 text-white/60' : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {row.seller_keep === true ? '✓' : row.seller_keep === false ? '✗' : '—'}
                        </button>
                      ) : (
                        <span className={`text-xs ${bothChecked ? 'text-white/30' : 'text-gray-200'}`}>—</span>
                      )}
                    </td>
                    {/* Contact */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="space-y-0.5">
                        {row.seller_email && (
                          <div className={`flex items-center gap-1.5 text-xs ${bothChecked ? 'text-white/80' : 'text-gray-600'}`}>
                            <svg className={`w-3.5 h-3.5 shrink-0 ${bothChecked ? 'text-white/60' : 'text-gray-400'}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.093-9.75-6.093" />
                            </svg>
                            {row.seller_email}
                          </div>
                        )}
                        {row.seller_phone && (
                          <div className={`flex items-center gap-1.5 text-xs ${bothChecked ? 'text-white/80' : 'text-gray-600'}`}>
                            <svg className={`w-3.5 h-3.5 shrink-0 ${bothChecked ? 'text-white/60' : 'text-gray-400'}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                            </svg>
                            {row.seller_phone}
                          </div>
                        )}
                        {!row.seller_email && !row.seller_phone && (
                          <span className={`text-xs ${bothChecked ? 'text-white/40' : 'text-gray-300'}`}>—</span>
                        )}
                      </div>
                    </td>
                    {/* Product */}
                    <td className="px-4 py-3">
                      <div>
                        <span className={`font-medium ${bothChecked ? 'text-white' : 'text-gray-900'}`}>{title}</span>
                        <span className={`block text-xs ${bothChecked ? 'text-white/60' : 'text-gray-400'}`}>
                          {PRODUCT_TYPES[row.product_type] || row.product_type}
                        </span>
                      </div>
                    </td>
                    {/* Price */}
                    <td className={`px-4 py-3 hidden sm:table-cell font-medium ${bothChecked ? 'text-white' : 'text-brand-500'}`}>
                      ${row.price.toLocaleString('es-CL')}
                    </td>
                    {/* Sale Price */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <SalePriceInput
                        value={row.sale_price}
                        bothChecked={bothChecked}
                        onSave={(val) => updateField(row.product_id, 'sale_price', val)}
                      />
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <select
                        value={row.status}
                        onChange={(e) => updateField(row.product_id, 'status', e.target.value)}
                        onClick={e => e.stopPropagation()}
                        className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${bothChecked ? 'bg-white/20 text-white' : (STATUS_COLORS[row.status] || 'bg-gray-100 text-gray-600')}`}
                      >
                        <option value="pending">Pendiente</option>
                        <option value="approved">Aprobado</option>
                        <option value="rejected">Rechazado</option>
                        <option value="missing_photos">Faltan fotos</option>
                        <option value="sold">Vendido</option>
                        <option value="archived">Archivado</option>
                      </select>
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

function SalePriceInput({ value, bothChecked, onSave }: { value: number | null; bothChecked: boolean; onSave: (val: number | null) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ? String(value) : '')

  function handleBlur() {
    setEditing(false)
    const num = parseInt(draft.replace(/\D/g, ''), 10)
    if (!isNaN(num) && num > 0) {
      onSave(num)
    } else if (draft === '') {
      onSave(null)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur()
    }
  }

  if (editing) {
    return (
      <div className={`flex items-center gap-1 font-medium ${bothChecked ? 'text-green-200' : 'text-green-600'}`}>
        <span className="text-xs">$</span>
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          className={`w-20 text-sm font-medium border-0 border-b bg-transparent outline-none ${bothChecked ? 'text-green-200 border-white/30' : 'text-green-600 border-green-200'}`}
          onClick={e => e.stopPropagation()}
        />
      </div>
    )
  }

  if (value) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setDraft(String(value)); setEditing(true) }}
        className={`font-medium text-sm ${bothChecked ? 'text-green-200' : 'text-green-600'} hover:underline`}
      >
        ${value.toLocaleString('es-CL')}
      </button>
    )
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); setDraft(''); setEditing(true) }}
      className={`text-xs ${bothChecked ? 'text-white/40' : 'text-gray-300'} hover:text-green-500`}
    >
      $+
    </button>
  )
}
