'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PRODUCT_TYPES, PRODUCT_STATUSES, CONDITIONS, PRODUCT_ATTRIBUTES, formatAttributeValue } from '@/lib/constants'
import Spinner from '@/components/Spinner'
import { phoneToWhatsApp } from '@/lib/phone'
import { daysUntilSaleReminder } from '@/lib/sale-reminder'
import ApprovalStoryModal from '@/components/admin/ApprovalStoryModal'
import { useStoryApproval } from '@/components/admin/useStoryApproval'
import type { AdminApprovalResponse } from '@/lib/instagram/contracts'
import AdminInfiniteScroll from '@/components/admin/AdminInfiniteScroll'
import type { AdminProductsPageData } from '@/lib/admin-view-data'

interface AdminProduct {
  id: string
  slug: string | null
  product_type: string
  brand: string
  model: string | null
  price: number
  sale_price: number | null
  status: string
  created_at: string
  days_published: number
  sale_reminder_sent_at: string | null
  seller_id: string
  condition?: string
  region?: string
  comuna?: string
  description?: string | null
  rejection_reason?: string | null
  attributes?: Record<string, unknown> | null
  anon_contact: string | null
  users: { name: string | null; email: string; phone?: string | null; hide_phone?: boolean } | null
  product_images: { url: string; order: number }[]
  details_loaded?: boolean
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  missing_photos: 'bg-orange-100 text-orange-700',
  sold: 'bg-brand-100 text-brand-700',
  archived: 'bg-gray-100 text-gray-500',
}

function EditableSalePrice({
  productId,
  value,
  onSave,
}: {
  productId: string
  value: number | null
  onSave: (productId: string, newValue: number | null) => Promise<void>
}) {
  const [draft, setDraft] = useState<string>(value != null ? String(value) : '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(value != null ? String(value) : '')
  }, [value])

  async function commit() {
    const trimmed = draft.replace(/[^\d]/g, '')
    let parsed: number | null
    if (trimmed === '') {
      parsed = null
    } else {
      const n = parseInt(trimmed, 10)
      if (isNaN(n) || n <= 0) {
        // Invalid → revert
        setDraft(value != null ? String(value) : '')
        return
      }
      parsed = n
    }
    if (parsed === value) return
    setSaving(true)
    await onSave(productId, parsed)
    setSaving(false)
  }

  const formatted = draft && /^\d+$/.test(draft)
    ? Number(draft).toLocaleString('es-CL')
    : draft

  return (
    <div className="flex items-center gap-1 font-light" onClick={(e) => e.stopPropagation()}>
      <span className="text-green-600">$</span>
      <input
        type="text"
        inputMode="numeric"
        value={formatted}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            (e.currentTarget as HTMLInputElement).blur()
          } else if (e.key === 'Escape') {
            setDraft(value != null ? String(value) : '')
            ;(e.currentTarget as HTMLInputElement).blur()
          }
        }}
        disabled={saving}
        placeholder="—"
        className="text-green-600 bg-transparent border-b border-dashed border-gray-300 focus:border-green-500 focus:outline-none w-24"
      />
      {saving && (
        <span className="ml-1 inline-block w-3 h-3 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />
      )}
    </div>
  )
}

