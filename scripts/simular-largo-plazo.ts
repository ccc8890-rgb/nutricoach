/**
 * Simula 12 semanas de seguimiento (check-in semanal → periodización → ajuste de macros) de los clientes de PRUEBA
 * con las funciones reales del sistema (evaluarCheckin, calcularAjusteCaloricoSemanal) y un modelo simple de peso
 * (balance energético 7.700 kcal/kg). NO escribe en la base de datos: solo lee el plan y el umbral de TLS de cada cliente.
 * Con --apply SÍ escribe (checkins, seguimiento_peso, periodizacion_acciones y kcal del plan) solo en clientes @nutricoach-test.dev,
 * con marcador en las notas y copia previa del plan en salidas/. --limpiar borra lo simulado y restaura el plan.
 * Uso: npx tsx scripts/simular-largo-plazo.ts [--semanas=12] [--semilla=7] [--apply | --limpiar] [prefijo_email…]
 * Salida: consola + salidas/<fecha>_simulacion-largo-plazo.md
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { evaluarCheckin } from '../lib/periodizacion/arbol-decision'
import { calcularAjusteCaloricoSemanal, type AjusteMacros, type MacrosBase } from '../lib/periodizacion/motor-macros'
import { macrosARestaurar } from '../lib/periodizacion/revertir-ajuste'
import { evaluarTendenciaPeso, type PuntoPeso, type ResultadoTendencia } from '../lib/periodizacion/tendencia-peso'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1] ?? d
const SEMANAS = Number(arg('semanas', '12'))
const APPLY = process.argv.includes('--apply')
const LIMPIAR = process.argv.includes('--limpiar')
const MARCA = '[SIM largo plazo 20-10-2026]'
const COPIA = (id: string) => join(__dirname, '..', 'salidas', `20-10-2026_copia-plan-sim-${id.slice(0, 8)}.json`)
let semilla = Number(arg('semilla', '7'))
const rnd = () => { semilla = (semilla * 1664525 + 1013904223) % 4294967296; return semilla / 4294967296 }
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) / 0.58 // ~N(0,1)
const clip = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))

/** Meta del cliente: dirección esperada del peso (kg/sem) y comportamiento realista. */
interface Perfil {
  prefijo: string; sexo: 'hombre' | 'mujer'; edad: number; peso: number; altura: number; factor: number
  meta: 'perder' | 'ganar' | 'mantener'; metaKgSem: number
  ratioIngesta: number   // lo que realmente come respecto al plan (1 = clava el plan)
  adherenciaReportada: number // 0-100 que el cliente declara
  sueno: number; energia: number; tls: number
  evento?: { semanas: number[]; sueno: number; energia: number } // semana de estrés / viaje / enfermedad
}
const PERFILES: Perfil[] = [
  { prefijo: 'marta', sexo: 'mujer', edad: 52, peso: 68, altura: 163, factor: 1.4, meta: 'perder', metaKgSem: -0.4, ratioIngesta: 0.97, adherenciaReportada: 80, sueno: 6.2, energia: 3, tls: 25, evento: { semanas: [6, 7], sueno: -1, energia: -1 } },
  { prefijo: 'daniel', sexo: 'hombre', edad: 19, peso: 62, altura: 181, factor: 1.6, meta: 'ganar', metaKgSem: 0.25, ratioIngesta: 0.86, adherenciaReportada: 65, sueno: 8, energia: 4, tls: 95 },
  { prefijo: 'rafael', sexo: 'hombre', edad: 45, peso: 118, altura: 178, factor: 1.3, meta: 'perder', metaKgSem: -0.7, ratioIngesta: 1.08, adherenciaReportada: 55, sueno: 6, energia: 2.6, tls: 20, evento: { semanas: [5], sueno: -1, energia: -0.5 } },
  { prefijo: 'irene', sexo: 'mujer', edad: 34, peso: 63, altura: 168, factor: 1.6, meta: 'mantener', metaKgSem: 0, ratioIngesta: 0.95, adherenciaReportada: 90, sueno: 7, energia: 2.4, tls: 115 },
  { prefijo: 'julian', sexo: 'hombre', edad: 68, peso: 74, altura: 172, factor: 1.5, meta: 'mantener', metaKgSem: 0, ratioIngesta: 1.0, adherenciaReportada: 95, sueno: 6.5, energia: 3, tls: 15 },
  { prefijo: 'sergio', sexo: 'hombre', edad: 38, peso: 82, altura: 180, factor: 1.5, meta: 'mantener', metaKgSem: 0, ratioIngesta: 0.93, adherenciaReportada: 70, sueno: 5.5, energia: 2.2, tls: 45, evento: { semanas: [8, 9], sueno: -0.5, energia: -0.5 } },
]

