import type { Metadata } from "next"
import { Inter } from "next/font/google"
import Script from "next/script"
import "./globals.css"
import { ToastProvider } from '@/components/ui/Toast'
import { ThemeProvider } from '@/components/ThemeProvider'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: "Casanova Nutrition",
  description: "Plataforma profesional de coaching nutricional y de entrenamiento",
  manifest: "/manifest.json",
  icons: [
    { rel: "icon", url: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
    { rel: "icon", url: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    { rel: "apple-touch-icon", url: "/icon-192.svg" },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`h-full ${inter.variable}`} suppressHydrationWarning>
      <body className="min-h-full font-sans" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, var(--font-inter), system-ui, sans-serif' }}>
        <ThemeProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
        {/* SW desactivado temporalmente en dev por incompatibilidad con Safari/Turbopack */}
      </body>
    </html>
  )
}
