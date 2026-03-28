import type { Metadata, Viewport } from 'next'
import { Montserrat, DM_Sans } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'
import Header from '@/components/Header'
import StickyHeader from '@/components/StickyHeader'
import Footer from '@/components/Footer'
import ScreenLock from '@/components/ScreenLock'
import ScrollToTop from '@/components/ScrollToTop'
import NavigationProgress from '@/components/NavigationProgress'
import { cn } from '@/lib/utils'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '500', '600', '700', '900'],
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

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-nav',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: 'ReskiChile - Equipamiento de montaña usado',
  description: 'Marketplace de equipamiento usado de ski, snowboard y escalada en Chile',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={cn(norwester.variable, kollektif.variable, montserrat.variable, dmSans.variable)}>
      <body className={`${montserrat.className} min-h-screen flex flex-col antialiased text-slate-900 font-light`}>
        <NavigationProgress />
        <ScrollToTop />
        <ScreenLock>
          <StickyHeader><Header /></StickyHeader>
          <div className="h-[95px] md:h-[130px]" />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
        </ScreenLock>
      </body>
    </html>
  )
}
