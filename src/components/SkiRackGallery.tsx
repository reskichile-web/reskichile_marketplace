'use client'

import { useState } from 'react'
import Image from 'next/image'

interface GalleryImage {
  url: string
  alt: string
}

export default function SkiRackGallery({
  images,
  title,
}: {
  images: GalleryImage[]
  title: string
}) {
  const [current, setCurrent] = useState(0)
  const selected = images[current] || images[0]

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-[22px] bg-gray-50 md:rounded-[26px]">
        <Image
          key={selected.url}
          src={selected.url}
          alt={selected.alt || title}
          fill
          priority
          sizes="(max-width: 767px) 100vw, 416px"
          className="object-cover"
        />
      </div>

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
    </div>
  )
}
