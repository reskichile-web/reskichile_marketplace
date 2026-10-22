'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Instagram } from 'lucide-react'

export default function HomeFooterIntro() {
  const pathname = usePathname()
  if (pathname !== '/') return null

  return (
    <div className="mb-6 border-b border-gray-200 pb-6 text-center min-[821px]:hidden">
      <p className="text-lg font-light leading-8 text-gray-700 md:text-xl">
        Encuentra <strong className="font-bold text-brand-500">tu próximo equipo.</strong><br />
        <strong className="font-bold text-gray-950">Publica gratis</strong> con nosotros.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm font-bold">
        <Link href="/catalogo" className="inline-flex h-12 items-center justify-center border border-gray-300 px-6 text-gray-700 transition-colors hover:border-brand-500 hover:text-brand-500">Ver catálogo</Link>
        <Link href="/vender" className="inline-flex h-12 items-center justify-center border border-brand-500 bg-brand-500 px-6 text-white transition-colors hover:bg-brand-600">Publicar equipo</Link>
      </div>
      <p className="mt-5 text-sm leading-6 text-gray-500">¿Necesitas ayuda para publicar?<br />Escríbenos directamente.</p>
      <a href="https://instagram.com/reskichile" target="_blank" rel="noopener noreferrer"
        aria-label="Hablar con ReskiChile en Instagram"
        className="mx-auto mt-3 inline-flex items-center justify-center gap-2 text-brand-500 transition-opacity hover:opacity-75">
        <Instagram className="h-6 w-6" strokeWidth={1.6} aria-hidden="true" />
        <span className="text-sm font-semibold">@reskichile</span>
      </a>
      <p className="mt-4 text-sm font-light italic text-gray-500">El <strong className="font-medium">snowmarket</strong> de Chile.</p>
    </div>
  )
}
