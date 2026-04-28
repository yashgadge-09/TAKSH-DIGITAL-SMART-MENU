import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { CartProvider } from '@/context/CartContext'
import { LanguageProvider } from '@/context/LanguageContext'
import { Toaster } from 'sonner'
import { SplashScreen } from '@/components/SplashScreen'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'TAKSH — Pure Veg Restaurant',
  description: 'Discover handcrafted Indian classics at Taksh — a luxurious pure vegetarian dining experience.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} bg-background`} suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground" suppressHydrationWarning>
        <SplashScreen />
        <LanguageProvider>
          <CartProvider>
            {children}
            <Toaster 
              position="top-center" 
              toastOptions={{
                style: {
                  background: 'oklch(0.18 0.025 50)',
                  color: 'oklch(0.88 0.09 80)',
                  border: '1px solid oklch(0.82 0.13 82 / 0.3)',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                  borderRadius: '12px',
                },
                className: 'font-sans font-medium',
              }}
            />
          </CartProvider>
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  )
}
