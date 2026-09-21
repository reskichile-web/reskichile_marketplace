import { describe, expect, it } from 'vitest'
import {
  RACK_EVENT_LABELS,
  RACK_EVENTS,
  parseRackEventDetail,
  rackEventDetail,
} from '@/lib/rack-analytics'

describe('Ski Rack first-party analytics', () => {
  it('uses stable event names with admin labels', () => {
    expect(RACK_EVENTS.cartAdd).toBe('rack_cart_add')
    expect(RACK_EVENT_LABELS[RACK_EVENTS.purchase]).toBe('Compra confirmada')
  })

  it('round-trips compact cart metadata', () => {
    const encoded = rackEventDetail({
      slug: 'madera',
      size: 'M',
      qty: 5,
      cartQty: 5,
    })

    expect(encoded).toBe('slug=madera;size=M;qty=5;cartQty=5')
    expect(parseRackEventDetail(encoded)).toEqual({
      slug: 'madera',
      size: 'M',
      qty: '5',
      cartQty: '5',
    })
  })

  it('keeps metadata within the database limit and removes separators', () => {
    const encoded = rackEventDetail({ value: 'x;='.repeat(100) })
    expect(encoded.length).toBeLessThanOrEqual(100)
    expect(encoded.slice('value='.length)).not.toMatch(/[;=]/)
  })
})
