import { describe, expect, it } from 'vitest'
import {
  productFacts,
  type AutomatedPostProduct,
} from '@/components/ig/AutomatedProductPost'

function product(overrides: Partial<AutomatedPostProduct> = {}): AutomatedPostProduct {
  return {
    id: 'product-1',
    slug: 'producto-prueba',
    product_type: 'bolsos',
    brand: 'Rossignol',
    model: 'Bolso para snowboard',
    price: 50_000,
    condition: 'usado_buen_estado',
    region: 'Metropolitana',
    comuna: 'Las Condes',
    attributes: {},
    product_images: [],
    ...overrides,
  }
}

describe('automated product post facts', () => {
  it('shows only intrinsic product attributes without location or condition fallbacks', () => {
    expect(productFacts(product({ attributes: { tiene_ruedas: false } }))).toEqual([
      { label: 'RUEDAS', value: 'SIN RUEDAS' },
    ])
  })

  it('leaves the facts empty when the product has no intrinsic attributes', () => {
    expect(productFacts(product())).toEqual([])
  })

  it('never uses BOA as a highlighted boot attribute', () => {
    expect(productFacts(product({
      product_type: 'botas_esqui',
      attributes: { boa: true },
    }))).toEqual([])
    expect(productFacts(product({
      product_type: 'botas_snowboard',
      attributes: { boa: false },
    }))).toEqual([])
  })

  it('shows the ski binding brand and model as an emphasized fact', () => {
    expect(productFacts(product({
      product_type: 'esquis',
      attributes: {
        largo_cm: 171,
        ancho_mm: 100,
        incluye_fijaciones: true,
        fijaciones_marca: 'Salomon',
        fijaciones_modelo: 'Shift²',
      },
    }))).toEqual([
      { label: 'LARGO', value: '171 CM' },
      { label: 'ANCHO', value: '100 MM' },
      { label: 'FIJACIONES', value: 'SALOMON SHIFT²', emphasized: true },
    ])
  })

  it('keeps a safe fallback when included ski bindings have no name', () => {
    expect(productFacts(product({
      product_type: 'esquis',
      attributes: { incluye_fijaciones: true },
    }))).toEqual([
      { label: 'FIJACIONES', value: 'INCLUIDAS' },
    ])
  })

  it('shows only the interchangeable-lens answer for goggles', () => {
    expect(productFacts(product({
      product_type: 'antiparras',
      attributes: {
        talla: 'M',
        genero: ['hombre', 'mujer'],
        lente_intercambiable: true,
      },
    }))).toEqual([
      { label: 'LENTE INTERCAMBIABLE', value: 'SÍ' },
    ])

    expect(productFacts(product({
      product_type: 'antiparras',
      attributes: { lente_intercambiable: false },
    }))).toEqual([
      { label: 'LENTE INTERCAMBIABLE', value: 'NO' },
    ])
  })

  it('keeps the long avalanche attribute as intrinsic content', () => {
    expect(productFacts(product({
      product_type: 'equipo_avalanchas',
      attributes: { tipo_equipo: 'Sonda' },
    }))).toEqual([
      { label: 'EQUIPO', value: 'SONDA' },
      { label: 'USO', value: 'SEGURIDAD EN MONTAÑA' },
    ])
  })
})
