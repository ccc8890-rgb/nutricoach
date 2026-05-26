'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import CoachShell from '@/components/CoachShell'

export default function RecetasShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo') ?? ''
  const isPublicClientRecipe = /^\/recetas\/[^/]+$/.test(pathname) && returnTo.startsWith('/cliente/')

  if (isPublicClientRecipe) {
    return (
      <main className="min-h-screen pb-nav-safe" style={{ background: 'var(--bg)' }}>
        {children}
      </main>
    )
  }

  return <CoachShell>{children}</CoachShell>
}
