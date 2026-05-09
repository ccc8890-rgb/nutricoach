// scripts/deduplicar-alimentos.mjs
// Uso: node scripts/deduplicar-alimentos.mjs [--dry-run]
// Requiere .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Cargar .env.local
const envPath = resolve(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
}

const DRY_RUN = process.argv.includes('--dry-run')
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

function similitud(a, b) {
  const na = a.toLowerCase().trim()
  const nb = b.toLowerCase().trim()
  if (na === nb) return 1.0
  if (na.includes(nb) || nb.includes(na)) return 0.85
  // Palabras en común / total palabras
  const wa = new Set(na.split(/\s+/))
  const wb = new Set(nb.split(/\s+/))
  const comunes = [...wa].filter(w => wb.has(w)).length
  return comunes / Math.max(wa.size, wb.size)
}

async function main() {
  console.log(DRY_RUN ? '🔍 DRY RUN — sin cambios en BD' : '🔧 MODO REAL — modificando BD')

  // 1. Obtener todos los alimentos
  const { data: alimentos, error } = await supabase
    .from('alimentos')
    .select('id, nombre, calorias, proteinas, carbohidratos, grasas, es_generico')
    .order('nombre')

  if (error) { console.error('Error cargando alimentos:', error.message); process.exit(1) }

  // Separar en canónicos (macros > 0) y huérfanos (macros = 0)
  const canonicos = alimentos.filter(a => a.calorias > 0)
  const huerfanos = alimentos.filter(a => a.calorias === 0)

  console.log(`Canónicos: ${canonicos.length} | Huérfanos (macros=0): ${huerfanos.length}`)

  // 2. Para cada huérfano, buscar el canónico más similar
  let transferidos = 0
  let ambiguos = 0
  let sinMatch = 0

  for (const huerfano of huerfanos) {
    // Buscar si tiene precios
    const { data: precios } = await supabase
      .from('productos_supermercado')
      .select('id, supermercado_id, precio_por_kg, precio_unidad, url_producto')
      .eq('alimento_id', huerfano.id)

    if (!precios || precios.length === 0) {
      // Sin precios: simplemente marcar como no-genérico y continuar
      if (!DRY_RUN) {
        await supabase.from('alimentos').update({ es_generico: false }).eq('id', huerfano.id)
      }
      sinMatch++
      continue
    }

    // Buscar candidatos canónicos por similitud
    const candidatos = canonicos
      .map(c => ({ ...c, sim: similitud(c.nombre, huerfano.nombre) }))
      .filter(c => c.sim >= 0.75)
      .sort((a, b) => b.sim - a.sim)

    if (candidatos.length === 0) {
      // No hay canónico cercano — marcar como es_generico=false (es un producto de marca)
      console.log(`  ⬜ Sin match: "${huerfano.nombre}" (tiene ${precios.length} precio/s)`)
      if (!DRY_RUN) {
        await supabase.from('alimentos').update({ es_generico: false }).eq('id', huerfano.id)
      }
      sinMatch++
      continue
    }

    if (candidatos.length > 1 && candidatos[0].sim < 0.95) {
      // Múltiples candidatos similares — volcar a dedup_revision para revisión manual
      console.log(`  ⚠️  Ambiguo: "${huerfano.nombre}" → candidatos: ${candidatos.slice(0,3).map(c => `"${c.nombre}"(${c.sim.toFixed(2)})`).join(', ')}`)
      if (!DRY_RUN) {
        await supabase.from('dedup_revision').insert({
          alimento_a_id: candidatos[0].id,
          alimento_b_id: huerfano.id,
          motivo: `Similitud ${candidatos[0].sim.toFixed(2)}: "${huerfano.nombre}" → "${candidatos[0].nombre}". Candidatos alternativos: ${candidatos.slice(1,3).map(c=>c.nombre).join(', ')}`,
        })
      }
      ambiguos++
      continue
    }

    // Match claro: transferir precios al canónico
    const canonico = candidatos[0]
    console.log(`  ✅ Match: "${huerfano.nombre}" → "${canonico.nombre}" (sim=${canonico.sim.toFixed(2)}, precios: ${precios.length})`)

    if (!DRY_RUN) {
      for (const precio of precios) {
        // Upsert: si ya hay precio de ese supermercado en el canónico, no sobreescribir
        const { data: existente } = await supabase
          .from('productos_supermercado')
          .select('id')
          .eq('alimento_id', canonico.id)
          .eq('supermercado_id', precio.supermercado_id)
          .maybeSingle()

        if (!existente) {
          await supabase.from('productos_supermercado').insert({
            alimento_id: canonico.id,
            supermercado_id: precio.supermercado_id,
            precio_por_kg: precio.precio_por_kg,
            precio_unidad: precio.precio_unidad,
            url_producto: precio.url_producto,
            fecha_precio: new Date().toISOString().split('T')[0],
          })
        }
      }
      // Borrar el huérfano (sus precios ya fueron transferidos o el canónico ya los tenía)
      await supabase.from('productos_supermercado').delete().eq('alimento_id', huerfano.id)
      await supabase.from('alimentos').delete().eq('id', huerfano.id)
      // Marcar canónico como genérico
      await supabase.from('alimentos').update({ es_generico: true }).eq('id', canonico.id)
    }
    transferidos++
  }

  console.log(`\n📊 Resultado:`)
  console.log(`  ✅ Transferidos: ${transferidos}`)
  console.log(`  ⚠️  Ambiguos (en dedup_revision): ${ambiguos}`)
  console.log(`  ⬜ Sin match / marca: ${sinMatch}`)
}

main().catch(err => { console.error(err); process.exit(1) })
