import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import { Montserrat, Outfit, Space_Grotesk } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'
import Header from '@/components/Header'
import StickyHeader from '@/components/StickyHeader'
import Footer from '@/components/Footer'
import LayoutChrome from '@/components/LayoutChrome'
import ScrollToTop from '@/components/ScrollToTop'
import NavigationProgress from '@/components/NavigationProgress'
import PageViewTracker from '@/components/PageViewTracker'
import { cn } from '@/lib/utils'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
  variable: '--font-body',
})

const norwester = localFont({
  src: '../fonts/norwester.woff',
  variable: '--font-display',
  display: 'swap',
})

const kollektif = localFont({
  src: '../fonts/Kollektif.ttf',
  variable: '--font-sub',
  display: 'swap',
})

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['200', '300', '500'],
  variable: '--font-nav',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-button',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: 'resizes-content',
}

export const metadata: Metadata = {
  title: 'ReskiChile - Equipamiento de montaña usado',
  description: 'Marketplace de equipamiento usado de ski, snowboard y escalada en Chile',
  icons: {
    icon: '/favicon.svg',
  },
  manifest: '/manifest.json',
  other: {
    'theme-color': '#2674bf',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={cn(norwester.variable, kollektif.variable, montserrat.variable, outfit.variable, spaceGrotesk.variable)}>
      <body className={`${montserrat.className} min-h-screen flex flex-col antialiased text-slate-900 font-light`}>
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <ScrollToTop />
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
        <LayoutChrome
          header={<StickyHeader><Header /></StickyHeader>}
          footer={<Footer />}
        >
          {children}
        </LayoutChrome>
      </body>
    </html>
  )
}
