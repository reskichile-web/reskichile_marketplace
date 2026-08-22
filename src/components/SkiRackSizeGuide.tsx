'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Info, X } from 'lucide-react'
import { SKI_RACK_SIZE_GUIDE_IMAGES } from '@/lib/ski-rack-products'

const SIZE_REFERENCES = [
  { size: 'S', width: 'Hasta 8,5 cm', use: 'Esquís de pista' },
  { size: 'M', width: '8,6 a 10 cm', use: 'Esquís all-mountain' },
  { size: 'L', width: '10,1 a 12 cm', use: 'Esquís fuera de pista' },
]

export default function SkiRackSizeGuide({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [current, setCurrent] = useState(0)
  const image = SKI_RACK_SIZE_GUIDE_IMAGES[current]

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  function showPrevious() {
    setCurrent((index) => (
      index === 0 ? SKI_RACK_SIZE_GUIDE_IMAGES.length - 1 : index - 1
    ))
  }

  function showNext() {
    setCurrent((index) => (index + 1) % SKI_RACK_SIZE_GUIDE_IMAGES.length)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-950/55 p-3 backdrop-blur-[1px] sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ski-rack-size-guide-title"
      aria-describedby="ski-rack-size-guide-note"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <h2 id="ski-rack-size-guide-title" className="font-body text-xl font-black text-gray-950">
            Guía de tallas
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-950"
            aria-label="Cerrar guía de tallas"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex items-start gap-4 bg-white" id="ski-rack-size-guide-note">
            <Info className="h-10 w-10 shrink-0 text-brand-400" strokeWidth={1.7} aria-hidden="true" />
            <p className="pt-0.5 text-xs italic leading-relaxed text-gray-600 sm:text-sm">
              Referencia orientativa, no oficial. La talla depende del ancho del esquí exactamente en la posición donde quieras instalar los soportes.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full border-collapse text-left text-xs sm:text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th scope="col" className="px-3 py-3 font-semibold sm:px-4">Talla</th>
                  <th scope="col" className="px-3 py-3 font-semibold sm:px-4">Ancho medido</th>
                  <th scope="col" className="px-3 py-3 font-semibold sm:px-4">Referencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800">
                {SIZE_REFERENCES.map((row) => (
                  <tr key={row.size}>
                    <th scope="row" className="px-3 py-3 font-black text-brand-500 sm:px-4">{row.size}</th>
                    <td className="px-3 py-3 font-medium sm:px-4">{row.width}</td>
                    <td className="px-3 py-3 text-gray-500 sm:px-4">{row.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-gray-100 bg-white">
              <Image
                key={image.url}
                src={image.url}
                alt={image.alt}
                fill
                sizes="(max-width: 767px) calc(100vw - 50px), 610px"
                className="object-contain"
              />

              <button
                type="button"
                onClick={showPrevious}
                className="absolute left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/95 text-gray-700 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-500"
                aria-label="Ver imagen anterior de la guía"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={showNext}
                className="absolute right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/95 text-gray-700 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-500"
                aria-label="Ver imagen siguiente de la guía"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-center gap-2" aria-label="Imagen de la guía de tallas">
              {SKI_RACK_SIZE_GUIDE_IMAGES.map((item, index) => (
                <button
                  key={item.url}
                  type="button"
                  onClick={() => setCurrent(index)}
                  className={`h-2 rounded-full transition-all ${
                    current === index ? 'w-6 bg-brand-500' : 'w-2 bg-gray-200 hover:bg-gray-300'
                  }`}
                  aria-label={`Ver imagen ${index + 1} de ${SKI_RACK_SIZE_GUIDE_IMAGES.length}`}
                  aria-pressed={current === index}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
