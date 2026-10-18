/**
 * Solo lectura: compara los ingredientes de cada receta aprobada con sus etiquetas de alérgenos (`intolerancias`).
 * Detecta recetas que llevan un alérgeno en los ingredientes pero NO lo declaran (el caso peligroso para un celíaco, alérgico, etc.).
 * Uso: npx tsx scripts/auditar-alergenos-recetas.ts [--detalle] [--aplicar]
 * --aplicar: añade «Gluten» (y quita «Sin Gluten») a las recetas que lo llevan sin declararlo. Copia previa en salidas/.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '')

// tag positivo → palabras de ingrediente que lo implican. Se compara por palabra completa.
const REGLAS: Record<string, RegExp> = {
  Gluten: /\b(trigo|pan|panes|pasta|espagueti|espaguetis|macarron(es)?|fideos?|cuscus|bagel|granola|cereales?|galletas?|harina de trigo|harina|seitan|cebada|bulgur|pita|tortilla de trigo|wraps?|focaccia|pizza|rebozad[oa]|empanad[oa]|croutons?|tostadas?|sandwich|bocadillo|tallarines|lasana|canelon(es)?|pan rallado|obleas?|hojaldre|masa|centeno|espelta|kamut|cerveza|salsa de soja|weetabix|muesli)\b/,
  'Frutos Secos': /\b(almendras?|nueces?|nuez|avellanas?|anacardos?|pistachos?|pecanas?|macadamias?|castanas?|frutos secos|mantequilla de almendras?|crema de almendras?|praline|turron)\b/,
  Cacahuetes: /\b(cacahuetes?|mani|crema de cacahuete)\b/,
  Huevos: /\b(huevos?|claras?|yemas?|mayonesa|alioli|merengue|tortilla francesa|tortilla de patata|revuelto)\b/,
  Lácteos: /\b(leche|yogur|yogurt|queso|quesos|nata|mantequilla|kefir|requeson|skyr|cottage|mozzarella|feta|burrata|parmesano|cheddar|ricotta|mascarpone|crema agria|suero|caseina|whey)\b/,
  Pescado: /\b(salmon|atun|merluza|bacalao|lubina|dorada|sardinas?|caballa|boqueron(es)?|anchoas?|rape|pescadilla|trucha|pescado|corvina|tataki|caballa)\b/,
  Crustáceos: /\b(gambas?|langostinos?|cangrejo|cigalas?|camarones?|bogavante|langosta|marisco)\b/,
  Moluscos: /\b(mejillones?|calamares?|pulpo|almejas?|ostras?|sepia|vieiras?|berberechos?|chipirones?|surimi)\b/,
  Soja: /\b(soja|tofu|tempeh|edamame|salsa de soja|miso)\b/,
  Sésamo: /\b(sesamo|tahini)\b/,
}
// El alimento no es lo que parece (evitar falsos positivos): «pasta de curry/tomate/…», «leche de coco/almendra/avena/soja»
const EXCLUIR = /(konjac|everything bagel|pasta fusilli 100|almendra tostada|pipas|semillas|nuez moscada|obleas de arroz|papel de arroz|tostad[oa]s? (de )?(sesamo|calabaza)|pasta de (curry|tomate|sesamo|almendras?|cacahuetes?|datiles|aceitunas?|dientes)|leche de (coco|almendras?|avena|soja|arroz)|bebida de|queso vegano|yogur de (soja|coco)|mantequilla de (almendras?|cacahuete)|pan de pescado|harina de (arroz|garbanzo|avena|maiz|almendra|coco|legumbres)|crema de cacahuete|nata vegetal|mantequilla vegetal)/

async function main() {
  const filas: Array<{ id: string; nombre: string; intolerancias: string[] | null; receta_ingredientes: { nombre_libre: string | null; alimento: { nombre: string } | { nombre: string }[] | null }[] }> = []
  for (let d = 0; ; d += 500) {
    const { data, error } = await db.from('recetas').select('id, nombre, intolerancias, receta_ingredientes!receta_ingredientes_receta_id_fkey(nombre_libre, alimento:alimentos(nombre))').eq('estado', 'aprobada').range(d, d + 499)
    if (error) throw error
    filas.push(...(data as never))
    if (!data || data.length < 500) break
  }
  const faltan = new Map<string, Array<{ id: string; nombre: string; por: string; tags: string[] }>>()
  for (const r of filas) {
    const tags = r.intolerancias ?? []
    for (const ing of r.receta_ingredientes) {
      const a = Array.isArray(ing.alimento) ? ing.alimento[0] : ing.alimento
      const texto = norm(`${ing.nombre_libre ?? ''}`)
      const textoAl = norm(`${a?.nombre ?? ''}`)
      for (const [tag, re] of Object.entries(REGLAS)) {
        if (tags.includes(tag)) continue
        // se exige que lo diga el nombre libre del ingrediente (lo que figura en la receta); el alimento enlazado solo confirma
        if (re.test(texto) && !EXCLUIR.test(texto) && !EXCLUIR.test(textoAl)) {
          const l = faltan.get(tag) ?? []
          if (!l.some(x => x.nombre === r.nombre)) l.push({ id: r.id, nombre: r.nombre, por: ing.nombre_libre ?? '', tags })
          faltan.set(tag, l)
        }
      }
    }
  }
  console.log(`Recetas aprobadas auditadas: ${filas.length}`)
  for (const [tag, l] of [...faltan.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n«${tag}» sin declarar en ${l.length} recetas${process.argv.includes('--detalle') ? ':' : ' (ej.):'}`)
    for (const x of l.slice(0, process.argv.includes('--detalle') ? 999 : 6)) console.log(`   ${x.nombre.slice(0, 55).padEnd(55)} ← ${x.por}`)
  }
  if (process.argv.includes('--aplicar')) await aplicar(faltan.get('Gluten') ?? [])
}
async function aplicar(filas: Array<{ id: string; nombre: string; tags: string[] }>) {
  const copia = filas.map(f => ({ id: f.id, nombre: f.nombre, antes: { intolerancias: f.tags } }))
  const archivo = join(__dirname, '..', 'salidas', `${new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', 'h')}_copia-gluten-recetas.json`)
  writeFileSync(archivo, JSON.stringify(copia, null, 1))
  for (const f of filas) {
    const nuevas = [...new Set([...f.tags.filter(t => t !== 'Sin Gluten'), 'Gluten'])]
    const { error } = await db.from('recetas').update({ intolerancias: nuevas }).eq('id', f.id)
    if (error) throw new Error(`${f.nombre}: ${error.message}`)
  }
  console.log(`\nAplicado «Gluten» a ${filas.length} recetas. Copia: ${archivo}`)
}
main().catch(e => { console.error(e); process.exit(1) })
