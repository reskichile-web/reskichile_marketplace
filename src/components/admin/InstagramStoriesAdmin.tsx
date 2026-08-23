'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Instagram, Loader2, RefreshCw } from 'lucide-react'
import InstagramStoryCalendarTable from './InstagramStoryCalendarTable'
import InstagramStoryEditorModal, { type InstagramSlotOption } from './InstagramStoryEditorModal'
import InstagramStoryProductList from './InstagramStoryProductList'
import type { InstagramAdminCalendarResponse } from '@/lib/instagram/admin-contracts'
import {
  addLocalDays,
  chileCurrentTime,
  chileToday,
  displayLocalDate,
} from '@/lib/instagram/admin-ui'
import { instagramStoryRuleForDate } from '@/lib/instagram/schedule-rules'

const CALENDAR_DAYS = 35

async function responseError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => ({})) as { error?: string }
  return payload.error || 'No pudimos cargar las Stories'
}

export default function InstagramStoriesAdmin() {
  const [data, setData] = useState<InstagramAdminCalendarResponse | null>(null)
  const [view, setView] = useState<'prepare' | 'calendar'>('calendar')
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/admin/instagram-stories', { cache: 'no-store' })
      if (!response.ok) throw new Error(await responseError(response))
      setData(await response.json() as InstagramAdminCalendarResponse)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos cargar las Stories')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const today = chileToday()
  const currentTime = chileCurrentTime()
  const dates = useMemo(
    () => Array.from({ length: CALENDAR_DAYS }, (_, index) => addLocalDays(today, index)),
    [today],
  )
  const products = data?.products ?? []
  const selectedProduct = selectedProductId
    ? products.find((product) => product.id === selectedProductId) || null
    : null
  const occupiedKeys = products
    .filter((product) => product.capture?.scheduledLocalDate && product.capture.scheduledSlot)
    .map((product) => `${product.capture!.scheduledLocalDate}|${product.capture!.scheduledSlot}`)
  const availableSlots = useMemo(() => {
    const occupied = new Set(occupiedKeys)
    return dates.flatMap((localDate) => {
      const rule = instagramStoryRuleForDate(localDate)
      return rule.slots.flatMap((slot): InstagramSlotOption[] => {
        const key = `${localDate}|${slot.slot}`
        if (occupied.has(key) || (localDate === today && slot.time <= currentTime)) return []
        return [{
          key,
          localDate,
          slot: slot.slot,
          time: slot.time,
          label: `${displayLocalDate(localDate)} · ${slot.time}`,
        }]
      })
    })
  }, [currentTime, dates, occupiedKeys, today])

  if (loading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-brand-500">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
      <header className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:items-end">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-500">
            <Instagram className="h-4 w-4" /> @reskichile
          </div>
          <h1 className="mt-2 font-body text-2xl font-black tracking-tight text-gray-950 sm:text-3xl xl:whitespace-nowrap xl:text-[2rem]">
            Historias de Instagram
          </h1>
        </div>

        <div
          className="inline-flex justify-self-start rounded-xl border border-gray-200 bg-gray-100 p-1 shadow-inner xl:justify-self-center"
          role="tablist"
          aria-label="Vista de historias"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === 'prepare'}
            onClick={() => setView('prepare')}
            className={`rounded-lg px-5 py-2.5 text-sm font-bold transition sm:px-8 ${view === 'prepare' ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
          >
            Generar historias
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'calendar'}
            onClick={() => setView('calendar')}
            className={`rounded-lg px-5 py-2.5 text-sm font-bold transition sm:px-8 ${view === 'calendar' ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
          >
            Calendario
          </button>
        </div>

        <div className="flex items-center gap-2 xl:justify-self-end">
          <span className={`hidden rounded-full px-3 py-1.5 text-xs font-bold sm:inline-flex ${data?.publishingEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {data?.publishingEnabled ? 'Publicación activa' : 'Publicación desactivada'}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-500 shadow-sm transition hover:bg-gray-50 disabled:opacity-40"
            aria-label="Actualizar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="mt-7">
        {view === 'prepare' ? (
          <InstagramStoryProductList products={products} onOpen={setSelectedProductId} />
        ) : (
          <InstagramStoryCalendarTable
            products={products}
            dates={dates}
            today={today}
            currentTime={currentTime}
            availableSlots={availableSlots}
            onOpen={setSelectedProductId}
            onChanged={load}
          />
        )}
      </div>

      {selectedProduct && (
        <InstagramStoryEditorModal
          product={selectedProduct}
          publishingEnabled={Boolean(data?.publishingEnabled)}
          slots={availableSlots}
          onClose={() => setSelectedProductId(null)}
          onChanged={load}
        />
      )}
    </main>
  )
}
