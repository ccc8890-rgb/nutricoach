// Pone a las recetas de ingesta web (fuente_tipo='web', sin foto) la foto de su página de origen, subida a Cloudinary.
// PROVISIONAL: la foto es de la web de origen; se marca con la etiqueta «Foto provisional» para cambiarla cuando Carlos cocine la receta.
// Uso: node scripts/ingesta-foto-web.mjs [--apply]
import { createClient } from '@supabase/supabase-js'
import { v2 as cloudinary } from 'cloudinary'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,'')]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET })
const apply = process.argv.includes('--apply')
const flat = n => Array.isArray(n) ? n.flatMap(flat) : n && n['@graph'] ? flat(n['@graph']) : [n]
const {data:rs,error} = await sb.from('recetas').select('id,nombre,url_origen,tags').eq('fuente_tipo','web').is('imagen_url',null).not('url_origen','is',null)
if (error) throw error
console.log('recetas web sin foto:', rs.length)
let ok=0, mal=0
for (const r of rs) {
  try {
    const html = await (await fetch(r.url_origen,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(25000)})).text()
    const blocks=[...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>{try{return JSON.parse(m[1].trim())}catch{return null}}).filter(Boolean)
    const rec=blocks.flatMap(flat).find(n=>n&&[].concat(n['@type']||[]).includes('Recipe'))
    const img=[].concat(rec?.image||[]).map(i=>i.url||i).find(u=>typeof u==='string')
    if(!img) throw new Error('sin imagen en JSON-LD')
    if(!apply){console.log('·',r.nombre,img);continue}
    const buf=Buffer.from(await (await fetch(img,{signal:AbortSignal.timeout(30000)})).arrayBuffer())
    const url=await new Promise((res,rej)=>cloudinary.uploader.upload_stream({folder:'nutricoach/recetas',public_id:r.id,resource_type:'image',format:'webp',overwrite:true,quality:'auto:good'},(e,x)=>e||!x?rej(e):res(x.secure_url)).end(buf))
    const tags=[...new Set([...(r.tags||[]),'Foto provisional'])]
    const {error:e2}=await sb.from('recetas').update({imagen_url:url,imagen_origen:'scraped',imagen_estado:'aprobada',imagen_needs_review:false,imagen_updated_at:new Date().toISOString(),tags}).eq('id',r.id)
    if(e2) throw e2
    console.log('✓',r.nombre); ok++
  } catch(e){ console.log('✗',r.nombre,e.message); mal++ }
}
console.log('listo', ok, 'ok', mal, 'fallos')
