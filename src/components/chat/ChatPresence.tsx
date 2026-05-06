'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  userId: string
}

/**
 * Single global Realtime listener mounted in the header for every logged-in
 * user. We keep this to ONE channel because Supabase free tier has a tight
 * connection budget — adding extra channels per page exhausts the pool and
 * the tenant gets terminated, which kills every channel including the chat.
 *
 * Responsibilities:
 * - Mark delivered_at on incoming messages that don't have one (so the
 *   sender's "Entregado" check appears even when the recipient hasn't
 *   opened the conversation).
 * - When the user is on /mensajes (the conversation list), debounced
 *   router.refresh() triggers the SSR to re-fetch and update the list
 *   in near real-time without spinning up a second channel.
 */
export default function ChatPresence({ userId }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  // Refs so the channel callback (mounted once) always reads the latest values.
  const pathRef = useRef(pathname)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    pathRef.current = pathname
  }, [pathname])

  useEffect(() => {
    const supabase = createClient()
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
            delivered_at: string | null
          }
          // Refresh the conversation list when an incoming message arrives
          // and the user is currently looking at /mensajes.
          if (pathRef.current === '/mensajes') {
            if (refreshTimer.current) clearTimeout(refreshTimer.current)
            refreshTimer.current = setTimeout(() => router.refresh(), 300)
          }
          if (m.sender_id === userId) return
          if (m.delivered_at) return
          await supabase
            .from('messages')
            .update({ delivered_at: new Date().toISOString() })
            .eq('id', m.id)
        }
      )
      .subscribe()

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      supabase.removeChannel(channel)
    }
  }, [userId, router])

  return null
}
