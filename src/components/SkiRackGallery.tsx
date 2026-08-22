'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, ZoomIn, X } from 'lucide-react'

interface GalleryImage {
  url: string
  alt: string
}

function SkiRackZoom({
  images,
  current,
  title,
  onChange,
  onClose,
}: {
  images: GalleryImage[]
  current: number
  title: string
  onChange: (index: number) => void
  onClose: () => void
}) {
  const [zoomed, setZoomed] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragState = useRef({ active: false, moved: false, lastX: 0, lastY: 0 })
  const selected = images[current]

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && current > 0) onChange(current - 1)
      if (event.key === 'ArrowRight' && current < images.length - 1) onChange(current + 1)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [current, images.length, onChange, onClose])

  useEffect(() => {
    setZoomed(false)
    setOffset({ x: 0, y: 0 })
  }, [current])

  useEffect(() => {
    function handleMove(event: MouseEvent) {
      if (!dragState.current.active) return
      event.preventDefault()
      dragState.current.moved = true
      setOffset((previous) => ({
        x: previous.x + event.clientX - dragState.current.lastX,
        y: previous.y + event.clientY - dragState.current.lastY,
      }))
      dragState.current.lastX = event.clientX
      dragState.current.lastY = event.clientY
    }

    function handleUp() {
      dragState.current.active = false
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
    }
  }, [])

  function toggleZoom() {
    if (dragState.current.moved) {
      dragState.current.moved = false
      return
    }
    setZoomed((value) => !value)
    if (zoomed) setOffset({ x: 0, y: 0 })
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex select-none items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Vista ampliada de ${title}`}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
        aria-label="Cerrar imagen ampliada"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onChange(current - 1)
            }}
            disabled={current === 0}
            className="absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 disabled:pointer-events-none disabled:opacity-25 sm:left-6"
            aria-label="Ver imagen anterior"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onChange(current + 1)
            }}
            disabled={current === images.length - 1}
            className="absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 disabled:pointer-events-none disabled:opacity-25 sm:right-6"
            aria-label="Ver imagen siguiente"
          >
            <ChevronRight className="h-6 w-6" aria-hidden="true" />
          </button>
        </>
      )}

      <div className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap text-xs text-white/70">
        {zoomed ? 'Arrastra para mover · clic para alejar' : 'Clic para acercar'}
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={selected.url}
        src={selected.url}
        alt={selected.alt || title}
        draggable={false}
        onMouseDown={(event) => {
          if (!zoomed) return
          event.preventDefault()
          dragState.current = {
            active: true,
            moved: false,
            lastX: event.clientX,
            lastY: event.clientY,
          }
        }}
        onClick={(event) => {
          event.stopPropagation()
          toggleZoom()
        }}
        className="max-h-[88vh] max-w-[88vw] object-contain"
        style={{
          cursor: zoomed ? 'grab' : 'zoom-in',
          transform: zoomed
            ? `scale(2.35) translate(${offset.x / 2.35}px, ${offset.y / 2.35}px)`
            : 'scale(1)',
          transition: dragState.current.active ? 'none' : 'transform 180ms ease-out',
        }}
      />
    </div>,
    document.body,
  )
}

export default function SkiRackGallery({
  images,
  title,
}: {
  images: GalleryImage[]
  title: string
}) {
  const [current, setCurrent] = useState(0)
  const [zoomOpen, setZoomOpen] = useState(false)
  const selected = images[current] || images[0]

  return (
    <div>
      <button
        type="button"
        onClick={() => setZoomOpen(true)}
        className="group relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-[22px] bg-gray-50 text-left md:rounded-[26px]"
        aria-label={`Ampliar foto ${current + 1} de ${title}`}
      >
        <Image
          key={selected.url}
          src={selected.url}
          alt={selected.alt || title}
          fill
          priority
          sizes="(max-width: 767px) 100vw, 416px"
          className="object-cover"
        />
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1.5 text-[10px] font-semibold text-white backdrop-blur-sm transition-colors group-hover:bg-black/60">
          <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
          Zoom
        </span>
      </button>

      <div className="mt-3 flex gap-3" aria-label={`Fotografías de ${title}`}>
        {images.map((image, index) => {
          const active = index === current
          return (
            <button
              key={image.url}
              type="button"
              onClick={() => setCurrent(index)}
              className={`relative aspect-square w-[72px] overflow-hidden rounded-xl border-2 bg-gray-50 transition-colors md:w-[78px] ${
                active ? 'border-brand-500' : 'border-transparent hover:border-gray-300'
              }`}
              aria-label={`Ver foto ${index + 1} de ${title}`}
              aria-pressed={active}
            >
              <Image
                src={image.url}
                alt=""
                fill
                sizes="78px"
                className="object-cover"
              />
            </button>
          )
        })}
      </div>

      {zoomOpen && (
        <SkiRackZoom
          images={images}
          current={current}
          title={title}
          onChange={setCurrent}
          onClose={() => setZoomOpen(false)}
        />
      )}
    </div>
  )
}
