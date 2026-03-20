'use client'

import { useRef, useState } from 'react'
import gsap from 'gsap'

export default function AnimatedLogo() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  // Refs for each body part
  const bodyRef = useRef<SVGPathElement>(null)
  const headRef = useRef<SVGCircleElement>(null)
  const leftArmRef = useRef<SVGGElement>(null)
  const rightArmRef = useRef<SVGGElement>(null)
  const leftPoleRef = useRef<SVGGElement>(null)
  const rightPoleRef = useRef<SVGGElement>(null)
  const leftLegRef = useRef<SVGPathElement>(null)
  const rightLegRef = useRef<SVGPathElement>(null)
  const leftSkiRef = useRef<SVGPathElement>(null)
  const rightSkiRef = useRef<SVGPathElement>(null)
  const skierGroupRef = useRef<SVGGElement>(null)
  const snowRef = useRef<SVGGElement>(null)
  const lettersRef = useRef<(SVGGElement | null)[]>([])

  const letterPaths = [
    { transform: 'translate(108.492066, 84.511013)', d: 'M 30.671875 -19.84375 C 30.671875 -17.1875 29.960938 -14.890625 28.546875 -12.953125 C 27.128906 -11.023438 25.144531 -9.617188 22.59375 -8.734375 L 27.546875 0 L 18.9375 0 L 14.609375 -7.734375 L 10.4375 -7.734375 L 8.90625 0 L 0.671875 0 L 6.484375 -29.125 L 18.9375 -29.125 C 22.65625 -29.125 25.539062 -28.304688 27.59375 -26.671875 C 29.644531 -25.035156 30.671875 -22.757812 30.671875 -19.84375 Z M 22.34375 -19.0625 C 22.34375 -20.25 21.941406 -21.140625 21.140625 -21.734375 C 20.335938 -22.335938 19.210938 -22.640625 17.765625 -22.640625 L 13.4375 -22.640625 L 11.6875 -14.109375 L 16.609375 -14.109375 C 18.429688 -14.109375 19.84375 -14.535156 20.84375 -15.390625 C 21.84375 -16.253906 22.34375 -17.476562 22.34375 -19.0625 Z' },
    { transform: 'translate(139.288351, 84.511013)', d: 'M 13.3125 -22.765625 L 12.359375 -17.84375 L 25.296875 -17.84375 L 24.09375 -11.6875 L 11.109375 -11.6875 L 10.0625 -6.359375 L 25.34375 -6.359375 L 24.015625 0 L 0.671875 0 L 6.484375 -29.125 L 29.296875 -29.125 L 28 -22.765625 Z' },
    { transform: 'translate(167.254708, 84.511013)', d: 'M 11.53125 0.578125 C 9.113281 0.578125 6.820312 0.285156 4.65625 -0.296875 C 2.5 -0.878906 0.738281 -1.625 -0.625 -2.53125 L 2.625 -8.703125 C 4.09375 -7.753906 5.65625 -7.035156 7.3125 -6.546875 C 8.976562 -6.066406 10.644531 -5.828125 12.3125 -5.828125 C 13.894531 -5.828125 15.125 -6.054688 16 -6.515625 C 16.875 -6.972656 17.3125 -7.601562 17.3125 -8.40625 C 17.3125 -9.09375 16.914062 -9.628906 16.125 -10.015625 C 15.332031 -10.410156 14.101562 -10.832031 12.4375 -11.28125 C 10.550781 -11.78125 8.984375 -12.285156 7.734375 -12.796875 C 6.484375 -13.304688 5.40625 -14.085938 4.5 -15.140625 C 3.601562 -16.203125 3.15625 -17.59375 3.15625 -19.3125 C 3.15625 -21.382812 3.722656 -23.203125 4.859375 -24.765625 C 6.003906 -26.335938 7.628906 -27.550781 9.734375 -28.40625 C 11.847656 -29.269531 14.316406 -29.703125 17.140625 -29.703125 C 19.222656 -29.703125 21.164062 -29.488281 22.96875 -29.0625 C 24.769531 -28.632812 26.320312 -28.019531 27.625 -27.21875 L 24.625 -21.09375 C 23.488281 -21.8125 22.234375 -22.359375 20.859375 -22.734375 C 19.492188 -23.109375 18.085938 -23.296875 16.640625 -23.296875 C 15.003906 -23.296875 13.722656 -23.03125 12.796875 -22.5 C 11.867188 -21.976562 11.40625 -21.300781 11.40625 -20.46875 C 11.40625 -19.75 11.804688 -19.191406 12.609375 -18.796875 C 13.410156 -18.410156 14.660156 -18 16.359375 -17.5625 C 18.242188 -17.09375 19.800781 -16.609375 21.03125 -16.109375 C 22.269531 -15.609375 23.332031 -14.84375 24.21875 -13.8125 C 25.101562 -12.789062 25.546875 -11.445312 25.546875 -9.78125 C 25.546875 -7.726562 24.96875 -5.914062 23.8125 -4.34375 C 22.664062 -2.78125 21.03125 -1.566406 18.90625 -0.703125 C 16.789062 0.148438 14.332031 0.578125 11.53125 0.578125 Z' },
    { transform: 'translate(194.180649, 84.511013)', d: 'M 20.09375 -15.734375 L 29.875 0 L 20.6875 0 L 13.984375 -10.484375 L 10.1875 -7.078125 L 8.78125 0 L 0.671875 0 L 6.484375 -29.125 L 14.609375 -29.125 L 12.234375 -17.21875 L 25.375 -29.125 L 35.078125 -29.125 Z' },
    { transform: 'translate(225.476334, 84.511013)', d: 'M 6.484375 -29.125 L 14.734375 -29.125 L 8.90625 0 L 0.671875 0 Z' },
    { transform: 'translate(239.584356, 84.511013)', d: 'M 16.5625 0.578125 C 13.625 0.578125 11.046875 0.046875 8.828125 -1.015625 C 6.609375 -2.085938 4.898438 -3.59375 3.703125 -5.53125 C 2.503906 -7.476562 1.90625 -9.710938 1.90625 -12.234375 C 1.90625 -15.554688 2.675781 -18.550781 4.21875 -21.21875 C 5.757812 -23.882812 7.914062 -25.960938 10.6875 -27.453125 C 13.46875 -28.953125 16.632812 -29.703125 20.1875 -29.703125 C 22.875 -29.703125 25.253906 -29.222656 27.328125 -28.265625 C 29.410156 -27.316406 30.96875 -25.96875 32 -24.21875 L 26.046875 -19.46875 C 24.628906 -21.75 22.492188 -22.890625 19.640625 -22.890625 C 17.785156 -22.890625 16.148438 -22.453125 14.734375 -21.578125 C 13.316406 -20.703125 12.210938 -19.492188 11.421875 -17.953125 C 10.628906 -16.410156 10.234375 -14.6875 10.234375 -12.78125 C 10.234375 -10.800781 10.867188 -9.210938 12.140625 -8.015625 C 13.421875 -6.828125 15.15625 -6.234375 17.34375 -6.234375 C 20.125 -6.234375 22.5 -7.359375 24.46875 -9.609375 L 29.328125 -4.828125 C 27.753906 -2.910156 25.910156 -1.53125 23.796875 -0.6875 C 21.691406 0.15625 19.28125 0.578125 16.5625 0.578125 Z' },
    { transform: 'translate(270.297408, 84.511013)', d: 'M 34.15625 -29.125 L 28.328125 0 L 20.09375 0 L 22.34375 -11.3125 L 11.15625 -11.3125 L 8.90625 0 L 0.671875 0 L 6.484375 -29.125 L 14.734375 -29.125 L 12.5625 -18.21875 L 23.765625 -18.21875 L 25.921875 -29.125 Z' },
    { transform: 'translate(303.840404, 84.511013)', d: 'M 6.484375 -29.125 L 14.734375 -29.125 L 8.90625 0 L 0.671875 0 Z' },
    { transform: 'translate(317.948415, 84.511013)', d: 'M 6.484375 -29.125 L 14.734375 -29.125 L 10.234375 -6.53125 L 24.140625 -6.53125 L 22.796875 0 L 0.671875 0 Z' },
    { transform: 'translate(343.334545, 84.511013)', d: 'M 13.3125 -22.765625 L 12.359375 -17.84375 L 25.296875 -17.84375 L 24.09375 -11.6875 L 11.109375 -11.6875 L 10.0625 -6.359375 L 25.34375 -6.359375 L 24.015625 0 L 0.671875 0 L 6.484375 -29.125 L 29.296875 -29.125 L 28 -22.765625 Z' },
  ]

  function play() {
    if (isPlaying) return
    setIsPlaying(true)

    const tl = gsap.timeline({
      onComplete: () => setIsPlaying(false),
    })

    // ---- RESET ----
    gsap.set(skierGroupRef.current, { x: -60, y: -30, opacity: 0, rotation: -5 })
    gsap.set(lettersRef.current, { opacity: 0, y: 12, scale: 0.85 })
    gsap.set(snowRef.current?.children || [], { opacity: 0, y: 0, x: 0 })
    // Left arm starts raised (not grabbing ski)
    gsap.set(leftArmRef.current, { rotation: -35, transformOrigin: '0% 0%' })
    gsap.set(leftPoleRef.current, { rotation: -35, transformOrigin: '0% 0%' })
    // Right arm starts low
    gsap.set(rightArmRef.current, { rotation: 10, transformOrigin: '0% 0%' })
    gsap.set(rightPoleRef.current, { rotation: 10, transformOrigin: '0% 0%' })

    // ---- ACT 1: Skier slides in ----
    tl.to(skierGroupRef.current, {
      x: 0, y: 0, opacity: 1, rotation: 0,
      duration: 1.0, ease: 'power3.out',
    })

    // ---- ACT 2: Arms move — left arm reaches down to grab ski, right arm goes up ----
    tl.to(leftArmRef.current, {
      rotation: 0, duration: 1.4, ease: 'power2.inOut',
    }, '-=0.3')
    tl.to(leftPoleRef.current, {
      rotation: 0, duration: 1.4, ease: 'power2.inOut',
    }, '<')
    tl.to(rightArmRef.current, {
      rotation: -20, duration: 1.4, ease: 'power2.inOut',
    }, '<')
    tl.to(rightPoleRef.current, {
      rotation: -20, duration: 1.4, ease: 'power2.inOut',
    }, '<')

    // ---- ACT 3: Landing bounce ----
    tl.to(skierGroupRef.current, {
      y: 3, duration: 0.12, ease: 'power2.in',
    })
    tl.to(skierGroupRef.current, {
      y: 0, duration: 0.4, ease: 'elastic.out(1.2, 0.4)',
    })

    // Right arm settles back
    tl.to(rightArmRef.current, {
      rotation: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)',
    }, '-=0.3')
    tl.to(rightPoleRef.current, {
      rotation: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)',
    }, '<')

    // Snow burst
    tl.to(snowRef.current?.children || [], {
      opacity: 1, duration: 0.08,
    }, '-=0.4')
    tl.to(snowRef.current?.children || [], {
      y: () => gsap.utils.random(-18, -40),
      x: () => gsap.utils.random(-25, 25),
      opacity: 0, duration: 0.7, ease: 'power2.out', stagger: 0.02,
    }, '-=0.35')

    // ---- ACT 4: Letters stagger in ----
    tl.to(lettersRef.current, {
      opacity: 1, y: 0, scale: 1,
      duration: 0.45, ease: 'back.out(1.7)', stagger: 0.05,
    }, '-=0.2')
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <svg
        ref={svgRef}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 375 150"
        className="w-full max-w-[500px]"
      >
        {/* ===== SKIER (articulado) ===== */}
        <g ref={skierGroupRef} style={{ opacity: 0 }}>

          {/* Skis */}
          <path ref={leftSkiRef} d="M 25 118 Q 30 116 75 114 Q 82 114 85 116" stroke="#2674bf" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path ref={rightSkiRef} d="M 35 122 Q 40 120 85 118 Q 92 118 95 120" stroke="#2674bf" strokeWidth="3" strokeLinecap="round" fill="none" />

          {/* Left leg */}
          <path ref={leftLegRef} d="M 58 90 L 48 112 L 52 114" stroke="#2674bf" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />

          {/* Right leg */}
          <path ref={rightLegRef} d="M 62 88 L 68 110 L 72 114" stroke="#2674bf" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />

          {/* Body / torso */}
          <path ref={bodyRef} d="M 60 89 Q 58 75 62 58 Q 64 50 68 45" stroke="#2674bf" strokeWidth="4" strokeLinecap="round" fill="none" />

          {/* Head */}
          <circle ref={headRef} cx="70" cy="38" r="8" fill="#2674bf" />

          {/* Goggles detail */}
          <path d="M 64 37 Q 70 34 76 37" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />

          {/* Left arm + pole (front arm — the one that grabs) */}
          <g ref={leftArmRef} style={{ transformOrigin: '60px 60px' }}>
            {/* Arm */}
            <path d="M 60 60 L 45 78 L 38 85" stroke="#2674bf" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            {/* Hand */}
            <circle cx="38" cy="85" r="2.5" fill="#2674bf" />
          </g>
          <g ref={leftPoleRef} style={{ transformOrigin: '60px 60px' }}>
            {/* Pole */}
            <line x1="38" y1="85" x2="20" y2="105" stroke="#2674bf" strokeWidth="1.5" strokeLinecap="round" />
            {/* Pole basket */}
            <circle cx="20" cy="105" r="3" stroke="#2674bf" strokeWidth="1" fill="none" />
          </g>

          {/* Right arm + pole (back arm) */}
          <g ref={rightArmRef} style={{ transformOrigin: '64px 58px' }}>
            {/* Arm */}
            <path d="M 64 58 L 80 68 L 88 62" stroke="#2674bf" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            {/* Hand */}
            <circle cx="88" cy="62" r="2.5" fill="#2674bf" />
          </g>
          <g ref={rightPoleRef} style={{ transformOrigin: '64px 58px' }}>
            {/* Pole */}
            <line x1="88" y1="62" x2="95" y2="100" stroke="#2674bf" strokeWidth="1.5" strokeLinecap="round" />
            {/* Pole basket */}
            <circle cx="95" cy="100" r="3" stroke="#2674bf" strokeWidth="1" fill="none" />
          </g>

        </g>

        {/* Snow particles */}
        <g ref={snowRef}>
          {Array.from({ length: 14 }).map((_, i) => (
            <circle
              key={i}
              cx={35 + (i * 4)}
              cy={120}
              r={1 + (i % 3)}
              fill="#2674bf"
              opacity={0}
            />
          ))}
        </g>

        {/* ===== LETTERS ===== */}
        {letterPaths.map((letter, i) => (
          <g
            key={i}
            ref={(el) => { lettersRef.current[i] = el }}
            transform={letter.transform}
            style={{ opacity: 0 }}
          >
            <path fill="#2674bf" d={letter.d} />
          </g>
        ))}
      </svg>

      <div className="flex gap-3">
        <button
          onClick={play}
          disabled={isPlaying}
          className="px-6 py-2.5 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors"
        >
          {isPlaying ? 'Reproduciendo...' : 'Reproducir'}
        </button>
      </div>
    </div>
  )
}
