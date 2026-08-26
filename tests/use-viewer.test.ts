import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface ViewerState {
  userId: string | null
  isAdmin: boolean
  marketingConsent: {
    choice: 'granted' | 'denied'
    version: number
    decidedAt: number
  } | null
  loading: boolean
}

interface DeferredResponse {
  promise: Promise<Response>
  resolve: (value: Response) => void
}

type AuthCallback = (event: string, session: unknown) => void

const harness = vi.hoisted(() => {
  function deferredResponse(): DeferredResponse {
    let resolve!: DeferredResponse['resolve']
    const promise = new Promise<Response>((done) => {
      resolve = done
    })
    return { promise, resolve }
  }

  return {
    state: null as ViewerState | null,
    cleanup: null as (() => void) | null,
    authCallback: null as AuthCallback | null,
    requests: [] as DeferredResponse[],
    unsubscribe: vi.fn(),
    listeners: new Map<string, EventListener>(),
    deferredResponse,
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
    }
  },
}))

import { useViewer } from '@/lib/use-viewer'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('useViewer', () => {
  beforeEach(() => {
    harness.state = null
    harness.cleanup = null
    harness.authCallback = null
    harness.requests.length = 0
    harness.unsubscribe.mockClear()
    harness.listeners.clear()

    vi.stubGlobal('fetch', vi.fn(() => {
      const request = harness.deferredResponse()
      harness.requests.push(request)
      return request.promise
    }))
    vi.stubGlobal('window', {
      addEventListener: vi.fn((type: string, listener: EventListener) => {
        harness.listeners.set(type, listener)
      }),
      removeEventListener: vi.fn((type: string) => {
        harness.listeners.delete(type)
      }),
    })
  })

  afterEach(() => {
    harness.cleanup?.()
    vi.unstubAllGlobals()
  })

  it('only enables permissions returned by the server session', async () => {
    const initial = useViewer()
    expect(initial.loading).toBe(true)

    const marketingConsent = {
      choice: 'granted',
      version: 1,
      decidedAt: Date.now() - 1000,
    }
    harness.requests[0].resolve(jsonResponse({ userId: 'owner-1', isAdmin: true, marketingConsent }))
    await flushPromises()

    expect(harness.state).toEqual({
      userId: 'owner-1',
      isAdmin: true,
      marketingConsent,
      loading: false,
    })
  })

  it('settles an anonymous server session without private permissions', async () => {
    useViewer()
    harness.requests[0].resolve(jsonResponse({ userId: null, isAdmin: false }))
    await flushPromises()

    expect(harness.state).toEqual({ userId: null, isAdmin: false, marketingConsent: null, loading: false })
  })

  it('fails closed when the authoritative session request fails', async () => {
    useViewer()
    harness.requests[0].resolve(jsonResponse({ error: 'unavailable' }, 500))
    await flushPromises()

    expect(harness.state).toEqual({ userId: null, isAdmin: false, marketingConsent: null, loading: false })
  })

  it('removes permissions immediately and ignores an older response on logout', async () => {
    useViewer()

    harness.listeners.get('reski:logout')?.(new Event('reski:logout'))
    expect(harness.state).toEqual({ userId: null, isAdmin: false, marketingConsent: null, loading: false })

    harness.requests[0].resolve(jsonResponse({ userId: 'owner-1', isAdmin: true }))
    await flushPromises()

    expect(harness.state).toEqual({ userId: null, isAdmin: false, marketingConsent: null, loading: false })
  })

  it('removes permissions immediately when Supabase emits SIGNED_OUT', async () => {
    useViewer()
    harness.requests[0].resolve(jsonResponse({ userId: 'owner-1', isAdmin: false }))
    await flushPromises()
    expect(harness.state?.userId).toBe('owner-1')

    harness.authCallback?.('SIGNED_OUT', null)
    expect(harness.state).toEqual({
      userId: null,
      isAdmin: false,
      marketingConsent: null,
      loading: false,
    })
  })
})
