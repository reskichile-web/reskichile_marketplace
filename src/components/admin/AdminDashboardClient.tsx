'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PRODUCT_TYPES } from '@/lib/constants'
import Spinner from '@/components/Spinner'
import RecentMessagesCard from '@/components/admin/RecentMessagesCard'
import ApprovalStoryModal from '@/components/admin/ApprovalStoryModal'
import { useStoryApproval } from '@/components/admin/useStoryApproval'
import type { AdminApprovalResponse } from '@/lib/instagram/contracts'
import type { AdminDashboardData } from '@/lib/admin-view-data'

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
  visitor_id: string | null
  users: { name: string | null } | null
}

interface Stats {
  total: number
  pending: number
  approved: number
  sold: number
  visitsToday: number
  uniquesToday: number
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

// "9 jun · 18:43" — compact Reski-style date+time
function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }).replace('.', '')
  const time = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  return `${date} · ${time}`
}

// White card with the standard admin border
const CARD = 'bg-white rounded-xl border border-gray-200'

export default function AdminDashboardClient({ initialData }: { initialData: AdminDashboardData }) {
  const [stats, setStats] = useState<Stats>(initialData.stats)
  const [pending, setPending] = useState<PendingProduct[]>(initialData.pending)
  const [visits] = useState<RecentVisit[]>(initialData.visits)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleApprovalFinished = useCallback((response: AdminApprovalResponse) => {
    setPending(current => current.filter(product => product.id !== response.product.id))
    if (response.transitioned) {
      setStats(current => ({
        ...current,
        pending: Math.max(0, current.pending - 1),
        approved: current.approved + 1,
      }))
    }
  }, [])

  const storyApproval = useStoryApproval({ onApproved: handleApprovalFinished })

  async function handleApprove(productId: string) {
    const product = pending.find(item => item.id === productId)
    if (!product) return
    await storyApproval.approve({
      id: product.id,
      title: [product.brand, product.model].filter(Boolean).join(' '),
      slug: product.id,
    })
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
    } else {
      setStats(current => ({ ...current, pending: Math.max(0, current.pending - 1) }))
    }
  }

  async function handleDelete(productId: string) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta publicación? Esta acción no se puede deshacer.')) return
    setDeletingId(productId)
    try {
      const response = await fetch(`/api/admin/products/${productId}`, { method: 'DELETE' })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Error al eliminar')
      }
      setPending(p => p.filter(x => x.id !== productId))
      setStats(s => ({
        ...s,
        total: Math.max(0, s.total - 1),
        pending: Math.max(0, s.pending - 1),
      }))
    } catch (error) {
      alert('Error al eliminar: ' + (error instanceof Error ? error.message : 'desconocido'))
    } finally {
      setDeletingId(null)
    }
  }

  const cards = [
    {
      label: 'Total publicaciones',
      value: stats.total,
      color: 'text-brand-500',
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
    },
    {
      label: 'Pendientes',
      value: stats.pending,
      color: 'text-yellow-600',
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />,
    },
    {
      label: 'Aprobados',
      value: stats.approved,
      color: 'text-green-600',
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
    },
    {
      label: 'Vendidos',
      value: stats.sold,
      color: 'text-brand-500',
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z M6 6h.008v.008H6V6z" />,
    },
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
          <div key={card.label} className={`${CARD} p-5 flex items-center gap-4`}>
            <svg className={`w-8 h-8 shrink-0 ${card.color}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              {card.icon}
            </svg>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{card.label}</p>
              <p className={`text-3xl font-black ${card.color}`}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
        {/* Pending review queue */}
        <div className={`${CARD} overflow-hidden`}>
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-body text-lg font-bold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-900 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 019 9v.375M10.125 2.25A3.375 3.375 0 0113.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 013.375 3.375M9 15l2.25 2.25L15 12" />
                </svg>
                Pendientes de revisión
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">{stats.pending} publicaciones esperando aprobación</p>
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
                        <img src={image.url} alt="" loading="lazy" decoding="async" className="w-11 h-11 rounded-lg object-cover shrink-0" />
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
                      <button
                        onClick={() => handleApprove(product.id)}
                        disabled={storyApproval.busy}
                        className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
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

        {/* Recent chat activity — below the pending queue */}
        <RecentMessagesCard
          initialMessages={initialData.recentMessages}
          initialWhatsappClicks={initialData.recentWhatsappClicks}
        />
        </div>

        {/* Recent unique visitors */}
        <div className={`${CARD} overflow-hidden`}>
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="font-body text-lg font-bold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-900 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Últimas visitas
              </h2>
              <Link href="/admin/metricas" className="text-xs text-brand-500 hover:underline shrink-0">
                Ver métricas
              </Link>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {stats.visitsToday} {stats.visitsToday === 1 ? 'vista' : 'vistas'} · {stats.uniquesToday} {stats.uniquesToday === 1 ? 'único' : 'únicos'} hoy
            </p>
          </div>

          {visits.length === 0 ? (
            <p className="px-5 py-10 text-sm text-gray-400 text-center">
              Aún no hay visitas registradas.
            </p>
          ) : (
            <ul className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {visits.map(v => {
                const who = v.users?.name || 'Anónimo'
                const where = [v.city, v.country].filter(Boolean).join(', ')
                return (
                  <li key={v.id} className="px-5 py-2.5 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${v.users?.name ? 'bg-brand-50 text-brand-500' : 'bg-gray-100 text-gray-400'}`}>
                      {who.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {who}
                        {where && <span className="ml-1.5 text-xs font-normal text-gray-400">{where}</span>}
                      </p>
                      <Link href={v.path} className="block text-xs text-gray-400 hover:text-brand-500 truncate" title={v.path}>
                        {v.path}
                      </Link>
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0 text-right leading-tight whitespace-nowrap">
                      {fmtDateTime(v.created_at)}
                    </span>
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
      <ApprovalStoryModal
        state={storyApproval.state}
        onClose={storyApproval.close}
        onRetry={storyApproval.retry}
      />
    </div>
  )
}
