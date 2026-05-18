import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { sendRecordatorioCheckinEmail } from '@/lib/emails/recordatorio-checkin'

export async function GET(request: Request) {
    // Protección: solo CRON_SECRET puede ejecutar esto
    const authHeader = request.headers.get('Authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
        console.warn('[cron/recordatorio-checkin] CRON_SECRET no configurado — ruta deshabilitada')
        return NextResponse.json({ error: 'Service not configured' }, { status: 503 })
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = createServiceSupabase()

    // 1. Buscar clientes activos
    const { data: clientes, error: errClientes } = await db
        .from('clientes')
        .select(`
            id,
            profile:profiles!profile_id(nombre, email),
            planes:planes_nutricion!inner(codigo_publico, activo)
        `)
        .eq('activo', true)

    if (errClientes) {
        console.error('[cron/recordatorio-checkin] Error al buscar clientes:', errClientes)
        return NextResponse.json({ error: errClientes.message }, { status: 500 })
    }

    if (!clientes?.length) {
        return NextResponse.json({ enviados: 0, saltados: 0, errores: 0 })
    }

    const resultados = {
        enviados: 0,
        saltados: 0,
        errores: 0,
        detalles: [] as string[],
    }

    for (const cliente of clientes) {
        try {
            const codigoPublico = cliente.planes?.[0]?.codigo_publico
            const email = (cliente.profile as { nombre?: string; email?: string } | null)?.email
            const nombre = (cliente.profile as { nombre?: string; email?: string } | null)?.nombre ?? 'cliente'

            if (!email || !codigoPublico) {
                resultados.saltados++
                resultados.detalles.push(`[${cliente.id}] saltado — sin email o código público`)
                continue
            }

            // 2. Buscar último check-in del cliente
            const { data: ultimoCheckin } = await db
                .from('checkins')
                .select('fecha')
                .eq('cliente_id', cliente.id)
                .order('fecha', { ascending: false })
                .limit(1)
                .maybeSingle()

            const diasSinCheckin = ultimoCheckin?.fecha
                ? Math.floor((Date.now() - new Date(ultimoCheckin.fecha).getTime()) / (1000 * 60 * 60 * 24))
                : 999

            // 3. Si lleva 7+ días sin check-in, enviar recordatorio
            if (diasSinCheckin >= 7) {
                const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://nutricoach.vercel.app'}/cliente`
                await sendRecordatorioCheckinEmail({ to: email, nombre, portalUrl })
                resultados.enviados++
                resultados.detalles.push(`[${cliente.id}] ✅ recordatorio enviado a ${email} (${diasSinCheckin}d sin check-in)`)
            } else {
                resultados.saltados++
                resultados.detalles.push(`[${cliente.id}] saltado — ${diasSinCheckin}d desde último check-in`)
            }
        } catch (err) {
            resultados.errores++
            resultados.detalles.push(`[${cliente.id}] ❌ error: ${err instanceof Error ? err.message : 'desconocido'}`)
        }
    }

    console.log('[cron/recordatorio-checkin] Resultados:', resultados)

    return NextResponse.json(resultados)
}
