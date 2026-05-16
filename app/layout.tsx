import type { Metadata, Viewport } from "next"
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import Script from "next/script"
import "./globals.css"
import { ToastProvider } from '@/components/ui/Toast'
import { ThemeProvider } from '@/components/ThemeProvider'

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
    <html lang="es" className={`h-full ${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body
        className="min-h-full font-sans overflow-x-hidden"
        style={{
          fontFamily: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
          WebkitTapHighlightColor: 'transparent',
          overscrollBehavior: 'none',
        }}
      >
        <ThemeProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
        <Script
          id="register-sw"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    console.log('[SW] Registrado correctamente:', reg.scope);
                    reg.addEventListener('updatefound', function() {
                      console.log('[SW] Nueva versión disponible, recarga para actualizar');
                    });
                  }).catch(function(err) {
                    console.warn('[SW] Error al registrar:', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
