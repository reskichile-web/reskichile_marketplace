'use client'

import { useRouter } from 'next/navigation'

// Back arrow for the chat header. Uses browser history when there's a
// previous entry (so coming from /producto/X returns to that product),
// otherwise falls back to the messages list.
export default function ChatHeaderBack() {
  const router = useRouter()

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push('/mensajes')
    }
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label="Volver"
      className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
    >
      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  )
}
