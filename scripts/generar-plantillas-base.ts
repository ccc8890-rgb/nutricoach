// Genera las plantillas base de dieta (1 semana por perfil estándar) con el mismo motor que usa «Generar semana».
// Usa un cliente interno «Plantillas base» (inactivo) como lienzo: pone su objetivo y restricciones, genera la semana,
// la guarda en plantillas_semana_dieta (origen 'base', clave estable) y deja un informe de calidad.
// Uso: npx tsx scripts/generar-plantillas-base.ts [--solo=2000-omnivoro] [--guardar]   (sin --guardar solo audita)
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { generarSemana } from '../lib/nutricion/planificar-semana'
import type { SlotComida } from '../lib/tipos-comida'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const COACH_ID = 'f62aea4e-69a2-4062-b517-bb6a639ee1b5'
const EMAIL = 'plantillas-base@nutricoach-test.dev'
const FRANJAS: SlotComida[] = ['Desayuno', 'Comida', 'Merienda', 'Cena']
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const KCALS = [1600, 2000, 2500, 3000]
const DIETAS: { id: string; nombre: string; restricciones: string[] }[] = [
  { id: 'omnivoro', nombre: 'Omnívora', restricciones: [] },
  { id: 'vegetariano', nombre: 'Vegetariana', restricciones: ['vegetariano'] },
  { id: 'vegano', nombre: 'Vegana', restricciones: ['vegano'] },
]
const pctProteina = (k: number) => (k <= 1600 ? 0.24 : k <= 2000 ? 0.23 : k <= 2500 ? 0.22 : 0.21)

async function lienzo() {
  const { data: lista } = await db.auth.admin.listUsers({ page: 1, perPage: 200 })
  let uid = lista?.users.find(u => u.email === EMAIL)?.id
  if (!uid) {
    const { data, error } = await db.auth.admin.createUser({ email: EMAIL, password: `${Math.random().toString(36).slice(2)}Aa1!${Math.random().toString(36).slice(2)}`, email_confirm: true, user_metadata: { nombre: 'Plantillas base', apellidos: '(sistema)', role: 'cliente' } })
    if (error) throw error
    uid = data.user.id
  }
  await db.from('profiles').upsert({ id: uid, nombre: 'Plantillas base', apellidos: '(sistema)', email: EMAIL, role: 'cliente' }, { onConflict: 'id' })
  const payload = { profile_id: uid, coach_id: COACH_ID, objetivo: 'mantenimiento', nivel: 'intermedio', peso_inicial: 70, altura: 170, edad: 35, sexo: 'hombre', restricciones_alimentarias: 'Ninguna', notas: 'Cliente interno: lienzo para generar plantillas base. No borrar.', activo: false, revisado_por_coach: true, onboarding_completado: true, comidas_dia: 4, updated_at: new Date().toISOString() }
  const { data: ex } = await db.from('clientes').select('id').eq('profile_id', uid).maybeSingle()
  const { data: cli, error } = ex ? await db.from('clientes').update(payload).eq('id', ex.id).select('id').single() : await db.from('clientes').insert(payload).select('id').single()
  if (error || !cli) throw error
  return cli.id as string
}

