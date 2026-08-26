'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface SessionAuth {
  userId: string | null
  email: string | null
  isAdmin: boolean
  avatarUrl: string | null
  name: string | null
  /** Undefined until the authenticated profile query settles. */
  phone: string | null | undefined
  /** Unread message count (0 until loaded / for anonymous). */
  unreadCount: number
  /** True until the first session check resolves. */
  loading: boolean
}

const ANON: SessionAuth = {
  userId: null,
  email: null,
  isAdmin: false,
  avatarUrl: null,
  name: null,
  phone: undefined,
  unreadCount: 0,
  loading: true,
}

/**
 * Subscribes to the browser session so public pages can stay statically/ISR
 * rendered (no server-side cookies()). Persisted identity is published as soon
 * as Supabase emits its initial local session; profile and unread metadata load
 * independently afterward. Repeated startup/token events are deduplicated.
 */
export function useSessionAuth(): SessionAuth {
  const [state, setState] = useState<SessionAuth>(ANON)

  useEffect(() => {
    const supabase = createClient()
    let active = true
    let initialized = false
    let currentUserId: string | null = null
    let generation = 0
    let profileLoadedFor: string | null = null
    let unreadLoadedFor: string | null = null
    let profileRequest: { userId: string; generation: number } | null = null
    let unreadRequest: { userId: string; generation: number } | null = null
    const deferred = new Set<ReturnType<typeof setTimeout>>()

    function defer(task: () => Promise<void>) {
      const timer = setTimeout(() => {
        deferred.delete(timer)
        void task()
      }, 0)
      deferred.add(timer)
    }

    function isCurrent(userId: string, requestGeneration: number) {
      return active && currentUserId === userId && generation === requestGeneration
    }

    function loadProfile(userId: string, force = false) {
      if (profileRequest?.userId === userId) return
      if (!force && profileLoadedFor === userId) return

      const request = { userId, generation }
      profileRequest = request

      // Supabase recommends deferring database work outside the auth callback.
      defer(async () => {
        try {
          if (!isCurrent(userId, request.generation)) return
          const { data: profile, error } = await supabase
            .from('users')
            .select('is_admin, avatar_url, name, phone')
            .eq('id', userId)
            .single()

          if (error || !isCurrent(userId, request.generation)) return
          profileLoadedFor = userId
          setState((previous) => previous.userId === userId
            ? {
                ...previous,
                isAdmin: profile?.is_admin ?? false,
                avatarUrl: profile?.avatar_url ?? null,
                name: profile?.name ?? null,
                phone: profile?.phone ?? null,
              }
            : previous)
        } finally {
          if (profileRequest === request) profileRequest = null
        }
      })
    }

    function loadUnreadCount(userId: string, force = false) {
      if (unreadRequest?.userId === userId) return
      if (!force && unreadLoadedFor === userId) return

      const request = { userId, generation }
      unreadRequest = request

      defer(async () => {
        try {
          if (!isCurrent(userId, request.generation)) return
          const { count, error } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .is('read_at', null)
            .neq('sender_id', userId)

          if (error || !isCurrent(userId, request.generation)) return
          unreadLoadedFor = userId
          setState((previous) => previous.userId === userId
            ? { ...previous, unreadCount: count ?? 0 }
            : previous)
        } finally {
          if (unreadRequest === request) unreadRequest = null
        }
      })
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      const user = session?.user ?? null

      if (!user) {
        if (!initialized || currentUserId !== null) {
          generation += 1
          currentUserId = null
          profileLoadedFor = null
          unreadLoadedFor = null
          profileRequest = null
          unreadRequest = null
          setState({ ...ANON, loading: false })
        }
        initialized = true
        return
      }

      const sameUser = initialized && currentUserId === user.id
      if (!sameUser) {
        generation += 1
        currentUserId = user.id
        profileLoadedFor = null
        unreadLoadedFor = null
        profileRequest = null
        unreadRequest = null
      }
      initialized = true

      // Identity comes directly from the persisted session and must not wait
      // for profile or message queries. Preserve already-enriched data when the
      // same session emits INITIAL_SESSION / SIGNED_IN again.
      setState((previous) => {
        const email = user.email ?? null
        if (sameUser && previous.email === email && !previous.loading) return previous
        return {
          userId: user.id,
          email,
          isAdmin: sameUser ? previous.isAdmin : false,
          avatarUrl: sameUser ? previous.avatarUrl : null,
          name: sameUser ? previous.name : null,
          phone: sameUser ? previous.phone : undefined,
          unreadCount: sameUser ? previous.unreadCount : 0,
          loading: false,
        }
      })

      loadProfile(user.id, event === 'USER_UPDATED')

      // A later SIGNED_IN can represent a refocused tab. Refresh only the
      // unread badge in that case; initial SIGNED_IN + INITIAL_SESSION events
      // share the same in-flight request and therefore stay deduplicated.
      const refreshUnread = sameUser && event === 'SIGNED_IN' && unreadLoadedFor === user.id
      loadUnreadCount(user.id, refreshUnread)
    })

    return () => {
      active = false
      deferred.forEach((timer) => clearTimeout(timer))
      deferred.clear()
      sub.subscription.unsubscribe()
    }
  }, [])

  return state
}

export interface Viewer {
  userId: string | null
  isAdmin: boolean
  loading: boolean
}

const ANON_VIEWER: Viewer = { userId: null, isAdmin: false, loading: true }

/**
 * Lightweight identity hook for pages that only need "who is viewing" (owner /
 * admin checks) without the unread-count query. Lets a cacheable page render
 * anonymously on the server and resolve owner/admin controls on the client.
 */
export function useViewer(): Viewer {
  const [v, setV] = useState<Viewer>(ANON_VIEWER)

  useEffect(() => {
    const supabase = createClient()
    let active = true

    async function load(user: { id: string } | null) {
      if (!user) {
        if (active) setV({ userId: null, isAdmin: false, loading: false })
        return
      }
      const { data } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
      if (active) setV({ userId: user.id, isAdmin: data?.is_admin ?? false, loading: false })
    }

    supabase.auth.getSession().then(({ data }) => load(data.session?.user ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      load(session?.user ?? null)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return v
}
