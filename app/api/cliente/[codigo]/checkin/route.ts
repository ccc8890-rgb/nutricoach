import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function POST(
    request: Request,
    { params }: { params: Promise<{ codigo: string }> }
) {
    try {
        const supabase = await createServerSupabase()
        const { codigo } = await params
        const body = await request.json()
        const { peso, adherencia, energia, sueno, notas } = body

        // Buscar cliente por código del plan
        const { data: plan } = await supabase
            .from('planes_nutricion')
            .select('cliente_id')
            .eq('codigo_publico', codigo)
            .eq('activo', true)
            .single()

        if (!plan) {
            return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
        }

        if (!plan.cliente_id) {
            return NextResponse.json({ error: 'Este plan no tiene un cliente asignado. Crea un cliente primero.' }, { status: 400 })
        }

        // Crear check-in
        const { data, error } = await supabase
            .from('checkins')
            .insert({
                cliente_id: plan.cliente_id,
                peso: peso || null,
                adherencia: adherencia || null,
                energia: energia || null,
                sueno: sueno || null,
                notas: notas || null,
            })
            .select()
            .single()

        if (error) {
            console.error('Error al crear check-in:', error)
            return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
        }

        // Si también envió peso, guardarlo en seguimiento_peso
        if (peso) {
            await supabase.from('seguimiento_peso').insert({
                cliente_id: plan.cliente_id,
                peso,
                // Usar fecha en zona horaria local (España UTC+2)
                fecha: new Date().toLocaleDateString('en-CA'),
                notas: 'Check-in semanal',
            })
        }

        return NextResponse.json({ success: true, checkin: data })
    } catch (err) {
        console.error('Error en checkin:', err)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}
