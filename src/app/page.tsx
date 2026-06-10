export const revalidate = 60

import { Suspense } from 'react'
import RotatingWord from '@/components/RotatingWord'
import TrackedLink from '@/components/TrackedLink'
import CategoriesSection from '@/components/home/CategoriesSection'
import ProductsSection from '@/components/home/ProductsSection'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductGridSkeleton } from '@/components/skeletons/ProductCardSkeleton'

function CategoriesSkeleton() {
  return (
    <section className="max-w-[1000px] mx-auto px-4 md:px-6 pt-6 md:pt-10 pb-12 md:pb-20">
      <Skeleton className="h-4 w-28 mb-8" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-xl" />
        ))}
      </div>
    </section>
  )
}

function ProductsSkeleton() {
  return (
    <section className="max-w-7xl mx-auto px-4">
      <div className="py-3 md:py-4 border-b border-gray-200 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-8" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-16 rounded-full md:hidden" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="hidden md:block h-8 w-24 rounded-full" />
            ))}
          </div>
        </div>
      </div>
      <ProductGridSkeleton count={8} />
    </section>
  )
}

export default function HomePage() {
  return (
    <div className="relative">
      {/* Desktop background — viewport width, long bottom fade via mask */}
      <img
        src="https://images.unsplash.com/photo-1586357111879-28b152bdb01c?w=3840&q=85&auto=format&fit=crop"
        alt=""
        className="hidden md:block absolute inset-x-0 top-[70px] w-screen h-auto -z-10 pointer-events-none select-none opacity-70"
        style={{
          maskImage:
            'linear-gradient(to bottom, black 55%, transparent 100%), ' +
            'linear-gradient(to right, transparent 0%, black 50%), ' +
            'linear-gradient(to bottom, transparent 0%, black 2%), ' +
            'linear-gradient(to left, transparent 0%, black 25%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, black 55%, transparent 100%), ' +
            'linear-gradient(to right, transparent 0%, black 50%), ' +
            'linear-gradient(to bottom, transparent 0%, black 2%), ' +
            'linear-gradient(to left, transparent 0%, black 25%)',
          maskComposite: 'intersect',
          WebkitMaskComposite: 'source-in',
        }}
      />

      {/* Hero — static, renders instantly */}
      <section className="relative -mt-[96px] md:-mt-[131px]">
        <img
          src="/images/hero-mobile.jpeg"
          alt=""
          className="absolute -top-[5%] left-0 right-0 h-[160%] w-full object-cover object-top md:hidden"
          style={{
            maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
          }}
        />
        <div
          className="absolute -top-[5%] left-0 right-0 h-[160%] bg-white/65 md:hidden pointer-events-none"
          style={{
            maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
          }}
        />
        <div className="relative max-w-5xl mx-auto px-4 md:px-6 pt-[140px] md:pt-[220px] pb-16 md:pb-32">
        <h1 className="font-body text-3xl md:text-5xl lg:text-6xl font-black leading-[1.1] max-w-4xl text-black">
          Encuentra lo mejor en <RotatingWord />
        </h1>
        <p className="text-gray-900 text-xl md:text-2xl mt-6 leading-relaxed">
          Mismo equipo, mejor precio. <span className="whitespace-nowrap">El snowmarket de Chile.</span>
        </p>
        <div className="flex flex-row justify-center md:justify-start gap-3 sm:gap-4 mt-8 md:mt-10">
          <TrackedLink
            href="/catalogo"
            event="hero_explorar"
            className="shine-beam shine-beam-dark hover-wave pressable inline-flex items-center justify-center gap-1.5 md:gap-2.5 bg-brand-500 text-white hover:!text-brand-500 transition-colors duration-500 px-4 md:px-8 py-2.5 md:py-3.5 font-button font-bold tracking-wide shadow-sm text-xs md:text-base"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
            <span>Explorar ofertas</span>
          </TrackedLink>
          <TrackedLink
            href="/vender"
            event="hero_publicar"
            className="shine-beam shine-beam-delayed hover-wave hover-wave-inverse pressable inline-flex items-center justify-center gap-1.5 md:gap-2.5 border border-gray-900/15 bg-white/75 backdrop-blur-sm text-gray-700 hover:!text-white transition-colors duration-500 px-4 md:px-8 py-2.5 md:py-3.5 font-button font-bold tracking-wide text-xs md:text-base"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <span>Publicar equipo</span>
          </TrackedLink>
        </div>
        </div>
      </section>

      {/* Categories — streams in with skeleton fallback */}
      <Suspense fallback={<CategoriesSkeleton />}>
        <CategoriesSection />
      </Suspense>


      {/* Products — streams in with skeleton fallback */}
      <Suspense fallback={<ProductsSkeleton />}>
        <ProductsSection />
      </Suspense>
    </div>
  )
}
