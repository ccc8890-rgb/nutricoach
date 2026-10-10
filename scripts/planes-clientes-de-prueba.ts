// Genera (sin escribir en BD) el macrociclo de cada cliente de prueba con sus datos reales y lo vuelca a un documento.
// Uso: npx tsx scripts/planes-clientes-de-prueba.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { construirEntradaMacro, type DatosClienteMacro } from '../lib/entrenos/macro-desde-cliente'
import { planificarMacrociclo } from '../lib/entrenos/macrociclo'

for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const hoy = new Date().toISOString().slice(0, 10)
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const NOMBRES = ['Carlos', 'Marcos', 'Andrés', 'Natalia', 'Laura']
const REG_FUERZA = /fuerza|h[ií]brid|gym|hyrox|upper|lower|torso|pierna/i

async function main() {
  const { data: clientes } = await db.from('clientes').select('id, nivel, edad, sexo, activo, profiles:profiles!profile_id(nombre, apellidos)').eq('activo', true)
  const salida: string[] = [`# Planes de los clientes de prueba — macrociclo determinista (${hoy})`, '',
    'Generado con `scripts/planes-clientes-de-prueba.ts` a partir de los datos reales de cada cliente (solo lectura; no se ha escrito nada en la base de datos). Cada plan sale de `lib/entrenos/macrociclo.ts`: reglas y fuentes en `docs/10-10-2026_motor-fiable-rendimiento.md`. **Es una propuesta para que el coach la revise, no un plan aplicado.**', '']
  for (const nombre of NOMBRES) {
    const c = (clientes ?? []).find(x => String((x.profiles as { nombre?: string } | null)?.nombre ?? '').startsWith(nombre))
    if (!c) { salida.push(`## ${nombre}`, '', 'No se encontró entre los clientes activos.', ''); continue }
    const [{ data: perfil }, { data: comp }, { data: onb }, { data: entrenos }, { data: plan }] = await Promise.all([
      db.from('perfil_entreno_cliente').select('nivel,vdot,dias_disponibles,patron_lesiones,restricciones_temporales,capacidad_recuperacion,sport_modality').eq('cliente_id', c.id).maybeSingle(),
      db.from('competiciones').select('fecha_competicion,disciplina,tiempo_objetivo_min,objetivo').eq('cliente_id', c.id).eq('activo', true).gte('fecha_competicion', hoy).order('fecha_competicion').limit(1),
      db.from('onboarding_perfil_profundo').select('condiciones_salud,fecha_competicion,tipo_competicion').eq('cliente_id', c.id).maybeSingle(),
      db.from('entrenos_realizados').select('fecha,tipo,duracion_s').eq('cliente_id', c.id).gte('fecha', new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10)),
      db.from('planes_entrenamiento').select('id,nombre').eq('cliente_id', c.id).eq('activo', true).maybeSingle(),
    ])
    let fuerza = 0
    if (plan) {
      const { data: ses } = await db.from('sesiones_entrenamiento').select('nombre').eq('plan_id', plan.id)
      fuerza = (ses ?? []).filter(s => REG_FUERZA.test(String(s.nombre ?? ''))).length
    }
    const datos: DatosClienteMacro = {
      hoy,
      cliente: { nivel: c.nivel ?? null, edad: c.edad ?? null, sexo: c.sexo ?? null },
      perfil: perfil as DatosClienteMacro['perfil'],
      competicion: (comp?.[0] as DatosClienteMacro['competicion']) ?? null,
      onboarding: onb as DatosClienteMacro['onboarding'],
      entrenos: (entrenos ?? []) as DatosClienteMacro['entrenos'],
      sesionesFuerzaFijas: fuerza,
    }
    const { entrada, faltan, supuestos } = construirEntradaMacro(datos)
    const r = planificarMacrociclo(entrada)
    const p = r.parametros
    salida.push(`## ${nombre} ${(c.profiles as { apellidos?: string } | null)?.apellidos ?? ''}`.trim(), '')
    salida.push('**Datos usados:** ' + [
      `modalidad ${(perfil as { sport_modality?: string } | null)?.sport_modality ?? 'n/d'}`, `nivel ${entrada.nivel ?? 'n/d'}`, `edad ${entrada.edad ?? 'n/d'}`, `VDOT ${entrada.vdot ?? 'n/d'}`, `días disponibles ${entrada.diasDisponibles ?? 'n/d'}`,
      `volumen real ${entrada.minutosSemanaActuales ?? 'n/d'} min/sem`, `fuerza fija ${entrada.sesionesFuerzaFijas}`,
      `lesiones ${entrada.lesiones.join(', ') || 'ninguna'}`, `salud ${entrada.condicionesSalud ?? 'n/d'}`,
      entrada.competicion ? `prueba ${entrada.competicion.disciplina || 'sin tipo'} el ${entrada.competicion.fecha}` : 'sin prueba'].join(' · '), '')
    const modalidad = String((perfil as { sport_modality?: string } | null)?.sport_modality ?? '')
    if (modalidad && !/run|carrera|hibrid|hyrox|trail|marat/i.test(modalidad)) salida.push(`> ⚠️ Su modalidad registrada es **${modalidad}**, no carrera: este plan de carrera es solo orientativo y solo tiene sentido si quiere correr de verdad.`, '')
    if (faltan.length) salida.push('**Falta (completar para afinar):**', ...faltan.map(f => `- ${f}`), '')
    const sup = [...supuestos, ...(r.supuestos ?? [])]
    if (sup.length) salida.push('**Supuestos:**', ...sup.map(f => `- ${f}`), '')
    if (r.avisos.length) salida.push('**Avisos del planificador:**', ...r.avisos.map(f => `- ${f}`), '')
    salida.push(`**Parámetros:** ${p.salidasSemana} salidas/sem · volumen ${p.volumenBase} → pico ${p.volumenPico} min · crecimiento ${Math.round(p.crecimientoSemanal * 100)} %/sem · descarga cada ${p.descargaCada} semanas`, '')
    salida.push('| Sem | Fase | Min | Salidas | Tirada | % suave | Fuerza | Sesiones (día:tipo min) |', '|---|---|---|---|---|---|---|---|')
    for (const s of r.semanas) salida.push(`| ${s.n}${s.descarga ? ' ↓' : ''} | ${s.fase} | ${s.minutos} | ${s.salidas} | ${s.tiradaMin} | ${s.pctSuave} | ${s.fuerza} | ${s.sesiones.map(x => `${DIAS[x.dia]}:${x.tipo} ${x.minutos}`).join(', ')} |`)
    salida.push('')
  }
  const ruta = `docs/${hoy.split('-').reverse().join('-')}_planes-clientes-de-prueba.md`
  writeFileSync(ruta, salida.join('\n'))
  console.log('escrito', ruta)
}
main()
