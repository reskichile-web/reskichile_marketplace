'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface RecentMessage {
  id: string
  body: string
  created_at: string
  conversation_id: string
  read_at: string | null
  sender: { name: string | null } | null
  conversations: {
    id: string
    products: { brand: string | null; model: string | null } | null
  } | null
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `hace ${hrs} h`
  return `hace ${Math.floor(hrs / 24)} d`
}

/**
 * Latest chat messages across all conversations (admin-only data).
 * Each row links into the read-only god-mode viewer at /admin/chats.
 */
export default function RecentMessagesCard({ className }: { className?: string }) {
  const [messages, setMessages] = useState<RecentMessage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/conversations')
        const data = await res.json()
        if (res.ok) setMessages(data.recent_messages || [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${className || ''}`}>
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="font-body text-lg font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-900 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            Últimos mensajes
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Actividad reciente del chat</p>
        </div>
        <Link href="/admin/chats" className="text-xs text-brand-500 hover:underline shrink-0">
          Ver chats
        </Link>
      </div>

      {loading ? (
        <p className="px-5 py-8 text-xs text-gray-400 text-center">Cargando…</p>
      ) : messages.length === 0 ? (
        <p className="px-5 py-8 text-sm text-gray-400 text-center">Sin mensajes todavía.</p>
      ) : (
        <ul className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
          {messages.map(m => {
            const product = [m.conversations?.products?.brand, m.conversations?.products?.model]
              .filter(Boolean).join(' ') || 'Producto eliminado'
            return (
              <li key={m.id}>
                <Link
                  href={`/admin/chats?c=${m.conversation_id}`}
                  className="block px-5 py-2.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {m.sender?.name || 'Anónimo'}
                      <span className="ml-1.5 text-xs font-normal text-gray-400">{product}</span>
                    </p>
                    <span className="text-xs text-gray-400 shrink-0 flex items-center gap-1">
                      {!m.read_at && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" title="No leído" />}
                      {timeAgo(m.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{m.body}</p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
