import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const BAD_IDS = [
  '1b2d073b',
  '73becefb',
  'a2ac2ebe',
  '79502b6a',
  '3bfddebd',
  'f14be87a',
  '8ea29590'
]

async function main() {
  try {
    // Get today's date
    const hoy = new Date().toISOString().split('T')[0]
    console.log(`📅 Procesando recetas de hoy: ${hoy}\n`)

    // Step 1: Get all today's en_revision recipes
    const { data: hoyRecetas, error: fetchError } = await db
      .from('recetas')
      .select('id, nombre, estado')
      .eq('estado', 'en_revision')
      .gte('created_at', hoy)

    if (fetchError) {
      console.error('❌ Error fetchando recetas:', fetchError.message)
      process.exit(1)
    }

    console.log(`📊 Total en_revision hoy: ${hoyRecetas?.length || 0}\n`)

    if (!hoyRecetas || hoyRecetas.length === 0) {
      console.log('✅ No hay recetas en revisión hoy. Nada que procesar.')
      process.exit(0)
    }

    // Step 2: Find and delete the 7 bad ones (match by partial ID prefix)
    const badFullIds = hoyRecetas
      .filter((r) => BAD_IDS.some((bad) => r.id.startsWith(bad)))
      .map((r) => r.id)

    console.log(`🗑️  IDs a borrar (${badFullIds.length}):`)
    if (badFullIds.length > 0) {
      badFullIds.forEach((id) => {
        const receta = hoyRecetas.find((r) => r.id === id)
        console.log(`   - ${id.substring(0, 8)}... → ${receta?.nombre}`)
      })

      const { error: delError } = await db
        .from('recetas')
        .delete()
        .in('id', badFullIds)

      if (delError) {
        console.error('\n❌ Error borrando:', delError.message)
        process.exit(1)
      }
      console.log(`\n✅ Borradas: ${badFullIds.length} recetas\n`)
    } else {
      console.log('   (ninguna encontrada)\n')
    }

    // Step 3: Approve the rest
    const goodIds = hoyRecetas
      .filter((r) => !BAD_IDS.some((bad) => r.id.startsWith(bad)))
      .map((r) => r.id)

    console.log(`✅ IDs a aprobar (${goodIds.length}):`)
    if (goodIds.length > 0) {
      // Show first 5 + count of rest
      const first5 = goodIds.slice(0, 5)
      first5.forEach((id) => {
        const receta = hoyRecetas.find((r) => r.id === id)
        console.log(`   - ${id.substring(0, 8)}... → ${receta?.nombre}`)
      })
      if (goodIds.length > 5) {
        console.log(`   ... y ${goodIds.length - 5} más`)
      }

      const { error: updError } = await db
        .from('recetas')
        .update({ estado: 'aprobada' })
        .in('id', goodIds)

      if (updError) {
        console.error('\n❌ Error aprobando:', updError.message)
        process.exit(1)
      }
      console.log(`\n✅ Aprobadas: ${goodIds.length} recetas\n`)
    } else {
      console.log('   (ninguna)\n')
    }

    // Step 4: Verify final counts
    const { data: aprobadas, error: countError1 } = await db
      .from('recetas')
      .select('id', { count: 'exact' })
      .eq('estado', 'aprobada')
      .gte('created_at', hoy)

    const { data: revision, error: countError2 } = await db
      .from('recetas')
      .select('id', { count: 'exact' })
      .eq('estado', 'en_revision')
      .gte('created_at', hoy)

    if (countError1 || countError2) {
      console.error('❌ Error en verificación final')
      process.exit(1)
    }

    console.log('─'.repeat(50))
    console.log('📈 ESTADO FINAL')
    console.log('─'.repeat(50))
    console.log(`Aprobadas hoy:    ${aprobadas?.length || 0}`)
    console.log(`En revisión hoy:  ${revision?.length || 0} (debe ser 0)`)
    console.log('─'.repeat(50))

    if ((revision?.length || 0) === 0) {
      console.log('\n✅ ¡ÉXITO! Todas las recetas procesadas correctamente.')
      process.exit(0)
    } else {
      console.log('\n⚠️  Aún hay recetas en revisión. Revisar estado.')
      process.exit(1)
    }
  } catch (err) {
    console.error('❌ Error inesperado:', err)
    process.exit(1)
  }
}

main()
