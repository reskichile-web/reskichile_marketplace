'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  userId: string
}

/**
 * Global Realtime listener mounted at the header level for any logged-in user.
 * Subscribes to ALL messages reachable by the user (RLS scopes them automatically)
 * and marks delivered_at = now() for every incoming message that doesn't have one.
 *
 * This is what makes "Entregado" work even when the conversation is not open:
 * - Sender inserts message → sent
 * - Recipient's any open tab sees the realtime INSERT → marks delivered_at
 * - Recipient eventually opens the chat → marks read_at (handled in ChatRoom)
 */
export default function ChatPresence({ userId }: Props) {
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
      supabase.removeChannel(channel)
    }
  }, [userId])

  return null
}
