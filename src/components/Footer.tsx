import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="mt-auto">
      {/* Image banner */}
      <div className="relative overflow-hidden h-[250px] md:h-[380px]">
        <img
          src="/images/clement-delhaye-cnluLIyhpBA-unsplash.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-[center_70%]"
        />
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white to-transparent" />
      </div>

      {/* Footer content */}
      <div className="bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-12 md:py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <img src="/logo.svg" alt="ReskiChile" className="h-10 brightness-0 invert" />
              <p className="text-gray-400 text-sm mt-4 leading-relaxed">
                El snowmarket de Chile. Compra y vende equipamiento de montaña usado.
              </p>
            </div>

            {/* Categorías */}
            <div>
              <h4 className="font-bold text-sm uppercase tracking-widest text-gray-400 mb-4">Categorías</h4>
              <div className="space-y-2">
                <Link href="/catalogo?product_type=esquis" className="block text-sm text-gray-300 hover:text-white transition-colors">Esquís</Link>
                <Link href="/catalogo?product_type=snowboards" className="block text-sm text-gray-300 hover:text-white transition-colors">Snowboards</Link>
                <Link href="/catalogo?product_type=botas_esqui" className="block text-sm text-gray-300 hover:text-white transition-colors">Botas</Link>
                <Link href="/catalogo?product_type=cascos" className="block text-sm text-gray-300 hover:text-white transition-colors">Cascos</Link>
                <Link href="/catalogo?product_type=parkas" className="block text-sm text-gray-300 hover:text-white transition-colors">Parkas</Link>
              </div>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-bold text-sm uppercase tracking-widest text-gray-400 mb-4">Reski</h4>
              <div className="space-y-2">
                <Link href="/catalogo" className="block text-sm text-gray-300 hover:text-white transition-colors">Catálogo</Link>
                <Link href="/vender" className="block text-sm text-gray-300 hover:text-white transition-colors">Vender</Link>
                <Link href="/auth/registro" className="block text-sm text-gray-300 hover:text-white transition-colors">Registrarse</Link>
              </div>
            </div>

            {/* Social */}
            <div>
              <h4 className="font-bold text-sm uppercase tracking-widest text-gray-400 mb-4">Síguenos</h4>
              <div className="space-y-2">
                <a href="https://instagram.com/reskichile" target="_blank" rel="noopener noreferrer" className="block text-sm text-gray-300 hover:text-white transition-colors">Instagram</a>
              </div>
            </div>
          </div>

          {/* Bottom */}
          <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-xs text-gray-500">&copy; 2026 ReskiChile. Todos los derechos reservados.</p>
            <p className="text-xs text-gray-600">Hecho en Chile</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
