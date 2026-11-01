// Repunta a un alimento básico las líneas de receta enlazadas a productos elaborados o de marca («Nata» → «Castañas heladas de nata»).
// La lista de arreglos está revisada a mano (01-11-2026); el validador `vinculoParaReceta` evita que el problema vuelva a entrar.
//   npx tsx scripts/corregir-vinculos-elaborados.ts            → simula
//   npx tsx scripts/corregir-vinculos-elaborados.ts --aplica   → copia en salidas/, repunta y recalcula macros
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { recalcularMacrosReceta } from '../lib/recetas/elaboraciones-db'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const APLICA = process.argv.includes('--aplica')

// [texto de la línea (regex, sin tildes), alimento actual (regex), nombre EXACTO del alimento básico de destino]
const ARREGLOS: [RegExp, RegExp, string][] = [
  [/^nata$/, /castanas heladas/, 'Nata'],
  [/^tomate triturado natural$/, /con cebolla/, 'Tomate triturado'],
  [/^sal maldon$/, /almendra/, 'Sal Escamas'],
  [/^aove$/, /lingote de bacalao/, 'Aceite de oliva virgen extra'],
  [/^oregano seco$/, /cuadraditos/, 'Orégano seco'],
  [/^cafe$/, /3 en 1/, 'Café'],
  [/^cafe soluble$/, /3 en 1/, 'Café'],
  [/^nuez moscada/, /nuez cascara/, 'Nuez moscada molida'],
  [/^pina \(con piel\)$/, /deshidratada/, 'Piña'],
  [/^azucar$/, /sobres/, 'Azúcar'],
  [/^impulsor$/, /preparado para reposteria/, 'Levadura química'],
  [/^salsa de soja baja en (sal|sodio)$/, /salsa con soja/, 'Salsa de soja (baja en sal)'],
  [/^semillas de lino molidas$/, /sesamo/, 'Semillas de lino'],
  [/^queso rallado light( \(gratinado\))?$/, /rallado 3 quesos/, 'Queso rallado'],
  [/^queso parmesano rallado$/, /rallado 3 quesos/, 'Queso parmesano rallado'],
  [/^cacahuetes tostados( y salados)?$/, /con cascara/, 'Cacahuetes'],
  [/^chocolate sin azucar$/, /bebida de avena/, 'Chocolate Negro 70% sin Azúcar'],
]
const sin = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

async function main() {
  const destinos = new Map<string, { id: string; nombre: string }>()
  for (const n of new Set(ARREGLOS.map(a => a[2]))) {
    const { data } = await db.from('alimentos').select('id, nombre, es_base').eq('nombre', n).eq('es_comestible', true).order('es_base', { ascending: false }).limit(1)
    if (!data?.[0]) { console.log(`✗ sin destino «${n}»`); continue }
    destinos.set(n, data[0])
  }
  const { data: filas, error } = await db.from('receta_ingredientes').select('id, receta_id, nombre_libre, alimento_id, alimentos(nombre), recetas!receta_ingredientes_receta_id_fkey(estado, nombre)').not('alimento_id', 'is', null).limit(20000)
  if (error) throw error
  const cambios: any[] = []
  for (const f of filas as any[]) {
    const libre = sin(f.nombre_libre ?? ''), actual = sin(f.alimentos?.nombre ?? '')
    const a = ARREGLOS.find(([l, al]) => l.test(libre) && al.test(actual))
    const d = a && destinos.get(a[2])
    if (d && d.id !== f.alimento_id) cambios.push({ id: f.id, receta_id: f.receta_id, receta: f.recetas?.nombre, estado: f.recetas?.estado, libre: f.nombre_libre, de: f.alimentos?.nombre, a: d.nombre, alimento_anterior: f.alimento_id, alimento_nuevo: d.id })
  }
  for (const c of cambios) console.log(`${c.estado.padEnd(11)} ${c.receta} · ${c.libre}: ${c.de} → ${c.a}`)
  console.log(`${cambios.length} líneas`)
  if (!APLICA) return
  writeFileSync(join(__dirname, '..', 'salidas', `01-11-2026_BACKUP-vinculos-elaborados.json`), JSON.stringify(cambios, null, 2))
  for (const c of cambios) await db.from('receta_ingredientes').update({ alimento_id: c.alimento_nuevo }).eq('id', c.id)
  for (const r of new Set(cambios.map(c => c.receta_id))) await recalcularMacrosReceta(db as any, r as string)
  console.log('aplicado y macros recalculados')
}
main().catch(e => { console.error(e); process.exit(1) })
