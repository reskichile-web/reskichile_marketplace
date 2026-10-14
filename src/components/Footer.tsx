import Link from 'next/link'
import SellTagIcon from './SellTagIcon'
import FeedbackWidget from './FeedbackWidget'
import { Instagram } from 'lucide-react'
import CookiePreferencesButton from './CookiePreferencesButton'

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-200 bg-white pb-24 text-gray-900 min-[821px]:pb-0">
      {/* Footer content */}
      <div className="text-gray-900">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 min-[821px]:py-16">
          <div className="text-center min-[821px]:mb-10 min-[821px]:border-b min-[821px]:border-gray-200 min-[821px]:pb-10">
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
          <div className="hidden grid-cols-4 gap-8 min-[821px]:grid">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <img src="/logo.svg" alt="ReskiChile" className="h-10" />
              <p className="text-gray-400 text-sm mt-4 leading-relaxed">
                El snowmarket de Chile. Compra y vende equipamiento de montaña usado.
              </p>
            </div>

            {/* Categorías */}
            <div>
              <h4 className="font-bold text-sm uppercase tracking-widest text-gray-400 mb-4">Categorías</h4>
              <div className="space-y-2">
                <Link href="/catalogo?product_type=esquis" className="block text-sm text-gray-600 hover:text-brand-500 transition-colors">Esquís</Link>
                <Link href="/catalogo?product_type=snowboards" className="block text-sm text-gray-600 hover:text-brand-500 transition-colors">Snowboards</Link>
                <Link href="/catalogo?product_type=botas_esqui" className="block text-sm text-gray-600 hover:text-brand-500 transition-colors">Botas</Link>
                <Link href="/catalogo?product_type=cascos" className="block text-sm text-gray-600 hover:text-brand-500 transition-colors">Cascos</Link>
                <Link href="/catalogo?product_type=parkas" className="block text-sm text-gray-600 hover:text-brand-500 transition-colors">Parkas</Link>
              </div>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-bold text-sm uppercase tracking-widest text-gray-400 mb-4">Reski</h4>
              <div className="space-y-2">
                <Link href="/catalogo" className="block text-sm text-gray-600 hover:text-brand-500 transition-colors">Catálogo</Link>
                <Link href="/vender" className="flex items-center gap-1.5 text-sm font-bold text-gray-600 hover:text-brand-500 transition-colors">
                  <SellTagIcon className="h-3.5 w-3.5" />
                  Vender
                </Link>
                <Link href="/auth/registro" className="block text-sm text-gray-600 hover:text-brand-500 transition-colors">Registrarse</Link>
              </div>
            </div>

            {/* Social */}
            <div>
              <h4 className="font-bold text-sm uppercase tracking-widest text-gray-400 mb-4">Síguenos</h4>
              <div className="space-y-2">
                <a href="https://instagram.com/reskichile" target="_blank" rel="noopener noreferrer" className="block text-sm text-gray-600 hover:text-brand-500 transition-colors">Instagram</a>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-center border-t border-gray-200 pt-5 min-[821px]:mt-10 min-[821px]:pt-7"><FeedbackWidget /></div>

          {/* Bottom */}
          <div className="border-t border-gray-200 mt-6 pt-5 flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-xs text-gray-500">&copy; 2026 ReskiChile. Todos los derechos reservados.</p>
            <div className="flex items-center gap-3">
              <CookiePreferencesButton />
              <span className="text-gray-700" aria-hidden="true">·</span>
              <Link href="/privacidad" className="text-xs text-gray-500 hover:text-gray-300 hover:underline">Privacidad</Link>
              <span className="text-gray-700" aria-hidden="true">·</span>
              <p className="text-xs text-gray-600">Hecho en Chile</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
