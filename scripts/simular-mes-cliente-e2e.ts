import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'node:path'
import { evaluarCheckin } from '../lib/periodizacion/arbol-decision'
import { calcularAjusteCaloricoSemanal } from '../lib/periodizacion/motor-macros'
import { ejecutarDirectorSupercoachCliente } from '../lib/agentes/supercoach'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const apply = process.argv.includes('--apply')
const marker = '[E2E mensual 25-05-2026]'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

async function main() {
  const { data: cliente } = await db
    .from('clientes')
    .select('id, profile_id, tls_umbral_carga_alta')
    .eq('onboarding_completado', true)
    .eq('activo', true)
    .eq('revisado_por_coach', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!cliente) throw new Error('No hay cliente activo revisado con onboarding completado')

  const { data: profile } = await db.from('profiles').select('nombre, email').eq('id', cliente.profile_id).maybeSingle()
  const { data: plan } = await db
    .from('planes_nutricion')
    .select('id, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo')
    .eq('cliente_id', cliente.id)
    .eq('activo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!plan) throw new Error('El cliente no tiene plan nutricional activo')

  console.log(`Cliente: ${profile?.nombre ?? cliente.id} (${profile?.email ?? 'sin email'})`)
  console.log(`Modo: ${apply ? 'APPLY' : 'DRY-RUN'}`)

  const { count: existentes } = await db
    .from('checkins')
    .select('id', { count: 'exact', head: true })
    .eq('cliente_id', cliente.id)
    .ilike('notas', `%${marker}%`)

  if ((existentes ?? 0) > 0) {
    console.log(`Ya existen ${existentes} check-ins de esta simulación. No duplico.`)
  }

  const escenarios = [
    { dias: 28, pesoDelta: 0, adherencia: 9, energia: 4, sueno: 8, tls: 65 },
    { dias: 21, pesoDelta: -0.3, adherencia: 8, energia: 3, sueno: 7, tls: 82 },
    { dias: 14, pesoDelta: -0.5, adherencia: 8, energia: 2, sueno: 5, tls: 95 },
    { dias: 7, pesoDelta: -0.4, adherencia: 9, energia: 2, sueno: 8, tls: 130 },
    { dias: 0, pesoDelta: -0.2, adherencia: 6, energia: 4, sueno: 7, tls: 60 },
  ]

  let creados = 0
  let acciones = 0

  if (apply && (existentes ?? 0) === 0) {
    for (const [idx, e] of escenarios.entries()) {
      const fecha = new Date(Date.now() - e.dias * 86_400_000).toISOString().split('T')[0]
      const peso = 65 + e.pesoDelta
      const { data: checkin, error } = await db.from('checkins').insert({
        cliente_id: cliente.id,
        fecha,
        peso,
        adherencia: e.adherencia,
        energia: e.energia,
        sueno: e.sueno,
        notas: `${marker} semana ${idx + 1}`,
      }).select('id').single()
      if (error || !checkin) throw new Error(error?.message ?? 'No se pudo crear checkin')
      creados += 1

      await db.from('seguimiento_peso').insert({
        cliente_id: cliente.id,
        fecha,
        peso,
        notas: `${marker} seguimiento peso`,
      })

      const input = {
        energia: e.energia,
        horas_sueno: e.sueno,
        adherencia: e.adherencia,
        tls_semanal: e.tls,
        semanas_en_deficit: idx + 1,
        umbral_carga_alta: cliente.tls_umbral_carga_alta ?? 80,
      }
      const resultado = evaluarCheckin(input)
      const ajuste = resultado.accion === 'ajuste_calorico_10pct'
        ? calcularAjusteCaloricoSemanal({
          kcal: plan.kcal_objetivo ?? 2000,
          proteinas: plan.proteinas_objetivo ?? 150,
          carbohidratos: plan.carbohidratos_objetivo ?? 200,
          grasas: plan.grasas_objetivo ?? 70,
        })
        : null

      const { error: accionError } = await db.from('periodizacion_acciones').insert({
        cliente_id: cliente.id,
        checkin_id: checkin.id,
        accion: resultado.accion,
        input_snapshot: input,
        ajuste_macros: ajuste,
        requiere_aprobacion: resultado.requiere_aprobacion_coach,
        aprobado_por_coach: resultado.requiere_aprobacion_coach ? null : true,
        aplicado: false,
      })
      if (accionError) throw new Error(accionError.message)
      acciones += 1
    }

    const director = await ejecutarDirectorSupercoachCliente(cliente.id)
    console.log(`Supercoach tareas nuevas: ${director.generadas}`)
  }

  console.log(`Check-ins creados: ${creados}`)
  console.log(`Acciones periodización creadas: ${acciones}`)
  console.log('Simulación mensual terminada')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
