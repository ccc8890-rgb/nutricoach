import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Casanova Nutrition",
  description: "Tu plataforma de coaching nutricional y de entrenamiento",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  )
}
