import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export type Logro = {
    id: string
    icono: string
    titulo: string
    descripcion: string
    progreso: number        // 0-100
    actual: number
    meta: number
    conseguido: boolean
    categoria: 'peso' | 'checkin' | 'constancia' | 'plan'
}

async function calcularLogros(clienteId: string, supabase: ReturnType<typeof createServerClient>): Promise<Logro[]> {
    // Obtener datos del cliente
    const { data: cliente } = await supabase
        .from('clientes')
        .select('*, planes_nutricion!inner(created_at, activo)')
        .eq('id', clienteId)
        .eq('planes_nutricion.activo', true)
        .single()

    // Obtener count de checkins
    const { count: totalCheckins } = await supabase
        .from('checkins')
        .select('*', { count: 'exact', head: true })
        .eq('cliente_id', clienteId)

    // Obtener count de registros de peso
    const { count: totalPesos } = await supabase
        .from('seguimiento_peso')
        .select('*', { count: 'exact', head: true })
        .eq('cliente_id', clienteId)

    // Obtener fecha del primer peso y último
    const { data: pesos } = await supabase
        .from('seguimiento_peso')
        .select('peso, fecha')
        .eq('cliente_id', clienteId)
        .order('fecha', { ascending: false })
        .limit(2)

    // Calcular días desde que empezó el plan activo
    const planActivo = cliente?.planes_nutricion?.[0] as { created_at: string } | undefined
    const fechaInicio = planActivo?.created_at ? new Date(planActivo.created_at) : null
    const diasTranscurridos = fechaInicio
        ? Math.floor((Date.now() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24))
        : 0

    // Calcular progreso de peso
    let pesoPerdido = 0
    if (pesos && pesos.length >= 2) {
        const primero = pesos[pesos.length - 1]
        const ultimo = pesos[0]
        if (primero?.peso && ultimo?.peso) {
            pesoPerdido = Math.abs(primero.peso - ultimo.peso)
        }
    }

    const logros: Logro[] = [
        {
            id: 'primer-peso',
            icono: '🎯',
            titulo: 'Primer paso',
            descripcion: 'Registra tu peso por primera vez',
            progreso: Math.min(100, (totalPesos ?? 0) * 100),
            actual: Math.min(1, totalPesos ?? 0),
            meta: 1,
            conseguido: (totalPesos ?? 0) >= 1,
            categoria: 'peso',
        },
        {
            id: 'constancia-peso',
            icono: '📊',
            titulo: 'Constancia en el peso',
            descripcion: totalPesos && totalPesos >= 15
                ? `¡${totalPesos} registros! Increíble constancia`
                : totalPesos && totalPesos >= 5
                    ? `${totalPesos} registros de peso — buen hábito`
                    : 'Registra tu peso 15 veces',
            progreso: Math.min(100, ((totalPesos ?? 0) / 15) * 100),
            actual: totalPesos ?? 0,
            meta: 15,
            conseguido: (totalPesos ?? 0) >= 15,
            categoria: 'peso',
        },
        {
            id: 'rastreador-experto',
            icono: '🏆',
            titulo: 'Rastreador experto',
            descripcion: 'Registra tu peso 30 veces',
            progreso: Math.min(100, ((totalPesos ?? 0) / 30) * 100),
            actual: totalPesos ?? 0,
            meta: 30,
            conseguido: (totalPesos ?? 0) >= 30,
            categoria: 'peso',
        },
        {
            id: 'primer-checkin',
            icono: '✅',
            titulo: 'Primer check-in',
            descripcion: 'Completa tu primer check-in semanal',
            progreso: Math.min(100, (totalCheckins ?? 0) * 100),
            actual: Math.min(1, totalCheckins ?? 0),
            meta: 1,
            conseguido: (totalCheckins ?? 0) >= 1,
            categoria: 'checkin',
        },
        {
            id: 'checkin-regular',
            icono: '📅',
            titulo: 'Check-in regular',
            descripcion: totalCheckins && totalCheckins >= 5
                ? `${totalCheckins} check-ins completados — ¡ritmo!`
                : 'Completa 5 check-ins semanales',
            progreso: Math.min(100, ((totalCheckins ?? 0) / 5) * 100),
            actual: totalCheckins ?? 0,
            meta: 5,
            conseguido: (totalCheckins ?? 0) >= 5,
            categoria: 'checkin',
        },
        {
            id: 'checkin-pro',
            icono: '⭐',
            titulo: 'Check-in Pro',
            descripcion: 'Completa 10 check-ins sin perder semana',
            progreso: Math.min(100, ((totalCheckins ?? 0) / 10) * 100),
            actual: totalCheckins ?? 0,
            meta: 10,
            conseguido: (totalCheckins ?? 0) >= 10,
            categoria: 'checkin',
        },
        {
            id: 'peso-logrado',
            icono: '💪',
            titulo: 'Progreso real',
            descripcion: pesoPerdido >= 1
                ? `¡${pesoPerdido.toFixed(1)} kg de cambio!`
                : 'Acumula 1 kg de progreso en peso',
            progreso: Math.min(100, (pesoPerdido / 1) * 100),
            actual: Math.round(pesoPerdido * 10) / 10,
            meta: 1,
            conseguido: pesoPerdido >= 1,
            categoria: 'peso',
        },
        {
            id: 'transformacion',
            icono: '🔥',
            titulo: 'Transformación',
            descripcion: pesoPerdido >= 3
                ? `¡${pesoPerdido.toFixed(1)} kg de transformación!`
                : 'Acumula 3 kg de progreso en peso',
            progreso: Math.min(100, (pesoPerdido / 3) * 100),
            actual: Math.round(pesoPerdido * 10) / 10,
            meta: 3,
            conseguido: pesoPerdido >= 3,
            categoria: 'peso',
        },
        {
            id: 'dedicacion-semana',
            icono: '🗓️',
            titulo: 'Una semana',
            descripcion: diasTranscurridos >= 7
                ? '¡Llevas una semana con el plan!'
                : 'Lleva 7 días con el plan activo',
            progreso: Math.min(100, (diasTranscurridos / 7) * 100),
            actual: diasTranscurridos,
            meta: 7,
            conseguido: diasTranscurridos >= 7,
            categoria: 'plan',
        },
        {
            id: 'dedicacion-mes',
            icono: '📆',
            titulo: 'Un mes',
            descripcion: diasTranscurridos >= 30
                ? '¡Llevas un mes entero! Sigue así'
                : 'Lleva 30 días con el plan activo',
            progreso: Math.min(100, (diasTranscurridos / 30) * 100),
            actual: diasTranscurridos,
            meta: 30,
            conseguido: diasTranscurridos >= 30,
            categoria: 'plan',
        },
        {
            id: 'dedicacion-tres-meses',
            icono: '🎉',
            titulo: '3 meses de dedicación',
            descripcion: diasTranscurridos >= 90
                ? `¡Ya son ${diasTranscurridos} días! Impresionante`
                : '90 días con tu plan de coaching',
            progreso: Math.min(100, (diasTranscurridos / 90) * 100),
            actual: diasTranscurridos,
            meta: 90,
            conseguido: diasTranscurridos >= 90,
            categoria: 'plan',
        },
    ]

    return logros
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ codigo: string }> }
) {
    try {
        const { codigo } = await params
        const cookieStore = await cookies()
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return cookieStore.getAll() },
                    setAll() { /* readonly */ },
                },
            }
        )

        // Verificar que el cliente existe por codigo_publico
        const { data: planCliente } = await supabase
            .from('planes_nutricion')
            .select('cliente_id')
            .eq('codigo_publico', codigo)
            .eq('activo', true)
            .maybeSingle()

        if (!planCliente) {
            return NextResponse.json({ logros: [] })
        }

        const logros = await calcularLogros(planCliente.cliente_id, supabase)

        return NextResponse.json({ logros })
    } catch (err) {
        console.error('[LOGROS] Error:', err)
        return NextResponse.json({ logros: [] })
    }
}
