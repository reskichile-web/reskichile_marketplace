'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import CategoryIconBar from '@/components/CategoryIconBar'

const AnimatedLogo = dynamic(() => import('@/components/AnimatedLogo'), { ssr: false })

export default function AnimacionesPage() {
  const [selectedCategory, setSelectedCategory] = useState('esquis')

  return (
    <div className="max-w-7xl mx-auto mt-0 px-8 pt-4 pb-16">
      <div className="mb-8">
        <h1 className="font-body text-2xl font-black text-gray-900">Animaciones</h1>
        <p className="text-sm text-gray-500 mt-1">Preview y configuración de animaciones</p>
      </div>

      {/* Category Icon Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">Barra de categorías</h2>
        <div className="bg-gray-50 rounded-lg p-4">
          <CategoryIconBar selected={selectedCategory} onSelect={setSelectedCategory} />
        </div>
        <p className="mt-4 text-sm text-gray-500">
          Seleccionada: <span className="font-semibold text-gray-900">{selectedCategory}</span>
          — Animaciones: entrada stagger, hover wiggle, selección con dot animado
        </p>
      </div>

      {/* Logo Animation */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">Logo — Entrada cinematográfica</h2>
        <div className="bg-gray-50 rounded-lg p-12 flex items-center justify-center">
          <AnimatedLogo />
        </div>
        <div className="mt-4 text-sm text-gray-500 space-y-1">
          <p><span className="font-medium text-gray-700">Acto 1:</span> Esquiador entra deslizándose diagonal</p>
          <p><span className="font-medium text-gray-700">Acto 2:</span> Frena con bounce + partículas de nieve</p>
          <p><span className="font-medium text-gray-700">Acto 3:</span> Letras aparecen en stagger con efecto elástico</p>
        </div>
      </div>
    </div>
  )
}
