/**
 * proponer-correccion-matches.mjs — para cada enlace dudoso (salidas/matches-dudosos.json) busca el
 * alimento más coherente de la BD. Solo propone: escribe salidas/matches-propuestas.json y .md.
 *   node scripts/auditar-matches-ingredientes.mjs && node scripts/proponer-correccion-matches.mjs
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const norm=s=>(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9% ]/g,' ').replace(/\s+/g,' ').trim()
const sing=w=>w.replace(/(ones)$/,'on').replace(/(es)$/,'').replace(/s$/,'')
const RUIDO=new Set(('de del la el en con sin para y o al los las un una u e natural light fresco fresca picado picada troceado troceada rallado rallada laminado laminada molido molida entero entera mediano mediana pequeno pequena grande cocido cocida crudo cruda opcional decorar derretido derretida fundido fundida batido batida tostado tostada ligero ligera bajo baja grasa grasas materia sal anadida azucar azucares anadidos hacendado mercadona carrefour lidl dia alcampo bote bolsa paquete pack lata botella brik bandeja tarro tarrina loncha lonchas sobre unidad unidades gramos gr g ml kg cucharada cucharadas cucharadita taza vaso trozo trozos rodaja rodajas diente dientes hoja hojas ramita pizca chorrito gusto cantidad aproximadamente si prefieres tambien extra virgen maduro madura fino fina finos finas cubos cubo hueso piel tipo apto cocina').split(' '))
const ELAB=['galleta','bizcocho','brownie','natilla','batido','bebida','relleno','rellena','barrita','magdalena','cereal','helado','bombon','bocadillo','sandwich','pizza','croqueta','hojaldre','tarta','pastel','donut','gofre','tortita','turron','caramelo','polo','mousse','flan','muesli','granola','snack','cono','focaccia','trenza','napolitana','bollo','sirope','caldo','sopa','pure','pouch','sabor','te','infusion','cuadradito','patata frita','frita','crujiente','condimento']
const clave=s=>norm(s).split(' ').filter(w=>w.length>2&&!RUIDO.has(w)&&!/^\d+$/.test(w)).map(sing)
const all=async(t,c)=>{const o=[];for(let f=0;;f+=1000){const {data,error}=await sb.from(t).select(c).range(f,f+999);if(error)throw error;o.push(...data);if(data.length<1000)break}return o}
const dud=JSON.parse(fs.readFileSync('salidas/matches-dudosos.json','utf8')).filter(h=>h.id)
const al=(await all('alimentos','id,nombre,calorias,fuente,es_comestible')).filter(a=>a.es_comestible!==false&&a.calorias>0)
const pre=al.map(a=>({a,t:clave(a.nombre),n:norm(a.nombre)}))
const casa=(w,t)=>t.some(x=>x===w||x.startsWith(w)||w.startsWith(x))
function mejor(ingrediente){
  const kI=clave(ingrediente), nI=norm(ingrediente); if(!kI.length) return null
  let best=null
  for(const {a,t,n} of pre){
    if(!kI.every(w=>casa(w,t))) continue
    let sc=100-Math.max(0,t.length-kI.length)*8-n.length*0.15
    if(ELAB.some(w=>new RegExp('(^| )'+w).test(n)&&!nI.includes(w))) sc-=60
    if(a.fuente==='coach'||a.fuente==='curada') sc+=6
    if(/hacendado|milka|danone|nestle|pack|bolsa|bandeja|paquete/.test(n)) sc-=12
    if(!best||sc>best.sc) best={a,sc}
  }
  return best&&best.sc>55?best.a:null
}
const por=new Map(); for(const h of dud){(por.get(h.ingrediente)??por.set(h.ingrediente,[]).get(h.ingrediente)).push(h)}
const props=[]
for(const [ing,hs] of por){ const m=mejor(ing); const actual=hs[0].alimento
  props.push({ingrediente:ing,actual,actual_id:hs[0].alimento_id,kcal_actual:hs[0].kcal,propuesto:m?.nombre??null,propuesto_id:m?.id??null,kcal_propuesto:m?.calorias??null,usos:hs.length,filas:hs.map(h=>h.id),motivos:hs[0].motivos}) }
props.sort((a,b)=>b.usos-a.usos)
fs.writeFileSync('salidas/matches-propuestas.json',JSON.stringify(props,null,1))
const conP=props.filter(p=>p.propuesto&&p.propuesto_id!==p.actual_id)
fs.writeFileSync('salidas/matches-propuestas.md','# Propuestas de corrección de enlaces\n\n'+props.map(p=>`- ${p.usos}x «${p.ingrediente}»: ${p.actual} (${p.kcal_actual} kcal) → ${p.propuesto?`**${p.propuesto}** (${p.kcal_propuesto} kcal)`:'SIN PROPUESTA (revisar a mano)'}`).join('\n'))
console.log('ingredientes distintos',props.length,'| con propuesta distinta de la actual',conP.length,'| sin propuesta',props.filter(p=>!p.propuesto).length,'| misma que la actual',props.filter(p=>p.propuesto_id===p.actual_id).length)
console.log(conP.slice(0,90).map(p=>`${p.usos}x ${p.ingrediente}: ${p.actual} (${p.kcal_actual}) → ${p.propuesto} (${p.kcal_propuesto})`).join('\n'))
