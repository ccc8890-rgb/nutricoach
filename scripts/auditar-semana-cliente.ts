/**
 * Genera la semana de uno o varios clientes de PRUEBA con el motor real (como «Generar semana» → reemplazar)
 * y audita el resultado: seguridad (alérgenos, carne en pescetarianos…), desviación de macros por día y reglas clínicas.
 * Uso: npx tsx scripts/auditar-semana-cliente.ts <prefijo_cliente> [<prefijo>…]
 * ⚠ Escribe en el plan del cliente (comidas de la semana). Solo para clientes ficticios; guarda copia previa en salidas/.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { generarSemana } from '../lib/nutricion/planificar-semana'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '')
const PALABRAS: Record<string, string[]> = {
  'sin frutos secos': ['almendra', 'nuez', 'nueces', 'avellana', 'anacardo', 'pistacho', 'cacahuete', 'pecana', 'macadamia', 'frutos secos', 'mani '],
  'sin gluten': ['trigo', 'pan ', 'pan de', 'pan integral', 'pan blanco', 'pasta', 'cuscus', 'fideo', 'macarron', 'espagueti', 'cerveza', 'galleta', 'wrap', 'tortilla de trigo', 'seitan', 'cebada', 'bulgur', 'bocadillo', 'tostada', 'bagel', 'sandwich', 'granola', 'cereales', 'avena', 'harina de trigo', 'pita', 'focaccia', 'pizza', 'empanad', 'rebozad'],
  'sin huevo': ['huevo', 'clara', 'yema', 'mayonesa', 'alioli', 'tortilla francesa', 'tortilla de patata', 'revuelto', 'flan'],
  'sin mariscos': ['gamba', 'langostino', 'mejillon', 'calamar', 'pulpo', 'marisco', 'cangrejo', 'almeja', 'ostra', 'vieira', 'cigala', 'sepia', 'surimi', 'berberecho'],
  'sin lactosa': ['leche de vaca', 'leche entera', 'leche desnatada', 'leche semidesnatada', 'yogur ', 'yogurt', 'queso', 'nata', 'mantequilla', 'kefir', 'requeson', 'skyr', 'cottage', 'mozzarella', 'feta', 'burrata'],
  'sin carne': ['pollo', 'pavo', 'ternera', 'cerdo', 'jamon', 'chorizo', 'bacon', 'carne', 'buey', 'cordero', 'embutido', 'salchicha', 'lomo de cerdo', 'lomo embuchado', 'pechuga', 'solomillo', 'hamburguesa', 'albondiga', 'pato', 'conejo'],
  'sodio alto': ['jamon', 'chorizo', 'embutido', 'salchicha', 'bacon', 'queso curado', 'conserva', 'salsa de soja', 'aceituna', 'anchoa', 'caldo concentrado', 'sobrasada', 'lomo embuchado'],
  'azúcar/IG alto': ['azucar', 'miel', 'sirope', 'zumo', 'datil', 'mermelada', 'pan blanco', 'bizcocho', 'tarta', 'brownie', 'helado', 'galleta', 'chocolate con leche'],
}
const REGLAS: Record<string, string[]> = {
  c3e2744d: ['sodio alto'],                                                   // Marta: hipertensión
  '2a05ff53': ['sin frutos secos'],                                           // Daniel
  '92fc59e8': ['sin gluten', 'azúcar/IG alto'],                               // Rafael: celiaquía + diabetes
  '5440a4a1': ['sin carne', 'sin lactosa'],                                   // Irene: pescetariana, sin lactosa
  d6565990: ['sodio alto'],                                                   // Julián: ERC + hipertensión
  cf9d8509: ['sin huevo', 'sin mariscos'],                                    // Sergio
}
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

async function auditar(prefijo: string) {
  const { data: cls } = await db.from('clientes').select('id, peso_inicial, comidas_dia, profiles!profile_id(nombre, apellidos)')
  const cli = (cls ?? []).find(c => c.id.startsWith(prefijo)) as { id: string; peso_inicial: number; comidas_dia: number | null; profiles: { nombre: string; apellidos: string } | { nombre: string; apellidos: string }[] } | undefined
  if (!cli) throw new Error(`Cliente ${prefijo} no encontrado`)
  const perfil = Array.isArray(cli.profiles) ? cli.profiles[0] : cli.profiles
  const { data: plan } = await db.from('planes_nutricion').select('id, nombre, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo').eq('cliente_id', cli.id).eq('activo', true).maybeSingle()
  if (!plan) throw new Error('Sin plan activo')

  const { data: antes } = await db.from('comidas').select('*, comida_alimentos(*)').eq('plan_id', plan.id)
  writeFileSync(join(__dirname, '..', 'salidas', `18-10-2026_copia-semana-${cli.id.slice(0, 8)}.json`), JSON.stringify(antes, null, 1))

  const t0 = Date.now()
  const r = await generarSemana(db, cli.id, plan, true, [])
  const seg = ((Date.now() - t0) / 1000).toFixed(1)

  const { data: filas } = await db.from('comidas')
    .select('nombre, dia_semana, orden, receta:recetas(nombre, intolerancias, tiempo_prep_min, tiempo_coccion_min), comida_alimentos(cantidad_gramos, es_complemento, alimento:alimentos(nombre, calorias, proteinas, carbohidratos, grasas, sodio_mg, potasio_mg))')
    .eq('plan_id', plan.id).not('dia_semana', 'is', null)
  type Alim = { nombre: string; calorias: number; proteinas: number; carbohidratos: number; grasas: number; sodio_mg: number | null; potasio_mg: number | null }
  type Fila = { nombre: string; dia_semana: string; orden: number; receta: { nombre: string; intolerancias: string[] | null; tiempo_prep_min: number | null; tiempo_coccion_min: number | null } | null; comida_alimentos: { cantidad_gramos: number; es_complemento: boolean; alimento: Alim | null }[] }
  const comidas = (filas ?? []) as unknown as Fila[]

  console.log(`\n══════ ${perfil?.nombre} ${perfil?.apellidos} (${cli.id.slice(0, 8)}) · obj ${plan.kcal_objetivo} kcal P${plan.proteinas_objetivo} C${plan.carbohidratos_objetivo} G${plan.grasas_objetivo} · ${seg}s`)
  console.log(`   asignadas ${r.asignadas} · complementos ${r.complementos} · repetidas ${r.repetidas} · sin cubrir ${JSON.stringify(r.sinCubrir)} · errores ${JSON.stringify(r.errores)}${r.avisos?.length ? ` · avisos: ${JSON.stringify(r.avisos).slice(0, 300)}` : ''}`)

  const reglas = REGLAS[prefijo] ?? []
  const violaciones: string[] = []
  const desv: number[] = [], dp: number[] = [], prots: number[] = [], nsodio: number[] = []
  for (const d of DIAS) {
    const del = comidas.filter(c => c.dia_semana === d)
    if (!del.length) continue
    let k = 0, p = 0, c2 = 0, g = 0, na = 0
    for (const c of del) {
      const textoReceta = norm(`${c.receta?.nombre ?? ''} `)
      const alim = c.comida_alimentos
      for (const x of alim) {
        const a = x.alimento; if (!a) continue
        const f = x.cantidad_gramos / 100
        k += a.calorias * f; p += a.proteinas * f; c2 += a.carbohidratos * f; g += a.grasas * f; na += (a.sodio_mg ?? 0) * f
      }
      const texto = norm(`${c.receta?.nombre ?? ''} ${alim.map(x => x.alimento?.nombre ?? '').join(' ')} `)
      for (const regla of reglas) for (const w of PALABRAS[regla]) if (texto.includes(w) || textoReceta.includes(w)) violaciones.push(`${d} ${c.nombre}: «${c.receta?.nombre ?? alim.map(x => x.alimento?.nombre).join(', ')}» contiene «${w}» (${regla})`)
      const tags = c.receta?.intolerancias ?? []
      if (reglas.includes('sin gluten') && tags.includes('Gluten')) violaciones.push(`${d} ${c.nombre}: receta etiquetada Gluten`)
      if (reglas.includes('sin frutos secos') && (tags.includes('Frutos Secos') || tags.includes('Cacahuetes'))) violaciones.push(`${d} ${c.nombre}: receta etiquetada Frutos Secos/Cacahuetes`)
      if (reglas.includes('sin huevo') && tags.includes('Huevos')) violaciones.push(`${d} ${c.nombre}: receta etiquetada Huevos`)
      if (reglas.includes('sin mariscos') && (tags.includes('Crustáceos') || tags.includes('Moluscos'))) violaciones.push(`${d} ${c.nombre}: receta etiquetada Crustáceos/Moluscos`)
      if (reglas.includes('sin lactosa') && tags.includes('Lácteos')) violaciones.push(`${d} ${c.nombre}: receta etiquetada Lácteos`)
    }
    desv.push(((k - (plan.kcal_objetivo ?? 0)) / (plan.kcal_objetivo ?? 1)) * 100)
    dp.push(((p - (plan.proteinas_objetivo ?? 0)) / (plan.proteinas_objetivo ?? 1)) * 100)
    prots.push(p); nsodio.push(na)
    console.log(`   ${d.padEnd(10)} ${del.length} comidas · ${String(Math.round(k)).padStart(4)} kcal (${desv[desv.length - 1] >= 0 ? '+' : ''}${desv[desv.length - 1].toFixed(0)}%) · P${Math.round(p)} (${dp[dp.length - 1] >= 0 ? '+' : ''}${dp[dp.length - 1].toFixed(0)}%) C${Math.round(c2)} G${Math.round(g)} · Na ${Math.round(na)} mg`)
  }
  const media = (a: number[]) => a.reduce((s, x) => s + x, 0) / (a.length || 1)
  const max = (a: number[]) => Math.max(...a.map(Math.abs))
  console.log(`   Desviación kcal: media ${media(desv).toFixed(1)}% · máx ${max(desv).toFixed(0)}% | proteína: media ${media(dp).toFixed(1)}% · máx ${max(dp).toFixed(0)}% | sodio medio ${Math.round(media(nsodio))} mg/día`)
  if (prefijo === 'd6565990') console.log(`   ERC: proteína media ${Math.round(media(prots))} g/día = ${(media(prots) / cli.peso_inicial).toFixed(2)} g/kg (techo orientativo 0,8 g/kg = ${Math.round(0.8 * cli.peso_inicial)} g)`)
  const tiemposAltos = comidas.filter(c => ((c.receta?.tiempo_prep_min ?? 0) + (c.receta?.tiempo_coccion_min ?? 0)) > 30).length
  console.log(`   Comidas por día: ${(comidas.length / (new Set(comidas.map(c => c.dia_semana)).size || 1)).toFixed(1)} · recetas >30 min: ${tiemposAltos}/${comidas.length}`)
  console.log(violaciones.length ? `   ✗ ${violaciones.length} VIOLACIONES:\n     ${[...new Set(violaciones)].slice(0, 25).join('\n     ')}` : `   ✓ sin violaciones de las reglas (${reglas.join(', ') || 'ninguna'})`)
}

async function main() {
  const prefs = process.argv.slice(2)
  if (!prefs.length) throw new Error('Indica uno o varios prefijos de cliente')
  for (const p of prefs) await auditar(p)
}
main().catch(e => { console.error(e); process.exit(1) })
