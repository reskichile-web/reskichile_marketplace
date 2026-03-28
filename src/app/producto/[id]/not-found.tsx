import Link from 'next/link'

export default function ProductNotFound() {
  return (
    <div className="max-w-md mx-auto mt-16 px-4 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      </div>
      <h1 className="font-body text-2xl font-black text-gray-900 mb-2">Producto no encontrado</h1>
      <p className="text-gray-500 text-sm mb-8">
        Este producto puede haber sido eliminado o el enlace es incorrecto.
      </p>
      <div className="flex gap-3 justify-center">
        <Link href="/catalogo" className="bg-brand-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
          Ver catalogo
        </Link>
        <Link href="/" className="border border-gray-200 px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
          Inicio
        </Link>
      </div>
    </div>
  )
}
