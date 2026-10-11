// Limpieza de la biblioteca de ejercicios: duplicados sin uso y músculo «general». Simula por defecto; --apply escribe.
// Copia previa: salidas/11-10-2026_backup-ejercicios.json. Deshacer: reinsertar filas de la copia.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { musculoDe, pestanaDe, type EjercicioBiblioteca } from '../lib/entrenos/ejercicio-categorias'

for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '') }
const APPLY = process.argv.includes('--apply')
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

async function todos(tabla: string, cols: string) {
  let out: any[] = []
  for (let f = 0; ; f += 1000) { const { data } = await s.from(tabla).select(cols).range(f, f + 999); out = out.concat(data ?? []); if (!data || data.length < 1000) break }
  return out
}

async function main() {
  const ej = await todos('ejercicios', 'id,nombre,tipo,grupo_muscular,created_at') as (EjercicioBiblioteca & { created_at: string })[]
  const uso = new Map<string, number>()
  for (const t of ['sesion_ejercicios', 'plantilla_sesion_ejercicios', 'registros_sets'])
    for (const r of await todos(t, 'ejercicio_id')) uso.set(r.ejercicio_id, (uso.get(r.ejercicio_id) ?? 0) + 1)

  const grupos = new Map<string, typeof ej>()
  for (const e of ej) { const k = norm(e.nombre); grupos.set(k, [...(grupos.get(k) ?? []), e]) }
  const borrar: typeof ej = []
  for (const l of grupos.values()) {
    if (l.length < 2) continue
    const orden = [...l].sort((a, b) => (uso.get(b.id) ?? 0) - (uso.get(a.id) ?? 0) || a.created_at.localeCompare(b.created_at))
    borrar.push(...orden.slice(1).filter(e => !uso.get(e.id)))
  }
  const idsBorrar = new Set(borrar.map(e => e.id))

  const cambios: { id: string; nombre: string; de: string; a: string }[] = []
  for (const e of ej) {
    if (e.grupo_muscular !== 'general' || idsBorrar.has(e.id)) continue
    const p = pestanaDe(e)
    let a: string
    const n = norm(e.nombre)
    if (/curl (femoral|de piernas)/.test(n)) a = 'Isquiotibiales'
    else if (/hip thrust|gluteo/.test(n)) a = 'Glúteos'
    else if (/pedaleo|rodillo/.test(n)) a = 'Cardio'
    else if (p === 'Core') a = 'Core'
    else if (p === 'Cardio') a = 'Cardio'
    else if (p === 'Calentamiento' || p === 'Funcional') a = 'Cuerpo completo'
    else {
      const m = musculoDe(e)
      a = m === 'Piernas y glúteos' ? 'Piernas' : m === 'Brazos' ? (/triceps|fondos|frances/.test(norm(e.nombre)) ? 'Tríceps' : 'Bíceps') : m
    }
    cambios.push({ id: e.id, nombre: e.nombre, de: 'general', a })
  }

  console.log(`${APPLY ? 'APLICANDO' : 'SIMULACIÓN'}: ${borrar.length} duplicados sin uso a borrar, ${cambios.length} músculos a asignar`)
  console.log('BORRAR:', borrar.map(e => e.nombre).join(' | '))
  console.log('MÚSCULOS:', cambios.map(c => `${c.nombre}→${c.a}`).join(' | '))
  if (!APPLY) return
  let b = 0, fb = 0, u = 0
  for (const e of borrar) { const { error } = await s.from('ejercicios').delete().eq('id', e.id); if (error) fb++; else b++ }
  for (const c of cambios) { const { error } = await s.from('ejercicios').update({ grupo_muscular: c.a }).eq('id', c.id); if (!error) u++ }
  console.log(`Borrados ${b} (rechazados ${fb}), actualizados ${u}`)
}
main()
