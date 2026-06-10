'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Spinner from '@/components/Spinner'
import AdminTableSkeleton from '@/components/skeletons/AdminTableSkeleton'

interface Person {
  id: string
  name: string | null
  email: string
}

interface ConversationRow {
  id: string
  created_at: string
  last_message_at: string | null
  buyer: Person | null
  seller: Person | null
  products: {
    id: string
    brand: string | null
    model: string | null
    slug: string | null
    product_images: { url: string; order: number }[]
  } | null
  messages: { body: string; sender_id: string; created_at: string; read_at: string | null }[]
}

interface TranscriptMessage {
  id: string
  body: string
  sender_id: string
  created_at: string
  delivered_at: string | null
  read_at: string | null
}

interface Transcript {
  conversation: ConversationRow & { buyer_id: string; seller_id: string }
  messages: TranscriptMessage[]
}

const CARD = 'bg-white rounded-xl border border-gray-200'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `hace ${hrs} h`
  return `hace ${Math.floor(hrs / 24)} d`
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }).replace('.', '')
  const time = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  return `${date} · ${time}`
}

function productTitle(c: ConversationRow): string {
  return [c.products?.brand, c.products?.model].filter(Boolean).join(' ') || 'Producto eliminado'
}

function ChatsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const selectedId = searchParams.get('c')
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [transcriptLoading, setTranscriptLoading] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/conversations')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error')
        setConversations(data.conversations || [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setTranscript(null)
      return
    }
    let cancelled = false
    async function loadTranscript() {
      setTranscriptLoading(true)
      try {
        const res = await fetch(`/api/admin/conversations/${selectedId}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error')
        if (!cancelled) setTranscript(data)
      } catch {
        if (!cancelled) setTranscript(null)
      } finally {
        if (!cancelled) setTranscriptLoading(false)
      }
    }
    loadTranscript()
    return () => { cancelled = true }
  }, [selectedId])

  if (loading) return <AdminTableSkeleton />

  return (
    <div className="max-w-7xl mx-auto mt-0 px-4 md:px-8 pt-4 pb-16">
      <div className="mb-6">
        <h1 className="font-body text-2xl font-black text-gray-900">Chats</h1>
        <p className="text-sm text-gray-500 mt-1">
          Modo dios — solo lectura. Abrir un chat <span className="font-semibold">no</span> marca los mensajes como entregados ni leídos.
        </p>
      </div>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Conversation list */}
        <div className={`lg:col-span-2 ${CARD} overflow-hidden`}>
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">Conversaciones ({conversations.length})</h2>
          </div>
          {conversations.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">No hay conversaciones.</p>
          ) : (
            <ul className="divide-y divide-gray-50 max-h-[calc(100vh-280px)] overflow-y-auto">
              {conversations.map(c => {
                const img = (c.products?.product_images || []).slice().sort((a, b) => a.order - b.order)[0]
                const last = c.messages?.[0]
                const lastSenderName = last
                  ? (last.sender_id === c.buyer?.id ? c.buyer?.name : c.seller?.name) || 'Anónimo'
                  : null
                const isSelected = c.id === selectedId
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => router.replace(`/admin/chats?c=${c.id}`, { scroll: false })}
                      className={`w-full text-left px-5 py-3 flex items-center gap-3 transition-colors ${isSelected ? 'bg-brand-50' : 'hover:bg-gray-50'}`}
                    >
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img.url} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-gray-100 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{productTitle(c)}</p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {c.buyer?.name || 'Anónimo'} ↔ {c.seller?.name || 'Anónimo'}
                        </p>
                        {last && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            <span className="font-medium">{lastSenderName}:</span> {last.body}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {c.last_message_at ? timeAgo(c.last_message_at) : ''}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Transcript */}
        <div className={`lg:col-span-3 ${CARD} overflow-hidden`}>
          {!selectedId ? (
            <div className="py-24 text-center text-sm text-gray-400">
              Selecciona una conversación para leerla.
            </div>
          ) : transcriptLoading ? (
            <div className="py-24 flex items-center justify-center gap-2">
              <Spinner size="md" color="brand" />
              <span className="text-xs text-gray-400">Cargando chat…</span>
            </div>
          ) : !transcript ? (
            <p className="py-24 text-center text-sm text-red-500">No se pudo cargar la conversación.</p>
          ) : (
            <>
              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{productTitle(transcript.conversation)}</p>
                  <p className="text-xs text-gray-400 truncate">
                    <span className="text-brand-600 font-medium">{transcript.conversation.buyer?.name || 'Anónimo'}</span>
                    {' '}(comprador) ↔{' '}
                    <span className="text-gray-700 font-medium">{transcript.conversation.seller?.name || 'Anónimo'}</span>
                    {' '}(vendedor)
                  </p>
                </div>
                {transcript.conversation.products && (
                  <Link
                    href={`/producto/${transcript.conversation.products.slug || transcript.conversation.products.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs bg-brand-500 text-white px-3 py-1.5 rounded hover:bg-brand-600"
                  >
                    Ver producto
                  </Link>
                )}
              </div>

              {/* Messages — buyer left, seller right */}
              <div className="px-5 py-4 space-y-2.5 max-h-[calc(100vh-340px)] overflow-y-auto bg-gray-50/50">
                {transcript.messages.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-10">Sin mensajes.</p>
                ) : (
                  transcript.messages.map(m => {
                    const isBuyer = m.sender_id === transcript.conversation.buyer_id
                    const senderName = isBuyer
                      ? transcript.conversation.buyer?.name || 'Comprador'
                      : transcript.conversation.seller?.name || 'Vendedor'
                    return (
                      <div key={m.id} className={`flex ${isBuyer ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[80%] rounded-xl px-3.5 py-2 ${isBuyer ? 'bg-white border border-gray-200' : 'bg-brand-500 text-white'}`}>
                          <p className={`text-[10px] font-bold mb-0.5 ${isBuyer ? 'text-brand-600' : 'text-brand-100'}`}>{senderName}</p>
                          <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                          <p className={`text-[9px] mt-1 flex items-center justify-end gap-1 ${isBuyer ? 'text-gray-400' : 'text-brand-100'}`}>
                            {fmtDateTime(m.created_at)}
                            {m.read_at ? (
                              <span title={`Leído ${fmtDateTime(m.read_at)}`}>✓✓</span>
                            ) : m.delivered_at ? (
                              <span title={`Entregado ${fmtDateTime(m.delivered_at)}`}>✓</span>
                            ) : null}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminChatsPage() {
  return (
    <Suspense fallback={<AdminTableSkeleton />}>
      <ChatsContent />
    </Suspense>
  )
}
