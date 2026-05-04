'use client'

import { useState } from 'react'

interface Props {
  status: string
  rejectionReason: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: {
    label: 'En revisión',
    color: 'bg-yellow-500',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  approved: {
    label: 'Aprobado',
    color: 'bg-green-500',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  rejected: {
    label: 'Rechazado',
    color: 'bg-red-500',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
  missing_photos: {
    label: 'Faltan fotos',
    color: 'bg-orange-500',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
      </svg>
    ),
  },
  sold: {
    label: 'Vendido',
    color: 'bg-brand-500',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75" />
      </svg>
    ),
  },
  archived: {
    label: 'Archivado',
    color: 'bg-gray-400',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
  },
  draft: {
    label: 'Borrador',
    color: 'bg-gray-400',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
      </svg>
    ),
  },
}

export default function ProductStatusBlock({ status, rejectionReason }: Props) {
  const [showReason, setShowReason] = useState(false)
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft
  const isRejected = status === 'rejected' && rejectionReason

  return (
    <>
      {/* Inline label + optional note button (renders in current flex flow) */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-light text-gray-400">{config.label}</span>
        {isRejected && (
          <button
            type="button"
            onClick={() => setShowReason(true)}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Ver motivo de rechazo"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
              <rect x="4.5" y="3.5" width="15" height="17" rx="1.5" />
              <line x1="8" y1="8.5" x2="16" y2="8.5" strokeLinecap="round" />
              <line x1="8" y1="12" x2="16" y2="12" strokeLinecap="round" />
              <line x1="8" y1="15.5" x2="13" y2="15.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {/* Triangular vignette top-right (absolute, fixed to card corner) */}
      <div
        className="absolute top-0 right-0 w-16 h-16 pointer-events-none"
        aria-label={config.label}
      >
        <div
          className={`absolute inset-0 ${config.color} rounded-tr-lg`}
          style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 0)' }}
        />
        <div className="absolute top-1.5 right-1.5 text-white">
          {config.icon}
        </div>
      </div>

      {showReason && isRejected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowReason(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="font-body text-lg font-black text-gray-900">Motivo de rechazo</h3>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{rejectionReason}</p>
            <button
              onClick={() => setShowReason(false)}
              className="mt-5 w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-gray-800"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
