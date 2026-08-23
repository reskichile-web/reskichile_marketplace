import Image from 'next/image'
import { PRODUCT_TYPES } from '@/lib/constants'
import styles from './AutomatedProductPost.module.css'
import ProductArtwork from './ProductArtwork'
import FitTitle from './FitTitle'
import FitPrice from './FitPrice'
import RiderArtwork from './RiderArtwork'

export interface AutomatedPostProduct {
  id: string
  slug: string | null
  product_type: string
  brand: string
  model: string | null
  price: number
  condition: string
  region: string
  comuna: string | null
  attributes: Record<string, unknown> | null
  product_images: { url: string; order: number }[]
}

const LONG_PRODUCT_TYPES = new Set(['esquis', 'snowboards', 'bastones'])

function firstValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return value[0] == null ? undefined : String(value[0])
  if (value == null || value === '') return undefined
  return String(value)
}

function humanize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

function genderFact(value: unknown): string | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined
  const genders = value.map(item => String(item))
  if (genders.includes('hombre') && genders.includes('mujer')) return 'UNISEX'
  return humanize(genders[0]).toUpperCase()
}

function booleanValue(value: unknown, yes: string, no: string): string | undefined {
  if (value === true) return yes
  if (value === false) return no
  return undefined
}

interface ProductFact {
  label: string
  value: string
}

function productFact(label: string, value: string | undefined): ProductFact | undefined {
  return value ? { label, value } : undefined
}

function productFacts(product: AutomatedPostProduct): ProductFact[] {
  const attributes = product.attributes || {}
  const facts: Array<ProductFact | undefined> = []
  const value = (key: string) => firstValue(attributes[key])

  switch (product.product_type) {
    case 'esquis':
      facts.push(
        productFact('LARGO', value('largo_cm') ? `${value('largo_cm')} CM` : undefined),
        productFact('ANCHO', value('ancho_mm') ? `${value('ancho_mm')} MM` : undefined),
        productFact('FIJACIONES', booleanValue(attributes.incluye_fijaciones, 'INCLUIDAS', 'NO INCLUIDAS')),
      )
      break
    case 'snowboards':
      facts.push(
        productFact('LARGO', value('largo') ? `${value('largo')} CM` : undefined),
        productFact('ANCHO', value('ancho') ? `${value('ancho')} CM` : undefined),
        productFact('FIJACIONES', booleanValue(attributes.incluye_fijaciones, 'INCLUIDAS', 'NO INCLUIDAS')),
      )
      break
    case 'botas_esqui':
      facts.push(
        productFact('TALLA', value('talla_mondo') ? `MONDO ${value('talla_mondo')}` : undefined),
        productFact('FLEX', value('flex')),
        productFact('PINES', booleanValue(attributes.incluye_pines, 'INCLUIDOS', 'NO INCLUIDOS')),
      )
      break
    case 'botas_snowboard':
      facts.push(
        productFact('TALLA', value('talla_cm') ? `${value('talla_cm')} CM` : undefined),
        productFact('CONEXIÓN', value('tipo_conexion_fijacion')?.toUpperCase()),
        productFact('GÉNERO', genderFact(attributes.genero)),
      )
      break
    case 'bastones':
      facts.push(
        productFact('LARGO', value('largo') ? `${value('largo')} CM` : undefined),
        productFact('TIPO', booleanValue(attributes.telescopicos, 'TELESCÓPICOS', 'LARGO FIJO')),
        productFact('GÉNERO', genderFact(attributes.genero)),
      )
      break
    case 'cascos':
      facts.push(
        productFact('TALLA', value('talla')?.toUpperCase()),
        productFact('RANGO', value('talla_cm') ? `${value('talla_cm')} CM` : undefined),
        productFact('COLOR', value('color')?.toUpperCase()),
      )
      break
    case 'parkas':
    case 'pantalones':
      facts.push(
        productFact('TALLA', value('talla')?.toUpperCase() || value('talla_numero')),
        productFact('AISLACIÓN', value('tipo_aislacion')?.toUpperCase()),
        productFact('GÉNERO', genderFact(attributes.genero)),
      )
      break
    case 'guantes':
      facts.push(
        productFact('TALLA', value('talla')?.toUpperCase()),
        productFact('GÉNERO', genderFact(attributes.genero)),
      )
      break
    case 'fijaciones':
      facts.push(
        productFact('CONEXIÓN', value('tipo_conexion')?.toUpperCase()),
        productFact('GÉNERO', genderFact(attributes.genero)),
      )
      break
    case 'antiparras':
      facts.push(
        productFact('TALLA', value('talla')?.toUpperCase()),
        productFact('LENTE', booleanValue(attributes.lente_intercambiable, 'INTERCAMBIABLE', 'FIJO')),
        productFact('GÉNERO', genderFact(attributes.genero)),
      )
      break
    case 'mochilas':
      facts.push(
        productFact('CAPACIDAD', value('capacidad_litros') ? `${value('capacidad_litros')} L` : undefined),
        productFact('USO', booleanValue(attributes.compartimiento_avalancha, 'AVALANCHA', 'GENERAL')),
        productFact('GÉNERO', genderFact(attributes.genero)),
      )
      break
    case 'bolsos':
      facts.push(
        productFact('CAPACIDAD', value('capacidad_litros') ? `${value('capacidad_litros')} L` : undefined),
        productFact('RUEDAS', booleanValue(attributes.tiene_ruedas, 'INCLUIDAS', 'SIN RUEDAS')),
        productFact('LARGO', value('largo') ? `${value('largo')} CM` : undefined),
      )
      break
    case 'equipo_avalanchas':
      facts.push(
        productFact('EQUIPO', value('tipo_equipo')?.toUpperCase()),
        productFact('USO', 'SEGURIDAD EN MONTAÑA'),
      )
      break
    case 'camaras_accion':
      facts.push(
        productFact('GRABACIÓN', value('tipo_grabacion')?.toUpperCase()),
        productFact('GÉNERO', genderFact(attributes.genero)),
      )
      break
  }

  const present = facts.filter((fact): fact is ProductFact => Boolean(fact))
  if (present.length < 2) present.push({ label: 'UBICACIÓN', value: product.region.toUpperCase() })
  return present.slice(0, 3)
}