const tdee = (p: Perfil, peso: number) => (10 * peso + 6.25 * p.altura - 5 * p.edad + (p.sexo === 'hombre' ? 5 : -161)) * p.factor
const iso = (d: Date) => d.toISOString().slice(0, 10)
// Misma fórmula que app/api/cliente/[codigo]/checkin/route.ts → dispararEvaluacionPeriodizacion (semanas con check-in).
const claveSemana = (f: string) => { const d = new Date(f); const y0 = new Date(d.getFullYear(), 0, 1); return `${d.getFullYear()}-W${Math.ceil(((d.getTime() - y0.getTime()) / 86400000 + y0.getDay() + 1) / 7)}` }

interface Fila { sem: number; fecha: string; peso: number; kcalPlan: number; ingesta: number; tdee: number; energia: number; sueno: number; adh: number; tls: number; accion: string; tendencia: string; aplicado: boolean; fatigaReal: boolean; horasReales: number }
interface Resultado { nombre: string; p: Perfil; filas: Fila[]; kcalInicial: number; hallazgos: string[] }

async function simular(p: Perfil): Promise<Resultado> {
  const { data: cls } = await db.from('clientes').select('id, tls_umbral_carga_alta, profiles:profiles!profile_id(nombre, apellidos, email)')
  const cli = (cls ?? []).find((c: any) => String((Array.isArray(c.profiles) ? c.profiles[0] : c.profiles)?.email ?? '').startsWith(p.prefijo)) as any
  if (!cli) throw new Error(`Sin cliente ${p.prefijo}`)
  const perfil = Array.isArray(cli.profiles) ? cli.profiles[0] : cli.profiles
  if (!String(perfil?.email ?? '').endsWith('@nutricoach-test.dev')) throw new Error(`Salvaguarda: ${p.prefijo} no es un cliente de prueba`)
  const { data: plan } = await db.from('planes_nutricion').select('id, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo').eq('cliente_id', cli.id).eq('activo', true).order('created_at', { ascending: false }).limit(1).single()
  if (!plan) throw new Error(`Sin plan activo ${p.prefijo}`)
  let macros: MacrosBase = { kcal: plan.kcal_objetivo, proteinas: plan.proteinas_objetivo, carbohidratos: plan.carbohidratos_objetivo, grasas: plan.grasas_objetivo }
  const umbral = cli.tls_umbral_carga_alta ?? 80
  if (APPLY) {
    const { count } = await db.from('checkins').select('id', { count: 'exact', head: true }).eq('cliente_id', cli.id).ilike('notas', `%${MARCA}%`)
    if (count) throw new Error(`${p.prefijo} ya tiene ${count} check-ins simulados: ejecuta --limpiar antes`)
    writeFileSync(COPIA(cli.id), JSON.stringify(plan, null, 1))
  }

  const filas: Fila[] = []
  const pesos: PuntoPeso[] = []
  const adhs: number[] = []
  let ultimaTendencia = -99
  let ajusteVigente: AjusteMacros | null = null
  let accionVigenteId: string | null = null
  const fechasCheckin: string[] = []
  let peso = p.peso
  const hoy = new Date()
  for (let s = 1; s <= SEMANAS; s++) {
    const fecha = iso(new Date(hoy.getTime() - (SEMANAS - s) * 7 * 86400000))
    const ev = p.evento?.semanas.includes(s) ? p.evento : undefined
    // Igual que la ruta real: el ajuste de la semana anterior se revierte antes de evaluar
    const rest = macrosARestaurar(ajusteVigente, macros)
    if (rest) {
      macros = rest
      if (APPLY && accionVigenteId) {
        await db.from('planes_nutricion').update({ kcal_objetivo: rest.kcal, proteinas_objetivo: rest.proteinas, carbohidratos_objetivo: rest.carbohidratos, grasas_objetivo: rest.grasas }).eq('id', plan.id)
        await db.from('periodizacion_acciones').update({ ajuste_macros: { ...ajusteVigente, revertido_at: new Date().toISOString() } }).eq('id', accionVigenteId)
      }
    }
    ajusteVigente = null; accionVigenteId = null
    const ingesta = macros.kcal * clip(p.ratioIngesta + 0.06 * gauss(), 0.6, 1.3)
    const gasto = tdee(p, peso)
    peso = Math.round((peso + ((ingesta - gasto) * 7) / 7700 + 0.25 * gauss()) * 10) / 10
    // «Verdad» del cliente: energía 1-5 y horas de sueño. Lo que DECLARA es lo que pide el formulario real
    // (CheckInForm.tsx): energía 1-10, sueño 1-10 (calidad) y adherencia 1-10; el motor recibe esos números tal cual.
    const energiaReal = Math.round(clip(p.energia + (ev?.energia ?? 0) + 0.8 * gauss(), 1, 5))
    const horasReales = Math.round(clip(p.sueno + (ev?.sueno ?? 0) + 0.7 * gauss(), 4, 9) * 10) / 10
    const energia = clip(Math.round(energiaReal * 2 + 0.6 * gauss()), 1, 10)
    const sueno = clip(Math.round((horasReales - 4) * 2), 1, 10) // 4 h → 1 … 9 h → 10 (supuesto)
    const adh = clip(Math.round((p.adherenciaReportada + 8 * gauss()) / 10), 1, 10)
    const tls = Math.round(p.tls * (0.75 + 0.5 * rnd()))
    pesos.push({ fecha, peso })
    adhs.push(adh)
    // Regla de tendencia de peso: propone ±5 % de kcal sobre el plan BASE (antes del ajuste temporal). Se asume que el coach la aprueba.
    let tend: ResultadoTendencia | null = null
    let ajT: AjusteMacros | null = null
    if (s - ultimaTendencia >= 2) {
      const rec = adhs.slice(-4)
      const t = evaluarTendenciaPeso(pesos, p.meta, rec.reduce((a, b) => a + b, 0) / rec.length)
      if (t.kcal_pct !== 0) { tend = t; ultimaTendencia = s; ajT = calcularAjusteCaloricoSemanal(macros, t.kcal_pct); macros = { kcal: ajT.kcal_ajustado, proteinas: ajT.proteinas_ajustadas, carbohidratos: ajT.carbohidratos_ajustados, grasas: ajT.grasas_ajustadas } }
    }
    fechasCheckin.push(fecha)
    const semanas_en_deficit = new Set(fechasCheckin.map(claveSemana)).size
    const res = evaluarCheckin({ energia, calidad_sueno: sueno, adherencia: adh, tls_semanal: tls, semanas_en_deficit, umbral_carga_alta: umbral })
    let aplicado = false
    const aj = res.accion === 'ajuste_calorico_10pct' ? calcularAjusteCaloricoSemanal(macros) : null
    if (aj && !res.requiere_aprobacion_coach) {
      macros = { kcal: aj.kcal_ajustado, proteinas: aj.proteinas_ajustadas, carbohidratos: aj.carbohidratos_ajustados, grasas: aj.grasas_ajustadas }
      aplicado = true
      ajusteVigente = aj
    }
    if (APPLY) {
      const { data: ck, error: e1 } = await db.from('checkins').insert({ cliente_id: cli.id, fecha, peso, adherencia: adh, energia, sueno, notas: `${MARCA} semana ${s}` }).select('id').single()
      if (e1 || !ck) throw new Error(`checkin: ${e1?.message}`)
      const { error: e2 } = await db.from('seguimiento_peso').insert({ cliente_id: cli.id, fecha, peso, notas: `${MARCA} semana ${s}` })
      if (e2) throw new Error(`peso: ${e2.message}`)
      if (tend && ajT) {
        const { error: eT } = await db.from('periodizacion_acciones').insert({ cliente_id: cli.id, checkin_id: ck.id, accion: 'revision_tendencia_peso', input_snapshot: { meta: p.meta, estado: tend.estado, ritmo_pct_semana: tend.ritmo_pct_semana, dias: tend.dias }, ajuste_macros: { ...ajT, descripcion: tend.descripcion }, requiere_aprobacion: true, aprobado_por_coach: true, aplicado: true })
        if (eT) throw new Error(`tendencia: ${eT.message}`)
        await db.from('planes_nutricion').update({ kcal_objetivo: ajT.kcal_ajustado, proteinas_objetivo: ajT.proteinas_ajustadas, carbohidratos_objetivo: ajT.carbohidratos_ajustados, grasas_objetivo: ajT.grasas_ajustadas }).eq('id', plan.id)
      }
      const { data: ac, error: e3 } = await db.from('periodizacion_acciones').insert({ cliente_id: cli.id, checkin_id: ck.id, accion: res.accion, input_snapshot: res.input_snapshot, ajuste_macros: aj, requiere_aprobacion: res.requiere_aprobacion_coach, aprobado_por_coach: res.requiere_aprobacion_coach ? null : true, aplicado: false }).select('id').single()
      if (e3 || !ac) throw new Error(`accion: ${e3?.message}`)
      accionVigenteId = ac.id
      if (aplicado && aj) {
        await db.from('planes_nutricion').update({ kcal_objetivo: aj.kcal_ajustado, proteinas_objetivo: aj.proteinas_ajustadas, carbohidratos_objetivo: aj.carbohidratos_ajustados, grasas_objetivo: aj.grasas_ajustadas }).eq('id', plan.id)
        await db.from('periodizacion_acciones').update({ aplicado: true }).eq('id', ac.id)
      }
    }
    filas.push({ sem: s, fecha, peso, kcalPlan: Math.round(macros.kcal), ingesta: Math.round(ingesta), tdee: Math.round(gasto), energia, sueno, adh, tls, accion: res.accion, tendencia: tend?.estado ?? '', aplicado, fatigaReal: energiaReal <= 2, horasReales })
  }

  const h: string[] = []
  const kcal0 = plan.kcal_objetivo
  const kcalN = filas[filas.length - 1].kcalPlan
  const deriva = (kcalN / kcal0 - 1) * 100
  const ajustesT = filas.filter(f => f.tendencia).length
  if (ajustesT) h.push(`La regla de tendencia de peso propuso ${ajustesT} ajuste(s) de ±5 % (se asume aprobado): ${[...new Set(filas.filter(f => f.tendencia).map(f => f.tendencia))].join(', ')}.`)
  if (Math.abs(deriva) >= 10) h.push(`**Deriva de calorías ${deriva > 0 ? '+' : ''}${deriva.toFixed(0)} %** (${kcal0} → ${kcalN} kcal) (incluye los ajustes de tendencia aprobados) (${filas.filter(f => f.aplicado).length} ajustes aplicados).`)
  const dPeso = filas[filas.length - 1].peso - p.peso
  const esperado = p.metaKgSem * SEMANAS
  const sentidoOk = p.meta === 'mantener' ? Math.abs(dPeso) <= 2 : p.meta === 'perder' ? dPeso <= esperado * 0.5 : dPeso >= esperado * 0.5
  if (!sentidoOk) h.push(`**El peso no va hacia la meta** (${p.meta}): ${p.peso} → ${filas[filas.length - 1].peso} kg en ${SEMANAS} semanas (esperado ≈ ${esperado.toFixed(1)} kg). El árbol de decisión no usa el peso, así que ninguna regla corrige el rumbo.`)
  if (p.meta === 'perder' && dPeso / SEMANAS < -(p.peso * 0.01)) h.push(`Pérdida demasiado rápida (${(dPeso / SEMANAS).toFixed(2)} kg/sem > 1 % del peso) sin ningún aviso.`)
  const refeedSinDeficit = filas.filter(f => f.accion === 'refeed_sugerir').length
  if (refeedSinDeficit && p.meta !== 'perder') h.push(`Se sugiere **refeed ${refeedSinDeficit} vez/veces a un cliente que no está en déficit** (meta: ${p.meta}): «semanas_en_deficit» cuenta semanas con check-in, no semanas en déficit.`)
  const pendientes = filas.filter(f => ['refeed_sugerir', 'alerta_coach_solo'].includes(f.accion)).length
  if (pendientes >= 3) h.push(`${pendientes} acciones esperan aprobación del coach (refeed / alerta). Si no las revisa, el cliente no recibe respuesta.`)
  const fatigaPerdida = filas.filter(f => f.fatigaReal && !['refeed_sugerir', 'higiene_sueno', 'ajuste_calorico_10pct', 'mensaje_apoyo'].includes(f.accion)).length
  const fatigas = filas.filter(f => f.fatigaReal).length
  if (fatigas >= 2 && fatigaPerdida >= 1) h.push(`**Fatiga no detectada:** ${fatigaPerdida} de ${fatigas} semanas con cansancio real (energía 1-2 sobre 5) no activan ninguna regla de fatiga (energía declarada por encima del umbral).`)
  const alertaPorDefecto = filas.filter(f => f.accion === 'alerta_coach_solo' && f.adh <= 5).length
  if (alertaPorDefecto >= 2) h.push(`${alertaPorDefecto} alertas al coach por adherencia ≤ 5/10 (el control del formulario arranca en 5: quien envía sin tocarlo dispara la alerta).`)
  return { nombre: `${perfil?.nombre} ${perfil?.apellidos}`, p, filas, kcalInicial: kcal0, hallazgos: h }
}

