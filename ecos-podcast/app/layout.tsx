import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { esES } from '@clerk/localizations'
import { brand } from '@/lib/config/brand'
import { CLERK_ACTIVE } from '@/lib/env'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { GrainOverlay } from '@/components/GrainOverlay'
import './globals.css'

export const metadata: Metadata = {
  title: `${brand.name} · ${brand.tagline}`,
  description: brand.slogan,
  openGraph: {
    title: `${brand.name} · ${brand.tagline}`,
    description: brand.slogan,
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0806',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const shell = (
    <html lang="es">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-ink-900 text-cream-100 antialiased">
        <GrainOverlay />
        <Nav />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  )

  if (!CLERK_ACTIVE) return shell

  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      localization={esES}
      appearance={{
        variables: {
          colorPrimary: '#c9a961',
          colorBackground: '#100d0a',
          colorInputBackground: '#0a0806',
          colorInputText: '#f5e9d3',
          colorText: '#f5e9d3',
          colorTextSecondary: '#c7b58f',
          fontFamily: 'Inter, sans-serif',
        },
      }}
    >
      {shell}
    </ClerkProvider>
  )
}
