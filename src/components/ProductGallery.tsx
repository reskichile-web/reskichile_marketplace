'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
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
  const dragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  function handleClick() {
    if (dragging.current) return
    if (zoomed) {
      setZoomed(false)
      setOffset({ x: 0, y: 0 })
    } else {
      setZoomed(true)
    }
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (!zoomed) return
    dragging.current = false
    lastPos.current = { x: e.clientX, y: e.clientY }

    function onMove(ev: MouseEvent) {
      dragging.current = true
      setOffset(prev => ({
        x: prev.x + (ev.clientX - lastPos.current.x),
        y: prev.y + (ev.clientY - lastPos.current.y),
      }))
      lastPos.current = { x: ev.clientX, y: ev.clientY }
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      setTimeout(() => { dragging.current = false }, 10)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-black/90 flex items-center justify-center">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Zoom hint */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/40 text-xs z-10 pointer-events-none">
        {zoomed ? 'Arrastra para mover · Click para alejar' : 'Click para acercar'}
      </div>

      {/* Image */}
      <div
        className="relative w-full h-full flex items-center justify-center overflow-hidden"
        style={{ cursor: zoomed ? (dragging.current ? 'grabbing' : 'grab') : 'zoom-in' }}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
      >
        <img
          src={src}
          alt={alt}
          className="max-h-full max-w-full object-contain transition-transform duration-200 select-none"
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

// ─── Main gallery component ─────────────────────────────────────────────────

export default function ProductGallery({ images, title }: Props) {
  const [currentImage, setCurrentImage] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const touchState = useRef({ startX: 0, startY: 0, isDragging: false, locked: false })

  useEffect(() => { setMounted(true) }, [])

  const goTo = useCallback((index: number) => {
    setCurrentImage(index)
  }, [])

  // ─── Mobile touch handling — horizontal lock + smooth carousel ───
  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    touchState.current = { startX: t.clientX, startY: t.clientY, isDragging: false, locked: false }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (images.length <= 1) return
    const t = e.touches[0]
    const dx = t.clientX - touchState.current.startX
    const dy = t.clientY - touchState.current.startY

    // Determine lock direction on first significant move
    if (!touchState.current.locked) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        touchState.current.locked = true
        touchState.current.isDragging = Math.abs(dx) > Math.abs(dy)
      }
    }

    if (!touchState.current.isDragging) return

    // Prevent page scroll when swiping horizontally
    e.preventDefault()

    if (trackRef.current) {
      const baseOffset = -currentImage * 100
      const dragPercent = (dx / trackRef.current.parentElement!.clientWidth) * 100
      trackRef.current.style.transition = 'none'
      trackRef.current.style.transform = `translateX(${baseOffset + dragPercent}%)`
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!touchState.current.isDragging) return

    const endX = e.changedTouches[0].clientX
    const diff = touchState.current.startX - endX

    if (Math.abs(diff) > 40) {
      if (diff > 0 && currentImage < images.length - 1) {
        goTo(currentImage + 1)
      } else if (diff < 0 && currentImage > 0) {
        goTo(currentImage - 1)
      }
    }

    // Snap back
    if (trackRef.current) {
      const target = Math.abs(diff) > 40
        ? (diff > 0 ? Math.min(currentImage + 1, images.length - 1) : Math.max(currentImage - 1, 0))
        : currentImage
      trackRef.current.style.transition = 'transform 0.3s ease-out'
      trackRef.current.style.transform = `translateX(-${target * 100}%)`
    }
  }

  // Sync track position when currentImage changes (from arrows/dots)
  useEffect(() => {
    if (trackRef.current) {
      trackRef.current.style.transition = 'transform 0.3s ease-out'
      trackRef.current.style.transform = `translateX(-${currentImage * 100}%)`
    }
  }, [currentImage])

  if (images.length === 0) {
    return (
      <div className="aspect-[4/5] bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
        Sin fotos
      </div>
    )
  }

  return (
    <div>
      {/* Gallery container */}
      <div
        className="relative aspect-[4/5] bg-white rounded-lg overflow-hidden border border-gray-100"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Carousel track — all images side by side */}
        <div
          ref={trackRef}
          className="absolute inset-0 flex will-change-transform"
          style={{ width: `${images.length * 100}%`, transform: `translateX(-${currentImage * 100}%)`, transition: 'transform 0.3s ease-out' }}
        >
          {images.map((img, i) => (
            <div
              key={img.url}
              className="relative h-full flex items-center justify-center bg-white"
              style={{ width: `${100 / images.length}%` }}
            >
              <Image
                src={img.url}
                alt={i === 0 ? title : `${title} - ${i + 1}`}
                fill
                priority={i === 0}
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-contain"
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                onClick={() => {
                  // Desktop only — open zoom modal
                  if (window.innerWidth >= 768) setModalOpen(true)
                }}
                style={{ cursor: window !== undefined && typeof window !== 'undefined' ? 'zoom-in' : undefined }}
              />
            </div>
          ))}
        </div>

        {/* Counter — mobile */}
        {images.length > 1 && (
          <div className="absolute top-3 right-3 bg-black/50 text-white text-xs font-medium px-2 py-0.5 rounded-full md:hidden z-10">
            {currentImage + 1}/{images.length}
          </div>
        )}

        {/* Desktop: click to zoom hint */}
        <div className="absolute bottom-3 right-3 bg-black/40 text-white text-[10px] px-2 py-1 rounded hidden md:flex items-center gap-1 z-10 pointer-events-none">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
          </svg>
          Zoom
        </div>

        {/* Arrow buttons — desktop */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => goTo((currentImage - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition-colors hidden md:flex z-10"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => goTo((currentImage + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition-colors hidden md:flex z-10"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Dots — bottom */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`h-2 rounded-full transition-all duration-200 ${i === currentImage ? 'bg-brand-500 w-4' : 'bg-black/20 w-2'}`}
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
              className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${i === currentImage ? 'border-brand-500' : 'border-transparent hover:border-gray-300'}`}
            >
              <Image src={img.url} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Zoom modal — desktop only */}
      {mounted && modalOpen && (
        <ZoomModal
          src={images[currentImage].url}
          alt={title}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}
