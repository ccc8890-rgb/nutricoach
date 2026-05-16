import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro'

const ACTIVIDAD_FACTOR: Record<string, number> = {
  sedentario: 1.2,
  ligero: 1.375,
  moderado: 1.55,
  activo: 1.725,
  muy_activo: 1.9,
}

const OBJETIVO_AJUSTE: Record<string, number> = {
  perder_grasa: -400,
  ganar_musculo: 300,
  rendimiento: 200,
  mantener: 0,
  salud_general: 0,
}

function calcularTDEE(peso: number, altura: number, edad: number, sexo: string, actividad: string): number {
  const tmb =
    sexo === 'mujer'
      ? 10 * peso + 6.25 * altura - 5 * edad - 161
      : 10 * peso + 6.25 * altura - 5 * edad + 5
  const factor = ACTIVIDAD_FACTOR[actividad] ?? 1.55
  return Math.round(tmb * factor)
}

export async function POST(request: NextRequest) {
  const { cliente_id } = await request.json()
  if (!cliente_id) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })

  const supabase = createServiceSupabase()

  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, coach_id, objetivo, peso_inicial, altura, edad, sexo, restricciones_alimentarias')
    .eq('id', cliente_id)
    .single()

  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const { data: onboarding } = await supabase
    .from('onboarding_responses')
    .select('*')
    .eq('cliente_id', cliente_id)
    .single()

  if (!onboarding) return NextResponse.json({ error: 'Onboarding no completado' }, { status: 400 })

  const tdee = calcularTDEE(
    cliente.peso_inicial ?? 70,
    cliente.altura ?? 170,
    cliente.edad ?? 30,
    cliente.sexo ?? 'hombre',
    onboarding.actividad_base,
  )
  const kcalObjetivo = tdee + (OBJETIVO_AJUSTE[onboarding.objetivo] ?? 0)
  const proteinas = Math.round((cliente.peso_inicial ?? 70) * 2)
  const grasas = Math.round((kcalObjetivo * 0.28) / 9)
  const carbos = Math.round((kcalObjetivo - proteinas * 4 - grasas * 9) / 4)

  const prompt = `Eres un dietista experto. Genera un plan nutricional inicial en JSON.

DATOS DEL CLIENTE:
- Objetivo: ${onboarding.objetivo}
- TDEE calculado: ${tdee} kcal/día
- Kcal objetivo (ajustado): ${kcalObjetivo} kcal/día
- Macros objetivo: ${proteinas}g proteína | ${carbos}g carbohidratos | ${grasas}g grasa
- Actividad: ${onboarding.actividad_base} (${onboarding.dias_entreno} días/semana de ${onboarding.duracion_sesion_min} min)
- Tipos de entrenamiento: ${onboarding.tipo_entreno?.join(', ') || 'no especificado'}
- Restricciones: ${onboarding.restricciones?.join(', ') || 'ninguna'}
- Alimentos no deseados: ${onboarding.alimentos_no_gustan || 'ninguno'}
- Nivel cocina: ${onboarding.nivel_cocina}
- Tiempo para cocinar: ${onboarding.tiempo_cocina_min} min/día

Responde SOLO con este JSON (sin markdown):
{
  "kcal_objetivo": número,
  "macros": { "proteinas_g": número, "carbos_g": número, "grasas_g": número },
  "distribucion_comidas": [
    { "nombre": "Desayuno", "porcentaje_kcal": número, "kcal": número, "hora_sugerida": "HH:MM" },
    ...
  ],
  "recomendaciones": ["frase corta 1", "frase corta 2", "frase corta 3"],
  "notas_coach": "texto breve para el coach con puntos clave de este perfil"
}`

  let planJson: Record<string, unknown> = {}
  let tokensUsados = 0

  try {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (apiKey) {
      const res = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: [
            { role: 'system', content: 'Eres un dietista experto. Respondes solo con JSON válido en español.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const content = data.choices?.[0]?.message?.content ?? ''
        const match = content.match(/\{[\s\S]*\}/)
        if (match) planJson = JSON.parse(match[0])
        tokensUsados = data.usage?.total_tokens ?? 0
      }
    }
  } catch {
    // Plan generation failed — save what we have and continue
  }

  // If DeepSeek failed, build a minimal plan from our calculations
  if (!planJson.kcal_objetivo) {
    planJson = {
      kcal_objetivo: kcalObjetivo,
      macros: { proteinas_g: proteinas, carbos_g: carbos, grasas_g: grasas },
      distribucion_comidas: [
        { nombre: 'Desayuno', porcentaje_kcal: 25, kcal: Math.round(kcalObjetivo * 0.25), hora_sugerida: '08:00' },
        { nombre: 'Comida', porcentaje_kcal: 35, kcal: Math.round(kcalObjetivo * 0.35), hora_sugerida: '13:30' },
        { nombre: 'Merienda', porcentaje_kcal: 15, kcal: Math.round(kcalObjetivo * 0.15), hora_sugerida: '17:00' },
        { nombre: 'Cena', porcentaje_kcal: 25, kcal: Math.round(kcalObjetivo * 0.25), hora_sugerida: '20:30' },
      ],
      recomendaciones: ['Plan generado automáticamente. El coach revisará y personalizará.'],
      notas_coach: `Cliente nuevo. Objetivo: ${onboarding.objetivo}. TDEE: ${tdee} kcal.`,
    }
  }

  // Save to registros_ia
  try {
    await supabase.from('registros_ia').insert({
      coach_id: cliente.coach_id,
      cliente_id,
      tipo: 'plan_inicial',
      prompt,
      respuesta_json: planJson,
      modelo: DEEPSEEK_MODEL,
      tokens_usados: tokensUsados,
    })
  } catch {
    // Non-critical — continue
  }

  // Mark cliente as pending review
  await supabase
    .from('clientes')
    .update({ revisado_por_coach: false })
    .eq('id', cliente_id)

  // Notify coach via Make.com (fire-and-forget)
  const webhookUrl = process.env.MAKE_WEBHOOK_NUEVO_CLIENTE
  if (webhookUrl) {
    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente_id, kcal_objetivo: planJson.kcal_objetivo }),
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, plan: planJson })
}
