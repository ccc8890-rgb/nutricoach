import type { Metadata, Viewport } from "next"
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
  appleWebApp: {
    capable: true,
    title: "Casanova Nutrition",
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0B" },
    { media: "(prefers-color-scheme: light)", color: "#F2F2F4" },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`h-full ${inter.variable}`} suppressHydrationWarning>
      <body
        className="min-h-full font-sans overflow-x-hidden"
        style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, var(--font-inter), system-ui, sans-serif',
          WebkitTapHighlightColor: 'transparent',
          overscrollBehavior: 'none',
        }}
      >
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
