'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import TrackedLink from '@/components/TrackedLink'
import { useReducedExperience } from '@/lib/use-reduced-experience'
import styles from './HomeHero.module.css'

const slides = [
  {
    image: '/images/ski-rack-mounted-purple-square.jpg',
    alt: 'Esquís instalados con soportes Ski Rack sobre una pared de madera',
    lead: 'Tu equipo merece',
    title: 'un buen soporte.',
    copy: 'Guarda tus esquís con estilo. Soportes de madera natural, hechos en Chile.',
    href: '/ski-rack/madera',
    action: 'Comprar soportes de madera',
    label: 'Soportes de madera',
  },
  {
    image: '/images/3.png',
    alt: 'Dos esquiadores sosteniendo sus esquís entre árboles nevados',
    lead: 'Fin de temporada,',
    title: 'mejores precios.',
    copy: 'Aprovecha las rebajas de fin de temporada y prepara tu próxima subida.',
    href: '/#productos',
    action: 'Ver descuentos',
    label: 'Descuentos de fin de temporada',
  },
]

export default function HomeHero() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const reducedExperience = useReducedExperience()

  useEffect(() => {
    if (reducedExperience || paused) return
    const timer = window.setInterval(() => setActive(value => (value + 1) % slides.length), 6500)
    return () => window.clearInterval(timer)
  }, [reducedExperience, paused])

  const slide = slides[active]
  return (
    <section className={styles.hero} aria-roledescription="carrusel" aria-label="Soportes y ofertas de fin de temporada"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false) }}>
      <svg className={styles.clipDefinitions} width="0" height="0" aria-hidden="true" focusable="false">
        <defs><clipPath id="home-hero-photo-clip" clipPathUnits="objectBoundingBox">
          <path d="M .22 0 H .96 Q 1 0 1 .056 V .944 Q 1 1 .96 1 H .04 Q 0 1 .011 .94 L .165 .085 Q .176 0 .22 0 Z" />
        </clipPath></defs>
      </svg>
      <div className={styles.frame}>
        <figure className={styles.photo}>
          <Image src={slide.image} alt={slide.alt} fill priority={active === 0}
            sizes="(max-width: 820px) calc(100vw - 32px), 50vw" />
        </figure>
        <div className={styles.content}>
          <h1 id="home-hero-title" className={styles.title}>
            <span>{slide.lead}</span>{' '}<span className={styles.rotatingLine}>{slide.title}</span>
          </h1>
          <p className={styles.copy}>{slide.copy}</p>
          <div className={styles.actions}>
            <TrackedLink href={slide.href} event={active === 0 ? 'hero_soportes' : 'hero_descuentos'}
              className={`${styles.button} ${styles.primaryButton}`}>{slide.action}</TrackedLink>
          </div>
          <div className={styles.slideControls} aria-label="Diapositivas">
            {slides.map((item, index) => <button key={item.label} type="button"
              aria-label={item.label} aria-pressed={active === index} onClick={() => setActive(index)}
              className={active === index ? styles.activeDot : styles.dot} />)}
            {!reducedExperience && <button type="button" className={styles.pauseButton} onClick={() => setPaused(value => !value)}
              aria-label={paused ? 'Reanudar carrusel' : 'Pausar carrusel'}>{paused ? 'Reanudar' : 'Pausar'}</button>}
          </div>
        </div>
      </div>
    </section>
  )
}
