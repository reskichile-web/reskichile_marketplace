'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface SessionAuth {
  userId: string | null
  email: string | null
  isAdmin: boolean
  avatarUrl: string | null
  name: string | null
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
  unreadCount: 0,
  loading: true,
}

/**
 * Reads the auth session on the client so public pages can stay statically/ISR
 * rendered (no server-side cookies()). getSession() is a local cookie read (no
 * network); only when a session exists do we fetch the profile + unread count.
 * Re-runs on auth state changes (login/logout in another tab, token refresh).
 */
export function useSessionAuth(): SessionAuth {
  const [state, setState] = useState<SessionAuth>(ANON)

  useEffect(() => {
    const supabase = createClient()
    let active = true

    async function load(user: { id: string; email?: string | null } | null) {
      if (!user) {
        if (active) setState({ ...ANON, loading: false })
        return
      }
      const [{ data: profile }, { count }] = await Promise.all([
        supabase.from('users').select('is_admin, avatar_url, name').eq('id', user.id).single(),
        supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .is('read_at', null)
          .neq('sender_id', user.id),
      ])
      if (!active) return
      setState({
        userId: user.id,
        email: user.email ?? null,
        isAdmin: profile?.is_admin ?? false,
        avatarUrl: profile?.avatar_url ?? null,
        name: profile?.name ?? null,
        unreadCount: count ?? 0,
        loading: false,
      })
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
