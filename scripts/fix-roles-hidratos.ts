/**
 * Corrige ingredientes ricos en hidratos (≥50 g HC/100 g y <20 g proteína) marcados
 * como proteina_principal (cacao → aromático, miel → condimento, resto → hidrato; legumbres se dejan): el optimizador de macros no podía ajustar los hidratos.
 * Simula por defecto; --apply para escribir.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const APPLY = process.argv.includes('--apply')
;(async () => {
  const filas: any[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db.from('receta_ingredientes')
      .select('id, nombre_libre, alimento:alimentos(nombre, proteinas, carbohidratos)')
      .eq('rol_ingrediente', 'proteina_principal').range(desde, desde + 999)
    if (error) throw error
    filas.push(...(data ?? [])); if (!data || data.length < 1000) break
  }
  // Legumbres secas: en recetas veganas son la fuente de proteína, se dejan
  const malos = filas
    .filter(f => f.alimento && f.alimento.carbohidratos >= 50 && f.alimento.proteinas < 20 && !/garbanzo|lenteja|alubia|judia/i.test(f.alimento.nombre))
    .map(f => ({ ...f, nuevo: /cacao/i.test(f.alimento.nombre) ? 'especias_aromaticos' : /\bmiel\b/i.test(f.alimento.nombre) ? 'salsa_condimento' : 'carbohidrato_base' }))
  const porAlimento: Record<string, number> = {}
  for (const f of malos) porAlimento[`${f.alimento.nombre} → ${f.nuevo}`] = (porAlimento[`${f.alimento.nombre} → ${f.nuevo}`] ?? 0) + 1
  console.log(`proteina_principal revisados: ${filas.length} · hidratos mal marcados: ${malos.length}`)
  console.log(Object.entries(porAlimento).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${v}× ${k}`).join('\n'))
  if (!APPLY) { console.log('Simulación: usa --apply'); return }
  for (const rol of ['carbohidrato_base', 'especias_aromaticos', 'salsa_condimento']) {
    const ids = malos.filter(m => m.nuevo === rol).map(m => m.id)
    for (let i = 0; i < ids.length; i += 100) {
      const { error } = await db.from('receta_ingredientes').update({ rol_ingrediente: rol }).in('id', ids.slice(i, i + 100))
      if (error) throw error
    }
  }
  console.log(`✅ ${malos.length} corregidos`)
})()
