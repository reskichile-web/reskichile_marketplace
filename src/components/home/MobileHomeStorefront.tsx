'use client'

import Image from 'next/image'
import Link from 'next/link'
import OfferCountdown from '@/components/OfferCountdown'
import { getSkiRackProduct } from '@/lib/ski-rack-products'
import { useRackInventory } from '@/lib/use-rack-inventory'
import { totalRackAvailability } from '@/lib/rack-inventory'
import { getPriceDrop } from '@/lib/price-drop'
import styles from './MobileHomeStorefront.module.css'

const money = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })

export default function MobileHomeStorefront() {
  const product = getSkiRackProduct('madera')!
  const { inventory, loading, error } = useRackInventory()
  const stock = inventory.madera
  const price = stock?.priceClp ?? product.priceClp
  const drop = getPriceDrop(price, product.previousPriceClp)
  const soldOut = !loading && !error && totalRackAvailability(stock) === 0

  return (
    <div className={styles.storefront}>
      <section className={styles.offer} aria-labelledby="mobile-offer-title">
        <h1 id="mobile-offer-title" className={styles.title}>Oferta<br /><span>limitada</span></h1>
        <p className={styles.subtitle}>{drop ? `${drop.percent}% OFF EN SOPORTES DE MADERA` : 'SOPORTES PARA TU EQUIPO DE MONTAÑA'}</p>
        <p className={styles.offerLabel}>Oferta termina en</p>
        <OfferCountdown />
      </section>
      <section className={styles.products} aria-label="Soportes de madera">
        <article>
          <Link href="/ski-rack" className={styles.photo}>
            <Image src="/images/ski-rack-madera-white-catalog.webp" alt={product.imageAlt} fill sizes="(max-width: 820px) calc(100vw - 40px), 520px" className={styles.productImage} />
            {soldOut && <span className={styles.soldOut}>Sin stock</span>}
          </Link>
          <h2 className={styles.productTitle}><Link href="/ski-rack">{product.name}</Link></h2>
          <p className={styles.price}>
            {drop && <del>{money.format(drop.previousPrice)}</del>}
            <strong>{money.format(price)}</strong>
          </p>
          <Link href="/ski-rack" className={styles.options}>Ver producto</Link>
        </article>
      </section>
    </div>
  )
}
