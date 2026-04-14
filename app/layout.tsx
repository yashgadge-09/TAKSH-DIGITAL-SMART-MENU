import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { CartProvider } from '@/context/CartContext'
import { LanguageProvider } from '@/context/LanguageContext'
import { Toaster } from 'sonner'
import { SplashScreen } from '@/components/SplashScreen'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'TAKSH - Restaurant Menu',
  description: 'TAKSH - Delicious Indian Cuisine',
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
    <html lang="en">
      <body className="font-sans antialiased bg-[#F8F1E8]" suppressHydrationWarning>
        <SplashScreen />
        <LanguageProvider>
          <CartProvider>
            {children}
            <Toaster 
              position="top-center" 
              toastOptions={{
                style: {
                  background: '#1A140F',
                  color: '#E7CFA8',
                  border: '1px solid rgba(226, 139, 75, 0.3)',
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
