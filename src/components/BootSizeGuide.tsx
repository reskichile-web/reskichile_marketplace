'use client'

import { useEffect, useState } from 'react'
import { Ruler, X } from 'lucide-react'

const SKI_ROWS = [
  ['18/18.5', '11–11.5 junior', '18.0–18.9'],
  ['19/19.5', '12–12.5 junior', '19.0–19.9'],
  ['20/20.5', '13 junior–1', '20.0–20.9'],
  ['21/21.5', '2–3', '21.0–21.9'],
  ['22/22.5', '3.5–4', '22.0–22.9'],
  ['23/23.5', '4.5–5', '23.0–23.9'],
  ['24/24.5', '6–6.5', '24.0–24.9'],
  ['25/25.5', '7–7.5', '25.0–25.9'],
  ['26/26.5', '8–8.5', '26.0–26.9'],
  ['27/27.5', '9–10', '27.0–27.9'],
  ['28/28.5', '10.5–11', '28.0–28.9'],
  ['29/29.5', '11.5–12', '29.0–29.9'],
  ['30/30.5', '13–13.5', '30.0–30.9'],
]

const SNOW_ROWS = [
  ['23/23.5', '5–5.5', '6–6.5', '23.0–23.9'],
  ['24/24.5', '6–6.5', '7–7.5', '24.0–24.9'],
  ['25/25.5', '7–7.5', '8–8.5', '25.0–25.9'],
  ['26/26.5', '8–8.5', '9–9.5', '26.0–26.9'],
  ['27/27.5', '9–9.5', '10–10.5', '27.0–27.9'],
  ['28/28.5', '10–10.5', '11', '28.0–28.9'],
  ['29/29.5', '11–11.5', '—', '29.0–29.9'],
  ['30/30.5', '12', '—', '30.0–30.9'],
  ['31/31.5', '13', '—', '31.0–31.9'],
  ['32/32.5', '14', '—', '32.0–32.9'],
  ['33/33.5', '15', '—', '33.0–33.9'],
]

export default function BootSizeGuide({
  kind,
  compact = false,
}: {
  kind: 'ski' | 'snowboard'
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex shrink-0 items-center font-bold text-brand-500 hover:text-brand-600 ${
          compact ? 'gap-1 text-[11px]' : 'mb-3 gap-1.5 text-xs'
        }`}
      >
        <Ruler className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" />
        Guía de tallas
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-gray-950/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="boot-size-guide-title"
          onMouseDown={() => setOpen(false)}
        >
          <div
            className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="boot-size-guide-title" className="font-body text-2xl font-black text-gray-950">
                  Guía de tallas
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-gray-500">
                  Mide el pie desde el talón hasta el dedo más largo. La equivalencia US es referencial y puede variar según la marca.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar guía de tallas"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full table-fixed text-left text-xs sm:text-sm">
                <thead className="bg-gray-50 font-body text-[10px] font-bold uppercase tracking-wider text-gray-500 sm:text-xs">
                  {kind === 'ski' ? (
                    <tr>
                      <th className="px-3 py-3">Mondo</th>
                      <th className="px-3 py-3">US aprox.</th>
                      <th className="px-3 py-3">Pie (cm)</th>
                    </tr>
                  ) : (
                    <tr>
                      <th className="px-2 py-3 sm:px-3">Mondo</th>
                      <th className="px-2 py-3 sm:px-3">US H</th>
                      <th className="px-2 py-3 sm:px-3">US M</th>
                      <th className="px-2 py-3 sm:px-3">Pie (cm)</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {(kind === 'ski' ? SKI_ROWS : SNOW_ROWS).map(row => (
                    <tr key={row[0]}>
                      {row.map((cell, index) => (
                        <td key={`${row[0]}-${index}`} className={`px-2 py-2.5 sm:px-3 ${index === 0 ? 'font-bold text-gray-950' : ''}`}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
