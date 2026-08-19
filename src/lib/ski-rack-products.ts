export const SKI_RACK_SIZES = ['S', 'M', 'L'] as const

export type SkiRackSize = (typeof SKI_RACK_SIZES)[number]

export interface SkiRackGalleryImage {
  url: string
  alt: string
}

export interface SkiRackProduct {
  slug: string
  name: string
  material: string
  priceClp: number
  image: string
  imageAlt: string
  imageClassName: string
  sizeImages: Record<SkiRackSize, SkiRackGalleryImage>
  gallery: SkiRackGalleryImage[]
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
    sizeImages: {
      S: {
        url: '/images/reski-rack-product.png',
        alt: 'Ski Rack de madera natural talla S sobre fondo claro',
      },
      M: {
        url: '/images/ski-rack-madera-m.jpg',
        alt: 'Ski Rack de madera natural talla M sobre fondo claro',
      },
      L: {
        url: '/images/ski-rack-madera-l.jpg',
        alt: 'Ski Rack de madera natural talla L sobre fondo claro',
      },
    },
    gallery: [
      {
        url: '/images/ski-rack-madera-common-1.jpg',
        alt: 'Detalle cruzado de un par de soportes Ski Rack de madera',
      },
      {
        url: '/images/ski-rack-madera-common-2.jpg',
        alt: 'Comparación de las tres tallas de Ski Rack de madera',
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
    sizeImages: {
      S: {
        url: '/images/reski-rack-filament.png',
        alt: 'Ski Rack de filamento talla S sobre fondo claro',
      },
      M: {
        url: '/images/ski-rack-filamento-m.jpg',
        alt: 'Ski Rack de filamento talla M sobre fondo claro',
      },
      L: {
        url: '/images/ski-rack-filamento-l.jpg',
        alt: 'Ski Rack de filamento talla L sobre fondo claro',
      },
    },
    gallery: [],
  },
]

export function getSkiRackProduct(slug: string): SkiRackProduct | undefined {
  return SKI_RACK_PRODUCTS.find((product) => product.slug === slug)
}

export function getSkiRackSizeImage(
  product: SkiRackProduct,
  size: SkiRackSize,
): SkiRackGalleryImage {
  return product.sizeImages[size]
}

export function getSkiRackGalleryForSize(
  product: SkiRackProduct,
  size: SkiRackSize,
): SkiRackGalleryImage[] {
  return [getSkiRackSizeImage(product, size), ...product.gallery]
}
