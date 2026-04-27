import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ski Rack - ReskiChile',
}

export default function SkiRackPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <h1 className="font-body font-extrabold italic text-5xl md:text-8xl text-black tracking-tight select-none">
        SKI-RACK
      </h1>
    </div>
  )
}