async function limpiar(p: Perfil) {
  const { data: cls } = await db.from('clientes').select('id, profiles:profiles!profile_id(email)')
  const cli = (cls ?? []).find((c: any) => String((Array.isArray(c.profiles) ? c.profiles[0] : c.profiles)?.email ?? '').startsWith(p.prefijo)) as any
  if (!cli) return
  const email = String((Array.isArray(cli.profiles) ? cli.profiles[0] : cli.profiles)?.email ?? '')
  if (!email.endsWith('@nutricoach-test.dev')) throw new Error('Salvaguarda: no es cliente de prueba')
  const { data: cks } = await db.from('checkins').select('id').eq('cliente_id', cli.id).ilike('notas', `%${MARCA}%`)
  const ids = (cks ?? []).map(c => c.id)
  if (ids.length) await db.from('periodizacion_acciones').delete().in('checkin_id', ids)
  await db.from('checkins').delete().eq('cliente_id', cli.id).ilike('notas', `%${MARCA}%`)
  await db.from('seguimiento_peso').delete().eq('cliente_id', cli.id).ilike('notas', `%${MARCA}%`)
  let restaurado = 'sin copia'
  try {
    const c = JSON.parse(readFileSync(COPIA(cli.id), 'utf8'))
    await db.from('planes_nutricion').update({ kcal_objetivo: c.kcal_objetivo, proteinas_objetivo: c.proteinas_objetivo, carbohidratos_objetivo: c.carbohidratos_objetivo, grasas_objetivo: c.grasas_objetivo }).eq('id', c.id)
    restaurado = `plan restaurado a ${c.kcal_objetivo} kcal`
  } catch { /* sin copia: no se tocó el plan */ }
  console.log(`${p.prefijo}: ${ids.length} check-ins borrados, ${restaurado}`)
}

