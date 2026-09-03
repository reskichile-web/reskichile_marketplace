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
  description?: string
  catalogVisible?: boolean
  image: string
  imageAlt: string
  imageClassName: string
  sizeImages: Record<SkiRackSize, SkiRackGalleryImage>
  gallery: SkiRackGalleryImage[]
}

export const SKI_RACK_DESCRIPTION =
  'Un par de soportes murales para ordenar y exhibir tus esquís de forma segura, con un diseño minimalista que aprovecha mejor el espacio.'

export function getSkiRackDescription(product: SkiRackProduct): string {
  if (product.description) return product.description
  return `Un par de soportes murales en ${product.material.toLowerCase()} para ordenar y exhibir tus esquís de forma segura. Instalación simple y diseño minimalista para aprovechar mejor el espacio. 🎿`
}

export const SKI_RACK_SIZE_GUIDE_IMAGES: SkiRackGalleryImage[] = [
  {
    url: '/images/ski-rack-size-guide-how-to.png',
    alt: 'Cómo medir el ancho de los esquís para escoger la talla de Ski Rack',
  },
  {
    url: '/images/ski-rack-size-guide-s.png',
    alt: 'Ski Rack talla S de 8,5 centímetros para esquís de pista',
  },
  {
    url: '/images/ski-rack-size-guide-m.png',
    alt: 'Ski Rack talla M de 10 centímetros para esquís all-mountain',
  },
  {
    url: '/images/ski-rack-size-guide-l.png',
    alt: 'Ski Rack talla L de 12 centímetros para esquís fuera de pista',
  },
]

const MOUNTED_PURPLE_SKIS_IMAGE: SkiRackGalleryImage = {
  url: '/images/ski-rack-mounted-purple-square.jpg',
  alt: 'Esquís Salomon morados instalados con Ski Rack sobre una pared de madera',
}

export const SKI_RACK_PRODUCTS: SkiRackProduct[] = [
  {
    slug: 'madera',
    name: 'Ski Rack Madera',
    material: 'Madera natural',
    priceClp: 17990,
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
      MOUNTED_PURPLE_SKIS_IMAGE,
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
    gallery: [MOUNTED_PURPLE_SKIS_IMAGE],
  },
  {
    slug: 'prueba-webpay-50',
    name: 'Ski Rack Prueba Webpay $50',
    material: 'Madera natural',
    priceClp: 50,
    description: 'Producto técnico de prueba solicitado por Transbank para validar Webpay Plus en producción.',
    catalogVisible: false,
    image: '/images/reski-rack-product.png',
    imageAlt: 'Ski Rack de madera para la prueba productiva de Webpay',
    imageClassName: 'brightness-[1.015]',
    sizeImages: {
      S: {
        url: '/images/reski-rack-product.png',
        alt: 'Ski Rack de madera para la prueba productiva de Webpay',
      },
      M: {
        url: '/images/reski-rack-product.png',
        alt: 'Ski Rack de madera para la prueba productiva de Webpay',
      },
      L: {
        url: '/images/reski-rack-product.png',
        alt: 'Ski Rack de madera para la prueba productiva de Webpay',
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