async function main() {
  const solo = process.argv.find(a => a.startsWith('--solo='))?.slice(7)
  const guardar = process.argv.includes('--guardar')
  const clienteId = await lienzo()
  await db.from('onboarding_perfil_profundo').delete().eq('cliente_id', clienteId)
  let { data: plan } = await db.from('planes_nutricion').select('id').eq('cliente_id', clienteId).eq('activo', true).maybeSingle()
  if (!plan) {
    const { data, error } = await db.from('planes_nutricion').insert({ coach_id: COACH_ID, cliente_id: clienteId, nombre: 'Lienzo plantillas base', activo: true, generado_por_ia: false, kcal_objetivo: 2000, proteinas_objetivo: 115, carbohidratos_objetivo: 240, grasas_objetivo: 65, codigo_publico: Math.random().toString(36).slice(2, 12) }).select('id').single()
    if (error || !data) throw error
    plan = data
  }

  for (const kcal of KCALS) for (const dieta of DIETAS) {
    const clave = `${kcal}-${dieta.id}`
    if (solo && solo !== clave) continue
    const p = Math.round(kcal * pctProteina(kcal) / 4), c = Math.round(kcal * 0.48 / 4), g = Math.round((kcal - p * 4 - c * 4) / 9)
    const objetivo = { id: plan!.id, nombre: 'Lienzo', kcal_objetivo: kcal, proteinas_objetivo: p, carbohidratos_objetivo: c, grasas_objetivo: g }
    await db.from('planes_nutricion').update({ kcal_objetivo: kcal, proteinas_objetivo: p, carbohidratos_objetivo: c, grasas_objetivo: g }).eq('id', plan!.id)
    await db.from('onboarding_responses').delete().eq('cliente_id', clienteId)
    const { error: eo } = await db.from('onboarding_responses').insert({ cliente_id: clienteId, objetivo: 'salud_general', actividad_base: 'moderado', dias_entreno: 0, tipo_entreno: [], restricciones: dieta.restricciones, nivel_cocina: 'intermedio', tiempo_cocina_min: 40 })
    if (eo) throw new Error(`onboarding: ${eo.message}`)
    const { data: viejas } = await db.from('comidas').select('id').eq('plan_id', plan!.id)
    if (viejas?.length) { await db.from('comida_alimentos').delete().in('comida_id', viejas.map(x => x.id)); await db.from('comidas').delete().in('id', viejas.map(x => x.id)) }

    const r = await generarSemana(db, clienteId, objetivo, true, FRANJAS, false)
    const { data: filas } = await db.from('comidas')
      .select('nombre, dia_semana, receta:recetas(id, nombre, kcal, proteinas, porciones), comida_alimentos(cantidad_gramos, alimento:alimentos(calorias, proteinas))').eq('plan_id', plan!.id).not('dia_semana', 'is', null)
    type F = { nombre: string; dia_semana: string; receta: { id: string; nombre: string } | null; comida_alimentos: { cantidad_gramos: number; alimento: { calorias: number; proteinas: number } | null }[] }
    const todas = (filas ?? []) as unknown as F[]
    const kc = (f: F) => f.comida_alimentos.reduce((t, x) => t + (x.alimento ? x.alimento.calorias * x.cantidad_gramos / 100 : 0), 0)
    const pr = (f: F) => f.comida_alimentos.reduce((t, x) => t + (x.alimento ? x.alimento.proteinas * x.cantidad_gramos / 100 : 0), 0)
    console.log(`\n=== ${clave}  objetivo ${kcal} kcal · P${p} C${c} G${g} · asignadas ${r.asignadas}/28 · repetidas ${r.repetidas} · sin cubrir ${r.sinCubrir.length} · errores ${r.errores.length}`)
    const dias = DIAS.map(d => {
      const del = todas.filter(f => f.dia_semana === d).sort((a, b) => FRANJAS.indexOf(a.nombre as SlotComida) - FRANJAS.indexOf(b.nombre as SlotComida))
      const k = Math.round(del.reduce((t, f) => t + kc(f), 0)), pp = Math.round(del.reduce((t, f) => t + pr(f), 0))
      console.log(`  ${d.padEnd(10)} ${String(k).padStart(5)} kcal (${Math.round((k / kcal - 1) * 100) >= 0 ? '+' : ''}${Math.round((k / kcal - 1) * 100)}%) P${pp}  | ${del.map(f => `${f.nombre[0]}: ${f.receta?.nombre ?? '—'}`).join(' | ')}`)
      return { dia: d, comidas: del.filter(f => f.receta).map(f => ({ franja: f.nombre, receta_id: f.receta!.id, nombre: f.receta!.nombre })) }
    })
    if (r.sinCubrir.length) console.log('  SIN CUBRIR:', r.sinCubrir.map(h => `${h.dia} ${h.franja}`).join(', '))
    if (r.errores.length) console.log('  ERRORES:', JSON.stringify(r.errores.slice(0, 3)))
    if (guardar && r.errores.length === 0 && r.sinCubrir.length === 0) {
      await db.from('plantillas_semana_dieta').delete().eq('coach_id', COACH_ID).eq('clave', clave)
      const { error } = await db.from('plantillas_semana_dieta').insert({
        coach_id: COACH_ID, nombre: `Base ${kcal} kcal · ${dieta.nombre}`, descripcion: `Plantilla base de 1 semana, 4 comidas al día, sin entrenamiento específico. Objetivo ${kcal} kcal · P${p} C${c} G${g}.`,
        etiquetas: ['base', `${kcal} kcal`, dieta.id], semanas: [{ dias }], origen: 'base', clave, perfil: { kcal, p, c, g, dieta: dieta.id, franjas: FRANJAS }, generada_at: new Date().toISOString(),
      })
      console.log(error ? `  ✗ no guardada: ${error.message}` : '  ✓ guardada')
    }
  }
}
main().catch(e => { console.error(e); process.exit(1) })
