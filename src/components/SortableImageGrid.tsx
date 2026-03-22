'use client'

import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
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
    zIndex: isDragging ? 50 : 'auto',
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

      {/* Order badge */}
      <div className="absolute top-1.5 left-1.5 w-5 h-5 bg-black/60 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
        {/* Will be set by parent via index */}
      </div>

      {/* New badge */}
      {image.isNew && (
        <div className="absolute bottom-1.5 left-1.5 bg-brand-500 text-white text-[9px] px-1.5 py-0.5 rounded font-medium">
          Nueva
        </div>
      )}

      {/* Delete button */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
      >
        ×
      </button>

      {/* Drag indicator */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="bg-black/40 text-white p-1.5 rounded-lg">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </div>
      </div>
    </div>
  )
}

export default function SortableImageGrid({ images, onReorder, onRemove, onAdd, maxImages = 8 }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = images.findIndex(i => i.id === active.id)
      const newIndex = images.findIndex(i => i.id === over.id)
      onReorder(arrayMove(images, oldIndex, newIndex))
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (images.length + files.length > maxImages) {
      alert(`Máximo ${maxImages} fotos`)
      return
    }
    onAdd(files)
    e.target.value = ''
  }

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={images.map(i => i.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {images.map((image, index) => (
              <div key={image.id} className="relative">
                <SortableImage image={image} onRemove={() => onRemove(image.id)} />
                {/* Order number overlay */}
                <div className="absolute top-1.5 left-1.5 w-5 h-5 bg-black/60 text-white text-[10px] font-bold rounded-full flex items-center justify-center pointer-events-none z-10">
                  {index + 1}
                </div>
              </div>
            ))}

            {/* Add button */}
            {images.length < maxImages && (
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
            )}
          </div>
        </SortableContext>
      </DndContext>

      <p className="text-xs text-gray-500 mt-2">
        {images.length}/{maxImages} fotos · Arrastra para reordenar
      </p>
    </div>
  )
}
