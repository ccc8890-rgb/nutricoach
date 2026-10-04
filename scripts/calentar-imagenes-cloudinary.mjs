// Precalienta en Cloudinary las variantes de foto que pide la app (loader: f_webp,q_75,w_N,c_limit).
// Cloudinary genera cada variante en la primera petición (~0,8 s); tras esto todas salen ya de caché (~0,1 s).
// Ejecutar tras importar/regenerar imágenes de recetas:  node scripts/calentar-imagenes-cloudinary.mjs
// Cada variante nueva cuenta como 1 transformación del plan de Cloudinary.
import fs from 'fs'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
  .filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, '')] }))

const ANCHOS = [96, 384, 640, 1080]   // 96: miniaturas del plan · 384/640: tarjetas · 1080: foto grande de la receta
const CONCURRENCIA = 12

const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/recetas?select=imagen_url&imagen_url=not.is.null&limit=5000`, {
  headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
})
const urls = [...new Set((await res.json()).map(r => r.imagen_url).filter(u => u?.includes('res.cloudinary.com') && u.includes('/upload/')))]

const tareas = urls.flatMap(u => ANCHOS.map(w => ({
  url: u.replace('/upload/', `/upload/f_webp,q_75,w_${w},c_limit/`),
})))
console.log(`${urls.length} imágenes × ${ANCHOS.length} anchos = ${tareas.length} peticiones`)

let hechas = 0, errores = 0
async function worker() {
  while (tareas.length) {
    const { url } = tareas.pop()
    try {
      const r = await fetch(url)
      await r.arrayBuffer()
      if (!r.ok) errores++
    } catch { errores++ }
    if (++hechas % 200 === 0) console.log(`  ${hechas} hechas, ${errores} errores`)
  }
}
await Promise.all(Array.from({ length: CONCURRENCIA }, worker))
console.log(`Listo: ${hechas} peticiones, ${errores} errores`)
