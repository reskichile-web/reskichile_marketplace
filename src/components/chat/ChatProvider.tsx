'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface ChatContextValue {
  unreadCount: number
}

// Default is null so consumers can distinguish "rendered outside the provider"
// (use the SSR fallback) from "rendered inside, count is currently 0".
const ChatContext = createContext<ChatContextValue | null>(null)

export function useUnreadCount(): number | null {
  return useContext(ChatContext)?.unreadCount ?? null
}

interface Props {
  userId: string | null
  initialUnreadCount: number
  children: React.ReactNode
}

/**
 * Realtime chat listener — scoped to the messages area only.
 *
 * The unread badge is always visible (the header SSR seeds it and it re-seeds on
 * every navigation), but the persistent Realtime WebSocket is **only opened
 * while the user is on a `/mensajes` route**. Browsing the rest of the site no
 * longer holds a socket open or runs a bootstrap query.
 *
 * Responsibilities while on /mensajes:
 *
 * 1. Keep an accurate live unread-message count, exposed via {@link useUnreadCount}.
 *    On entry we re-fetch the unread ids so decrements stay exact.
 * 2. Mark `delivered_at` on incoming messages (so the sender's "Entregado" check
 *    appears) while the recipient is in the messages area.
 * 3. Debounced router.refresh() when on the /mensajes list so it re-renders
 *    shortly after a new message arrives.
 */
export default function ChatProvider({
  userId,
  initialUnreadCount,
  children,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const onMessages = pathname?.startsWith('/mensajes') ?? false
  const pathRef = useRef(pathname)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unreadIdsRef = useRef<Set<string>>(new Set())
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)

  useEffect(() => {
    pathRef.current = pathname
  }, [pathname])

  // Reseed when SSR sends a new initial count (e.g. after router.refresh or a
  // navigation that re-renders the header). Keeps the badge fresh without a socket.
  useEffect(() => {
    setUnreadCount(initialUnreadCount)
  }, [initialUnreadCount])

  useEffect(() => {
    // Only hold a Realtime connection open while in the messages area.
    if (!userId || !onMessages) return
    const supabase = createClient()
    let cancelled = false

    // Bootstrap the unread-id set so subsequent UPDATE events decrement
    // accurately even for messages that were already unread before mount.
    supabase
      .from('messages')
      .select('id')
      .is('read_at', null)
      .neq('sender_id', userId)
      .then(({ data }) => {
        if (cancelled || !data) return
        const set = new Set<string>(data.map((d) => d.id as string))
        unreadIdsRef.current = set
        setUnreadCount(set.size)
      })

    const channel = supabase
      .channel('chat-presence')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const m = payload.new as {
            id: string
            sender_id: string
            read_at: string | null
            delivered_at: string | null
          }

          if (pathRef.current === '/mensajes') {
            if (refreshTimer.current) clearTimeout(refreshTimer.current)
            refreshTimer.current = setTimeout(() => router.refresh(), 300)
          }

          if (m.sender_id === userId) return

          if (!m.read_at && !unreadIdsRef.current.has(m.id)) {
            unreadIdsRef.current.add(m.id)
            setUnreadCount((c) => c + 1)
          }

          if (!m.delivered_at) {
            await supabase
              .from('messages')
              .update({ delivered_at: new Date().toISOString() })
              .eq('id', m.id)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const m = payload.new as {
            id: string
            sender_id: string
            read_at: string | null
          }
          if (m.sender_id === userId) return
          if (m.read_at && unreadIdsRef.current.has(m.id)) {
            unreadIdsRef.current.delete(m.id)
            setUnreadCount((c) => Math.max(0, c - 1))
          }
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      supabase.removeChannel(channel)
    }
  }, [userId, onMessages, router])

  return (
    <ChatContext.Provider value={{ unreadCount }}>
      {children}
    </ChatContext.Provider>
  )
}