async function main() {
  if (LIMPIAR) { for (const p of PERFILES) await limpiar(p); return }
  const filtro = process.argv.slice(2).filter(a => !a.startsWith('--'))
  const lista = PERFILES.filter(p => !filtro.length || filtro.some(f => p.prefijo.startsWith(f)))
  const md: string[] = [`# Simulación a largo plazo (${SEMANAS} semanas) — ${iso(new Date())}`, '',
    'Generado con `scripts/simular-largo-plazo.ts` (semilla ' + arg('semilla', '7') + '). Usa `evaluarCheckin` y `calcularAjusteCaloricoSemanal` reales; el peso sigue un balance energético simple. **' + (APPLY ? 'Escribió en la base de datos (clientes de prueba, con marcador).' : 'No escribe en la base de datos.') + '** Los hallazgos son hipótesis sobre el sistema a confirmar, no medidas de clientes reales.', '']
  for (const p of lista) {
    const r = await simular(p)
    console.log(`\n== ${r.nombre} (${p.meta}) ==`)
    md.push(`## ${r.nombre} — meta: ${p.meta}`, '', '| Sem | Peso | Plan kcal | Come | Gasto | Energía | Sueño | Adh. | TLS | Acción | Tendencia |', '|---|---|---|---|---|---|---|---|---|---|---|')
    for (const f of r.filas) {
      md.push(`| ${f.sem} | ${f.peso} | ${f.kcalPlan} | ${f.ingesta} | ${f.tdee} | ${f.energia} | ${f.sueno} | ${f.adh} | ${f.tls} | ${f.accion}${f.aplicado ? ' ✔aplicado' : ''} | ${f.tendencia} |`)
    }
    md.push('', r.hallazgos.length ? r.hallazgos.map(x => `- ${x}`).join('\n') : '- Sin hallazgos.', '')
    console.log(`peso ${p.peso} → ${r.filas[r.filas.length - 1].peso} | kcal ${r.kcalInicial} → ${r.filas[r.filas.length - 1].kcalPlan} | acciones: ${[...new Set(r.filas.map(f => f.accion))].join(', ')}`)
    r.hallazgos.forEach(x => console.log('  ⚠', x.replace(/\*\*/g, '')))
  }
  const ruta = join(__dirname, '..', 'salidas', `${iso(new Date()).split('-').reverse().join('-')}_simulacion-largo-plazo.md`)
  writeFileSync(ruta, md.join('\n'))
  console.log(`\nInforme: ${ruta}`)
}
main().catch(e => { console.error(e); process.exit(1) })
