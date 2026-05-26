import { Suspense } from 'react'
import RecetasShell from '@/components/RecetasShell'

export default function RecetasLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <RecetasShell>{children}</RecetasShell>
    </Suspense>
  )
}
