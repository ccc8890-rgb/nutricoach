import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { evaluarPerfilEntreno } from '@/lib/motor-entreno'
import type { PerfilEntrenoCliente } from '@/types'

const DEEPSEEK_BASE = 'https://api.deepseek.com/v1/chat/completions'
const MODEL = 'deepseek-chat'

export async function POST(req: NextRequest) {
  try {
    const supabase = createApiSupabase(req)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { cliente_id } = await req.json()
    if (!cliente_id) return NextResponse.json({ error: 'Falta cliente_id' }, { status: 400 })

    const sb = createServiceSupabase()

    // Cargar cliente + onboarding + perfil atleta
    const [clienteRes, perfilEntrenoRes, onboardingRes, sesionesCompletadasRes] = await Promise.all([
      sb.from('clientes')
        .select('*, profiles:profiles!profile_id(nombre, apellidos, edad, sexo, peso_actual)')
        .eq('id', cliente_id).single(),
      sb.from('perfil_entreno_cliente').select('*').eq('cliente_id', cliente_id).maybeSingle(),
      sb.from('onboarding_responses').select('*').eq('cliente_id', cliente_id).maybeSingle(),
      sb.from('sesiones_completadas')
        .select('rpe, created_at')
        .eq('cliente_id', cliente_id)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    if (!clienteRes.data) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    const cliente = clienteRes.data
    const perfilEntreno = perfilEntrenoRes.data as PerfilEntrenoCliente | null
    const onboarding = onboardingRes.data
    const sesionesCompletadas = sesionesCompletadasRes.data ?? []

    // Tendencia RPE para ajuste dinámico
    const rpes = sesionesCompletadas.map(s => s.rpe).filter(Boolean) as number[]
    const rpePromedio = rpes.length > 0 ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null
    let ajusteRpe = ''
    if (rpePromedio !== null) {
      if (rpePromedio > 8.5) ajusteRpe = `RPE promedio reciente: ${rpePromedio.toFixed(1)}/10 (MUY ALTO). REDUCIR volumen/intensidad un 15-20%.`
      else if (rpePromedio < 6.0) ajusteRpe = `RPE promedio reciente: ${rpePromedio.toFixed(1)}/10 (BAJO). AUMENTAR carga o volumen progresivamente.`
      else ajusteRpe = `RPE promedio reciente: ${rpePromedio.toFixed(1)}/10 (ÓPTIMO). Mantener progresión actual.`
    }

    // Recomendación del motor
    let recomendacion = null
    let modalidadFoco = 'funcional'
    if (perfilEntreno) {
      recomendacion = evaluarPerfilEntreno(perfilEntreno)
      modalidadFoco = perfilEntreno.sport_modality ?? 'funcional'
    }

    // Papeles relevantes de KB según modalidad
    const kbRes = await sb.from('knowledge_base')
      .select('titulo, resumen, referencias, tags')
      .or(`tags.cs.{${modalidadFoco}},tags.cs.{fuerza},tags.cs.{cardio},tags.cs.{hiit}`)
      .limit(5)
    const papers = kbRes.data ?? []

    const evidenciasTexto = papers.length > 0
      ? papers.map(p => `• ${p.titulo}\n  ${p.resumen?.slice(0, 200) ?? ''}\n  Refs: ${(p.referencias as string[])?.slice(0, 2).join('; ')}`).join('\n\n')
      : 'Sin papers específicos — usar principios ACSM/NSCA generales.'

    // Perfil del cliente
    const perfil = cliente.profiles as { nombre?: string; apellidos?: string; edad?: number } | null
    const nombre = perfil ? `${perfil.nombre ?? ''} ${perfil.apellidos ?? ''}`.trim() : 'Cliente'
    const diasSemana = perfilEntreno?.dias_disponibles ?? onboarding?.dias_entreno ?? 3
    const objetivo = cliente.objetivo ?? 'salud_general'
    const nivel = cliente.nivel ?? 'principiante'

    const promptSistema = `Eres un entrenador personal de élite especializado en periodización científica.
Generas planes de entrenamiento personalizados basados en evidencia científica peer-reviewed.
SIEMPRE respondes en JSON válido con la estructura especificada. NUNCA añades texto fuera del JSON.`

    const promptUsuario = `Genera un plan de entrenamiento personalizado para este cliente.

## PERFIL DEL CLIENTE
- Nombre: ${nombre}
- Objetivo: ${objetivo}
- Nivel: ${nivel}
- Días disponibles: ${diasSemana}/semana
- Modalidad principal: ${modalidadFoco}
${perfilEntreno?.vo2max_estimado ? `- VO2max: ${perfilEntreno.vo2max_estimado} ml/kg/min` : ''}
${perfilEntreno?.ftp_watts ? `- FTP cycling: ${perfilEntreno.ftp_watts}W` : ''}
${perfilEntreno?.vdot ? `- VDOT running: ${perfilEntreno.vdot}` : ''}
${perfilEntreno?.rm_sentadilla_kg ? `- RM sentadilla: ${perfilEntreno.rm_sentadilla_kg}kg` : ''}
${perfilEntreno?.rm_banca_kg ? `- RM press banca: ${perfilEntreno.rm_banca_kg}kg` : ''}

## ANÁLISIS MOTOR ENTRENAMIENTO
${recomendacion ? `
- Volumen recomendado: ${recomendacion.volumen}
- Intensidad: ${recomendacion.intensidad}
- Foco principal: ${recomendacion.foco_principal}
- Advertencias: ${recomendacion.advertencias.join('; ') || 'Ninguna'}
- Ajustes: ${recomendacion.ajustes_adicionales.join('; ') || 'Ninguno'}
` : 'Sin perfil atleta configurado — usar criterios estándar ACSM.'}

## AJUSTE POR FEEDBACK REAL
${ajusteRpe || 'Sin sesiones completadas previas — empezar conservador.'}

## EVIDENCIA CIENTÍFICA APLICABLE
${evidenciasTexto}

## INSTRUCCIONES DE GENERACIÓN
1. Crea un plan de ${Math.min(diasSemana, 5)} sesiones/semana durante 8-12 semanas
2. Cada sesión debe tener nombre descriptivo, día de la semana, y 4-6 ejercicios
3. Incluye series, repeticiones/duración, descanso en segundos y notas técnicas
4. Fundamenta la periodización en los papers proporcionados
5. Adapta la intensidad según el ajuste RPE indicado

## FORMATO DE RESPUESTA (JSON EXACTO)
{
  "nombre_plan": "string — nombre descriptivo del plan",
  "objetivo": "string",
  "duracion_semanas": number,
  "fundamentacion": "string — 2-3 frases explicando el enfoque científico",
  "sesiones": [
    {
      "nombre": "string",
      "dia_semana": "Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo",
      "tipo": "string — fuerza|cardio|hiit|tecnica|recuperacion",
      "duracion_min": number,
      "ejercicios": [
        {
          "nombre": "string — nombre exacto del ejercicio",
          "series": number,
          "repeticiones": "string — ej: '8-10' o '30s' o '400m'",
          "descanso_segundos": number,
          "rpe_objetivo": "string — ej: '7-8'",
          "notas": "string — clave técnica + por qué basado en ciencia"
        }
      ]
    }
  ],
  "progresion_semanal": "string — cómo progresar cada semana",
  "indicadores_mejora": ["string — métricas a seguir para ajuste dinámico"],
  "ajuste_si_rpe_alto": "string — qué hacer si RPE > 8.5 dos semanas seguidas",
  "ajuste_si_rpe_bajo": "string — qué hacer si RPE < 6 dos semanas seguidas"
}`

    const response = await fetch(DEEPSEEK_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: promptSistema },
          { role: 'user', content: promptUsuario },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 4000,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('DeepSeek error:', err)
      return NextResponse.json({ error: 'Error al generar el plan con IA' }, { status: 502 })
    }

    const ds = await response.json()
    const planTexto = ds.choices?.[0]?.message?.content ?? ''
    let planIA: Record<string, unknown>
    try {
      planIA = JSON.parse(planTexto)
    } catch {
      return NextResponse.json({ error: 'Respuesta IA no válida', raw: planTexto }, { status: 502 })
    }

    return NextResponse.json({
      plan: planIA,
      metadata: {
        rpe_promedio: rpePromedio,
        ajuste_rpe: ajusteRpe,
        modalidad: modalidadFoco,
        recomendacion_motor: recomendacion,
        papers_usados: papers.length,
        generado_con: MODEL,
      },
    })
  } catch (err) {
    console.error('proponer-plan-ciencia error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
