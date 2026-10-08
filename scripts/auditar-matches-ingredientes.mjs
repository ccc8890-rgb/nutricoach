/**
 * auditar-matches-ingredientes.mjs — detecta enlaces ingrediente → alimento dudosos en TODO el recetario.
 *   node scripts/auditar-matches-ingredientes.mjs [--json]   (solo lectura; informe en salidas/)
 * Señales: A) % distinto (70 vs 85)  B) el alimento es un producto elaborado que el ingrediente no pide
 *          C) falta una palabra clave del ingrediente en el alimento  D) kcal muy distintas de lo habitual
 *          E) el mismo ingrediente enlaza a alimentos distintos en recetas distintas
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const norm=s=>(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9% ]/g,' ').replace(/\s+/g,' ').trim()
const sing=w=>w.replace(/(ones)$/,'on').replace(/(es)$/,'').replace(/s$/,'')
// palabras que no distinguen un alimento (forma de cortar, cocinar, uso, marca blanca…)
const RUIDO=new Set(('de del la el en con sin para y o al los las un una u e natural light fresco fresca picado picada troceado troceada rallado rallada laminado laminada molido molida entero entera mediano mediana pequeno pequena grande cocido cocida crudo cruda opcional decorar derretido derretida fundido fundida batido batida tostado tostada ligero ligera bajo baja grasa grasas materia sal anadida azucar azucares anadidos hacendado mercadona carrefour lidl dia alcampo bote bolsa paquete pack lata botella brik bandeja tarro tarrina loncha lonchas sobre unidad unidades gramos gr g ml kg cucharada cucharadas cucharadita taza vaso trozo trozos rodaja rodajas diente dientes hoja hojas ramita pizca chorrito gusto cantidad aproximadamente si prefieres tambien extra virgen').split(' '))
// productos elaborados: si el alimento los lleva y el ingrediente no, es un enlace sospechoso
const ELABORADO=['galleta','galletas','bizcocho','brownie','natilla','natillas','batido','bebida','relleno','rellena','barrita','barritas','magdalena','cereal','cereales','helado','bombon','bombones','bocadillo','sandwich','pizza','croqueta','hojaldre','tarta','pastel','donut','gofre','tortita','crema de cacao','crema cacao','turron','caramelo','polo','mousse','flan','yogur','muesli','granola','snack','cono','coulant','trenza','napolitana','bollo','bollycao','sirope','salsa','caldo','sopa','pure','pouch','proteina','whey','sabor']
// palabras que cambian QUÉ alimento es (si faltan, el enlace es probablemente erróneo)
const DISCRIMINANTE=new Set(('negro blanco leche griego mozzarella queso salsa coco soja avena almendra integral vainilla chocolate cacao proteina suero whey huevo yema clara arroz papel canela tomate cherry pollo pavo ternera cerdo atun salmon vegetal oliva girasol sesamo cottage skyr mantequilla nata crema harina azucar miel sirope eritritol stevia cebolla ajo limon lima naranja platano manzana patata boniato pan pasta tortilla jamon bacon gamba pulpo tofu tempeh lenteja garbanzo judia quinoa cuscus bebida zumo vinagre mostaza curry pimenton cebollino perejil cilantro albahaca jengibre aguacate mango fresa arandano frambuesa').split(' ').map(sing))
const wordRe=w=>new RegExp('(^| )'+w+'( |$)')
const all=async(t,c)=>{const o=[];for(let f=0;;f+=1000){const {data,error}=await sb.from(t).select(c).range(f,f+999);if(error)throw error;o.push(...data);if(data.length<1000)break}return o}
const ing=await all('receta_ingredientes','receta_id,nombre_libre,alimento_id,cantidad_gramos')
const al=new Map((await all('alimentos','id,nombre,calorias,fuente')).map(a=>[a.id,a]))
const rec=new Map((await all('recetas','id,nombre')).map(r=>[r.id,r.nombre]))
const clave=s=>norm(s).split(' ').filter(w=>w.length>2&&!RUIDO.has(w)&&!/^\d+$/.test(w)).map(sing)
const pct=s=>[...norm(s).matchAll(/(\d{2,3}) ?%/g)].map(m=>m[1])
// mediana de kcal por nombre de ingrediente normalizado
const porNombre=new Map()
for(const i of ing){const a=al.get(i.alimento_id); if(!a||!i.nombre_libre) continue; const k=norm(i.nombre_libre); (porNombre.get(k)??porNombre.set(k,[]).get(k)).push({a,i})}
const mediana=v=>{const s=[...v].sort((x,y)=>x-y);return s[Math.floor(s.length/2)]}
const hallazgos=[]
for(const [k,lista] of porNombre){
  const med=mediana(lista.map(x=>x.a.calorias||0)); const alimentosDist=new Set(lista.map(x=>x.a.id))
  for(const {a,i} of lista){
    const motivos=[]; const nI=norm(i.nombre_libre), nA=norm(a.nombre)
    const pI=pct(i.nombre_libre), pA=pct(a.nombre)
    if(pI.length&&pA.length&&!pI.some(p=>pA.includes(p))) motivos.push(`A: pide ${pI[0]}% y el alimento es ${pA[0]}%`)
    const kA=new Set(clave(a.nombre).concat(clave(a.nombre).map(w=>w))), kI=clave(i.nombre_libre)
    const falta=kI.filter(w=>![...kA].some(x=>x===w||x.startsWith(w)||w.startsWith(x)))
    if(falta.length&&kI.length) motivos.push((falta.some(w=>DISCRIMINANTE.has(w))?'C!':'C')+`: falta «${falta.join(', ')}» en «${a.nombre}»`)
    const extra=ELABORADO.filter(w=>wordRe(w).test(nA)&&!wordRe(w).test(nI)&&!nI.includes(w))
    if(extra.length) motivos.push(`B: el alimento es «${extra[0]}» y el ingrediente no lo pide`)
    if(a.calorias>0&&med>0&&lista.length>=3&&Math.abs(a.calorias-med)/med>0.4) motivos.push(`D: ${a.calorias} kcal vs ${med} habitual`)
    if(motivos.length) hallazgos.push({receta:rec.get(i.receta_id),ingrediente:i.nombre_libre.trim(),alimento:a.nombre,kcal:a.calorias,motivos,gramos:i.cantidad_gramos})
  }
  if(alimentosDist.size>=3&&lista.length>=4) hallazgos.push({receta:'(varias)',ingrediente:k,alimento:[...alimentosDist].slice(0,4).map(id=>al.get(id).nombre).join(' | '),motivos:[`E: ${alimentosDist.size} alimentos distintos para el mismo ingrediente`]})
}
const cnt={}; for(const h of hallazgos) for(const m of h.motivos) cnt[m.slice(0,2).replace(':','')]=(cnt[m.slice(0,2).replace(':','')]||0)+1
const urgente=h=>h.motivos.some(m=>/^(A|B|C!|D|E)/.test(m))
console.log('URGENTES (cambian el tipo de alimento):',hallazgos.filter(urgente).length,'| menores (matiz de forma):',hallazgos.filter(h=>!urgente(h)).length)
console.log('ingredientes',ing.length,'| hallazgos',hallazgos.length,'| por señal',cnt)
const porPar=new Map(); for(const h of hallazgos){const key=h.ingrediente+'  →  '+h.alimento+'  ['+h.motivos.join('; ')+']'; (porPar.get(key)??porPar.set(key,[]).get(key)).push(h.receta)}
const ord=[...porPar.entries()].filter(([k])=>/\[(A|B|C!|D|E)/.test(k)||/; (A|B|C!|D|E)/.test(k)).sort((a,b)=>b[1].length-a[1].length)
console.log('pares distintos',ord.length); console.log(ord.slice(0,60).map(([k,v])=>v.length+'x '+k).join('\n'))
fs.mkdirSync('salidas',{recursive:true})
fs.writeFileSync('salidas/'+new Date().toISOString().slice(0,10).split('-').reverse().join('-')+'_matches-dudosos.md','# Enlaces ingrediente → alimento dudosos\n\n'+ord.map(([k,v])=>`- ${v.length}x ${k} — ${[...new Set(v)].slice(0,3).join('; ')}`).join('\n'))
