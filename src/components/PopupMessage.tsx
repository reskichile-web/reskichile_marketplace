'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  message: string
  type?: 'error' | 'warning' | 'info'
  onClose: () => void
  autoClose?: number
}

export default function PopupMessage({ message, onClose, autoClose = 5000 }: Props) {
  useEffect(() => {
    if (autoClose > 0) {
      const timer = setTimeout(onClose, autoClose)
      return () => clearTimeout(timer)
    }
  }, [autoClose, onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

      {/* Popup */}
      <div
        className="relative bg-white rounded-xl shadow-xl w-full max-w-xs p-6 text-center"
        style={{ animation: 'popup-in 0.2s ease-out' }}
      >
        {/* Logo */}
        <img src="/logo.svg" alt="" className="h-6 mx-auto mb-5" />

        {/* Icon — triangle with ! */}
        <div className="flex justify-center mb-3">
          <svg className="w-10 h-10 text-gray-400" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L1 21h22L12 2z" fill="currentColor" opacity={0.1} stroke="currentColor" strokeWidth={1} strokeLinejoin="round" />
            <path d="M12 10v4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
            <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="currentColor" strokeWidth={1} />
          </svg>
        </div>

        {/* Message */}
        <p className="text-base text-gray-700 leading-relaxed">{message}</p>

        {/* Close */}
        <button
          onClick={onClose}
          className="mt-5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>,
    document.body
  )
}
