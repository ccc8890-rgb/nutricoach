import type { Metadata } from 'next'
import CachePortal from '@/components/PortalCliente/CachePortal'

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
  return <CachePortal>{children}</CachePortal>
}
