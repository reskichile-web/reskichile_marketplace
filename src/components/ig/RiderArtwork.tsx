'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import styles from './AutomatedProductPost.module.css'

interface RiderArtworkProps {
  src: string
  transparentSource: boolean
}

const TRANSPARENT_FROM = 250
const OPAQUE_FROM = 218

export default function RiderArtwork({ src, transparentSource }: RiderArtworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (transparentSource) return

    let cancelled = false
    const source = new window.Image()
    source.decoding = 'async'

    source.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = source.naturalWidth
      canvas.height = source.naturalHeight
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) return

      context.drawImage(source, 0, 0)
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
      const pixels = imageData.data

      for (let index = 0; index < pixels.length; index += 4) {
        const minimumChannel = Math.min(pixels[index], pixels[index + 1], pixels[index + 2])
        const coverage = Math.max(0, Math.min(1, (TRANSPARENT_FROM - minimumChannel) / (TRANSPARENT_FROM - OPAQUE_FROM)))
        if (coverage >= 1) continue
        if (coverage <= 0) {
          pixels[index + 3] = 0
          continue
        }

        const whiteContribution = 255 * (1 - coverage)
        pixels[index] = Math.max(0, Math.min(255, (pixels[index] - whiteContribution) / coverage))
        pixels[index + 1] = Math.max(0, Math.min(255, (pixels[index + 1] - whiteContribution) / coverage))
        pixels[index + 2] = Math.max(0, Math.min(255, (pixels[index + 2] - whiteContribution) / coverage))
        pixels[index + 3] *= coverage
      }

      context.putImageData(imageData, 0, 0)
      if (!cancelled) setReady(true)
    }

    source.src = src
    return () => {
      cancelled = true
      source.onload = null
    }
  }, [src, transparentSource])

  if (transparentSource) {
    return <Image src={src} alt="" fill priority sizes="960px" className={styles.rider} />
  }

  return (
    <canvas
      ref={canvasRef}
      data-rider-ready={ready ? 'true' : 'false'}
      aria-hidden="true"
      className={`${styles.riderCutout} ${ready ? styles.artReady : ''}`}
    />
  )
}
