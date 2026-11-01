// «Mis platos»: borra los borradores con más de 30 días y sus fotos de Cloudinary. Simula por defecto; --aplica escribe.
// Uso: npx tsx scripts/limpiar-borradores-platos.ts [--aplica]
import { createClient } from '@supabase/supabase-js'
import { v2 as cloudinary } from 'cloudinary'
import fs from 'fs'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
const APLICA = process.argv.includes('--aplica')
const DIAS = 30

/** public_id de una URL de Cloudinary: lo que va tras /upload/[v123/] sin extensión */
export function publicIdDe(url: string | null): string | null {
  const m = url?.match(/\/upload\/(?:v\d+\/)?(.+?)\.[a-z0-9]+$/i)
  return m ? m[1] : null
}

async function main() {
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET })
  const limite = new Date(Date.now() - DIAS * 24 * 3600 * 1000).toISOString()
  const { data, error } = await db.from('platos_cliente').select('id, foto_original_url, foto_limpia_url, updated_at').eq('estado', 'borrador').lt('updated_at', limite)
  if (error) { console.error('No se pudo leer (¿migración sin aplicar?):', error.message); process.exit(2) }
  console.log(`${data?.length ?? 0} borradores con más de ${DIAS} días`)
  if (!APLICA) { console.log('Simulación: repite con --aplica para borrarlos'); return }
  for (const p of data ?? []) {
    for (const url of [p.foto_original_url, p.foto_limpia_url]) { const id = publicIdDe(url); if (id) await cloudinary.uploader.destroy(id).catch(() => null) }
    await db.from('platos_cliente').delete().eq('id', p.id).eq('estado', 'borrador')
  }
  console.log('Borrados.')
}
main().catch(e => { console.error(e); process.exit(1) })
