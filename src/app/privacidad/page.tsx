import Link from 'next/link'

export const metadata = {
  title: 'Privacidad y cookies | ReskiChile',
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 md:py-16">
      <h1 className="font-body text-3xl font-black text-gray-950">Privacidad y cookies</h1>
      <div className="mt-8 space-y-7 text-sm leading-7 text-gray-700">
        <section>
          <h2 className="font-body text-lg font-black text-gray-950">Cookies necesarias</h2>
          <p className="mt-2">
            ReskiChile utiliza almacenamiento y cookies propias para mantener sesiones, seguridad y funcionamiento básico del marketplace.
          </p>
        </section>
        <section>
          <h2 className="font-body text-lg font-black text-gray-950">Medición publicitaria</h2>
          <p className="mt-2">
            Si aceptas, cargamos Meta Pixel para saber si una visita llegó desde una campaña y medir acciones como páginas vistas o interés en productos. No activamos esta medición si rechazas.
          </p>
        </section>
        <section>
          <h2 className="font-body text-lg font-black text-gray-950">Cambiar tu decisión</h2>
          <p className="mt-2">
            Puedes aceptar o rechazar sin perder acceso al sitio. La opción “Preferencias de cookies” del pie de página permite cambiar la decisión en cualquier momento.
          </p>
        </section>
        <section>
          <h2 className="font-body text-lg font-black text-gray-950">Contacto</h2>
          <p className="mt-2">
            Para consultas sobre privacidad puedes utilizar los canales de contacto publicados por ReskiChile.
          </p>
        </section>
      </div>
      <Link href="/" className="mt-10 inline-block text-sm font-bold text-brand-600 hover:underline">
        Volver a ReskiChile
      </Link>
    </main>
  )
}
