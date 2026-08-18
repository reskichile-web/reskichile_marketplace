import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface AuthState {
  userId: string | null
  email: string | null
  isAdmin: boolean
  avatarUrl: string | null
  name: string | null
  unreadCount: number
  loading: boolean
}

interface QueryResult {
  data?: {
    is_admin?: boolean
    avatar_url?: string | null
    name?: string | null
  } | null
  count?: number | null
  error: { message: string } | null
}

interface Deferred {
  promise: Promise<QueryResult>
  resolve: (value: QueryResult) => void
}

type AuthCallback = (
  event: string,
  session: { user: { id: string; email?: string | null } } | null,
) => void

const harness = vi.hoisted(() => {
  function deferred(): Deferred {
    let resolve!: Deferred['resolve']
    const promise = new Promise<QueryResult>((done) => {
      resolve = done
    })
    return { promise, resolve }
  }

  return {
    state: null as AuthState | null,
    cleanup: null as (() => void) | null,
    authCallback: null as AuthCallback | null,
    profileRequests: [] as Deferred[],
    unreadRequests: [] as Deferred[],
    unsubscribe: vi.fn(),
    deferred,
  }
})

vi.mock('react', () => ({
  useState(initial: AuthState) {
    harness.state = initial
    const setState = (next: AuthState | ((previous: AuthState) => AuthState)) => {
      const previous = harness.state ?? initial
      harness.state = typeof next === 'function' ? next(previous) : next
    }
    return [harness.state, setState]
  },
  useEffect(effect: () => void | (() => void)) {
    harness.cleanup = effect() ?? null
  },
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient() {
    return {
      auth: {
        onAuthStateChange(callback: AuthCallback) {
          harness.authCallback = callback
          return {
            data: {
              subscription: { unsubscribe: harness.unsubscribe },
            },
          }
        },
      },
      from(table: string) {
        if (table === 'users') {
          return {
            select: () => ({
              eq: () => ({
                single: () => {
                  const request = harness.deferred()
                  harness.profileRequests.push(request)
                  return request.promise
                },
              }),
            }),
          }
        }

        if (table === 'messages') {
          return {
            select: () => ({
              is: () => ({
                neq: () => {
                  const request = harness.deferred()
                  harness.unreadRequests.push(request)
                  return request.promise
                },
              }),
            }),
          }
        }

        throw new Error(`Unexpected table: ${table}`)
      },
    }
  },
}))

import { useSessionAuth } from '@/lib/use-session-auth'

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
}

describe('useSessionAuth', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    harness.state = null
    harness.cleanup = null
    harness.authCallback = null
    harness.profileRequests.length = 0
    harness.unreadRequests.length = 0
    harness.unsubscribe.mockClear()
  })

  afterEach(() => {
    harness.cleanup?.()
    vi.useRealTimers()
  })

  it('publishes persisted identity immediately and deduplicates startup events', async () => {
    const initial = useSessionAuth()
    expect(initial.loading).toBe(true)

    const session = { user: { id: 'user-1', email: 'ski@example.com' } }
    harness.authCallback?.('SIGNED_IN', session)

    expect(harness.state).toMatchObject({
      userId: 'user-1',
      email: 'ski@example.com',
      loading: false,
      avatarUrl: null,
      unreadCount: 0,
    })

    // Supabase emits INITIAL_SESSION after recovering the same persisted user.
    harness.authCallback?.('INITIAL_SESSION', session)
    await vi.runAllTimersAsync()

    expect(harness.profileRequests).toHaveLength(1)
    expect(harness.unreadRequests).toHaveLength(1)

    harness.profileRequests[0].resolve({
      data: { is_admin: true, avatar_url: '/avatar.jpg', name: 'Andes' },
      error: null,
    })
    harness.unreadRequests[0].resolve({ count: 3, error: null })
    await flushPromises()

    expect(harness.state).toMatchObject({
      userId: 'user-1',
      isAdmin: true,
      avatarUrl: '/avatar.jpg',
      name: 'Andes',
      unreadCount: 3,
    })

    harness.authCallback?.('TOKEN_REFRESHED', session)
    harness.authCallback?.('INITIAL_SESSION', session)
    await vi.runAllTimersAsync()
    expect(harness.profileRequests).toHaveLength(1)
    expect(harness.unreadRequests).toHaveLength(1)

    // A later SIGNED_IN (for example, tab focus) refreshes only unread state.
    harness.authCallback?.('SIGNED_IN', session)
    await vi.runAllTimersAsync()
    expect(harness.profileRequests).toHaveLength(1)
    expect(harness.unreadRequests).toHaveLength(2)
  })

  it('does not let stale profile responses restore a user after logout', async () => {
    useSessionAuth()
    harness.authCallback?.('SIGNED_IN', {
      user: { id: 'user-1', email: 'ski@example.com' },
    })
    await vi.runAllTimersAsync()

    harness.authCallback?.('SIGNED_OUT', null)
    expect(harness.state).toMatchObject({ userId: null, loading: false })

    harness.profileRequests[0].resolve({
      data: { is_admin: true, avatar_url: '/stale.jpg', name: 'Stale' },
      error: null,
    })
    harness.unreadRequests[0].resolve({ count: 9, error: null })
    await flushPromises()

    expect(harness.state).toMatchObject({
      userId: null,
      avatarUrl: null,
      unreadCount: 0,
      loading: false,
    })
  })

  it('settles a genuinely anonymous session without database queries', async () => {
    useSessionAuth()
    harness.authCallback?.('INITIAL_SESSION', null)
    await vi.runAllTimersAsync()

    expect(harness.state).toMatchObject({ userId: null, loading: false })
    expect(harness.profileRequests).toHaveLength(0)
    expect(harness.unreadRequests).toHaveLength(0)
  })
})
