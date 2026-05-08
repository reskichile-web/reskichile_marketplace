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
 * One global Realtime listener for the entire app, mounted once in the header.
 *
 * Responsibilities (free-tier-friendly: a single channel, never spawned
 * elsewhere):
 *
 * 1. Keep an accurate live unread-message count, exposed via {@link useUnreadCount}.
 *    The header SSR seeds the count; on mount we re-fetch the unread ids so
 *    decrements stay exact even when the SSR snapshot is stale.
 * 2. Mark `delivered_at` on incoming messages whose recipient is online but
 *    not on the conversation page (so the sender's "Entregado" check appears).
 * 3. Debounced router.refresh() when the user is on /mensajes so the SSR list
 *    re-renders shortly after a new message arrives.
 */
export default function ChatProvider({
  userId,
  initialUnreadCount,
  children,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const pathRef = useRef(pathname)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unreadIdsRef = useRef<Set<string>>(new Set())
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)

  useEffect(() => {
    pathRef.current = pathname
  }, [pathname])

  // Reseed when SSR sends a new initial count (e.g. after router.refresh).
  useEffect(() => {
    setUnreadCount(initialUnreadCount)
  }, [initialUnreadCount])

  useEffect(() => {
    if (!userId) return
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
  }, [userId, router])

  return (
    <ChatContext.Provider value={{ unreadCount }}>
      {children}
    </ChatContext.Provider>
  )
}
