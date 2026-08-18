'use client'

import { useEffect, useState } from 'react'
import { useReducedExperience } from '@/lib/use-reduced-experience'

const SLIDES = [
  {
    desktopSrc:
      'https://images.unsplash.com/photo-1586357111879-28b152bdb01c?w=2400&q=82&auto=format&fit=crop',
    mobileSrc: '/images/hero-mobile.jpeg',
    label: 'Esquí en nieve polvo',
    positionClass: 'object-top md:object-[center_42%]',
  },
  {
    desktopSrc:
      'https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=2400&q=82&auto=format&fit=crop',
    mobileSrc:
      'https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=1000&q=80&auto=format&fit=crop',
    label: 'Bosque cubierto de nieve',
    positionClass: 'object-top',
  },
  {
    desktopSrc: '/images/clement-delhaye-cnluLIyhpBA-unsplash.jpg',
    mobileSrc: '/images/clement-delhaye-cnluLIyhpBA-unsplash.jpg',
    label: 'Travesía en la montaña',
    positionClass: 'object-[58%_center] md:object-center',
  },
] as const

const AUTOPLAY_DELAY = 6500

export default function HeroSlider() {
  const [activeSlide, setActiveSlide] = useState(0)
  const reducedExperience = useReducedExperience()

  useEffect(() => {
    if (reducedExperience) return

    const interval = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % SLIDES.length)
    }, AUTOPLAY_DELAY)

    return () => window.clearInterval(interval)
  }, [reducedExperience])

  return (
    <div className="absolute inset-0 z-0">
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {SLIDES.map((slide, index) => (
          <picture
            key={slide.label}
            className={`absolute inset-0 block transition-opacity duration-1000 ease-out motion-reduce:transition-none ${
              index === activeSlide ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <source media="(max-width: 767px)" srcSet={slide.mobileSrc} />
            <img
              src={slide.desktopSrc}
              alt=""
              loading={index === 0 ? 'eager' : 'lazy'}
              fetchPriority={index === 0 ? 'high' : 'auto'}
              className={`h-full w-full object-cover ${slide.positionClass}`}
            />
          </picture>
        ))}

        <div className="absolute inset-0 bg-white/35 md:hidden" />
        <div className="absolute inset-0 hidden bg-gradient-to-r from-white/75 via-white/35 to-transparent md:block" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent via-55% to-white" />
      </div>
    </div>
  )
}
