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
          <p className="mt-2">
            Cuando una URL incluye etiquetas UTM, conservamos en este navegador el origen, la campaña y la pieza publicitaria durante 30 días para relacionar una visita con un contacto posterior. No almacenamos el identificador publicitario <code>fbclid</code> en nuestra analítica interna.
          </p>
        </section>
        <section>
          <h2 className="font-body text-lg font-black text-gray-950">Contacto por WhatsApp</h2>
          <p className="mt-2">
            Cuando un vendedor habilita WhatsApp, una persona interesada puede iniciar el contacto aunque no tenga una cuenta de ReskiChile. El número se entrega al navegador únicamente después de que la persona pulsa el botón de contacto en una publicación aprobada; WhatsApp mostrará ese número al abrir la conversación.
          </p>
          <p className="mt-2">
            Para reducir usos abusivos aplicamos límites por visitante, dirección de red y publicación. Registramos el clic inicial y, si validamos el contacto, la derivación a WhatsApp para medir el funcionamiento del marketplace. ReskiChile no puede leer el mensaje en WhatsApp ni confirmar si finalmente fue enviado. Un vendedor con cuenta puede desactivar este canal desde su publicación.
          </p>
        </section>
        <section>
          <h2 className="font-body text-lg font-black text-gray-950">Cambiar tu decisión</h2>
          <p className="mt-2">
            Puedes aceptar o rechazar sin perder acceso al sitio. Si tienes una cuenta, guardamos la preferencia en ella para respetarla en otros dispositivos. Si navegas sin iniciar sesión, la conservamos en este navegador durante 180 días.
          </p>
          <p className="mt-2">
            La opción “Preferencias de cookies” del pie de página permite cambiar la decisión en cualquier momento.
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
