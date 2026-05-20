// app/api/auto-coach/analizar/route.ts
// ═══════════════════════════════════════════════════════════════
// AutoCoach — API de análisis proactivo de clientes.
// Ejecuta el motor heurístico + resumen IA y devuelve
// el dashboard de recomendaciones para el coach.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import {
  analizarTodosClientes,
  generarResumenIA,
} from '@/lib/auto-coach'
import type { AutoCoachDashboard } from '@/types'

export async function GET() {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const coachId = user.id

    // 1. Análisis heurístico de todos los clientes activos
    const dashboard: AutoCoachDashboard = await analizarTodosClientes(coachId)

    // 2. Generar resumen IA (no bloquear si falla)
    const resumenIa = dashboard.recomendaciones_pendientes > 0
      ? await generarResumenIA(dashboard)
      : ''

    // 3. Asignar resumen a cada análisis que tenga recomendaciones
    const analisisConResumen = dashboard.analisis.map(a => ({
      ...a,
      resumen_ia: resumenIa,
    }))

    return NextResponse.json({
      ...dashboard,
      analisis: analisisConResumen,
      resumen_ia: resumenIa,
    })
  } catch (e) {
    console.error('[auto-coach] Error en análisis:', e)
    return NextResponse.json(
      { error: 'Error interno al analizar clientes' },
      { status: 500 }
    )
  }
}
