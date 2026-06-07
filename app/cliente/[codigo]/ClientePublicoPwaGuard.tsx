'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface ClientePublicoPwaGuardProps {
    children: React.ReactNode
}

function isStandalonePwa() {
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    )
}

function safeNext(path: string) {
    return encodeURIComponent(path)
}

export default function ClientePublicoPwaGuard({ children }: ClientePublicoPwaGuardProps) {
    const [ready, setReady] = useState(false)

    useEffect(() => {
        async function routeStandalonePwa() {
            if (!isStandalonePwa()) {
                setReady(true)
                return
            }

            const { data: sessionData } = await supabase.auth.getSession()
            const session = sessionData.session

            if (!session) {
                window.location.replace(`/login?next=${safeNext('/cliente')}&pwa=1`)
                return
            }

            try {
                await fetch('/api/auth/callback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        access_token: session.access_token,
                        refresh_token: session.refresh_token,
                    }),
                })
            } catch {
                // La ruta destino volvera a comprobar sesion; no mostramos el portal publico.
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single()

            if (profile?.role === 'cliente') {
                window.location.replace('/cliente')
                return
            }

            window.location.replace('/dashboard')
        }

        routeStandalonePwa().catch(() => {
            window.location.replace(`/login?next=${safeNext('/cliente')}&pwa=1`)
        })
    }, [])

    if (!ready) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
                <div className="w-8 h-8 rounded-full border-2 border-[var(--border)] border-t-[var(--accent)] animate-spin" />
            </div>
        )
    }

    return <>{children}</>
}
