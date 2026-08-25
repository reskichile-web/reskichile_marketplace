'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface Viewer {
  userId: string | null
  isAdmin: boolean
  loading: boolean
}

const ANONYMOUS_VIEWER: Viewer = {
  userId: null,
  isAdmin: false,
  loading: true,
}

/**
 * Resolves the current viewer without allowing an older profile request to
 * restore permissions after SIGNED_OUT (or after switching accounts).
 *
 * Supabase publishes INITIAL_SESSION through onAuthStateChange, so using one
 * ordered event stream also avoids racing getSession() against SIGNED_OUT.
 */
export function useViewer(): Viewer {
  const [viewer, setViewer] = useState<Viewer>(ANONYMOUS_VIEWER)

  useEffect(() => {
    const supabase = createClient()
    let active = true
    let currentUserId: string | null = null
    let generation = 0
    let profileRequest: { userId: string; generation: number } | null = null
    const deferred = new Set<ReturnType<typeof setTimeout>>()

    function defer(task: () => Promise<void>) {
      const timer = setTimeout(() => {
        deferred.delete(timer)
        void task()
      }, 0)
      deferred.add(timer)
    }

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return

      const user = session?.user ?? null
      if (!user) {
        generation += 1
        currentUserId = null
        profileRequest = null
        setViewer({ userId: null, isAdmin: false, loading: false })
        return
      }

      const sameUser = currentUserId === user.id
      if (!sameUser) {
        generation += 1
        currentUserId = user.id
        profileRequest = null
      }

      setViewer((previous) => ({
        userId: user.id,
        isAdmin: sameUser && previous.userId === user.id ? previous.isAdmin : false,
        loading: false,
      }))

      if (profileRequest?.userId === user.id && profileRequest.generation === generation) return

      const request = { userId: user.id, generation }
      profileRequest = request

      // Supabase recommends moving database queries outside the auth callback.
      defer(async () => {
        try {
          if (!active || currentUserId !== request.userId || generation !== request.generation) return

          const { data } = await supabase
            .from('users')
            .select('is_admin')
            .eq('id', request.userId)
            .single()

          if (!active || currentUserId !== request.userId || generation !== request.generation) return

          setViewer((previous) => previous.userId === request.userId
            ? { ...previous, isAdmin: data?.is_admin ?? false }
            : previous)
        } finally {
          if (profileRequest === request) profileRequest = null
        }
      })
    })

    return () => {
      active = false
      deferred.forEach((timer) => clearTimeout(timer))
      deferred.clear()
      subscription.subscription.unsubscribe()
    }
  }, [])

  return viewer
}
