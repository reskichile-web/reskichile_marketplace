'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Stats {
  total: number
  pending: number
  approved: number
  rejected: number
  sold: number
}

interface RecentProduct {
  id: string
  brand: string
  model: string | null
  price: number
  status: string
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  missing_photos: 'bg-orange-100 text-orange-700',
  sold: 'bg-brand-100 text-brand-700',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  missing_photos: 'Faltan fotos',
  sold: 'Vendido',
}

export default function AdminHomePage() {
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, approved: 0, rejected: 0, sold: 0 })
  const [recent, setRecent] = useState<RecentProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('products')
        .select('id, brand, model, price, status, created_at')
        .order('created_at', { ascending: false })

      if (data) {
        setStats({
          total: data.length,
          pending: data.filter(p => p.status === 'pending').length,
          approved: data.filter(p => p.status === 'approved').length,
          rejected: data.filter(p => p.status === 'rejected').length,
          sold: data.filter(p => p.status === 'sold').length,
        })
        setRecent(data.slice(0, 5))
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="max-w-7xl mx-auto mt-0 px-8 pt-4 text-gray-500">Cargando...</div>
  )

  const cards = [
    { label: 'Total publicaciones', value: stats.total, color: 'text-gray-900', bg: 'bg-gray-50' },
    { label: 'Pendientes', value: stats.pending, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Aprobados', value: stats.approved, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Vendidos', value: stats.sold, color: 'text-brand-600', bg: 'bg-brand-50' },
  ]

  return (
    <div className="max-w-7xl mx-auto mt-0 px-8 pt-4 pb-16">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="font-body text-2xl font-black text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Resumen general de ReskiChile</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {cards.map((card) => (
          <div key={card.label} className={`${card.bg} rounded-xl p-5`}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</p>
            <p className={`text-3xl font-black mt-2 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <Link href="/admin/publicaciones" className="flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-xl hover:border-brand-300 hover:shadow-sm transition-all group">
          <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center text-brand-500 group-hover:bg-brand-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">Gestionar publicaciones</p>
            <p className="text-xs text-gray-500">{stats.pending} pendientes de revisión</p>
          </div>
        </Link>

        <Link href="/vender" className="flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-xl hover:border-brand-300 hover:shadow-sm transition-all group">
          <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center text-green-500 group-hover:bg-green-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">Publicar producto</p>
            <p className="text-xs text-gray-500">Crear nueva publicación</p>
          </div>
        </Link>

        <Link href="/admin/finanzas" className="flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-xl hover:border-brand-300 hover:shadow-sm transition-all group">
          <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center text-purple-500 group-hover:bg-purple-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">Finanzas</p>
            <p className="text-xs text-gray-500">Ver métricas y reportes</p>
          </div>
        </Link>
      </div>

      {/* Recent products */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-body text-lg font-bold text-gray-900">Últimas publicaciones</h2>
          <Link href="/admin/publicaciones" className="text-sm text-brand-500 hover:underline">
            Ver todas
          </Link>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50/50 text-left text-gray-500">
                <th className="px-5 py-3 font-medium">Producto</th>
                <th className="px-5 py-3 font-medium hidden sm:table-cell">Precio</th>
                <th className="px-5 py-3 font-medium hidden md:table-cell">Fecha</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((product) => {
                const title = [product.brand, product.model].filter(Boolean).join(' ')
                return (
                  <tr key={product.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link href={`/producto/${product.id}`} className="font-medium text-gray-900 hover:text-brand-500">
                        {title}
                      </Link>
                    </td>
                    <td className="px-5 py-3 hidden sm:table-cell font-medium text-brand-500">
                      ${product.price.toLocaleString('es-CL')}
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell text-gray-500">
                      {new Date(product.created_at).toLocaleDateString('es-CL')}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[product.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[product.status] || product.status}
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
