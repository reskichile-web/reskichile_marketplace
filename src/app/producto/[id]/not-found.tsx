import Link from 'next/link'
import { PackageX } from 'lucide-react'

export default function ProductNotFound() {
  return (
    <div className="max-w-md md:max-w-2xl mx-auto mt-16 px-4 text-center">
      <div className="flex items-center justify-center mb-6">
        <span className="flex items-center justify-center w-16 h-16 rounded-full bg-gray-100">
          <PackageX className="w-8 h-8 text-gray-400" strokeWidth={1.8} />
        </span>
      </div>

      <h1 className="font-body text-2xl font-black text-gray-900 mb-3 md:whitespace-nowrap">
        Este producto ya no está disponible
      </h1>
      <p className="text-gray-500 text-sm max-w-xs mx-auto sm:max-w-none mb-8">
        La publicación que buscas no existe, fue vendida o el vendedor la quitó.
        <br className="hidden md:block" />
        Revisa el catálogo para encontrar otros equipos.
      </p>

      <Link
        href="/catalogo"
        className="pressable inline-flex bg-brand-500 text-white px-6 py-2.5 rounded-none text-sm font-medium hover:bg-brand-600 transition-colors"
      >
        Volver al catálogo
      </Link>
    </div>
  )
}
