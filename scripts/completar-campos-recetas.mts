/**
 * completar-campos-recetas.mts — rellena y normaliza campos de TODAS las recetas con reglas deterministas
 * (sin IA, sin coste) y escribe un informe de avisos para lo que requiere criterio humano.
 *   npx tsx scripts/completar-campos-recetas.mts            # simulación
 *   npx tsx scripts/completar-campos-recetas.mts --aplica   # escribe (copia antes/después en salidas/)
 * Cambia: dificultad (normaliza/deduce), tipo_coccion, tipo_plato, categoria (a la lista oficial),
 *         tags (si vacíos), descripcion_porcion (si vacía).
 * momentos (solo los de comida, nunca los de entreno) y objetivos (solo si están vacíos; ver lib/recetas/campos-auto.ts).
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import { autoTagReceta } from '../lib/auto-tag'
import { deducirCoccion, normalizarDificultad, deducirDificultad, MOMENTOS_POR_TIPO, deducirObjetivos, cumplePreEntreno, cumplePostEntreno } from '../lib/recetas/campos-auto'

const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const APLICA = process.argv.includes('--aplica')
const norm=(s:string|null|undefined)=>(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
const LISTA_CAT=['Desayuno','Comida','Cena','Merienda','Snack','Postre','Salsa','Acompañamiento']
const TIPOS=['Desayuno','Comida','Cena','Merienda','Snack','Postre','Salsa','Acompañamiento']
const TAG_LEGADO:Record<string,string>={Ensaladas:'Ensalada',Burritos:'Burrito','Fajitas/Tacos':'Tacos',Mealpreps:'Meal prep','Bowls fruta':'Bowl',Tostas:'Tostada',Gofres:'Gofre',Entrante:'Entrante'}

async function todo(t:string,c:string){const o:any[]=[];for(let f=0;;f+=1000){const {data,error}=await sb.from(t).select(c).range(f,f+999);if(error)throw error;o.push(...data!);if(data!.length<1000)break}return o}
const R=await todo('recetas','id,nombre,descripcion,instrucciones,categoria,tipo_plato,tipo_coccion,dificultad,tiempo_prep_min,tiempo_coccion_min,tags,descripcion_porcion,peso_total_g,porciones,kcal,proteinas,carbohidratos,grasas,url_origen,estado,momentos,objetivos,nivel_fit,fibra,es_pre_entreno,es_post_entreno')
const I=await todo('receta_ingredientes','receta_id,nombre_libre,cantidad_gramos,alimentos(nombre)')
const ings=new Map<string,any[]>(); for(const i of I){(ings.get(i.receta_id)??ings.set(i.receta_id,[]).get(i.receta_id)!).push(i)}

function tipoPlato(r:any):string|null{
  if(r.tipo_plato==='Almuerzo') return 'Comida'
  if(r.tipo_plato) return null
  if(LISTA_CAT.includes(r.categoria)) return r.categoria
  const n=norm(r.nombre)
  if(/tarta|brownie|mousse|helado|natilla|flan|cheesecake|pudin|pudding|galleta|cookie|donut|bizcocho|mochi/.test(n)) return 'Postre'
  if(/tostada|tortita|pancake|gofre|overnight|porridge|granola/.test(n)) return 'Desayuno'
  return null
}

const cambios:any[]=[]; const cnt:Record<string,number>={}
for(const r of R){
  const is=ings.get(r.id)||[]; const patch:any={}
  const dif=r.dificultad?normalizarDificultad(r.dificultad):deducirDificultad(r,is.length); if(dif&&dif!==r.dificultad) patch.dificultad=dif
  if(!r.tipo_coccion){const c=deducirCoccion(r.instrucciones||''); if(c) patch.tipo_coccion=c}
  const tp=tipoPlato(r); if(tp) patch.tipo_plato=tp
  const tipoFinal=patch.tipo_plato??r.tipo_plato
  let tags:string[]=r.tags||[]
  if(r.categoria&&!LISTA_CAT.includes(r.categoria)&&TIPOS.includes(tipoFinal)){
    patch.categoria=tipoFinal
    const t=TAG_LEGADO[r.categoria]; if(t&&!tags.includes(t)) tags=[...tags,t]
  }
  if(!r.categoria&&TIPOS.includes(tipoFinal)) patch.categoria=tipoFinal
  if(!(r.tags||[]).length){ const auto=autoTagReceta({nombre:r.nombre,receta_ingredientes:is as any}); tags=Array.from(new Set([...tags,...auto])) }
  if(JSON.stringify(tags)!==JSON.stringify(r.tags||[])&&tags.length) patch.tags=tags
  if(!r.descripcion_porcion&&r.peso_total_g>0&&r.porciones>0){const g=Math.round(r.peso_total_g/r.porciones/5)*5; if(g>0) patch.descripcion_porcion=`1 ración (≈ ${g} g)`}
  if(r.estado!=='descartada'){
    if(!(r.momentos||[]).length&&MOMENTOS_POR_TIPO[tipoFinal]) patch.momentos=MOMENTOS_POR_TIPO[tipoFinal]
    if(r.estado==='aprobada'){ // momentos de entreno: solo si el marcador es_pre/es_post está puesto Y los macros lo respaldan
      const base:string[]=patch.momentos??r.momentos??[]; const ext=[...base]
      if(r.es_pre_entreno&&cumplePreEntreno({...r,tipo_plato:tipoFinal})&&!ext.includes('pre_entreno')) ext.push('pre_entreno')
      if(r.es_post_entreno&&cumplePostEntreno({...r,tipo_plato:tipoFinal})&&!ext.includes('post_entreno')) ext.push('post_entreno')
      if(ext.length!==base.length) patch.momentos=ext
    }
    if(!(r.objetivos||[]).length){const o=deducirObjetivos(r); if(o.length) patch.objetivos=o}
  }
  if(Object.keys(patch).length){ cambios.push({id:r.id,nombre:r.nombre,antes:Object.fromEntries(Object.keys(patch).map(k=>[k,(r as any)[k]])),despues:patch}); for(const k of Object.keys(patch)) cnt[k]=(cnt[k]||0)+1 }
}
console.log('recetas',R.length,'| con cambios',cambios.length,'| por campo',cnt)
const muestra=(k:string)=>cambios.filter(c=>k in c.despues).slice(0,6).map(c=>`   ${c.nombre.slice(0,40).padEnd(41)} ${JSON.stringify(c.antes[k])} → ${JSON.stringify(c.despues[k])}`).join('\n')
for(const k of Object.keys(cnt)) console.log('\n'+k+':\n'+muestra(k))

// ── Avisos (no se cambian) ──
const av:string[]=[]
const nombres=new Map<string,string[]>(); const urls=new Map<string,string[]>()
for(const r of R){const k=norm(r.nombre).replace(/[^a-z0-9]/g,''); (nombres.get(k)??nombres.set(k,[]).get(k)!).push(r.nombre); if(r.url_origen){const u=r.url_origen.split('?')[0]; (urls.get(u)??urls.set(u,[]).get(u)!).push(r.nombre)}}
av.push('## Macros: kcal no cuadran con P/H/G (>15 %)'); for(const r of R) if(r.kcal>50&&Math.abs(r.kcal-(4*r.proteinas+4*r.carbohidratos+9*r.grasas))/r.kcal>0.15) av.push(`- ${r.nombre}: ${Math.round(r.kcal)} kcal vs ${Math.round(4*r.proteinas+4*r.carbohidratos+9*r.grasas)} por macros`)
av.push('\n## kcal por ración extremas (>1000 o <40)'); for(const r of R) if(r.kcal>1000||(r.kcal>0&&r.kcal<40)) av.push(`- ${r.nombre}: ${Math.round(r.kcal)} kcal, ${r.porciones} raciones`)
av.push('\n## Ingredientes con más de 1000 g'); for(const r of R) for(const i of ings.get(r.id)||[]) if(i.cantidad_gramos>1000) av.push(`- ${r.nombre}: ${i.nombre_libre} ${i.cantidad_gramos} g`)
av.push('\n## Menos de 3 ingredientes'); for(const r of R) if((ings.get(r.id)||[]).length<3&&r.estado!=='descartada') av.push(`- ${r.nombre} (${(ings.get(r.id)||[]).length})`)
av.push('\n## Nombres duplicados'); for(const v of nombres.values()) if(v.length>1) av.push(`- ${v.join(' | ')}`)
av.push('\n## Mismo reel en varias recetas'); for(const [u,v] of urls) if(v.length>1) av.push(`- ${v.join(' | ')}`)
av.push('\n## Texto con víspera/carrera/recuperación (regla: títulos genéricos)'); for(const r of R) if(/v[ií]spera|carrera|recuperaci/i.test(r.nombre+' '+(r.descripcion||''))) av.push(`- ${r.nombre}`)
av.push('\n## Marcadas pre-entreno pero sin cumplir el criterio (hidratos ≥35 g, grasa ≤15 g, fibra ≤10 g, 180-600 kcal)'); for(const r of R) if(r.estado==='aprobada'&&r.es_pre_entreno&&!cumplePreEntreno(r)) av.push(`- ${r.nombre}`)
av.push('\n## Marcadas post-entreno pero sin cumplir el criterio (proteína ≥20 g, hidratos ≥25 g, grasa ≤28 g, 180-750 kcal)'); for(const r of R) if(r.estado==='aprobada'&&r.es_post_entreno&&!cumplePostEntreno(r)) av.push(`- ${r.nombre}`)
const fecha=new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric'}).replace(/\//g,'-')
fs.writeFileSync(`salidas/${fecha}_avisos-recetario.md`,'# Avisos del recetario (requieren criterio humano)\n\n'+av.join('\n'))
console.log('\nAvisos:',av.filter(l=>l.startsWith('- ')).length,'→ salidas/'+fecha+'_avisos-recetario.md')

if(APLICA&&cambios.length){
  const copia=`salidas/copia-campos-${new Date().toISOString().replace(/[:.]/g,'-')}.json`; fs.writeFileSync(copia,JSON.stringify(cambios,null,1)); console.log('Copia:',copia)
  let err=0; for(const c of cambios){const {error}=await sb.from('recetas').update(c.despues).eq('id',c.id); if(error){err++;console.log('ERROR',c.nombre,error.message)}}
  console.log('Aplicado en',cambios.length-err,'recetas')
} else if(!APLICA) console.log('\nSimulación: nada escrito. Usa --aplica.')
