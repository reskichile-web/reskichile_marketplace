import { describe, expect, it } from 'vitest'
import {
  computeBootCounts,
  normalizeFlex,
  normalizeMondoBand,
  passesBootFilters,
} from '@/lib/boot-filters'

describe('boot attribute normalization', () => {
  it.each([
    ['27.0-27.5', '27/27.5'],
    ['28 - 28.5', '28/28.5'],
    ['23,5', '23/23.5'],
    ['23.3', '23/23.5'],
    ['18.5', '18/18.5'],
    ['40-41', null],
    ['10 US', null],
  ])('normalizes %s into a canonical Mondo band', (input, expected) => {
    expect(normalizeMondoBand(input)).toBe(expected)
  })

  it.each([
    ['100-110', '105'],
    ['130-140', '135'],
    ['95', '95'],
    ['101', '100'],
    ['not specified', null],
  ])('normalizes flex %s to a five-point step', (input, expected) => {
    expect(normalizeFlex(input)).toBe(expected)
  })
})

describe('boot catalog filters', () => {
  const products = [
    {
      product_type: 'botas_esqui',
      attributes: {
        talla_mondo: '27/27.5',
        flex: '105',
        genero: ['hombre'],
        boa: true,
      },
    },
    {
      product_type: 'botas_esqui',
      attributes: {
        talla_mondo: '27/27.5',
        flex: '120',
        genero: ['unisex'],
        boa: false,
      },
    },
  ]

  it('counts only canonical values present in inventory', () => {
    expect(computeBootCounts(products)).toMatchObject({
      size: { '27/27.5': 2 },
      flex: { '105': 1, '120': 1 },
      gender: { hombre: 1, unisex: 1 },
      boaYes: 1,
      boaNo: 1,
    })
  })

  it('combines size, flex, gender and BOA filters', () => {
    expect(passesBootFilters(products[0].attributes, {
      size: ['27/27.5'],
      flex: ['105'],
      gender: ['hombre'],
      boa: 'yes',
    })).toBe(true)

    expect(passesBootFilters(products[0].attributes, {
      size: ['27/27.5'],
      flex: ['120'],
      gender: [],
      boa: '',
    })).toBe(false)
  })
})
