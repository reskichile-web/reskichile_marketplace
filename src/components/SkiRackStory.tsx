'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import Link from 'next/link'

const EASE = [0.65, 0, 0.35, 1] as const

const REVEAL = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.3 },
  transition: { duration: 0.9, ease: EASE },
}

const REVEAL_LEFT = {
  initial: { opacity: 0, x: -60 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, amount: 0.3 },
  transition: { duration: 0.9, ease: EASE },
}

const REVEAL_RIGHT = {
  initial: { opacity: 0, x: 60 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, amount: 0.3 },
  transition: { duration: 0.9, ease: EASE },
}

export default function SkiRackStory() {
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '-30%'])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])

  return (
    <div className="bg-white text-black">
      {/* ─────────────────────── HERO ─────────────────────── */}
      <section
        ref={heroRef}
        className="relative min-h-[100svh] overflow-hidden flex items-center justify-center"
      >
        {/* Background image */}
        <img
          src="/images/ski-rack-main.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-[center_15%]"
        />
        {/* Subtle dark overlay */}
        <div className="absolute inset-0 bg-black/15 pointer-events-none" />
        {/* Subtle vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.35) 100%)',
          }}
        />

        {/* Hero content */}
        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 px-6 text-center max-w-4xl"
        >
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
            className="inline-flex items-center gap-2.5 bg-gradient-to-r from-white/25 via-white/45 to-white/25 backdrop-blur-md border-y-2 border-white text-white text-[10px] md:text-xs font-button font-extrabold tracking-[0.35em] uppercase px-5 py-2 shadow-[0_6px_28px_rgb(255_255_255_/_0.35),0_2px_10px_rgb(0_0_0_/_0.2)]"
          >
            <span className="text-white/70 font-light">[</span>
            <span className="w-1 h-1 rounded-full bg-white/90 shadow-[0_0_6px_rgb(255_255_255_/_0.8)]" />
            Edición Limitada
            <span className="w-1 h-1 rounded-full bg-white/90 shadow-[0_0_6px_rgb(255_255_255_/_0.8)]" />
            <span className="text-white/70 font-light">]</span>
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: EASE, delay: 0.3 }}
            className="font-body font-extrabold italic text-white text-6xl md:text-[10rem] tracking-[-0.04em] leading-[0.9] mt-10 [text-shadow:0_5px_18px_rgb(0_0_0_/_0.22),0_2px_6px_rgb(0_0_0_/_0.18)]"
          >
            SKI-RACK
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.5 }}
            className="text-gray-700 text-base md:text-xl font-body font-light mt-10 max-w-xl mx-auto"
          >
            Hecho a mano en Chile <span className="inline-block align-middle ml-1">🇨🇱</span><br />
            <span className="font-semibold text-gray-900">Hecho para tu equipo.</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.9 }}
            className="mt-24 md:mt-32 flex justify-center"
          >
            <a
              href="#story"
              className="text-white text-xs md:text-sm font-button font-bold uppercase tracking-[0.3em] flex flex-col items-center gap-3 hover:text-white/80 transition-colors [text-shadow:0_2px_8px_rgb(0_0_0_/_0.35)]"
            >
              <span>Descubrí más</span>
              <motion.span
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                className="block"
                aria-hidden
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </motion.span>
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* ─────────────────────── PROBLEM ─────────────────────── */}
      <section id="story" className="relative py-24 md:py-40 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.span
            {...REVEAL}
            className="block text-brand-500 font-button font-bold tracking-[0.3em] uppercase text-xs md:text-sm"
          >
            01 — El problema
          </motion.span>

          <motion.h2
            {...REVEAL}
            transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}
            className="font-body font-extrabold italic text-4xl md:text-7xl tracking-[-0.03em] leading-[1.05] mt-6 max-w-3xl"
          >
            Tus skis merecen más
            <span className="block text-brand-500">que la esquina del living.</span>
          </motion.h2>

          <motion.p
            {...REVEAL}
            transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
            className="mt-8 text-gray-700 text-lg md:text-2xl font-body font-light max-w-2xl leading-relaxed"
          >
            Polvo, golpes, cantos rayados, fijaciones aplastadas.
            El equipo que costó una temporada terminado contra una pared.
          </motion.p>
        </div>

        {/* Floating image */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
          whileInView={{ opacity: 1, scale: 1, rotate: -3 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 1.1, ease: EASE, delay: 0.3 }}
          className="hidden md:block absolute top-[15%] right-[5%] w-[28vw] max-w-[400px] aspect-[3/4] shadow-2xl rounded-sm overflow-hidden border-8 border-white"
        >
          <img
            src="/images/default-racks.png"
            alt=""
            className="w-full h-full object-cover"
          />
        </motion.div>
      </section>

      {/* ─────────────────────── SOLUTION REVEAL ─────────────────────── */}
      <section className="relative bg-slate-950 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <img
            src="https://images.unsplash.com/photo-1496248286377-d2b8bbeeef23?w=3840&q=85&auto=format&fit=crop"
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/40 to-slate-950" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 py-28 md:py-44">
          <motion.span
            {...REVEAL}
            className="block text-brand-300 font-button font-bold tracking-[0.3em] uppercase text-xs md:text-sm"
          >
            02 — La solución
          </motion.span>

          <motion.h2
            {...REVEAL}
            transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}
            className="font-body font-extrabold italic text-5xl md:text-8xl leading-[0.95] tracking-[-0.04em] mt-6 max-w-4xl"
          >
            Diseñado por riders.<br />
            <span className="text-brand-400">Construido para durar.</span>
          </motion.h2>

          <motion.p
            {...REVEAL}
            transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
            className="mt-10 text-white/80 text-lg md:text-2xl font-body font-light max-w-2xl leading-relaxed"
          >
            Cada Ski-Rack se arma a mano con maderas nativas seleccionadas,
            tornillería de acero inoxidable y un acabado pensado para
            sobrevivir derretimientos, humedad y temporadas largas.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 80 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 1.2, ease: EASE, delay: 0.3 }}
            className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            <div className="md:col-span-2 aspect-[4/3] bg-slate-900 rounded-sm overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1604290516761-df484721f04b?w=2400&q=85&auto=format&fit=crop"
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <div className="grid grid-rows-2 gap-6">
              <div className="bg-slate-900 rounded-sm overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1542226957-1a6cc48f9410?w=1200&q=85&auto=format&fit=crop"
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="bg-slate-900 rounded-sm overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1488376986648-2512dfc6f736?w=1200&q=85&auto=format&fit=crop"
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─────────────────────── FEATURES ─────────────────────── */}
      <section className="relative py-28 md:py-44 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.span
            {...REVEAL}
            className="block text-brand-500 font-button font-bold tracking-[0.3em] uppercase text-xs md:text-sm"
          >
            03 — Detalles
          </motion.span>

          <motion.h2
            {...REVEAL}
            transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}
            className="font-body font-extrabold italic text-4xl md:text-7xl tracking-[-0.03em] leading-[1.05] mt-6 max-w-3xl"
          >
            Cuatro razones para tener uno.
          </motion.h2>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.12 } },
            }}
            className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {[
              {
                title: 'Madera nativa',
                desc: 'Roble, raulí o lenga seleccionado pieza por pieza.',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10h14V10" />
                  </svg>
                ),
              },
              {
                title: 'Hasta 4 pares',
                desc: 'Configurable para skis, snowboards, bastones y botas.',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                ),
              },
              {
                title: 'A prueba de centro',
                desc: 'Acabado marino. Soporta nieve derretida y humedad.',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.5C8 8 6 11 6 14a6 6 0 0012 0c0-3-2-6-6-11.5z" />
                  </svg>
                ),
              },
              {
                title: 'Instalación 5 min',
                desc: 'Anclajes incluidos. Plantilla de instalación lista.',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
              },
            ].map((f) => (
              <motion.div
                key={f.title}
                variants={{
                  hidden: { opacity: 0, y: 40 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
                }}
                className="group relative bg-white border border-gray-200 p-7 hover:border-brand-500 transition-colors"
              >
                <div className="text-brand-500 mb-5">{f.icon}</div>
                <h3 className="font-body font-bold text-xl text-black mb-2">{f.title}</h3>
                <p className="text-gray-600 font-body text-sm leading-relaxed">{f.desc}</p>
                <div className="absolute inset-x-0 bottom-0 h-1 bg-brand-500 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─────────────────────── ENVIRONMENTS ─────────────────────── */}
      <section className="relative py-28 md:py-44 px-6 bg-gray-50 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <motion.span
            {...REVEAL}
            className="block text-brand-500 font-button font-bold tracking-[0.3em] uppercase text-xs md:text-sm"
          >
            04 — Donde sea
          </motion.span>

          <motion.h2
            {...REVEAL}
            transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}
            className="font-body font-extrabold italic text-4xl md:text-7xl tracking-[-0.03em] leading-[1.05] mt-6 max-w-3xl"
          >
            Calza en tu casa,<br />
            <span className="text-brand-500">en tu refugio,</span><br />
            en tu garage.
          </motion.h2>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: 'Casa',
                img: 'https://images.unsplash.com/photo-1605647540924-852290f6b0d5?w=1600&q=85&auto=format&fit=crop',
              },
              {
                title: 'Refugio',
                img: 'https://images.unsplash.com/photo-1454942901704-3c44c11b2ad1?w=1600&q=85&auto=format&fit=crop',
              },
              {
                title: 'Garage',
                img: 'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=1600&q=85&auto=format&fit=crop',
              },
            ].map((s, i) => (
              <motion.div
                key={s.title}
                {...(i % 2 === 0 ? REVEAL_LEFT : REVEAL_RIGHT)}
                transition={{ duration: 0.9, ease: EASE, delay: 0.1 * i }}
                className="relative aspect-[4/5] overflow-hidden group cursor-pointer"
              >
                <img
                  src={s.img}
                  alt={s.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <h3 className="font-body font-extrabold italic text-white text-3xl md:text-4xl tracking-[-0.02em]">
                    {s.title}
                  </h3>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────── BIG QUOTE ─────────────────────── */}
      <section className="relative py-28 md:py-44 px-6 bg-white">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1.2, ease: EASE }}
          >
            <p className="font-body italic font-light text-2xl md:text-5xl leading-[1.2] text-gray-900 max-w-4xl mx-auto">
              &ldquo;Lo único que tu equipo necesita después de una temporada
              dura es <span className="font-extrabold not-italic text-brand-500">un buen lugar para descansar</span>.&rdquo;
            </p>
          </motion.div>
        </div>
      </section>

      {/* ─────────────────────── CTA ─────────────────────── */}
      <section className="relative bg-brand-500 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <img
            src="https://images.unsplash.com/photo-1612997038509-31033c9d17c5?w=3840&q=85&auto=format&fit=crop"
            alt=""
            className="w-full h-full object-cover"
          />
        </div>

        {/* Watermark mirror */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pointer-events-none opacity-50">
          <span
            className="font-body font-extrabold italic text-[18vw] text-white/15 leading-[0.78] tracking-[-0.05em] whitespace-nowrap select-none mb-[1vw]"
            style={{ transform: 'scaleX(-1) translateY(8px)' }}
          >
            SKI-RACK
          </span>
          <h2 className="font-body font-extrabold italic text-[18vw] text-white/15 leading-[0.78] tracking-[-0.05em] whitespace-nowrap select-none">
            SKI-RACK
          </h2>
        </div>

        <div className="relative max-w-4xl mx-auto px-6 py-28 md:py-40 text-center">
          <motion.span
            {...REVEAL}
            className="block text-white/70 font-button font-bold tracking-[0.3em] uppercase text-xs md:text-sm"
          >
            05 — Reservá el tuyo
          </motion.span>

          <motion.h2
            {...REVEAL}
            transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}
            className="font-body font-extrabold italic text-5xl md:text-8xl tracking-[-0.04em] leading-[0.95] mt-6"
          >
            ¿Listo para colgar tus skis?
          </motion.h2>

          <motion.p
            {...REVEAL}
            transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
            className="mt-8 text-white/85 text-lg md:text-xl font-body font-light max-w-xl mx-auto"
          >
            Producción limitada. Cada rack se hace por encargo, sobre medida.
          </motion.p>

          <motion.div
            {...REVEAL}
            transition={{ duration: 0.9, ease: EASE, delay: 0.3 }}
            className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="https://wa.me/56964880714?text=Hola%2C%20quiero%20un%20Ski-Rack"
              target="_blank"
              rel="noopener noreferrer"
              className="shine-beam shine-beam-dark hover-wave pressable inline-flex items-center justify-center gap-2.5 bg-white text-brand-500 hover:!text-brand-700 transition-colors duration-500 px-8 py-4 font-button font-bold tracking-wide text-base"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
              </svg>
              Pedí el tuyo por WhatsApp
            </Link>
            <Link
              href="mailto:reskichile@gmail.com?subject=Quiero%20un%20Ski-Rack"
              className="hover-wave pressable inline-flex items-center justify-center gap-2.5 border border-white/40 bg-white/10 backdrop-blur-sm text-white hover:!text-brand-500 transition-colors duration-500 px-8 py-4 font-button font-bold tracking-wide text-base"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Escribir por mail
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
