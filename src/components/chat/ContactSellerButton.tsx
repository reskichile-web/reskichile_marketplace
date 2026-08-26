'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { authRouteWithRedirect, currentBrowserAuthRedirect } from '@/lib/auth-redirect'

interface Props {
  productId: string
  isAuthenticated: boolean
  className?: string
}

export default function ContactSellerButton({ productId, isAuthenticated, className }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function start() {
    if (!isAuthenticated) {
      router.push(authRouteWithRedirect('/auth/login', currentBrowserAuthRedirect()))
      return
    }
    setLoading(true)
    setError('')
    const res = await fetch('/api/chat/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.conversation_id) {
      setError(data.error || 'No pudimos abrir el chat')
      setLoading(false)
      return
    }
    router.push(`/mensajes/${data.conversation_id}`)
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className="inline-flex items-center gap-2 bg-brand-500 text-white px-5 py-2.5 rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50 font-medium text-sm"
      >
        <MessageCircle className="w-4 h-4" />
        {loading ? 'Abriendo…' : 'Contactar al vendedor'}
      </button>
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  )
}
