// Descarta las recetas aparcadas / con foto IA / sin foto y las quita de las comidas de los planes (los alimentos de la comida se conservan).
// Uso: node scripts/descartar-recetas-malas-del-plan.mjs [--apply]. Copia en salidas/. Revertir: restaurar estado y receta_id desde la copia.
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,'')]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const apply = process.argv.includes('--apply')
const todo = async (q) => { let out=[]; for(let i=0;;i+=1000){const {data,error}=await q().range(i,i+999); if(error) throw error; out=out.concat(data); if(data.length<1000)break} return out }
const rs = await todo(() => sb.from('recetas').select('id,nombre,tags,imagen_url,imagen_tipo,estado').eq('estado','aprobada'))
const aparcada = r => (r.tags||[]).includes('Aparcada')
const descartar = rs.filter(r => aparcada(r) || r.imagen_tipo === 'txt2img')
const sinFoto = rs.filter(r => !descartar.includes(r) && !r.imagen_url)
const ids = new Set([...descartar, ...sinFoto].map(r => r.id))
const cs = await todo(() => sb.from('comidas').select('id,plan_id,receta_id').not('receta_id','is',null))
const comidas = cs.filter(c => ids.has(c.receta_id))
console.log('descartar', descartar.length, '| sin foto → en_revision', sinFoto.length, '| comidas a desvincular', comidas.length)
if (!apply) { console.log('simulación; usa --apply'); process.exit(0) }
fs.writeFileSync('salidas/27-10-2026_BACKUP-descartar-recetas-malas.json', JSON.stringify({ descartar: descartar.map(r=>r.id), sinFoto: sinFoto.map(r=>r.id), comidas }))
for (let i=0;i<comidas.length;i+=100) { const {error}=await sb.from('comidas').update({receta_id:null}).in('id',comidas.slice(i,i+100).map(c=>c.id)); if(error) throw error }
for (let i=0;i<descartar.length;i+=100) { const {error}=await sb.from('recetas').update({estado:'descartada'}).in('id',descartar.slice(i,i+100).map(r=>r.id)); if(error) throw error }
if (sinFoto.length) { const {error}=await sb.from('recetas').update({estado:'en_revision'}).in('id',sinFoto.map(r=>r.id)); if(error) throw error }
console.log('hecho')
