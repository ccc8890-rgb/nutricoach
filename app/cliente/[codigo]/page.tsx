'use client'

import { useParams } from 'next/navigation'
import DashboardCliente from '@/components/PortalCliente/DashboardCliente'

export default function ClientePublicoPage() {
    const { codigo } = useParams<{ codigo: string }>()

    if (!codigo) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8FAFC' }}>
                <div className="card p-12 text-center">
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Código no válido</h1>
                    <p className="text-gray-500 text-sm">El enlace que has utilizado no es correcto.</p>
                </div>
            </div>
        )
    }

    return <DashboardCliente codigo={codigo} />
}
