export const SKI_RACK_SIZES = ['S', 'M', 'L'] as const

export type SkiRackSize = (typeof SKI_RACK_SIZES)[number]

export interface SkiRackProduct {
  slug: string
  name: string
  material: string
  priceClp: number
  image: string
  imageAlt: string
  imageClassName: string
  gallery: Array<{ url: string; alt: string }>
}

export const SKI_RACK_DESCRIPTION =
  'Organiza y exhibe tus esquís de forma segura con Ski Rack. Su diseño minimalista mantiene el equipo ordenado y aprovecha mejor el espacio sin recargar el ambiente. Incluye un par de soportes para instalación mural.'

export const SKI_RACK_PRODUCTS: SkiRackProduct[] = [
  {
    slug: 'madera',
    name: 'Ski Rack Madera',
    material: 'Madera natural',
    priceClp: 11990,
    image: '/images/reski-rack-product.png',
    imageAlt: 'Ski Rack de madera natural',
    imageClassName: 'brightness-[1.015]',
    gallery: [
      {
        url: '/images/reski-rack-product.png',
        alt: 'Ski Rack de madera natural sobre fondo claro',
      },
      {
        url: '/images/default-racks.png',
        alt: 'Detalle de los soportes Ski Rack de madera',
      },
      {
        url: '/images/ski-rack-main.jpg',
        alt: 'Esquís organizados con Ski Rack en un muro',
      },
    ],
  },
  {
    slug: 'filamento',
    name: 'Ski Rack Filamento',
    material: 'Filamento',
    priceClp: 7990,
    image: '/images/reski-rack-filament.png',
    imageAlt: 'Ski Rack fabricado en filamento',
    imageClassName: '',
    gallery: [
      {
        url: '/images/reski-rack-filament.png',
        alt: 'Ski Rack negro fabricado en filamento sobre fondo claro',
      },
      {
        url: '/images/ski-rack-main.jpg',
        alt: 'Esquís organizados con Ski Rack en un muro',
      },
    ],
  },
]

export function getSkiRackProduct(slug: string): SkiRackProduct | undefined {
  return SKI_RACK_PRODUCTS.find((product) => product.slug === slug)
}
