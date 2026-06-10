'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PRODUCT_TYPES } from '@/lib/constants'
import AdminDashboardSkeleton from '@/components/skeletons/AdminDashboardSkeleton'
import Spinner from '@/components/Spinner'

interface PendingProduct {
  id: string
  product_type: string
  brand: string
  model: string | null
  price: number
  created_at: string
  users: { name: string | null; email: string } | null
  product_images: { url: string; order: number }[]
}

interface RecentVisit {
  id: number
  path: string
  created_at: string
  country: string | null
  city: string | null
  users: { name: string | null } | null
}

interface Stats {
  total: number
  approved: number
  sold: number
  visitsToday: number
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `hace ${hrs} h`
  const days = Math.floor(hrs / 24)
  return `hace ${days} d`
}

export default function AdminHomePage() {
  const [stats, setStats] = useState<Stats>({ total: 0, approved: 0, sold: 0, visitsToday: 0 })
  const [pending, setPending] = useState<PendingProduct[]>([])
  const [visits, setVisits] = useState<RecentVisit[]>([])
  const [loading, setLoading] = useState(true)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const [totalRes, approvedRes, soldRes, pendingRes, visitsRes, visitsTodayRes] = await Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'sold'),
      supabase
        .from('products')
        .select('id, product_type, brand, model, price, created_at, users(name, email), product_images(url, order)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
      supabase
        .from('events')
        .select('id, path, created_at, country, city, users(name)')
        .eq('event_type', 'pageview')
        .order('created_at', { ascending: false })
        .limit(12),
      supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', 'pageview')
        .gte('created_at', startOfDay.toISOString()),
    ])

    setStats({
      total: totalRes.count ?? 0,
      approved: approvedRes.count ?? 0,
      sold: soldRes.count ?? 0,
      visitsToday: visitsTodayRes.count ?? 0,
    })
    setPending((pendingRes.data as unknown as PendingProduct[]) || [])
    setVisits((visitsRes.data as unknown as RecentVisit[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleApprove(productId: string) {
    // Same server route as /admin/publicaciones — sends the approval email.
    const prev = pending
    setPending(p => p.filter(x => x.id !== productId))
    setStats(s => ({ ...s, approved: s.approved + 1 }))
    try {
      const res = await fetch(`/api/admin/products/${productId}/approve`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al aprobar')
      }
    } catch (e) {
      setPending(prev)
      setStats(s => ({ ...s, approved: s.approved - 1 }))
      alert('Error al aprobar: ' + (e instanceof Error ? e.message : 'desconocido'))
    }
  }

  async function handleReject(productId: string) {
    if (!rejectionReason.trim()) {
      alert('Ingresa un motivo de rechazo')
      return
    }
    const prev = pending
    setPending(p => p.filter(x => x.id !== productId))
    setRejectingId(null)
    const reason = rejectionReason
    setRejectionReason('')

    const supabase = createClient()
    const { error } = await supabase
      .from('products')
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('id', productId)
    if (error) {
      setPending(prev)
      alert('Error al rechazar: ' + error.message)
    }
  }

  async function handleDelete(productId: string) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta publicación? Esta acción no se puede deshacer.')) return
    setDeletingId(productId)
    const supabase = createClient()

    const product = pending.find(p => p.id === productId)
    if (product?.product_images?.length) {
      const paths = product.product_images
        .map(img => img.url.split('/product-images/')[1])
        .filter(Boolean)
        .map(p => decodeURIComponent(p))
      if (paths.length) await supabase.storage.from('product-images').remove(paths)
    }

    await supabase.from('product_images').delete().eq('product_id', productId)
    const { error } = await supabase.from('products').delete().eq('id', productId)
    setDeletingId(null)
    if (error) {
      alert('Error al eliminar: ' + error.message)
      return
    }
    setPending(p => p.filter(x => x.id !== productId))
    setStats(s => ({ ...s, total: s.total - 1 }))
  }

  if (loading) return <AdminDashboardSkeleton />

  const cards = [
    { label: 'Total publicaciones', value: stats.total, color: 'text-gray-900', bg: 'bg-gray-50' },
    { label: 'Pendientes', value: pending.length, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Aprobados', value: stats.approved, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Vendidos', value: stats.sold, color: 'text-brand-600', bg: 'bg-brand-50' },
  ]

  return (
    <div className="max-w-7xl mx-auto mt-0 px-4 md:px-8 pt-4 pb-16">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Pending review queue */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-body text-lg font-bold text-gray-900">Pendientes de revisión</h2>
              <p className="text-xs text-gray-500 mt-0.5">{pending.length} publicaciones esperando aprobación</p>
            </div>
            <Link href="/admin/publicaciones" className="text-sm text-brand-500 hover:underline shrink-0">
              Ver todas
            </Link>
          </div>

          {pending.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">No hay publicaciones pendientes. Todo al día.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {pending.map(product => {
                const title = [product.brand, product.model].filter(Boolean).join(' ')
                const seller = product.users?.name || product.users?.email || 'Sin Usuario Creado'
                const image = (product.product_images || []).slice().sort((a, b) => a.order - b.order)[0]
                return (
                  <li key={product.id} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image.url} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">
                          {title}
                          <span className="ml-2 text-xs font-normal text-gray-400">{PRODUCT_TYPES[product.product_type] || product.product_type}</span>
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          <span className="font-medium text-brand-500">${product.price.toLocaleString('es-CL')}</span>
                          <span className="mx-1.5 text-gray-300">·</span>
                          {seller}
                          <span className="mx-1.5 text-gray-300">·</span>
                          {timeAgo(product.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-1.5 shrink-0 flex-wrap">
                      <button onClick={() => handleApprove(product.id)} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700">
                        Aprobar
                      </button>
                      <button onClick={() => setRejectingId(product.id)} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700">
                        Rechazar
                      </button>
                      <Link href={`/producto/${product.id}`} target="_blank" rel="noopener noreferrer" className="text-xs bg-brand-500 text-white px-3 py-1.5 rounded hover:bg-brand-600">
                        Ver
                      </Link>
                      <Link href={`/producto/${product.id}/editar`} className="text-xs border px-3 py-1.5 rounded hover:bg-gray-100">
                        Editar
                      </Link>
                      <button onClick={() => handleDelete(product.id)} disabled={deletingId === product.id} className="text-xs border border-red-200 text-red-500 px-3 py-1.5 rounded hover:bg-red-50 disabled:opacity-50 flex items-center gap-1">
                        {deletingId === product.id ? (
                          <>
                            <Spinner size="sm" color="brand" />
                            Eliminando
                          </>
                        ) : 'Eliminar'}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Recent visits */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-body text-lg font-bold text-gray-900">Últimas visitas</h2>
            <span className="text-xs text-gray-400">{stats.visitsToday} hoy</span>
          </div>

          {visits.length === 0 ? (
            <p className="px-5 py-10 text-sm text-gray-400 text-center">
              Aún no hay visitas registradas.
            </p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {visits.map(v => {
                const who = v.users?.name || 'Anónimo'
                const where = [v.city, v.country].filter(Boolean).join(', ')
                return (
                  <li key={v.id} className="px-5 py-2.5">
                    <Link href={v.path} className="block text-sm font-medium text-gray-800 hover:text-brand-500 truncate" title={v.path}>
                      {v.path}
                    </Link>
                    <p className="text-xs text-gray-400 truncate">
                      {who}
                      {where && <><span className="mx-1 text-gray-300">·</span>{where}</>}
                      <span className="mx-1 text-gray-300">·</span>
                      {timeAgo(v.created_at)}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Rejection modal */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="font-medium mb-3">Motivo de rechazo</h3>
            <input
              type="text"
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="Escribe el motivo..."
              className="w-full border rounded px-3 py-2 text-sm mb-3"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setRejectingId(null); setRejectionReason('') }} className="border px-4 py-2 rounded text-sm">
                Cancelar
              </button>
              <button onClick={() => handleReject(rejectingId)} className="bg-red-600 text-white px-4 py-2 rounded text-sm">
                Rechazar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
