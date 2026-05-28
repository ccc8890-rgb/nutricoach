import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rate-limit'
import { evaluarPerfilEntreno } from '@/lib/motor-entreno'
import { obtenerInformeVigente } from '@/lib/inteligencia-clinica'
import type { PerfilEntrenoCliente } from '@/types'
import type { SupabaseClient } from '@supabase/supabase-js'

const DEEPSEEK_BASE = 'https://api.deepseek.com/v1/chat/completions'
const MODEL = 'deepseek-chat'

// Palabras genéricas que no aportan al matching
const STOP_WORDS = new Set(['con', 'de', 'en', 'el', 'la', 'los', 'las', 'y', 'a', 'al', 'del'])

async function matchEjercicio(sb: SupabaseClient, nombre: string): Promise<string | null> {
  const normalizado = nombre.toLowerCase().trim()

  // Nivel 1: match exacto (case-insensitive)
  const { data: exacto } = await sb.from('ejercicios')
    .select('id')
    .ilike('nombre', normalizado)
    .limit(1)
  if (exacto?.[0]) return exacto[0].id

  // Nivel 2: match parcial — nombre del ejercicio contiene la búsqueda
  const { data: parcial } = await sb.from('ejercicios')
    .select('id')
    .ilike('nombre', `%${normalizado}%`)
    .limit(1)
  if (parcial?.[0]) return parcial[0].id

  // Nivel 3: buscar por palabras significativas (>3 chars, sin stop words)
  const palabras = normalizado.split(/\s+/).filter(p => p.length > 3 && !STOP_WORDS.has(p))
  for (const palabra of palabras) {
    const { data: porPalabra } = await sb.from('ejercicios')
      .select('id')
      .ilike('nombre', `%${palabra}%`)
      .limit(1)
    if (porPalabra?.[0]) return porPalabra[0].id
  }

  return null
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createApiSupabase(req)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!rateLimit(`proponer-entreno:${user.id}`, 5, 60_000)) {
      return NextResponse.json({ error: 'Demasiadas peticiones. Espera un momento.' }, { status: 429 })
    }

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
      sb.from('registros_entreno')
        .select('rpe, created_at')
        .eq('cliente_id', cliente_id)
        .not('rpe', 'is', null)
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

    // Informe clínico del cliente (inyectar si existe)
    const informeClinico = await obtenerInformeVigente(cliente_id)
    const informeClinicoBlock = informeClinico?.instrucciones_ia
      ? `\n${informeClinico.instrucciones_ia}\n`
      : ''

    // Perfil del cliente
    const perfil = cliente.profiles as { nombre?: string; apellidos?: string; edad?: number } | null
    const nombre = perfil ? `${perfil.nombre ?? ''} ${perfil.apellidos ?? ''}`.trim() : 'Cliente'
    const diasSemana = perfilEntreno?.dias_disponibles ?? onboarding?.dias_entreno ?? 3
    const objetivo = cliente.objetivo ?? 'salud_general'
    const nivel = cliente.nivel ?? 'principiante'

    // Protocolos específicos por modalidad deportiva
    const SPORT_PROTOCOLS: Record<string, string> = {
      running: `RUNNING — Metodología Daniels (VDOT):
• Zonas: Easy Z2 (60-70% HRmax), Tempo Z3-4 (88-92%), Intervals Z5 (95-100%)
• Regla 80/20: 80% volumen en Z1-Z2, 20% calidad (tempo/intervals)
• Progresión: +10% volumen semanal máximo, semana de descarga cada 4ª semana
• Si VDOT disponible: calcular ritmos de entrenamiento precisos por zona
• Prioridad: construir base aeróbica antes de añadir velocidad`,

      gym: `GYM / FUERZA — Metodología Schoenfeld (2010, 2017):
• Hipertrofia: 6-12 reps, 60-75% 1RM, 3-4 sets, 60-90s descanso
• Frecuencia óptima: cada grupo muscular 2x/semana mínimo
• Progresión doble: aumentar reps hasta límite, luego subir peso
• RIR (Reps in Reserve): mantener 2-3 RIR en trabajo base, 0-1 RIR en últimas series
• Periodización ondulada diaria (DUP): variar estímulo entre sesiones`,

      crossfit: `CROSSFIT / FUNCIONAL — GPP (General Physical Preparedness):
• Estructura: Strength + WOD (Workout of the Day)
• Energéticos: ATP-PCr (fuerza), glucolítico (AMRAP/EMOM), aeróbico (Chipper)
• WODs cortos (< 10 min): alta intensidad, escalado para mantener > 85% esfuerzo
• WODs largos (> 15 min): ritmo sostenible, nunca ir al límite en la primera ronda
• Recuperación crítica: 48h entre sesiones de alta intensidad del mismo patrón`,

      hyrox: `HYROX — Protocolo específico (Laursen & Buchheit):
• 8 estaciones: SkiErg, Sled Push, Sled Pull, Burpee Broad Jumps, Row, Farmers Carry, Sandbag Lunges, Wall Balls
• Entrenamiento: combinar resistencia cardiovascular + fuerza funcional
• Simulaciones de carrera: 1km a ritmo objetivo + estación inmediatamente después
• Fuerza base: sentadilla, peso muerto, press militar — base para las estaciones
• 50/50 split: 50% trabajo cardiovascular, 50% fuerza funcional con carga`,

      cycling: `CICLISMO — Metodología Coggan (Training Peaks):
• Zonas FTP: Z1 (<55%), Z2 (56-75%), Z3 (76-90%), Z4 (91-105%), Z5 (>106%)
• Modelo polarizado: >80% en Z1-Z2, bloques Z4-Z5 en días específicos
• Intervalos: 2x20min Z4 (Threshold), 5x5min Z5 (VO2max)
• Progresión TSS: aumentar carga semanal 10% máximo, semana de descarga cada 4ª`,

      natacion: `NATACIÓN — Principios FINA/ASCA:
• Técnica primero: sin técnica correcta el volumen empeora los patrones
• Zonas: A1 (recuperación), A2 (base aeróbica), A3 (umbral), An (anaeróbico)
• Grupos de nado: 50-200m para velocidad, 400m-1km para fondo
• Variedad de estilos para equilibrio muscular y prevención lesiones`,

      funcional: `ENTRENAMIENTO FUNCIONAL — ACSM/NSCA Guidelines:
• Patrones fundamentales: push, pull, squat, hinge, carry, core
• Progresión: peso corporal → carga externa → velocidad → complejidad
• HIIT: 1:2 work:rest ratio para principiante, 1:1 intermedio, 2:1 avanzado
• Movilidad integrada: 5-10 min al inicio, no al final cuando hay fatiga`,
    }

    const protocoloDeporte = SPORT_PROTOCOLS[modalidadFoco] ?? SPORT_PROTOCOLS.funcional

    const promptSistema = `Eres un preparador físico y entrenador personal de élite con 20 años de experiencia en España. Tienes certificación NSCA-CSCS (Certified Strength and Conditioning Specialist) y ACSM. Has preparado atletas recreacionales y semi-profesionales en running, CrossFit, Hyrox y triatlón.

TU MISIÓN:
Generar el plan de entrenamiento que un preparador físico de 150-200€/sesión daría — con base científica, periodización real, y explicaciones que el cliente entiende.

LO QUE DEBES HACER:
1. DISEÑAR cada sesión con propósito claro: qué sistema energético trabaja, por qué ese día, cómo encaja en el ciclo semanal
2. ESPECIFICAR carga exacta: RPE objetivo por ejercicio, series/reps precisas, descansos calculados (no genéricos)
3. INCLUIR semana de descarga automáticamente (cada 4ª semana: -30-40% volumen)
4. ESCRIBIR "notas_cliente_entreno": mensaje motivador al cliente explicando su plan (3-4 frases, tono de entrenador cercano)
5. ESCRIBIR "senales_ajuste_coach": 3 indicadores concretos que el coach revisará en 4 semanas

REGLAS ABSOLUTAS:
- Nombres de ejercicios en español (Sentadilla, Press Banca, Peso Muerto, Remo con Barra...)
- RPE nunca > 9 en semanas 1-2 (adaptación inicial)
- Siempre incluir calentamiento implícito en notas del primer ejercicio
- Deload explícito: al menos una sesión de recuperación activa por semana
- Las notas de cada ejercicio deben decir el POR QUÉ, no solo el cómo

RESPONDE ÚNICAMENTE EN JSON VÁLIDO. Sin texto fuera del JSON.`

    const promptUsuario = `Genera un plan de entrenamiento personalizado para este cliente.

## PERFIL DEL CLIENTE
- Nombre: ${nombre}
- Objetivo: ${objetivo}
- Nivel: ${nivel}
- Días disponibles: ${diasSemana}/semana
- Modalidad principal: ${modalidadFoco}
${perfilEntreno?.vo2max_estimado ? `- VO2max estimado: ${perfilEntreno.vo2max_estimado} ml/kg/min` : ''}
${perfilEntreno?.ftp_watts ? `- FTP ciclismo: ${perfilEntreno.ftp_watts}W` : ''}
${perfilEntreno?.vdot ? `- VDOT running: ${perfilEntreno.vdot} → ritmos de entrenamiento calculables` : ''}
${perfilEntreno?.rm_sentadilla_kg ? `- RM sentadilla: ${perfilEntreno.rm_sentadilla_kg}kg` : ''}
${perfilEntreno?.rm_banca_kg ? `- RM press banca: ${perfilEntreno.rm_banca_kg}kg` : ''}
${perfilEntreno?.rm_peso_muerto_kg ? `- RM peso muerto: ${perfilEntreno.rm_peso_muerto_kg}kg` : ''}
${perfilEntreno?.patron_lesiones?.length ? `- ⚠️ LESIONES: ${perfilEntreno.patron_lesiones.map((l) => `${l.zona} (${l.frecuencia})`).join(', ')} — EVITAR ejercicios que comprometan estas zonas` : ''}

## PROTOCOLO CIENTÍFICO PARA ESTA MODALIDAD
${protocoloDeporte}

## ANÁLISIS MOTOR ENTRENAMIENTO (sistema automatizado)
${recomendacion ? `
- Volumen recomendado: ${recomendacion.volumen}
- Intensidad base: ${recomendacion.intensidad}
- Foco principal: ${recomendacion.foco_principal}
- Advertencias específicas: ${recomendacion.advertencias.join('; ') || 'Ninguna'}
- Ajustes adicionales: ${recomendacion.ajustes_adicionales.join('; ') || 'Ninguno'}
` : '→ Sin perfil atleta configurado. Usar criterios ACSM para nivel principiante-intermedio.'}

## FEEDBACK REAL DE SESIONES PREVIAS
${ajusteRpe || '→ Sin sesiones previas registradas. Empezar conservador (RPE 6-7 primeras 2 semanas).'}

## ANÁLISIS CLÍNICO DEL CLIENTE
${informeClinicoBlock || '→ Sin informe clínico previo. Aplicar protocolos estándar.'}

## EVIDENCIA CIENTÍFICA BASE
${evidenciasTexto}

## INSTRUCCIONES DE GENERACIÓN
1. Plan de ${Math.min(diasSemana, 5)} sesiones/semana, 8-12 semanas de duración
2. Semana tipo: distribución coherente (no 2 días fuerza seguidos sin recuperación)
3. Cada sesión: nombre descriptivo, 4-6 ejercicios ordenados (compuestos primero)
4. Cada ejercicio: series, reps exactas, descanso calculado, RPE objetivo, nota con el POR QUÉ
5. Incluir progresión: cómo escalar cada 2 semanas

## FORMATO JSON EXACTO
{
  "nombre_plan": "nombre descriptivo y específico para este cliente",
  "objetivo": "string",
  "duracion_semanas": number,
  "fundamentacion": "2-3 frases del enfoque científico específico para ${modalidadFoco}",
  "notas_cliente_entreno": "Mensaje personal al cliente (3-4 frases): qué va a conseguir, por qué este plan, qué sentirá en las primeras semanas",
  "sesiones": [
    {
      "nombre": "string — nombre evocador ej: 'Fuerza base tren inferior'",
      "dia_semana": "Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo",
      "tipo": "fuerza|cardio|hiit|tecnica|recuperacion|mixto",
      "duracion_min": number,
      "ejercicios": [
        {
          "nombre": "string — nombre español exacto",
          "series": number,
          "repeticiones": "string — '8-10' o '30s' o '400m' o '3x5min'",
          "descanso_segundos": number,
          "rpe_objetivo": "string — '7-8' o '8 RIR 2'",
          "notas": "string — técnica clave + justificación científica de POR QUÉ este ejercicio aquí"
        }
      ]
    }
  ],
  "progresion_semanal": "string — modelo exacto de progresión (ej: +2 reps semana 2-3, +2.5kg semana 4)",
  "semana_deload": "string — descripción de la semana de descarga (cuándo y cómo)",
  "indicadores_mejora": ["métrica 1 medible en 4 semanas", "métrica 2", "métrica 3"],
  "senales_ajuste_coach": {
    "si_rpe_alto": "qué hacer si RPE > 8.5 dos semanas seguidas",
    "si_rpe_bajo": "qué hacer si RPE < 6 dos semanas seguidas",
    "proxima_revision_4_semanas": "qué evaluar específicamente en el check-in de 4 semanas"
  }
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
        temperature: 0.35,
        max_tokens: 6000,
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

    // Guardar automáticamente en planes_entrenamiento + sesiones_entrenamiento
    let planGuardadoId: string | null = null
    try {
      const { data: planDB } = await sb.from('planes_entrenamiento').insert({
        coach_id: user.id,
        cliente_id,
        nombre: (planIA.nombre_plan as string) ?? `Plan IA — ${modalidadFoco}`,
        descripcion: (planIA.fundamentacion as string) ?? null,
        duracion_semanas: (planIA.duracion_semanas as number) ?? null,
        activo: true,
      }).select('id').single()

      if (planDB) {
        planGuardadoId = planDB.id
        const sesiones = (planIA.sesiones as Record<string, unknown>[]) ?? []
        for (let i = 0; i < sesiones.length; i++) {
          const s = sesiones[i]
          const ejerciciosIA = (s.ejercicios as Record<string, unknown>[]) ?? []

          const { data: nuevaSesion } = await sb.from('sesiones_entrenamiento').insert({
            plan_id: planDB.id,
            nombre: (s.nombre as string) ?? `Sesión ${i + 1}`,
            dia_semana: (s.dia_semana as string) ?? null,
            orden: i + 1,
            notas: null,
          }).select('id').single()

          if (!nuevaSesion) continue

          // Vincular cada ejercicio IA a un ejercicio real de la BD por nombre
          for (let j = 0; j < ejerciciosIA.length; j++) {
            const ej = ejerciciosIA[j]
            const nombreEj = (ej.nombre as string ?? '').trim()
            if (!nombreEj) continue

            const ejercicioId = await matchEjercicio(sb, nombreEj)
            if (!ejercicioId) continue // no hay match — se omite

            await sb.from('sesion_ejercicios').insert({
              sesion_id: nuevaSesion.id,
              ejercicio_id: ejercicioId,
              series: typeof ej.series === 'number' ? ej.series : null,
              repeticiones: ej.repeticiones != null ? String(ej.repeticiones) : null,
              descanso_segundos: typeof ej.descanso_segundos === 'number' ? ej.descanso_segundos : null,
              notas: [ej.rpe_objetivo ? `RPE ${ej.rpe_objetivo}` : null, ej.notas].filter(Boolean).join(' — ') || null,
              orden: j + 1,
            })
          }
        }
        // Historial para poder regenerar / ver versiones
        await sb.from('registros_ia').insert({
          cliente_id,
          tipo: 'plan_entreno_ia',
          respuesta_json: planIA,
        })
      }
    } catch (saveErr) {
      // No bloqueante: devolvemos el plan aunque falle el guardado
      console.error('proponer-plan-ciencia save error:', saveErr)
    }

    return NextResponse.json({
      plan: planIA,
      plan_id: planGuardadoId,
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
