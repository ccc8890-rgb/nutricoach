// Borra recetas creadas por IA, sin reel/URL y con foto IA (txt2img). Con copia previa. Uso: node scripts/quitar-recetas-ia-sin-reel.mjs [--apply]
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,'')]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const apply = process.argv.includes('--apply')
const { data: recetas } = await sb.from('recetas').select('*').eq('fuente_tipo','ia_generada').eq('imagen_tipo','txt2img').is('url_origen',null).limit(5000)
const ids = recetas.map(r=>r.id)
const all = async (t,col)=>{ let out=[]; for (let i=0;i<ids.length;i+=100){ const {data,error}=await sb.from(t).select('*').in(col,ids.slice(i,i+100)); if(error) throw new Error(t+': '+error.message); out=out.concat(data)} return out }
const copia = { fecha: new Date().toISOString(), recetas,
  receta_ingredientes: await all('receta_ingredientes','receta_id'),
  comidas_planificadas: await all('comidas_planificadas','receta_id'),
  receta_interacciones_cliente: await all('receta_interacciones_cliente','receta_id') }
const f = `salidas/23-10-2026_BACKUP-recetas-ia-sin-reel.json`
if (apply) { fs.mkdirSync('salidas',{recursive:true}); fs.writeFileSync(f, JSON.stringify(copia)) }
console.log(Object.entries(copia).map(([k,v])=>k+': '+(Array.isArray(v)?v.length:'')).join(' | '))
if (!apply) { console.log('simulación; usa --apply'); process.exit(0) }
console.log('copia', f, (fs.statSync(f).size/1e6).toFixed(1)+' MB')
let borradas=0
for (let i=0;i<ids.length;i+=20){ const {error,count}=await sb.from('recetas').delete({count:'exact'}).in('id',ids.slice(i,i+20)); if(error){console.error('ERROR',error.message);process.exit(1)} borradas+=count }
console.log('borradas', borradas)
