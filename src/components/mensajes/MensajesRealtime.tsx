'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  userId: string
}

/**
 * Mounts on /mensajes (the conversation list) and subscribes to live changes
 * to the user's conversations. The "messages_touch_conversation" trigger keeps
 * conversations.last_message_at in sync with new messages, so a single
 * subscription on conversations covers both new-message and new-conversation
 * cases. We debounce events so a burst of changes only triggers one refresh.
 */
export default function MensajesRealtime({ userId }: Props) {
  const router = useRouter()
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()

    function scheduleRefresh() {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => {
        router.refresh()
      }, 300)
    }

    const buyerChannel = supabase
      .channel(`mensajes-buyer:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `buyer_id=eq.${userId}`,
        },
        scheduleRefresh
      )
      .subscribe()

    const sellerChannel = supabase
      .channel(`mensajes-seller:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `seller_id=eq.${userId}`,
        },
        scheduleRefresh
      )
      .subscribe()

    function onFocus() {
      router.refresh()
    }
    window.addEventListener('focus', onFocus)

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      supabase.removeChannel(buyerChannel)
      supabase.removeChannel(sellerChannel)
      window.removeEventListener('focus', onFocus)
    }
  }, [router, userId])

  return null
}
