import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { fetchKnowledgeContext } from '@/lib/knowledge'

export async function POST(req: NextRequest) {
  try {
    // Auth
    const supabase = createApiSupabase(req)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Parse body
    const body = await req.json()
    const {
      cliente_id,
      objetivo,
      nivel,
      disciplina_principal,
      semanas_plan,
      fecha_competicion,
      condiciones_especiales,
    } = body

    if (!cliente_id || !objetivo || !nivel || !disciplina_principal || !semanas_plan) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios: cliente_id, objetivo, nivel, disciplina_principal, semanas_plan' },
        { status: 400 }
      )
    }

    // Fetch client
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('*, profile:profiles!profile_id(nombre, apellidos, edad, peso_actual, altura)')
      .eq('id', cliente_id)
      .eq('coach_id', user.id)
      .single()

    if (clienteError || !cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    const profile = (cliente as any).profile
    const nombreCompleto = profile
      ? `${profile.nombre ?? ''} ${profile.apellidos ?? ''}`.trim()
      : 'Desconocido'

    // Fetch knowledge context
    const serviceSupabase = createServiceSupabase()
    const kbText = await fetchKnowledgeContext(serviceSupabase, {
      disciplinas: [disciplina_principal, 'general', 'recuperacion', 'hibrido'],
      condiciones: condiciones_especiales,
      limite: 8,
    })

    // Build prompt
    const prompt = `Eres un coach de alto rendimiento especializado en ${disciplina_principal}. Genera un plan de entrenamiento periodizado.

${kbText}

PERFIL DEL ATLETA:
- Nombre: ${nombreCompleto}
- Nivel: ${nivel}
- Objetivo: ${objetivo}
- Semanas de plan: ${semanas_plan}
- Fecha competición: ${fecha_competicion || 'sin competición próxima'}
- Condiciones especiales: ${condiciones_especiales?.join(', ') || 'ninguna'}

Genera el plan en JSON EXACTO sin markdown:
{"semanas":[{"numero":1,"objetivo":"string","sesiones":[{"dia":"Lunes","tipo":"fuerza|resistencia|hiit|especifico|descanso","duracion_min":60,"descripcion":"string","ejercicios":[{"nombre":"string","series":3,"reps_o_duracion":"10","intensidad":"RPE 7","notas":"string"}]}]}],"notas_generales":"string","progresion":"string"}`

    // Call DeepSeek
    const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY
    if (!DEEPSEEK_KEY) {
      return NextResponse.json({ error: 'DEEPSEEK_API_KEY no configurada' }, { status: 500 })
    }

    const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro'

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 4000,
      }),
      signal: AbortSignal.timeout(60000),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('DeepSeek API error:', response.status, errText)
      return NextResponse.json({ error: 'Error al comunicarse con la IA' }, { status: 502 })
    }

    const data = await response.json()
    let planText = data?.choices?.[0]?.message?.content
    if (!planText) {
      return NextResponse.json({ error: 'Respuesta vacía de la IA' }, { status: 502 })
    }

    // Remove markdown fences if present
    let cleaned = planText.trim()
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7)
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3)
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3)
    }
    cleaned = cleaned.trim()

    let plan: unknown
    try {
      plan = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'La IA devolvió un JSON inválido' }, { status: 502 })
    }

    return NextResponse.json({
      plan,
      metadata: {
        disciplina: disciplina_principal,
        semanas: semanas_plan,
        fichas_kb: kbText.length > 0,
      },
    })
  } catch (err: unknown) {
    console.error('Error in generar-ia:', err)
    return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 500 })
  }
}
