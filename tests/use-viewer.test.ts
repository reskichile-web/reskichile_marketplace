import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface ViewerState {
  userId: string | null
  isAdmin: boolean
  loading: boolean
}

interface QueryResult {
  data?: { is_admin?: boolean } | null
  error: { message: string } | null
}

interface Deferred {
  promise: Promise<QueryResult>
  resolve: (value: QueryResult) => void
}

type AuthCallback = (
  event: string,
  session: { user: { id: string } } | null,
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
    state: null as ViewerState | null,
    cleanup: null as (() => void) | null,
    authCallback: null as AuthCallback | null,
    profileRequests: [] as Deferred[],
    unsubscribe: vi.fn(),
    deferred,
  }
})

vi.mock('react', () => ({
  useState(initial: ViewerState) {
    harness.state = initial
    const setState = (next: ViewerState | ((previous: ViewerState) => ViewerState)) => {
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
        if (table !== 'users') throw new Error(`Unexpected table: ${table}`)
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
      },
    }
  },
}))

import { useViewer } from '@/lib/use-viewer'

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
}

describe('useViewer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    harness.state = null
    harness.cleanup = null
    harness.authCallback = null
    harness.profileRequests.length = 0
    harness.unsubscribe.mockClear()
  })

  afterEach(() => {
    harness.cleanup?.()
    vi.useRealTimers()
  })

  it('publishes the authenticated identity immediately', async () => {
    const initial = useViewer()
    expect(initial.loading).toBe(true)

    harness.authCallback?.('INITIAL_SESSION', { user: { id: 'owner-1' } })
    expect(harness.state).toEqual({ userId: 'owner-1', isAdmin: false, loading: false })

    await vi.runAllTimersAsync()
    harness.profileRequests[0].resolve({ data: { is_admin: true }, error: null })
    await flushPromises()

    expect(harness.state).toEqual({ userId: 'owner-1', isAdmin: true, loading: false })
  })

  it('does not let a stale profile response restore owner permissions after logout', async () => {
    useViewer()
    harness.authCallback?.('INITIAL_SESSION', { user: { id: 'owner-1' } })
    await vi.runAllTimersAsync()

    harness.authCallback?.('SIGNED_OUT', null)
    expect(harness.state).toEqual({ userId: null, isAdmin: false, loading: false })

    harness.profileRequests[0].resolve({ data: { is_admin: true }, error: null })
    await flushPromises()

    expect(harness.state).toEqual({ userId: null, isAdmin: false, loading: false })
  })

  it('settles an anonymous initial session without querying a profile', async () => {
    useViewer()
    harness.authCallback?.('INITIAL_SESSION', null)
    await vi.runAllTimersAsync()

    expect(harness.state).toEqual({ userId: null, isAdmin: false, loading: false })
    expect(harness.profileRequests).toHaveLength(0)
  })
})
