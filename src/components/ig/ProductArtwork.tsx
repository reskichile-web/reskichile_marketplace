'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import styles from './AutomatedProductPost.module.css'

interface ProductArtworkProps {
  src: string
  alt: string
  longProduct: boolean
}

const WHITE_THRESHOLD = 246
const TITLE_BUFFER = 70
const RIDER_OVERLAP = 70
const PRODUCT_TITLE_GAP = 110
const MAX_TITLE_SHIFT = 190

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()))
}

export default function ProductArtwork({ src, alt, longProduct }: ProductArtworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const width = 700
  const height = longProduct ? 1050 : 1000

  useEffect(() => {
    let cancelled = false
    setReady(false)
    canvasRef.current
      ?.closest<HTMLElement>('[data-testid="ig-product-post"]')
      ?.removeAttribute('data-artwork-shape')
    canvasRef.current
      ?.closest<HTMLElement>('[data-testid="ig-product-post"]')
      ?.style.removeProperty('--ig-title-offset')

    const source = new window.Image()
    source.crossOrigin = 'anonymous'
    source.decoding = 'async'

    source.onload = async () => {
      const sample = document.createElement('canvas')
      sample.width = source.naturalWidth
      sample.height = source.naturalHeight
      const sampleContext = sample.getContext('2d', { willReadFrequently: true })
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      if (!sampleContext || !canvas || !context) return

      sampleContext.drawImage(source, 0, 0)
      const pixels = sampleContext.getImageData(0, 0, sample.width, sample.height).data
      let minX = sample.width
      let minY = sample.height
      let maxX = -1
      let maxY = -1

      for (let y = 0; y < sample.height; y += 2) {
        for (let x = 0; x < sample.width; x += 2) {
          const index = (y * sample.width + x) * 4
          if (pixels[index + 3] < 16) continue
          if (
            pixels[index] >= WHITE_THRESHOLD &&
            pixels[index + 1] >= WHITE_THRESHOLD &&
            pixels[index + 2] >= WHITE_THRESHOLD
          ) continue
          minX = Math.min(minX, x)
          minY = Math.min(minY, y)
          maxX = Math.max(maxX, x)
          maxY = Math.max(maxY, y)
        }
      }

      if (maxX < minX || maxY < minY) return

      const cropPadding = 8
      const sourceX = Math.max(0, minX - cropPadding)
      const sourceY = Math.max(0, minY - cropPadding)
      const sourceWidth = Math.min(sample.width - sourceX, maxX - minX + cropPadding * 2)
      const sourceHeight = Math.min(sample.height - sourceY, maxY - minY + cropPadding * 2)
      const contentAspectRatio = sourceWidth / sourceHeight
      const artworkShape = longProduct && contentAspectRatio < 0.34 ? 'narrow' : 'standard'
      const poster = canvas.closest<HTMLElement>('[data-testid="ig-product-post"]')
      if (poster) poster.dataset.artworkShape = artworkShape
      const destinationPadding = 12
      const contentOffsetX = artworkShape === 'narrow' ? 90 : 30
      const contentWidth = artworkShape === 'narrow' ? 520 : 600
      let scale = Math.min(
        contentWidth / sourceWidth,
        (height - destinationPadding * 2) / sourceHeight,
      )
      let renderedWidth = sourceWidth * scale
      let renderedHeight = sourceHeight * scale
      let destinationX = contentOffsetX + (contentWidth - renderedWidth) / 2

      let destinationY = height - renderedHeight - destinationPadding
      const verticallyCentered = !longProduct || artworkShape === 'standard'
      if (verticallyCentered && poster) {
        await document.fonts.ready
        await nextFrame()
        await nextFrame()
        if (cancelled) return

        const title = poster.querySelector<HTMLElement>('[data-ig-title-block]')
        const details = poster.querySelector<HTMLElement>('[data-ig-details-block]')
        const rider = poster.querySelector<HTMLElement>('[data-ig-rider]')
        const shell = canvas.parentElement

        if (title && details && rider && shell) {
          const posterRect = poster.getBoundingClientRect()
          const titleRect = title.getBoundingClientRect()
          const detailsRect = details.getBoundingClientRect()
          const riderRect = rider.getBoundingClientRect()
          const shellRect = shell.getBoundingClientRect()
          const shellTop = shellRect.top - posterRect.top
          const detailsCenter = detailsRect.top - posterRect.top + detailsRect.height / 2
          const minimumTop = titleRect.bottom - posterRect.top + TITLE_BUFFER
          const maximumBottom = riderRect.top - posterRect.top + RIDER_OVERLAP
          const availableHeight = Math.max(1, maximumBottom - minimumTop)

          if (renderedHeight > availableHeight) {
            scale *= availableHeight / renderedHeight
            renderedWidth = sourceWidth * scale
            renderedHeight = sourceHeight * scale
            destinationX = contentOffsetX + (contentWidth - renderedWidth) / 2
          }

          const centeredTop = detailsCenter - renderedHeight / 2
          const boundedTop = Math.max(
            minimumTop,
            Math.min(centeredTop, maximumBottom - renderedHeight),
          )

          destinationY = boundedTop - shellTop

          if (!longProduct) {
            const naturalGap = boundedTop - (titleRect.bottom - posterRect.top)
            const titleShift = Math.min(
              MAX_TITLE_SHIFT,
              Math.max(0, naturalGap - PRODUCT_TITLE_GAP),
            )
            poster.style.setProperty('--ig-title-offset', `${titleShift}px`)
          }
        }
      }

      context.clearRect(0, 0, width, height)
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(
        source,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        destinationX,
        destinationY,
        renderedWidth,
        renderedHeight,
      )
      if (!cancelled) setReady(true)
    }

    source.src = src
    return () => {
      cancelled = true
      source.onload = null
      canvasRef.current
        ?.closest<HTMLElement>('[data-testid="ig-product-post"]')
        ?.removeAttribute('data-artwork-shape')
      canvasRef.current
        ?.closest<HTMLElement>('[data-testid="ig-product-post"]')
        ?.style.removeProperty('--ig-title-offset')
    }
  }, [height, longProduct, src, width])

  return (
    <>
      <Image
        src={src}
        alt={alt}
        fill
        priority
        unoptimized
        sizes="700px"
        className={`${styles.productFallback} ${ready ? styles.artHidden : ''}`}
      />
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        data-artwork-ready={ready ? 'true' : 'false'}
        role="img"
        aria-label={alt}
        className={`${styles.normalizedCanvas} ${ready ? styles.artReady : ''}`}
      />
    </>
  )
}
