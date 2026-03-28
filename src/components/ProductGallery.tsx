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
  const dragState = useRef({ active: false, moved: false, lastX: 0, lastY: 0 })
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  // Drag via document listeners — always works
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragState.current.active) return
      e.preventDefault()
      dragState.current.moved = true
      setOffset(prev => ({
        x: prev.x + (e.clientX - dragState.current.lastX),
        y: prev.y + (e.clientY - dragState.current.lastY),
      }))
      dragState.current.lastX = e.clientX
      dragState.current.lastY = e.clientY
    }
    function onUp() {
      dragState.current.active = false
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  function handleImgMouseDown(e: React.MouseEvent) {
    if (!zoomed) return
    e.preventDefault()
    dragState.current = { active: true, moved: false, lastX: e.clientX, lastY: e.clientY }
  }

  function handleImgClick() {
    if (dragState.current.moved) {
      dragState.current.moved = false
      return
    }
    if (zoomed) {
      setZoomed(false)
      setOffset({ x: 0, y: 0 })
    } else {
      setZoomed(true)
    }
  }

  function handleBackdropClick(e: React.MouseEvent) {
    // Only close if clicking the backdrop itself, not the image
    if (e.target === e.currentTarget) onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] bg-black/70 flex items-center justify-center select-none"
      onClick={handleBackdropClick}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose() }}
        className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/40 text-xs z-10 pointer-events-none">
        {zoomed ? 'Arrastra para mover · Click para alejar' : 'Click para acercar'}
      </div>

      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-[90vw] object-contain"
        style={{
          cursor: zoomed ? (dragState.current.active ? 'grabbing' : 'grab') : 'zoom-in',
          transform: zoomed
            ? `scale(2.5) translate(${offset.x / 2.5}px, ${offset.y / 2.5}px)`
            : 'scale(1)',
          transition: dragState.current.active ? 'none' : 'transform 0.2s ease-out',
        }}
        draggable={false}
        onClick={(e) => { e.stopPropagation(); handleImgClick() }}
        onMouseDown={handleImgMouseDown}
      />
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
  const touchRef = useRef({ startX: 0, startY: 0, locked: false, isHorizontal: false, pinched: false })

  useEffect(() => { setMounted(true) }, [])

  function goTo(i: number) {
    setCurrent(Math.max(0, Math.min(i, images.length - 1)))
    setDragX(0)
  }

  // ─── Touch — pinch zoom poisons the entire gesture ───
  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length > 1) {
      touchRef.current.pinched = true
      if (swiping) { setSwiping(false); setDragX(0) }
      return
    }
    const t = e.touches[0]
    touchRef.current = { startX: t.clientX, startY: t.clientY, locked: false, isHorizontal: false, pinched: false }
    setSwiping(false)
    setDragX(0)
  }

  function onTouchMove(e: React.TouchEvent) {
    // If pinch happened at any point in this gesture, ignore everything
    if (touchRef.current.pinched) return
    if (e.touches.length > 1) {
      touchRef.current.pinched = true
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
    if (touchRef.current.pinched || !swiping) {
      setSwiping(false)
      setDragX(0)
      return
    }

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
      <div className="aspect-[4/5] bg-gray-100 md:rounded-lg flex items-center justify-center text-gray-400">
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
        className="relative aspect-[4/5] bg-white overflow-hidden md:rounded-lg md:border md:border-gray-100 touch-pan-y"
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
