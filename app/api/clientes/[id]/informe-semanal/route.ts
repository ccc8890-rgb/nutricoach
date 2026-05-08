import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { construirPromptInformeSemanal, generarInformeSemanalIA } from '@/lib/deepseek'
import { registrarInteraccionIA } from '@/lib/ia-logger'

export async function POST(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createServerSupabase()
        const { id } = await params

        // 0. Verificar autenticación
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        // 1. Obtener datos del cliente
        const { data: cliente, error: errCliente } = await supabase
            .from('clientes')
            .select('*, profile:profiles!profile_id(nombre, apellidos)')
            .eq('id', id)
            .single()

        if (errCliente || !cliente) {
            return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
        }

        const nombreCompleto = `${cliente.profile?.nombre || ''} ${cliente.profile?.apellidos || ''}`.trim() || 'Cliente'

        // 2. Obtener peso history (últimos 14 registros)
        const { data: pesoHistory } = await supabase
            .from('seguimiento_peso')
            .select('fecha, peso')
            .eq('cliente_id', id)
            .order('fecha', { ascending: false })
            .limit(14)

        // 3. Obtener check-ins de la última semana
        const unaSemanaAtras = new Date()
        unaSemanaAtras.setDate(unaSemanaAtras.getDate() - 7)

        const { data: checkins } = await supabase
            .from('checkins')
            .select('fecha, adherencia, energia, sueno, peso, notas')
            .eq('cliente_id', id)
            .gte('fecha', unaSemanaAtras.toISOString())
            .order('fecha', { ascending: false })

        // 4. Construir prompt y llamar a DeepSeek
        const prompt = construirPromptInformeSemanal(
            {
                nombre: nombreCompleto,
                peso_inicial: cliente.peso_inicial,
                objetivo: cliente.objetivo,
            },
            (pesoHistory ?? []).map(r => ({ fecha: new Date(r.fecha).toLocaleDateString('es-ES'), peso: r.peso })),
            (checkins ?? []).map(c => ({
                fecha: new Date(c.fecha).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
                adherencia: c.adherencia,
                energia: c.energia,
                sueno: c.sueno,
                peso: c.peso,
                notas: c.notas,
            }))
        )

        const { data: informe, total_tokens: totalTokens } = await generarInformeSemanalIA(prompt)

        // 5. Loguear interacción IA (con tokens)
        registrarInteraccionIA({
            coachId: user.id,
            clienteId: id,
            tipo: 'informe_semanal',
            prompt,
            respuestaJson: informe as unknown as Record<string, unknown>,
            tokensUsados: totalTokens,
        }).catch(err => console.error('[ia-logger] Error al registrar informe semanal:', err))

        return NextResponse.json({
            informe,
            meta: {
                cliente: nombreCompleto,
                periodo: 'últimos 7 días',
                total_checkins: (checkins ?? []).length,
                total_pesos: (pesoHistory ?? []).length,
            },
        })
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Error interno'
        console.error('[informe-semanal]', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
