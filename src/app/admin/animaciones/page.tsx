'use client'

import AnimatedLogo from '@/components/AnimatedLogo'

export default function AnimacionesPage() {
  return (
    <div className="max-w-7xl mx-auto mt-0 px-8 pt-4 pb-16">
      <div className="mb-8">
        <h1 className="font-body text-2xl font-black text-gray-900">Animaciones</h1>
        <p className="text-sm text-gray-500 mt-1">Preview y configuración de animaciones del logo</p>
      </div>

      {/* Preview area */}
      <div className="bg-white border border-gray-200 rounded-xl p-10">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-6">Logo — Entrada cinematográfica</h2>
        <div className="bg-gray-50 rounded-lg p-12 flex items-center justify-center">
          <AnimatedLogo />
        </div>
        <div className="mt-6 text-sm text-gray-500 space-y-1">
          <p><span className="font-medium text-gray-700">Acto 1:</span> Esquiador entra deslizándose diagonal (como bajando pendiente)</p>
          <p><span className="font-medium text-gray-700">Acto 2:</span> Frena con bounce + partículas de nieve</p>
          <p><span className="font-medium text-gray-700">Acto 3:</span> Letras aparecen en stagger con efecto elástico</p>
        </div>
      </div>
    </div>
  )
}
