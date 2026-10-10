import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import { rateLimit } from '@/lib/rate-limit'
import type { FaseBloque } from '@/lib/entrenos/bloques'
import { ErrorGeneracionPlan, generarPlanEntrenoIA } from '@/lib/entrenos/generar-plan-ia'
import { guardarPlanEntreno, type SesionIA } from '@/lib/entrenos/guardar-plan'

export const maxDuration = 120

/**
 * Generador que guarda el plan al instante. Solo lo usa «revisar plan» (cliente nuevo, sin plan que proteger).
 * Para un cliente con plan en curso se usa /api/entrenos/planificar-ia, que entrega una propuesta aprobable.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createApiSupabase(req)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!rateLimit(`proponer-entreno:${user.id}`, 5, 60_000)) return NextResponse.json({ error: 'Demasiadas peticiones. Espera un momento.' }, { status: 429 })

    const { cliente_id, fase_bloque_objetivo } = await req.json() as { cliente_id?: string; fase_bloque_objetivo?: FaseBloque }
    if (!cliente_id) return NextResponse.json({ error: 'Falta cliente_id' }, { status: 400 })
    const FASES_VALIDAS: FaseBloque[] = ['Base', 'Fuerza', 'Resistencia', 'Deload']
    if (fase_bloque_objetivo && !FASES_VALIDAS.includes(fase_bloque_objetivo)) return NextResponse.json({ error: 'fase_bloque_objetivo inválida' }, { status: 400 })

    const sb = createServiceSupabase()
    // Antes solo se comprobaba que hubiera sesión: cualquier usuario podía generar planes de cualquier cliente.
    const autorizado = await autorizarCoachCliente(sb, { userId: user.id, clienteId: cliente_id })
    if (!autorizado.ok) return NextResponse.json({ error: autorizado.mensaje }, { status: autorizado.status })

    const r = await generarPlanEntrenoIA(sb, { clienteId: cliente_id, faseBloqueObjetivo: fase_bloque_objetivo })

    let planGuardadoId: string | null = null
    try {
      planGuardadoId = (await guardarPlanEntreno(sb, {
        coachId: user.id, clienteId: cliente_id, nombre: r.nombrePlan, descripcion: (r.planIA.fundamentacion as string) ?? null,
        duracionSemanas: r.duracionSemanas, faseBloque: r.faseBloque, sesiones: (r.planIA.sesiones as SesionIA[]) ?? [],
      })).planId
      await sb.from('registros_ia').insert({
        cliente_id, tipo: 'plan_entreno_ia',
        respuesta_json: { ...r.planIA, ...(r.validacion ? { _validacion: r.validacion } : {}), ...(r.macrociclo ? { _macrociclo: r.macrociclo } : {}) },
      })
    } catch (saveErr) {
      // No bloqueante: devolvemos el plan aunque falle el guardado
      console.error('proponer-plan-ciencia save error:', saveErr)
    }

    return NextResponse.json({ plan: r.planIA, plan_id: planGuardadoId, validacion: r.validacion, macrociclo: r.macrociclo, metadata: r.metadata })
  } catch (err) {
    if (err instanceof ErrorGeneracionPlan) return NextResponse.json({ error: err.message }, { status: err.estado })
    console.error('proponer-plan-ciencia error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