export default function AdminProductsClient({ initialData }: { initialData: AdminProductsPageData }) {
  const [products, setProducts] = useState<AdminProduct[]>(initialData.products)
  const [viewCounts, setViewCounts] = useState<Record<string, number>>(initialData.viewCounts)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [hasMore, setHasMore] = useState(initialData.hasMore)
  const [nextOffset, setNextOffset] = useState(initialData.nextOffset)
  const [totalCount, setTotalCount] = useState(initialData.totalCount)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>(initialData.facets.statusCounts)
  const [brands, setBrands] = useState<string[]>(initialData.facets.brands)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null)
  const [detailError, setDetailError] = useState('')
  const loadingRef = useRef(false)
  const requestRef = useRef<AbortController | null>(null)
  const initialRenderRef = useRef(true)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [search])

  const loadProducts = useCallback(async (offset = 0, append = false) => {
    if (append && loadingRef.current) return
    if (!append) requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    loadingRef.current = true
    setLoadError('')
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const params = new URLSearchParams({ offset: String(offset) })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (brandFilter) params.set('brand', brandFilter)
      if (typeFilter) params.set('type', typeFilter)
      if (debouncedSearch) params.set('search', debouncedSearch)
      const response = await fetch(`/api/admin/products?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No pudimos cargar las publicaciones')
      const incoming = (data.products || []) as AdminProduct[]
      setProducts(current => append
        ? [...current, ...incoming.filter(product => !current.some(existing => existing.id === product.id))]
        : incoming)
      setViewCounts(current => append
        ? { ...current, ...(data.viewCounts || {}) }
        : (data.viewCounts || {}))
      if (data.facets) {
        setStatusCounts(data.facets.statusCounts || {})
        setBrands(data.facets.brands || [])
      }
      setHasMore(Boolean(data.hasMore))
      setNextOffset(Number(data.nextOffset || 0))
      setTotalCount(Number(data.totalCount || 0))
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setLoadError(error instanceof Error ? error.message : 'No pudimos cargar las publicaciones')
    } finally {
      if (requestRef.current === controller) {
        loadingRef.current = false
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [brandFilter, debouncedSearch, statusFilter, typeFilter])

  useEffect(() => {
    if (initialRenderRef.current) {
      initialRenderRef.current = false
      return
    }
    setExpandedId(null)
    void loadProducts(0)
  }, [loadProducts])

  useEffect(() => () => requestRef.current?.abort(), [])

  const loadMore = useCallback(() => {
    void loadProducts(nextOffset, true)
  }, [loadProducts, nextOffset])

  const filtered = products

  async function toggleExpanded(product: AdminProduct) {
    if (expandedId === product.id) {
      setExpandedId(null)
      return
    }
    if (product.details_loaded) {
      setExpandedId(product.id)
      return
    }

    setDetailLoadingId(product.id)
    setDetailError('')
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok || !data.product) {
        throw new Error(data.error || 'No pudimos cargar el detalle')
      }
      const detailed = { ...data.product, details_loaded: true } as AdminProduct
      setProducts(current => current.map(item => item.id === product.id ? detailed : item))
      if (typeof data.viewCount === 'number') {
        setViewCounts(current => ({ ...current, [product.id]: data.viewCount }))
      }
      setExpandedId(product.id)
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'No pudimos cargar el detalle')
    } finally {
      setDetailLoadingId(null)
    }
  }

  function recordStatusTransition(previousStatus: string | undefined, nextStatus: string) {
    if (!previousStatus || previousStatus === nextStatus) return
    setStatusCounts(current => ({
      ...current,
      [previousStatus]: Math.max(0, (current[previousStatus] || 0) - 1),
      [nextStatus]: (current[nextStatus] || 0) + 1,
    }))
    if (statusFilter !== 'all' && statusFilter !== nextStatus) {
      setProducts(current => current.filter(product => product.status === statusFilter))
      setTotalCount(current => Math.max(0, current - 1))
      setExpandedId(null)
    }
  }

  async function handleStatusChange(productId: string, status: string, extra?: Record<string, unknown>) {
    // Optimistic update — instant UI feedback
    const prevProducts = products
    const previousStatus = prevProducts.find(product => product.id === productId)?.status
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, status, ...extra } as AdminProduct : p))

    let errorMessage: string | null = null
    if (status === 'sold') {
      const response = await fetch(`/api/admin/products/${productId}/sold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extra || {}),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        errorMessage = body.error || 'No pudimos marcar el producto como vendido'
      }
    } else {
      const supabase = createClient()
      const { error } = await supabase.from('products').update({ status, ...extra }).eq('id', productId)
      errorMessage = error?.message || null
    }
    if (errorMessage) {
      // Revert on failure
      setProducts(prevProducts)
      alert('Error al cambiar estado: ' + errorMessage)
    } else {
      recordStatusTransition(previousStatus, status)
    }
  }

  const handleApprovalFinished = useCallback((response: AdminApprovalResponse) => {
    const previousStatus = products.find(product => product.id === response.product.id)?.status
    setProducts(current => current.map(product => product.id === response.product.id
      ? { ...product, status: 'approved', rejection_reason: null }
      : product))
    if (previousStatus && previousStatus !== 'approved') {
      setStatusCounts(current => ({
        ...current,
        [previousStatus]: Math.max(0, (current[previousStatus] || 0) - 1),
        approved: (current.approved || 0) + 1,
      }))
      if (statusFilter !== 'all' && statusFilter !== 'approved') {
        setProducts(current => current.filter(product => product.id !== response.product.id))
        setTotalCount(current => Math.max(0, current - 1))
        setExpandedId(null)
      }
    }
  }, [products, statusFilter])

  const storyApproval = useStoryApproval({ onApproved: handleApprovalFinished })

  async function handleApprove(productId: string) {
    const product = products.find(item => item.id === productId)
    if (!product) return
    await storyApproval.approve({
      id: product.id,
      title: [product.brand, product.model].filter(Boolean).join(' '),
      slug: product.slug || product.id,
    })
  }

  async function handleReject(productId: string) {
    if (!rejectionReason.trim()) {
      alert('Ingresa un motivo de rechazo')
      return
    }
    await handleStatusChange(productId, 'rejected', { rejection_reason: rejectionReason })
    setRejectingId(null)
    setRejectionReason('')
  }

  async function handleMarkSold(productId: string) {
    await handleStatusChange(productId, 'sold')
  }

  async function handleSalePriceChange(productId: string, newValue: number | null) {
    const prevProducts = products
    const current = products.find(p => p.id === productId)
    // Setting a non-null sale_price means the unit was sold — also flip status
    // so the listing stops showing as available. (Used to be a DB trigger;
    // moved to the client after the sales_history table was dropped.)
    const flipToSold = newValue != null && newValue !== current?.sale_price
    setProducts(prev => prev.map(p => {
      if (p.id !== productId) return p
      return { ...p, sale_price: newValue, ...(flipToSold ? { status: 'sold' } : {}) }
    }))
    let errorMessage: string | null = null
    if (flipToSold) {
      const response = await fetch(`/api/admin/products/${productId}/sold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sale_price: newValue }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        errorMessage = body.error || 'No pudimos marcar el producto como vendido'
      }
    } else {
      const supabase = createClient()
      const { error } = await supabase
        .from('products')
        .update({ sale_price: newValue })
        .eq('id', productId)
      errorMessage = error?.message || null
    }
    if (errorMessage) {
      setProducts(prevProducts)
      alert('Error al guardar precio de venta: ' + errorMessage)
    } else if (flipToSold) {
      recordStatusTransition(current?.status, 'sold')
    }
  }

  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(productId: string) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta publicación? Esta acción no se puede deshacer.')) return
    setDeletingId(productId)
    try {
      const response = await fetch(`/api/admin/products/${productId}`, { method: 'DELETE' })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Error al eliminar')
      }
      setExpandedId(null)
      await loadProducts(0)
    } catch (error) {
      alert('Error al eliminar: ' + (error instanceof Error ? error.message : 'desconocido'))
    } finally {
      setDeletingId(null)
    }
  }


  return (
    <div className="max-w-7xl mx-auto mt-0 px-4 md:px-8 pt-4 pb-16">

      {/* Filters */}
      <div className="space-y-3 mb-6">
        {/* Status tabs */}
        <div className="flex gap-1.5 overflow-x-auto">
          {(['all', 'pending', 'approved', 'missing_photos', 'rejected', 'sold', 'archived', 'draft'] as const).map(f => {
            const count = statusCounts[f] || 0
            return (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${statusFilter === f ? 'bg-gray-900 text-white' : count === 0 ? 'bg-gray-50 text-gray-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {f === 'all' ? 'Todos' : PRODUCT_STATUSES[f] || f}
                <span className="ml-1 opacity-60">{count}</span>
              </button>
            )
          })}
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar marca, modelo o vendedor..."
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm sm:w-40"
          >
            <option value="">Todos los tipos</option>
            {Object.entries(PRODUCT_TYPES).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <select
            value={brandFilter}
            onChange={e => setBrandFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm sm:w-40"
          >
            <option value="">Todas las marcas</option>
            {brands.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500 mb-3">
        {totalCount} productos
        {loading && <span className="ml-2 text-brand-500" role="status">Actualizando…</span>}
      </p>

      {loadError && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </p>
      )}
      {detailError && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {detailError}
        </p>
      )}

      <div
        aria-busy={loading}
        className={`transition-opacity ${loading ? 'pointer-events-none opacity-50' : ''}`}
      >
        {filtered.length === 0 ? (
          <p className="text-gray-500">No hay productos que coincidan</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-4 font-medium">Producto</th>
                <th className="pb-2 pr-4 font-medium hidden sm:table-cell">Precio</th>
                <th className="pb-2 pr-4 font-medium hidden md:table-cell">Vendedor</th>
                <th className="pb-2 pr-4 font-medium hidden md:table-cell">Tiempo</th>
                <th className="pb-2 pr-4 font-medium">Estado</th>
                <th className="pb-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(product => {
                const title = [product.brand, product.model].filter(Boolean).join(' ')
                const isAnon = !product.users
                const seller = product.users?.name || product.users?.email || ''
                const isExpanded = expandedId === product.id
                const images = (product.product_images || []).sort((a, b) => a.order - b.order)
                const attrs = product.attributes as Record<string, unknown> | null
                const reminderDaysLeft = daysUntilSaleReminder({
                  status: product.status,
                  daysPublished: product.days_published,
                  lastReminderAt: product.sale_reminder_sent_at,
                })
                const hasReminderEmail = Boolean(
                  product.users?.email || product.anon_contact?.includes('@'),
                )

                return (
                  <React.Fragment key={product.id}>
                    <tr className={`border-b hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-gray-50' : ''}`} onClick={() => void toggleExpanded(product)}>
                      <td className="py-3.5 pr-5">
                        <div className="flex items-center gap-3">
                          <svg className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          {images.length > 0 ? (
                            <img src={images[0].url} alt="" loading="lazy" decoding="async" className="w-10 h-10 rounded object-cover shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center shrink-0">
                              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                          <div>
                            <span className="block text-[10px] font-semibold text-gray-500">
                              {new Date(product.created_at).toLocaleDateString('es-CL')} · {viewCounts[product.id] ?? 0} vistas
                            </span>
                            <span className="font-medium">{title}</span>
                            {detailLoadingId === product.id && (
                              <span className="ml-2 text-[10px] font-medium text-brand-500">Cargando detalle…</span>
                            )}
                            <span className="ml-2 text-xs text-gray-400">{PRODUCT_TYPES[product.product_type] || product.product_type}</span>
                            <span className="block sm:hidden text-xs text-gray-500 mt-0.5">
                              ${product.price.toLocaleString('es-CL')} · {isAnon ? (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-medium">Sin Usuario Creado</span>
                              ) : seller}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 pr-5 hidden sm:table-cell font-medium text-brand-500">
                        ${product.price.toLocaleString('es-CL')}
                      </td>
                      <td className="py-3.5 pr-5 hidden md:table-cell text-gray-600">
                        {isAnon ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 font-medium">Sin Usuario Creado</span>
                        ) : (
                          <span className="block max-w-[150px] truncate" title={seller}>{seller}</span>
                        )}
                      </td>
                      <td className="py-3.5 pr-5 hidden md:table-cell text-gray-600">
                        {['approved', 'sold', 'archived'].includes(product.status) ? (
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{product.days_published} {product.days_published === 1 ? 'día' : 'días'}</span>
                            {product.status === 'approved' && reminderDaysLeft !== null && (
                              hasReminderEmail ? (
                                <span
                                  className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-red-500"
                                  title={product.sale_reminder_sent_at
                                    ? `Reloj reiniciado el ${new Date(product.sale_reminder_sent_at).toLocaleString('es-CL')}`
                                    : 'Primer recordatorio al cumplir 30 días publicado'}
                                >
                                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6.75A2.25 2.25 0 015.25 4.5h13.5A2.25 2.25 0 0121 6.75v10.5a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 17.25V6.75z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6l7.2 5.4a1.75 1.75 0 002.1 0L20.25 6" />
                                  </svg>
                                  {reminderDaysLeft} {reminderDaysLeft === 1 ? 'día' : 'días'}
                                </span>
                              ) : (
                                <span className="mt-0.5 text-[10px] font-medium text-red-400">
                                  Sin email para recordatorio
                                </span>
                              )
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-3.5 pr-5">
                        <span className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[product.status] || ''}`}>
                          {PRODUCT_STATUSES[product.status] || product.status}
                        </span>
                      </td>
                      <td className="py-3.5" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1.5">
                          {product.status === 'pending' && (
                            <>
                              <button onClick={() => handleApprove(product.id)} disabled={storyApproval.busy} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40">
                                Aprobar
                              </button>
                              <button onClick={() => setRejectingId(product.id)} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700">
                                Rechazar
                              </button>
                            </>
                          )}
                          {product.status === 'rejected' && (
                            <button onClick={() => handleApprove(product.id)} disabled={storyApproval.busy} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40">
                              Aprobar
                            </button>
                          )}
                          {product.status === 'missing_photos' && (
                            <button onClick={() => handleApprove(product.id)} disabled={storyApproval.busy} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40">
                              Aprobar
                            </button>
                          )}
                          {product.status === 'approved' && (
                            <button onClick={() => handleMarkSold(product.id)} className="text-xs border border-brand-500 text-brand-500 px-3 py-1.5 rounded hover:bg-brand-50">
                              Vendido
                            </button>
                          )}
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
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr className="border-b bg-gray-200">
                        <td colSpan={6} className="px-4 pt-5 pb-8">
                          <div className="space-y-5 max-w-6xl mx-auto">
                            {/* Action buttons */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {product.status !== 'sold' && (
                                <ContactSellerButton product={product} />
                              )}
                              <InstagramCopyButton product={product} />
                            </div>

                            {/* Basic info */}
                            <div className="bg-white rounded-xl p-6">
                              <div className="flex items-center gap-1.5 mb-3">
                                <svg className="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                                </svg>
                                <span className="font-body text-base font-black text-brand-500 tracking-tight">Detalles</span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-3 text-base justify-items-start text-left">
                                <div>
                                  <span className="font-bold text-gray-700">Tipo</span>
                                  <p className="font-light">{PRODUCT_TYPES[product.product_type] || product.product_type}</p>
                                </div>
                                <div>
                                  <span className="font-bold text-gray-700">Condición</span>
                                  <p className="font-light">{CONDITIONS[product.condition || ''] || product.condition || '—'}</p>
                                </div>
                                <div>
                                  <span className="font-bold text-gray-700">Precio</span>
                                  <p className="font-light text-brand-500">${product.price.toLocaleString('es-CL')}</p>
                                </div>
                                <div>
                                  <span className="font-bold text-gray-700">Visitas</span>
                                  <p className="font-light">{viewCounts[product.id] ?? 0}</p>
                                </div>
                                <div>
                                  <span className="font-bold text-gray-700">Precio de venta</span>
                                  <EditableSalePrice
                                    productId={product.id}
                                    value={product.sale_price}
                                    onSave={handleSalePriceChange}
                                  />
                                </div>
                                <div>
                                  <span className="font-bold text-gray-700">Descripción</span>
                                  <p className="font-light">{product.description || '—'}</p>
                                </div>
                              </div>
                            </div>

                            {/* Atributos + Vendedor lado a lado */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                              {/* Dynamic attributes */}
                              {attrs && Object.keys(attrs).length > 0 ? (
                                <div className="bg-white rounded-xl p-6">
                                  <div className="flex items-center gap-1.5 mb-3">
                                    <svg className="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z M6 6h.008v.008H6V6z" />
                                    </svg>
                                    <span className="font-body text-base font-black text-brand-500 tracking-tight">Atributos</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-base justify-items-start text-left">
                                    {Object.entries(attrs).map(([key, value]) => (
                                      <div key={key}>
                                        <span className="font-bold text-gray-700">{key.replace(/_/g, ' ')}</span>
                                        <p className="font-light">{formatAttributeValue((PRODUCT_ATTRIBUTES[product.product_type] || []).find(f => f.key === key), value)}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : <div />}

                              {/* Seller info */}
                              <div className="bg-white rounded-xl p-6">
                                <div className="flex items-center justify-between gap-2 mb-3">
                                  <div className="flex items-center gap-1.5">
                                    <svg className="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                    </svg>
                                    <span className="font-body text-base font-black text-brand-500 tracking-tight">Vendedor</span>
                                  </div>
                                  {isAnon && (
                                    <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 font-medium">Sin Usuario Creado</span>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-base justify-items-start text-left">
                                  {isAnon ? (
                                    <>
                                      <div className="col-span-2">
                                        <span className="font-bold text-gray-700">Contacto</span>
                                        <p className="font-light break-all">{product.anon_contact || '—'}</p>
                                      </div>
                                      <div>
                                        <span className="font-bold text-gray-700">Ubicación</span>
                                        <p className="font-light">{product.region || '—'}{product.comuna ? `, ${product.comuna}` : ''}</p>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div>
                                        <span className="font-bold text-gray-700">Nombre</span>
                                        <p className="font-light">{product.users?.name || 'Sin nombre'}</p>
                                      </div>
                                      <div>
                                        <span className="font-bold text-gray-700">Email</span>
                                        <p className="font-light">{product.users?.email}</p>
                                      </div>
                                      {product.users?.phone && (
                                        <div>
                                          <span className="font-bold text-gray-700">Teléfono</span>
                                          <p className="font-light">{product.users.phone}</p>
                                        </div>
                                      )}
                                      <div>
                                        <span className="font-bold text-gray-700">WhatsApp público</span>
                                        <p className="mt-0.5">
                                          {product.users?.hide_phone ? (
                                            <span className="inline-flex text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                                              No comparte
                                            </span>
                                          ) : product.users?.phone ? (
                                            <span className="inline-flex text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                                              Comparte
                                            </span>
                                          ) : (
                                            <span className="inline-flex text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 font-medium">
                                              Sin teléfono
                                            </span>
                                          )}
                                        </p>
                                      </div>
                                      <div>
                                        <span className="font-bold text-gray-700">Ubicación</span>
                                        <p className="font-light">{product.region || '—'}{product.comuna ? `, ${product.comuna}` : ''}</p>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Rejection reason */}
                            {product.rejection_reason && (
                              <div className="bg-white rounded-xl p-6">
                                <div className="flex items-center gap-1.5">
                                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                  </svg>
                                  <span className="font-body text-sm font-black text-red-500 tracking-tight">Motivo de rechazo</span>
                                </div>
                                <p className="text-sm font-light text-red-600 mt-1">{product.rejection_reason}</p>
                              </div>
                            )}

                            {/* Images — horizontal abajo */}
                            {images.length > 0 && (
                              <div className="bg-white rounded-xl p-6">
                                <div className="flex items-center gap-1.5 mb-3">
                                  <svg className="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                                  </svg>
                                  <span className="font-body text-base font-black text-brand-500 tracking-tight">Imágenes</span>
                                </div>
                                <div className="flex gap-2 overflow-x-auto">
                                  {images.map((img, i) => (
                                    <img key={i} src={img.url} alt="" loading="lazy" decoding="async" className="w-24 h-24 sm:w-32 sm:h-32 shrink-0 object-cover rounded-lg" />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>

          {/* Rejection modal inline */}
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
        )}
      </div>
      {!loading && filtered.length > 0 && (
        <AdminInfiniteScroll
          hasMore={hasMore}
          loading={loadingMore}
          error={loadError}
          onLoadMore={loadMore}
          label="Cargando más publicaciones"
        />
      )}
    </div>
  )
}

function ContactSellerButton({ product }: { product: AdminProduct }) {
  const [open, setOpen] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBodyDraft, setEmailBodyDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendStatus, setSendStatus] = useState<'idle' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [successPopup, setSuccessPopup] = useState(false)

  const seller = product.users
  const title = [product.brand, product.model].filter(Boolean).join(' ')
  const sellerFirstName = seller?.name?.split(' ')[0] || ''
  const greeting = sellerFirstName ? `Hola ${sellerFirstName},` : 'Hola,'

  const wsMessage = `Hola, te escribimos desde ReSkiChile.

Queríamos consultarte por el estado de tu publicación de ${title} en nuestro catálogo. ¿Continúa disponible o ya la vendiste?

Te agradecemos confirmarnos para mantener el catálogo actualizado, Saludos!`

  const defaultEmailBody = `${greeting}

Soy Sebastián del equipo de ventas de ReSkiChile.

Te escribo para saber el estado actual de tu publicación **${title}**. ¿Sigue disponible o ya la vendiste?

Te agradecería mucho que respondieras brevemente este correo para confirmarme si sigue disponible o si ya la vendiste.

Saludos,
Sebastián`

  function openWhatsApp() {
    const wa = phoneToWhatsApp(seller?.phone)
    if (!wa) return
    const url = `https://wa.me/${wa}?text=${encodeURIComponent(wsMessage)}`
    window.open(url, '_blank')
    setOpen(false)
  }

  function openEmailModal() {
    if (!seller?.email) return
    setEmailSubject(`¿Vendiste tu ${title}?`)
    setEmailBodyDraft(defaultEmailBody)
    setSendStatus('idle')
    setErrorMsg('')
    setEmailModalOpen(true)
    setOpen(false)
  }

  async function sendEmail() {
    if (!seller?.email) return
    setSending(true)
    setSendStatus('idle')
    try {
      const productImageUrl = (product.product_images || [])
        .slice()
        .sort((a, b) => a.order - b.order)[0]?.url
      const res = await fetch('/api/admin/contact-seller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: seller.email,
          subject: emailSubject,
          body: emailBodyDraft,
          productImageUrl,
        }),
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

  if (!seller?.email && !seller?.phone) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 bg-brand-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-600 shadow-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
        </svg>
        Contactar vendedor
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden min-w-[200px] max-w-[calc(100vw-32px)]">
            {seller?.phone && (
              <button
                onClick={openWhatsApp}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 text-left"
              >
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                <span className="font-medium">WhatsApp</span>
              </button>
            )}
            {seller?.email && (
              <button
                onClick={openEmailModal}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 text-left border-t border-gray-100"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.093-9.75-6.093" />
                </svg>
                <span className="font-medium">Correo</span>
              </button>
            )}
          </div>
        </>
      )}

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
            <p className="text-sm text-gray-500 mb-5">El mensaje fue enviado correctamente al vendedor.</p>
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
      {emailModalOpen && seller?.email && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !sending && setEmailModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-body text-lg font-black text-gray-900">Enviar correo</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Desde <span className="font-medium text-gray-700">reskichile@gmail.com</span> · Para <span className="font-medium text-gray-700">{seller.email}</span>
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

function buildInstagramText(product: AdminProduct): string {
  const lines: string[] = []
  const isSold = product.status === 'sold'
  lines.push(isSold ? 'Vendido ❌' : 'Disponible ✅')
  lines.push(`$${product.price.toLocaleString('es-CL')}`)

  const title = [product.brand, product.model].filter(Boolean).join(' ')
  if (title) lines.push(title)

  // Attribute labels lookup
  const attrDefs = PRODUCT_ATTRIBUTES[product.product_type] || []
  const labelMap: Record<string, string> = {}
  attrDefs.forEach(a => { labelMap[a.key] = a.label })

  if (product.attributes && typeof product.attributes === 'object') {
    for (const [key, value] of Object.entries(product.attributes)) {
      if (value === undefined || value === null || value === '') continue
      if (Array.isArray(value) && value.length === 0) continue
      const label = labelMap[key] || key.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
      const display = formatAttributeValue(attrDefs.find(a => a.key === key), value)
      lines.push(`${label}: ${display}`)
    }
  }

  if (product.condition) {
    lines.push(`Estado: ${CONDITIONS[product.condition] || product.condition}`)
  }

  if (product.description) {
    const flat = product.description.replace(/\s*\n+\s*/g, ' ').trim()
    lines.push('')
    lines.push(`Descripción: ${flat}`)
  }

  const location = [product.comuna, product.region].filter(Boolean).join(', ')
  if (location) {
    lines.push('')
    lines.push(`📍 ${location}`)
  }

  return lines.join('\n')
}

function InstagramCopyButton({ product }: { product: AdminProduct }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState<number | 'all' | null>(null)

  const text = buildInstagramText(product)
  const images = (product.product_images || []).slice().sort((a, b) => a.order - b.order)

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('No se pudo copiar al portapapeles')
    }
  }

  async function downloadImage(url: string, index: number) {
    setDownloading(index)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('Error de red')
      const blob = await res.blob()
      const ext = url.split('.').pop()?.split('?')[0] || 'jpg'
      const safeTitle = [product.brand, product.model].filter(Boolean).join('_').replace(/[^\w-]/g, '_')
      const filename = `${safeTitle}_${index + 1}.${ext}`
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
    } catch (e) {
      alert('Error al descargar: ' + (e instanceof Error ? e.message : 'desconocido'))
    } finally {
      setDownloading(null)
    }
  }

  async function downloadAll() {
    setDownloading('all')
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const safeTitle = [product.brand, product.model].filter(Boolean).join('_').replace(/[^\w-]/g, '_') || 'producto'

      for (let i = 0; i < images.length; i++) {
        const res = await fetch(images[i].url)
        if (!res.ok) throw new Error(`Error al descargar imagen ${i + 1}`)
        const blob = await res.blob()
        const ext = images[i].url.split('.').pop()?.split('?')[0] || 'jpg'
        zip.file(`${safeTitle}_${i + 1}.${ext}`, blob)
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const objectUrl = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `${safeTitle}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
    } catch (e) {
      alert('Error al descargar: ' + (e instanceof Error ? e.message : 'desconocido'))
    } finally {
      setDownloading(null)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 shadow-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
        Copy Instagram
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-body text-lg font-black text-gray-900">Copy para Instagram</h3>
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
              {/* Text + copy */}
              <div className="relative">
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm font-light whitespace-pre-wrap font-sans">{text}</pre>
                <button
                  onClick={copyText}
                  className={`absolute top-2 right-2 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded font-medium transition-colors ${copied ? 'bg-green-500 text-white' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                >
                  {copied ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Copiado
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                      Copiar
                    </>
                  )}
                </button>
              </div>

              {/* Images horizontal */}
              {images.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Imágenes ({images.length})</span>
                    <button
                      onClick={downloadAll}
                      disabled={downloading !== null}
                      className="text-xs bg-brand-500 text-white px-3 py-1.5 rounded font-medium hover:bg-brand-600 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {downloading === 'all' ? (
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                      )}
                      Descargar todas
                    </button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {images.map((img, i) => (
                      <div key={i} className="relative shrink-0 group">
                        <img src={img.url} alt="" loading="lazy" decoding="async" className="w-32 h-32 object-cover rounded-lg" />
                        <button
                          onClick={() => downloadImage(img.url, i)}
                          disabled={downloading !== null}
                          className="absolute bottom-1.5 right-1.5 bg-gray-900/80 text-white p-1.5 rounded hover:bg-gray-900 disabled:opacity-50"
                          title="Descargar"
                        >
                          {downloading === i ? (
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
