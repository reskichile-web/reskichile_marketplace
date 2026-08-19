import { describe, expect, it } from 'vitest'
import {
  CheckoutValidationError,
  checkoutFingerprint,
  parseCheckoutInput,
} from '@/lib/commerce/checkout-validation'

const checkout = {
  productIds: [],
  rackItems: [{ slug: 'madera', size: 'S', quantity: 2 }],
  idempotencyKey: '10000000-0000-4000-8000-000000000001',
  buyer: {
    name: '  Ana   Pérez ',
    email: 'ANA@EXAMPLE.COM',
    phone: '+56 9 1234 5678',
    phoneCountry: 'CL',
  },
  delivery: {
    method: 'home',
    region: 'Metropolitana de Santiago',
    commune: 'Las Condes',
    street: 'Apoquindo',
    number: '1234',
    extra: null,
    pickupPointId: null,
  },
  couponCode: 'welcome10',
}

describe('parseCheckoutInput', () => {
  it('normalizes a rack checkout without accepting client prices', () => {
    const parsed = parseCheckoutInput(checkout)
    expect(parsed.buyer).toEqual({
      name: 'Ana Pérez',
      email: 'ana@example.com',
      phone: '+56912345678',
      phoneCountry: 'CL',
    })
    expect(parsed.rackItems).toEqual([{ slug: 'madera', size: 'S', quantity: 2 }])
    expect(parsed.couponCode).toBe('WELCOME10')
    expect(parsed).not.toHaveProperty('totalClp')
  })

  it('rejects a mixed product and rack cart', () => {
    expect(() => parseCheckoutInput({
      ...checkout,
      productIds: ['20000000-0000-4000-8000-000000000001'],
    })).toThrow(CheckoutValidationError)
  })

  it('rejects duplicate variants and excessive quantities', () => {
    expect(() => parseCheckoutInput({
      ...checkout,
      rackItems: [
        { slug: 'madera', size: 'S', quantity: 1 },
        { slug: 'madera', size: 'S', quantity: 1 },
      ],
    })).toThrow('Una talla no puede repetirse')
    expect(() => parseCheckoutInput({
      ...checkout,
      rackItems: [
        { slug: 'madera', size: 'S', quantity: 10 },
        { slug: 'madera', size: 'M', quantity: 10 },
        { slug: 'madera', size: 'L', quantity: 1 },
      ],
    })).toThrow('máximo de unidades')
  })

  it.each([
    [{ ...checkout.buyer, phone: '912345678' }, 'país seleccionado'],
    [{ ...checkout.buyer, phone: '+56812345678' }, 'país seleccionado'],
    [{ name: checkout.buyer.name, email: checkout.buyer.email, phone: checkout.buyer.phone }, 'País del teléfono'],
    [{ ...checkout.buyer, phoneCountry: 'US' }, 'país seleccionado'],
  ])('rejects a manipulated phone payload', (buyer, message) => {
    expect(() => parseCheckoutInput({ ...checkout, buyer })).toThrow(message)
  })

  it('builds the same fingerprint regardless of rack line ordering', () => {
    const first = parseCheckoutInput({
      ...checkout,
      rackItems: [
        { slug: 'madera', size: 'S', quantity: 1 },
        { slug: 'filamento', size: 'M', quantity: 2 },
      ],
    })
    const second = parseCheckoutInput({
      ...checkout,
      rackItems: [...checkout.rackItems,
        { slug: 'filamento', size: 'M', quantity: 2 },
      ].slice(1).concat({ slug: 'madera', size: 'S', quantity: 1 }),
    })
    expect(checkoutFingerprint(first)).toBe(checkoutFingerprint(second))
    expect(checkoutFingerprint(first)).toMatch(/^[0-9a-f]{64}$/)
  })
})
