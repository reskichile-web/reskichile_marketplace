'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { createClient } from '@/lib/supabase/client'
import type { Message } from '@/lib/chat'

interface Props {
  conversationId: string
  myId: string
  initialMessages: Message[]
}

const PAGE_SIZE = 30

export default function ChatRoom({ conversationId, myId, initialMessages }: Props) {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMoreOlder, setHasMoreOlder] = useState(initialMessages.length >= 100)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = useRef(true)

  // Virtualized list
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 56,
    overscan: 8,
  })

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incoming = payload.new as Message
          setMessages((prev) => {
            // Dedupe by id (we use client-generated UUIDs that match server row)
            if (prev.some((m) => m.id === incoming.id)) return prev
            return [...prev, incoming]
          })
          // Mark as read if from other and chat is open
          if (incoming.sender_id !== myId) {
            supabase
              .from('messages')
              .update({ read_at: new Date().toISOString() })
              .eq('id', incoming.id)
              .then(() => {})
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, myId, supabase])

  // Auto-scroll to bottom on new messages if user was at bottom
  useEffect(() => {
    if (stickToBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

  // Detect if user is at bottom (to control auto-scroll behavior)
  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop
    stickToBottomRef.current = distFromBottom < 80

    // Load older when scrolled near top
    if (el.scrollTop < 200 && hasMoreOlder && !loadingOlder) {
      loadOlder()
    }
  }, [hasMoreOlder, loadingOlder])

  async function loadOlder() {
    if (loadingOlder || !hasMoreOlder || messages.length === 0) return
    setLoadingOlder(true)
    const oldest = messages[0]
    const el = scrollRef.current
    const prevScrollHeight = el?.scrollHeight || 0
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .lt('created_at', oldest.created_at)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (data && data.length > 0) {
      setMessages((prev) => [...data.reverse(), ...prev])
      // restore scroll position so it doesn't jump to top
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevScrollHeight
      })
      if (data.length < PAGE_SIZE) setHasMoreOlder(false)
    } else {
      setHasMoreOlder(false)
    }
    setLoadingOlder(false)
  }

  async function send() {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    const tempId = crypto.randomUUID()
    const now = new Date().toISOString()

    const optimistic: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: myId,
      body,
      read_at: null,
      created_at: now,
      pending: true,
    }
    setMessages((prev) => [...prev, optimistic])
    setDraft('')
    stickToBottomRef.current = true

    const { error } = await supabase.from('messages').insert({
      id: tempId,
      conversation_id: conversationId,
      sender_id: myId,
      body,
    })

    if (error) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m))
      )
    } else {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, pending: false } : m))
      )
    }
    setSending(false)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // Group messages by sender + 5min window
  const grouped = groupMessages(messages)

  const items = virtualizer.getVirtualItems()

  return (
    <>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-4 py-3 bg-gray-50"
      >
        {loadingOlder && (
          <div className="text-center text-xs text-gray-400 py-2">Cargando…</div>
        )}
        <div
          style={{
            height: virtualizer.getTotalSize(),
            position: 'relative',
            width: '100%',
          }}
        >
          {items.map((vi) => {
            const m = messages[vi.index]
            const group = grouped[vi.index]
            return (
              <div
                key={m.id}
                ref={virtualizer.measureElement}
                data-index={vi.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${vi.start}px)`,
                }}
                className={group.isLastInGroup ? 'pb-2' : 'pb-0.5'}
              >
                <Bubble m={m} mine={m.sender_id === myId} showTime={group.isLastInGroup} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-gray-200 bg-white px-3 py-2 flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Mensaje…"
          rows={1}
          className="flex-1 resize-none bg-gray-100 border-0 rounded-2xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 max-h-32"
        />
        <button
          type="button"
          onClick={send}
          disabled={!draft.trim() || sending}
          className="h-9 w-9 rounded-full bg-brand-500 text-white flex items-center justify-center disabled:opacity-40 hover:bg-brand-600 transition-colors shrink-0"
          aria-label="Enviar"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </>
  )
}

function Bubble({
  m,
  mine,
  showTime,
}: {
  m: Message
  mine: boolean
  showTime: boolean
}) {
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
            mine
              ? `bg-brand-500 text-white ${m.failed ? 'opacity-50' : ''}`
              : 'bg-white border border-gray-200 text-gray-900'
          }`}
        >
          {m.body}
        </div>
        {showTime && (
          <span className="text-[10px] text-gray-400 mt-0.5 px-1">
            {formatTime(m.created_at)}
            {m.pending && ' · enviando…'}
            {m.failed && ' · falló'}
          </span>
        )}
      </div>
    </div>
  )
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

interface GroupInfo {
  isFirstInGroup: boolean
  isLastInGroup: boolean
}

function groupMessages(messages: Message[]): GroupInfo[] {
  const out: GroupInfo[] = []
  for (let i = 0; i < messages.length; i++) {
    const prev = messages[i - 1]
    const curr = messages[i]
    const next = messages[i + 1]

    const prevSame =
      prev &&
      prev.sender_id === curr.sender_id &&
      new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000

    const nextSame =
      next &&
      next.sender_id === curr.sender_id &&
      new Date(next.created_at).getTime() - new Date(curr.created_at).getTime() < 5 * 60_000

    out.push({
      isFirstInGroup: !prevSame,
      isLastInGroup: !nextSame,
    })
  }
  return out
}
