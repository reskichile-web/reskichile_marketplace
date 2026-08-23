'use client'

/* eslint-disable @next/next/no-img-element */

import { useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Trash2,
} from 'lucide-react'
import type { InstagramAdminProduct } from '@/lib/instagram/admin-contracts'
import {
  displayLocalDate,
  storyStatus,
} from '@/lib/instagram/admin-ui'
import { instagramStoryRuleForDate } from '@/lib/instagram/schedule-rules'
import type { InstagramSlotOption } from './InstagramStoryEditorModal'

interface Props {
  products: InstagramAdminProduct[]
  dates: string[]
  today: string
  currentTime: string
  availableSlots: InstagramSlotOption[]
  onOpen: (productId: string) => void
  onChanged: () => Promise<void>
}

async function responseError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => ({})) as { error?: string }
  return payload.error || 'No pudimos actualizar el calendario'
}

export default function InstagramStoryCalendarTable({
  products,
  dates,
  today,
  currentTime,
  availableSlots,
  onOpen,
  onChanged,
}: Props) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const scheduledProducts = products.filter((product) => Boolean(product.capture?.scheduledLocalDate))
  const occupied = new Map(
    scheduledProducts.map((product) => [
      `${product.capture!.scheduledLocalDate}|${product.capture!.scheduledSlot}`,
      product,
    ]),
  )
  const preparedUnscheduled = products.filter((product) => {
    const capture = product.capture
    return Boolean(
      capture?.jpegPublicUrl
      && capture.generatedAt
      && (capture.status === 'ready' || capture.status === 'retry')
      && !capture.scheduledFor,
    )
  })

  async function scheduleRequest(body: Record<string, unknown>) {
    const response = await fetch('/api/admin/instagram-stories/schedule', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(await responseError(response))
  }

  async function move(captureId: string, target: string) {
    if (!target || busy) return
    const [localDate, slot] = target.split('|')
    setBusy(captureId)
    setError('')
    try {
      await scheduleRequest({ captureId, action: 'move', localDate, slot: Number(slot) })
      await onChanged()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos mover la Story')
    } finally {
      setBusy('')
    }
  }

  async function unschedule(captureId: string) {
    if (busy) return
    setBusy(captureId)
    setError('')
    try {
      await scheduleRequest({ captureId, action: 'unschedule' })
      await onChanged()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos retirar la Story')
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-5 py-5 sm:px-6">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
            <CalendarDays className="h-4 w-4" /> Calendario editorial
          </div>
          <h2 className="mt-1 font-body text-2xl font-black tracking-tight text-gray-800">Programación de historias</h2>
        </div>
        {busy && <Loader2 className="h-5 w-5 animate-spin text-gray-500" />}
      </header>

      {error && (
        <div role="alert" className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-left">
          <thead>
            <tr className="border-b border-blue-100 bg-blue-50 text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">
              <th className="w-44 px-5 py-3">Día</th>
              <th className="w-24 px-4 py-3">Hora</th>
              <th className="px-4 py-3">Publicación</th>
              <th className="w-44 px-4 py-3">Estado</th>
              <th className="w-64 px-5 py-3">Programación</th>
            </tr>
          </thead>
          <tbody>
            {dates.flatMap((localDate) => {
              const rule = instagramStoryRuleForDate(localDate)
              return rule.slots.map((slot, index) => {
                const key = `${localDate}|${slot.slot}`
                const product = occupied.get(key)
                const capture = product?.capture
                const state = product ? storyStatus(product) : null
                const slotPassed = localDate === today && slot.time <= currentTime
                return (
                  <tr key={key} className={`${index === 0 ? 'border-t-2 border-t-blue-200' : ''} ${index === 2 ? 'border-b-2 border-b-blue-200' : 'border-b border-b-gray-100'} transition hover:bg-blue-50/25`}>
                    {index === 0 && (
                      <th rowSpan={3} className="border-r border-blue-200 bg-blue-50 px-5 py-4 align-top">
                        <p className="text-sm font-black text-blue-950">{displayLocalDate(localDate)}</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-blue-500">
                          {localDate === today ? 'Hoy · ' : ''}{rule.window}
                        </p>
                      </th>
                    )}
                    <td className="px-4 py-4 align-middle">
                      <p className="text-base font-black text-gray-950">{slot.time}</p>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Cupo {slot.slot}</p>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      {product && capture ? (
                        <button type="button" onClick={() => onOpen(product.id)} className="group flex max-w-md items-center gap-3 text-left">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                            {product.imageUrl && <img src={product.imageUrl} alt="" className="h-full w-full object-contain" />}
                          </div>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-black text-gray-900 group-hover:text-brand-600">{product.title}</span>
                            <span className="mt-0.5 block text-[10px] text-gray-400">
                              {capture.scheduleSource === 'automatic' ? 'Asignación automática' : 'Asignación manual'}
                            </span>
                          </span>
                        </button>
                      ) : slotPassed ? (
                        <span className="text-xs font-bold uppercase tracking-wide text-gray-300">Cupo vencido</span>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-300">
                          <CheckCircle2 className="h-4 w-4" /> Cupo libre
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      {state && <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide ${state.className}`}>{state.label}</span>}
                    </td>
                    <td className="px-5 py-3 align-middle">
                      {product && capture ? capture.status === 'published' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" /> Publicada
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <select
                            value=""
                            onChange={(event) => void move(capture.id, event.target.value)}
                            disabled={Boolean(busy)}
                            aria-label={`Mover ${product.title}`}
                            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-semibold text-gray-600 outline-none focus:border-brand-400 disabled:opacity-40"
                          >
                            <option value="">Mover a…</option>
                            {availableSlots.map((target) => <option key={target.key} value={target.key}>{target.label}</option>)}
                          </select>
                          {capture.jpegPublicUrl && (
                            <a href={`${capture.jpegPublicUrl}?v=${encodeURIComponent(capture.updatedAt)}`} target="_blank" rel="noreferrer" aria-label="Abrir Story" className="rounded-lg border border-gray-200 p-2 text-gray-400 hover:text-brand-600">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          <button type="button" onClick={() => void unschedule(capture.id)} disabled={Boolean(busy)} aria-label="Sacar del calendario" className="rounded-lg border border-red-100 p-2 text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : slotPassed ? (
                        <span className="text-xs font-semibold text-gray-300">Sin acciones</span>
                      ) : (
                        <select
                          value=""
                          onChange={(event) => {
                            const selected = preparedUnscheduled.find((item) => item.capture?.id === event.target.value)
                            if (selected?.capture) void move(selected.capture.id, key)
                          }}
                          disabled={Boolean(busy) || preparedUnscheduled.length === 0}
                          aria-label={`Asignar Story a ${displayLocalDate(localDate)} ${slot.time}`}
                          className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-semibold text-gray-600 outline-none focus:border-brand-400 disabled:bg-gray-50 disabled:text-gray-300"
                        >
                          <option value="">{preparedUnscheduled.length ? 'Asignar preparada…' : 'Sin Stories preparadas'}</option>
                          {preparedUnscheduled.map((item) => <option key={item.id} value={item.capture!.id}>{item.title}</option>)}
                        </select>
                      )}
                    </td>
                  </tr>
                )
              })
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
