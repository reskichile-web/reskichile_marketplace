'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { createPortal } from 'react-dom'
import { BLUR_DATA_URL } from '@/lib/image-utils'

interface Props {
  images: { url: string; order: number }[]
  title: string
}

// ─── Desktop zoom modal ─────────────────────────────────────────────────────

function ZoomModal({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [zoomed, setZoomed] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const didDrag = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  function handlePointerDown(e: React.PointerEvent) {
    if (!zoomed) return
    e.preventDefault()
    isDragging.current = true
    didDrag.current = false
    lastPos.current = { x: e.clientX, y: e.clientY }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!isDragging.current) return
    didDrag.current = true
    setOffset(prev => ({
      x: prev.x + (e.clientX - lastPos.current.x),
      y: prev.y + (e.clientY - lastPos.current.y),
    }))
    lastPos.current = { x: e.clientX, y: e.clientY }
  }

  function handlePointerUp() {
    isDragging.current = false
  }

  function handleClick() {
    if (didDrag.current) {
      didDrag.current = false
      return
    }
    if (zoomed) {
      setZoomed(false)
      setOffset({ x: 0, y: 0 })
    } else {
      setZoomed(true)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-black/70 flex items-center justify-center">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/40 text-xs z-10 pointer-events-none">
        {zoomed ? 'Arrastra para mover · Click para alejar' : 'Click para acercar'}
      </div>

      {/* Click outside image to close */}
      <div
        className="absolute inset-0 z-0"
        onClick={onClose}
      />

      <div
        className="relative z-[1] flex items-center justify-center overflow-hidden select-none"
        style={{ cursor: zoomed ? (isDragging.current ? 'grabbing' : 'grab') : 'zoom-in' }}
        onClick={(e) => { e.stopPropagation(); handleClick() }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <img
          src={src}
          alt={alt}
          className="max-h-[90vh] max-w-[90vw] object-contain transition-transform duration-200"
          style={{
            transform: zoomed
              ? `scale(2.5) translate(${offset.x / 2.5}px, ${offset.y / 2.5}px)`
              : 'scale(1)',
          }}
          draggable={false}
        />
      </div>
    </div>,
    document.body
  )
}

// ─── Image with loading/error state ──────────────────────────────────────────

function GalleryImage({ src, alt, priority }: { src: string; alt: string; priority?: boolean }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  return (
    <>
      {/* Loading spinner — visible until image loads */}
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-[1]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
            <span className="text-xs text-gray-400">Cargando imagen...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-[1]">
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
            </svg>
            <span className="text-xs">No se pudo cargar</span>
          </div>
        </div>
      )}

      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes="(max-width: 768px) 100vw, 50vw"
        className={`object-contain pointer-events-none transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        placeholder="blur"
        blurDataURL={BLUR_DATA_URL}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </>
  )
}

// ─── Main gallery ───────────────────────────────────────────────────────────

export default function ProductGallery({ images, title }: Props) {
  const [current, setCurrent] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const touchRef = useRef({ startX: 0, startY: 0, locked: false, isHorizontal: false })

  useEffect(() => { setMounted(true) }, [])

  function goTo(i: number) {
    setCurrent(Math.max(0, Math.min(i, images.length - 1)))
    setDragX(0)
  }

  // ─── Touch (single finger only — 2+ fingers = pinch zoom, ignore) ───
  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length > 1) return // pinch zoom — don't interfere
    const t = e.touches[0]
    touchRef.current = { startX: t.clientX, startY: t.clientY, locked: false, isHorizontal: false }
    setSwiping(false)
    setDragX(0)
  }

  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length > 1) { // pinch zoom started mid-swipe — cancel
      if (swiping) { setSwiping(false); setDragX(0) }
      return
    }
    if (images.length <= 1) return
    const t = e.touches[0]
    const dx = t.clientX - touchRef.current.startX
    const dy = t.clientY - touchRef.current.startY

    if (!touchRef.current.locked) {
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        touchRef.current.locked = true
        touchRef.current.isHorizontal = Math.abs(dx) > Math.abs(dy)
      }
      return
    }

    if (!touchRef.current.isHorizontal) return
    e.preventDefault()
    setSwiping(true)
    setDragX(dx)
  }

  function onTouchEnd() {
    if (!swiping) return

    const threshold = 25
    if (dragX < -threshold && current < images.length - 1) {
      setCurrent(current + 1)
    } else if (dragX > threshold && current > 0) {
      setCurrent(current - 1)
    }
    setDragX(0)
    setSwiping(false)
  }

  function handleImageClick() {
    if (swiping) return
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      setModalOpen(true)
    }
  }

  if (images.length === 0) {
    return (
      <div className="aspect-[4/5] bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
        Sin fotos
      </div>
    )
  }

  const w = containerRef.current?.clientWidth || 0
  const tx = swiping ? -current * w + dragX : -current * w

  return (
    <div>
      <div
        ref={containerRef}
        className="relative aspect-[4/5] bg-white rounded-lg overflow-hidden border border-gray-100"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Track */}
        <div
          className="absolute top-0 left-0 h-full flex"
          style={{
            width: w > 0 ? images.length * w : `${images.length * 100}%`,
            transform: w > 0 ? `translateX(${tx}px)` : `translateX(-${current * 100}%)`,
            transition: swiping ? 'none' : 'transform 0.25s ease-out',
          }}
        >
          {images.map((img, i) => (
            <div
              key={img.url}
              className="relative h-full bg-white"
              style={{ width: w > 0 ? w : `${100 / images.length}%` }}
              onClick={handleImageClick}
            >
              <GalleryImage
                src={img.url}
                alt={i === 0 ? title : `${title} - ${i + 1}`}
                priority={i === 0}
              />
            </div>
          ))}
        </div>

        {/* Counter — mobile */}
        {images.length > 1 && (
          <div className="absolute top-3 right-3 bg-black/50 text-white text-xs font-medium px-2 py-0.5 rounded-full md:hidden z-10">
            {current + 1}/{images.length}
          </div>
        )}

        {/* Zoom hint — desktop */}
        <div className="absolute bottom-3 right-3 bg-black/40 text-white text-[10px] px-2 py-1 rounded hidden md:flex items-center gap-1 z-10 pointer-events-none">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
          </svg>
          Zoom
        </div>

        {/* Arrows — desktop */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => goTo(current - 1)}
              className={`absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full items-center justify-center hover:bg-white transition-colors hidden md:flex z-10 ${current === 0 ? 'opacity-30 pointer-events-none' : ''}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => goTo(current + 1)}
              className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full items-center justify-center hover:bg-white transition-colors hidden md:flex z-10 ${current === images.length - 1 ? 'opacity-30 pointer-events-none' : ''}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Dots */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`h-2 rounded-full transition-all duration-200 ${i === current ? 'bg-brand-500 w-4' : 'bg-black/20 w-2'}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnails — desktop */}
      {images.length > 1 && (
        <div className="hidden md:flex gap-2 mt-3">
          {images.map((img, i) => (
            <button
              key={img.url}
              onClick={() => goTo(i)}
              className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${i === current ? 'border-brand-500' : 'border-transparent hover:border-gray-300'}`}
            >
              <Image src={img.url} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Zoom modal */}
      {mounted && modalOpen && (
        <ZoomModal
          src={images[current].url}
          alt={title}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}
