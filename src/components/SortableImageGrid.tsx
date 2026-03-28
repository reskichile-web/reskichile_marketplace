'use client'

import { useState, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export interface ImageItem {
  id: string
  url: string
  isNew?: boolean
}

interface Props {
  images: ImageItem[]
  onReorder: (images: ImageItem[]) => void
  onRemove: (id: string) => void
  onAdd: (files: File[]) => void
  maxImages?: number
}

// ─── Desktop: drag & drop ───────────────────────────────────────────────────

function SortableImage({ image, onRemove }: { image: ImageItem; onRemove: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto' as const,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative aspect-[4/5] rounded-lg overflow-hidden bg-gray-100 group cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <img src={image.url} alt="" className="w-full h-full object-cover" />

      {image.isNew && (
        <div className="absolute bottom-1.5 left-1.5 bg-brand-500 text-white text-[9px] px-1.5 py-0.5 rounded font-medium">
          Nueva
        </div>
      )}

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
      >
        ×
      </button>
    </div>
  )
}

function DesktopGrid({ images, onReorder, onRemove, onAdd, maxImages }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = images.findIndex(i => i.id === active.id)
      const newIndex = images.findIndex(i => i.id === over.id)
      onReorder(arrayMove(images, oldIndex, newIndex))
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={images.map(i => i.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-4 gap-2">
          {images.map((image, index) => (
            <div key={image.id} className="relative">
              <SortableImage image={image} onRemove={() => onRemove(image.id)} />
              <div className="absolute top-1.5 left-1.5 w-5 h-5 bg-black/60 text-white text-[10px] font-bold rounded-full flex items-center justify-center pointer-events-none z-10">
                {index + 1}
              </div>
            </div>
          ))}
          <AddButton images={images} maxImages={maxImages!} onAdd={onAdd} />
        </div>
      </SortableContext>
    </DndContext>
  )
}

// ─── Mobile: arrow buttons to reorder with slide animation ──────────────────

function MobileGrid({ images, onReorder, onRemove, onAdd, maxImages }: Props) {
  const [animatingId, setAnimatingId] = useState<string | null>(null)
  const [animDir, setAnimDir] = useState<-1 | 1>(1)

  function moveImage(index: number, direction: -1 | 1) {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= images.length) return
    setAnimatingId(images[index].id)
    setAnimDir(direction)
    // Let the CSS transition play, then commit the reorder
    setTimeout(() => {
      onReorder(arrayMove([...images], index, newIndex))
      setAnimatingId(null)
    }, 150)
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {images.map((image, index) => (
        <div
          key={image.id}
          className="relative aspect-[4/5] rounded-lg overflow-hidden bg-gray-100 transition-transform duration-150 ease-out"
          style={{
            transform: animatingId === image.id
              ? `translateX(${animDir * 30}%)`
              : 'translateX(0)',
          }}
        >
          <img src={image.url} alt="" className="w-full h-full object-cover" />

          {/* Order badge */}
          <div className="absolute top-1.5 left-1.5 w-5 h-5 bg-black/60 text-white text-[10px] font-bold rounded-full flex items-center justify-center z-10">
            {index + 1}
          </div>

          {image.isNew && (
            <div className="absolute top-1.5 left-8 bg-brand-500 text-white text-[9px] px-1.5 py-0.5 rounded font-medium">
              Nueva
            </div>
          )}

          {/* Delete */}
          <button
            type="button"
            onClick={() => onRemove(image.id)}
            className="absolute top-1.5 right-1.5 w-7 h-7 bg-red-500/90 text-white rounded-full flex items-center justify-center text-sm font-bold"
          >
            ×
          </button>

          {/* Reorder arrows — centered at bottom, large white buttons */}
          <div className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-2 pb-2">
            <button
              type="button"
              onClick={() => moveImage(index, -1)}
              disabled={index === 0}
              className="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-sm disabled:opacity-30 pressable"
            >
              <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => moveImage(index, 1)}
              disabled={index === images.length - 1}
              className="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-sm disabled:opacity-30 pressable"
            >
              <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      ))}
      <AddButton images={images} maxImages={maxImages!} onAdd={onAdd} />
    </div>
  )
}

// ─── Shared add button ──────────────────────────────────────────────────────

function AddButton({ images, maxImages, onAdd }: { images: ImageItem[]; maxImages: number; onAdd: (files: File[]) => void }) {
  if (images.length >= maxImages) return null

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (images.length + files.length > maxImages) {
      alert(`Maximo ${maxImages} fotos`)
      return
    }
    onAdd(files)
    e.target.value = ''
  }

  return (
    <label className="aspect-[4/5] rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-brand-500 hover:bg-brand-50 transition-colors">
      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      <span className="text-xs text-gray-400 mt-1">Agregar</span>
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileInput}
        className="hidden"
      />
    </label>
  )
}

// ─── Main component — switches between mobile and desktop ───────────────────

export default function SortableImageGrid(props: Props) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <div>
      {isMobile ? <MobileGrid {...props} /> : <DesktopGrid {...props} />}
      <p className="text-xs text-gray-500 mt-2">
        {props.images.length}/{props.maxImages || 8} fotos{!isMobile && ' · Arrastra para reordenar'}
      </p>
    </div>
  )
}
