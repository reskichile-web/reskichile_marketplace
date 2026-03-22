'use client'

import { useState, useEffect } from 'react'

const ACCESS_CODE = 'reski2026'

export default function ScreenLock({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = sessionStorage.getItem('reski_unlocked')
    if (stored === 'true') {
      setUnlocked(true)
    }
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (code === ACCESS_CODE) {
      setUnlocked(true)
      sessionStorage.setItem('reski_unlocked', 'true')
    } else {
      setError(true)
      setTimeout(() => setError(false), 1500)
      setCode('')
    }
  }

  if (!mounted) return null

  if (unlocked) return <>{children}</>

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center">
      {/* Background image */}
      <img
        src="/images/reskichile-bg.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />

      {/* Lock form */}
      <div className="relative text-center px-6">
        <img src="/logo.svg" alt="ReskiChile" className="h-16 mx-auto mb-8 brightness-0 invert" />
        <p className="text-white/70 text-sm mb-6">Ingresa el código de acceso</p>
        <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4">
          <input
            type="password"
            value={code}
            onChange={e => { setCode(e.target.value); setError(false) }}
            placeholder="Código"
            autoFocus
            className={`w-64 text-center bg-white/10 border ${error ? 'border-red-400 animate-shake' : 'border-white/20'} rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-white/50 transition-colors`}
          />
          <button
            type="submit"
            className="w-64 bg-brand-500 text-white py-3 rounded-lg font-medium hover:bg-brand-600 transition-colors"
          >
            Entrar
          </button>
          {error && (
            <p className="text-red-400 text-sm">Código incorrecto</p>
          )}
        </form>
      </div>
    </div>
  )
}
