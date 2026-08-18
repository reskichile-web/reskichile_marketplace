import Image from 'next/image'
import TrackedLink from '@/components/TrackedLink'
import RotatingWord from '@/components/RotatingWord'
import SellTagIcon from '@/components/SellTagIcon'
import styles from './HomeHero.module.css'

export default function HomeHero() {
  return (
    <section className={styles.hero} aria-labelledby="home-hero-title">
      <svg className={styles.clipDefinitions} width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id="home-hero-photo-clip" clipPathUnits="objectBoundingBox">
            <path d="M .22 0 H .96 Q 1 0 1 .056 V .944 Q 1 1 .96 1 H .04 Q 0 1 .011 .94 L .165 .085 Q .176 0 .22 0 Z" />
          </clipPath>
          <clipPath id="home-hero-photo-clip-mobile" clipPathUnits="objectBoundingBox">
            <path d="M .19 0 H .94 Q 1 0 1 .08 V .92 Q 1 1 .94 1 H .06 Q 0 1 .015 .9 L .13 .13 Q .142 0 .19 0 Z" />
          </clipPath>
        </defs>
      </svg>

      <div className={styles.frame}>
        <figure className={styles.photo}>
          <Image
            src="/images/3.png"
            alt="Dos esquiadores sosteniendo sus esquís entre árboles nevados"
            fill
            priority
            sizes="(max-width: 820px) calc(100vw - 32px), 50vw"
          />
        </figure>

        <div className={styles.content}>
          <h1 id="home-hero-title" className={styles.title}>
            <span className={styles.titleLead}>Encuentra lo mejor en</span>{' '}
            <span className={styles.rotatingLine}><RotatingWord /></span>
          </h1>
          <p className={styles.copy}>Mismo equipo, mejor precio. El snowmarket de Chile.</p>

          <div className={styles.actions}>
            <TrackedLink
              href="/catalogo"
              event="hero_explorar"
              className={styles.button}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
              </svg>
              <span>Explorar ofertas</span>
            </TrackedLink>
            <TrackedLink
              href="/vender"
              event="hero_publicar"
              className={`${styles.button} ${styles.primaryButton}`}
            >
              <SellTagIcon />
              <span>Publicar equipo</span>
            </TrackedLink>
          </div>
        </div>
      </div>
    </section>
  )
}
