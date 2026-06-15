import Link from 'next/link'
import type { ActionTokenView } from '@/lib/action-token'

const MESSAGES: Record<string, string> = {
  not_found: 'No encontramos este enlace.',
  used: 'Este enlace ya fue utilizado.',
  expired: 'Este enlace expiró.',
}

export default function InvalidTokenNotice({ state }: { state: ActionTokenView['state'] | 'gone' }) {
  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <h1 className="font-body text-2xl font-black text-gray-900 mb-3">Enlace no válido</h1>
        <p className="text-sm text-gray-500 mb-6">{MESSAGES[state] || 'Este enlace no es válido.'}</p>
        <Link href="/" className="inline-block bg-brand-500 text-white px-6 py-2.5 rounded-lg hover:bg-brand-600 text-sm font-medium">
          Ir al inicio
        </Link>
      </div>
    </div>
  )
}
