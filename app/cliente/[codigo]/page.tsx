import { redirect } from 'next/navigation'
import DashboardCliente from '@/components/PortalCliente/DashboardCliente'
import { createServerSupabase } from '@/lib/supabase-server'

interface ClientePublicoPageProps {
    params: Promise<{ codigo: string }>
}

export default async function ClientePublicoPage({ params }: ClientePublicoPageProps) {
    const { codigo } = await params

    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role === 'cliente') {
            redirect('/cliente')
        }
    }

    if (!codigo) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8FAFC' }}>
                <div className="card p-12 text-center">
                    <h1 className="text-xl font-bold text-[var(--text)] mb-2">Código no válido</h1>
                    <p className="text-[var(--text-muted)] text-sm">El enlace que has utilizado no es correcto.</p>
                </div>
            </div>
        )
    }

    return <DashboardCliente codigo={codigo} />
}
