import type { Metadata } from 'next'
import CoachShell from '@/components/CoachShell'

export const metadata: Metadata = {
  title: 'Casanova Coach',
  manifest: '/manifest-coach.json',
  appleWebApp: {
    capable: true,
    title: 'Coach',
    statusBarStyle: 'black-translucent',
  },
}

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return <CoachShell>{children}</CoachShell>
}
