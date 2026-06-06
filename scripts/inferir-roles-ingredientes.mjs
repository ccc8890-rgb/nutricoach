// scripts/inferir-roles-ingredientes.mjs
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const APLICAR = process.argv.includes('--aplicar')
const PAGE_SIZE = 1000

function inferirRol(alimento, nombreIngrediente) {
  const nombre = (nombreIngrediente ?? '').toLowerCase()
  const cat = (alimento?.categoria ?? '').toLowerCase()
  const prot = alimento?.proteinas ?? 0
  const carbs = alimento?.carbohidratos ?? 0
  const grasas = alimento?.grasas ?? 0
  const kcal = alimento?.calorias ?? 0

  if (/\b(sal(?!sa)|pimienta|ajo|diente de ajo|ajo en polvo|cebolla en polvo|orégano|comino|cúrcuma|pimentón|albahaca|romero|tomillo|jengibre|canela|laurel|cilantro|perejil|cayena|nuez moscada|cardamomo|curry)\b/.test(nombre)) return 'especias_aromaticos'
  if (/\b(ketchup|mayonesa|pesto|hummus|tahini|mostaza|aliño|aderezo|ranch|sriracha|guacamole|tzatziki|chimichurri|vinagreta|salsa de soja|salsa teriyaki|salsa hoisin)\b/.test(nombre)) return 'salsa_condimento'
  if (/\b(tortilla de trigo|wrap|pan(?:ecillo)?|baguette|base de pizza|masa|galleta|cracker|tostada)\b/.test(nombre)) return 'estructural'
  if (/\b(fresa|frambuesa|arándano|plátano|mango|piña|kiwi|naranja|fruta|berry|cereza|uva|sandía|melón|melocotón|granada)\b/.test(nombre) || cat.includes('fruta')) return 'fruta_complemento'
  if (/\b(queso fresco|requesón|ricotta|mascarpone|crema de leche|nata|yogur|kéfir|queso rallado|queso parmesano)\b/.test(nombre) && kcal < 250) return 'lacteo_complemento'
  if (/\b(aguacate|aceite|nuez|almendra|cacahuete|pistacho|avellana|anacardo|semilla|linaza|chía|mantequilla de)\b/.test(nombre) || (grasas > 20 && prot < 15)) return 'grasa_saludable'
  if (/\b(pollo|pechuga|muslo|ternera|buey|cerdo|pavo|salmón|atún|merluza|lubina|dorada|bacalao|huevo|clara|tofu|seitán|tempe|garbanzos|lentejas|judías|edamame|proteína)\b/.test(nombre) || prot >= 15) return 'proteina_principal'
  if (/\b(arroz|pasta|patata|boniato|avena|quinoa|maíz|cuscús|bulgur|pan integral|tortita|porridge)\b/.test(nombre) || carbs >= 20) return 'carbohidrato_base'
  if (kcal < 50 || cat.includes('verdura') || cat.includes('hortaliza')) return 'verdura_volumen'
  return 'proteina_principal'
}

async function main() {
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN' : APLICAR ? 'APLICAR' : 'PREVIEW'}`)

  const ingredientes = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('receta_ingredientes')
      .select('id, nombre_libre, rol_ingrediente, alimento:alimentos(calorias, proteinas, carbohidratos, grasas, categoria)')
      .range(from, from + PAGE_SIZE - 1)

    if (error) { console.error(error.message); process.exit(1) }
    if (!data || data.length === 0) break

    ingredientes.push(...data)
    if (data.length < PAGE_SIZE) break
  }

  const sinRol = ingredientes.filter(i => !i.rol_ingrediente)
  console.log(`\nTotal ingredientes: ${ingredientes.length}`)
  console.log(`Sin rol: ${sinRol.length}`)

  const cambios = sinRol.map(i => ({
    id: i.id,
    nombre: i.nombre_libre ?? '(sin nombre)',
    rol: inferirRol(i.alimento, i.nombre_libre ?? ''),
  }))

  const cnt = {}
  cambios.forEach(c => cnt[c.rol] = (cnt[c.rol] ?? 0) + 1)
  console.log('\nDistribución inferida:')
  Object.entries(cnt).sort().forEach(([k, v]) => console.log(`  ${k}: ${v}`))

  if (DRY_RUN) {
    console.log('\nPrimeros 10:')
    cambios.slice(0, 10).forEach(c => console.log(`  [${c.rol}] ${c.nombre}`))
    return
  }

  if (!APLICAR) {
    console.log('\nEjecuta con --aplicar para guardar.')
    return
  }

  let ok = 0, err = 0
  for (let i = 0; i < cambios.length; i += 50) {
    const lote = cambios.slice(i, i + 50)
    for (const c of lote) {
      const { error: e } = await supabase
        .from('receta_ingredientes')
        .update({ rol_ingrediente: c.rol })
        .eq('id', c.id)
      if (e) { err++; console.error(`Error ${c.nombre}: ${e.message}`) }
      else ok++
    }
    process.stdout.write(`\r  ${ok + err}/${cambios.length}`)
  }

  console.log(`\n\n✅ ${ok} roles asignados, ${err} errores.`)
}

main().catch(e => { console.error(e); process.exit(1) })