export default function AutomatedProductPost({ product }: { product: AutomatedPostProduct }) {
  const title = [product.brand, product.model].filter(Boolean).join(' ')
  const category = PRODUCT_TYPES[product.product_type] || product.product_type
  const sortedImages = [...(product.product_images || [])].sort((a, b) => a.order - b.order)
  const productImage = sortedImages.find(image => /\.png(?:\?|$)/i.test(image.url))?.url || sortedImages[0]?.url
  const longProduct = LONG_PRODUCT_TYPES.has(product.product_type)
  const facts = productFacts(product)

  return (
    <div className={styles.viewport}>
      <article
        className={styles.poster}
        data-testid="ig-product-post"
        data-product-slug={product.slug || product.id}
        aria-label={`Publicación de ${title}`}
      >
        <div className={styles.background} aria-hidden="true">
          <Image
            src="/ig-assets/story-mountain-background-v1.png"
            alt=""
            fill
            priority
            sizes="1080px"
            className={styles.backgroundMaster}
          />
        </div>

        <Image
          src="/logo.svg"
          alt="ReskiChile"
          width={270}
          height={108}
          priority
          className={styles.logo}
        />

        {productImage && (
          <div className={`${styles.productShell} ${longProduct ? styles.productLong : styles.productCompact}`}>
            <ProductArtwork src={productImage} alt={title} longProduct={longProduct} />
          </div>
        )}

        <section className={styles.titleBlock} data-ig-title-block>
          <p className={styles.category}>{category}</p>
          <FitTitle>{title}</FitTitle>
        </section>

        <section
          className={`${styles.detailsBlock} ${facts.length <= 2 ? styles.detailsSparse : ''}`}
          data-ig-details-block
        >
          <FitPrice>{`$${product.price.toLocaleString('es-CL')}`}</FitPrice>
          <ul className={styles.facts} aria-label="Características destacadas">
            {facts.map((fact, index) => (
              <li key={`${fact.label}-${fact.value}-${index}`}>
                <span className={styles.factLabel}>{fact.label}</span>
                <span className={styles.factValue}>{fact.value}</span>
              </li>
            ))}
          </ul>
        </section>

        <div
          className={`${styles.riderShell} ${styles.riderSki}`}
          data-ig-rider
          aria-hidden="true"
        >
          <RiderArtwork
            src="/ig-assets/story-skier-rider-white-v1.png"
            transparentSource={false}
          />
        </div>
        <div className={styles.foregroundSnow} aria-hidden="true" />
        <p className={styles.sellerDisclaimer}>
          <span>Producto de vendedor independiente</span>
          <span>Publicado en www.reskichile.cl</span>
        </p>
      </article>
    </div>
  )
}
