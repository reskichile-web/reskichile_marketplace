import OfferCountdown from './OfferCountdown'
import { ShoppingBag } from 'lucide-react'
import Link from 'next/link'

export default function MobileOfferBar() {
  return (
    <aside aria-label="Oferta de soportes" className="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-lg items-center justify-between gap-3 rounded-full border border-gray-200 bg-white/95 py-2 pl-5 pr-2 text-gray-900 shadow-lg backdrop-blur-md min-[821px]:hidden">
      <div className="min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-500">Oferta por tiempo limitado</p>
        <p className="mt-0.5 text-sm"><OfferCountdown compact /></p>
      </div>
      <Link href="/ski-rack" aria-label="Comprar soportes"
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-brand-500 px-4 text-xs font-bold text-white">
        <ShoppingBag className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" /> Compra ya
      </Link>
    </aside>
  )
}
