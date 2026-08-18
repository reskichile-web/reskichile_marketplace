import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { getCommerceJobSecret } from '@/lib/env/server'
import { processCommerceOutbox } from '@/lib/commerce/outbox-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(request: Request, secret: string): boolean {
  const actual = Buffer.from(request.headers.get('authorization') || '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export async function POST(request: Request) {
  try {
    const secret = getCommerceJobSecret()
    if (!authorized(request, secret)) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      )
    }
    const summary = await processCommerceOutbox(10)
    return NextResponse.json(
      { ok: true, ...summary },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json(
      { error: 'No se pudo procesar la cola de comercio' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
