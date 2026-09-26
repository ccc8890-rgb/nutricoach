import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Casanova Cliente',
  manifest: '/manifest-cliente-carlos.json',
  appleWebApp: {
    capable: true,
    title: 'Cliente',
    statusBarStyle: 'black-translucent',
  },
}

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  return children
}
