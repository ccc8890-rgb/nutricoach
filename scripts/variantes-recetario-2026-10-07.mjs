// Variantes casi idénticas del recetario: misma categoría y ≥80 % de ingredientes (alimentos) en común.
// Se conserva la mejor de cada grupo (foto > verificada > en uso > score) y las demás pasan a «descartada»
// si ningún plan las usa. Simula por defecto; --apply escribe; copia en salidas/. --revertir las vuelve a aprobar.
import fs from 'fs'; import { createClient } from '@supabase/supabase-js'
for (const l of fs.readFileSync('.env.local','utf8').split('\n')){const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m) process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'')}
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY)
const APPLY=process.argv.includes('--apply'), REV=process.argv.includes('--revertir'), COPIA='salidas/07-10-2026_copia-variantes-descartadas.json'
if (REV) { for (const id of JSON.parse(fs.readFileSync(COPIA,'utf8'))) { const {error}=await db.from('recetas').update({estado:'aprobada'}).eq('id',id); console.log('reaprobada',id.slice(0,8),error?.message??'ok') } process.exit(0) }
const rec=[]; for(let f=0;;f+=1000){const {data}=await db.from('recetas').select('id,nombre,categoria,tipo_receta,imagen_url,verificacion,score_calidad,receta_ingredientes!receta_ingredientes_receta_id_fkey(alimento_id)').eq('estado','aprobada').range(f,f+999); rec.push(...data); if(data.length<1000)break}
const usadas=new Set()
for(const t of [['comidas','receta_id'],['comida_alimentos','complemento_receta_id'],['comidas_planificadas','receta_id']]){
  for(let f=0;;f+=1000){const {data,error}=await db.from(t[0]).select(t[1]).not(t[1],'is',null).range(f,f+999); if(error||!data) break; data.forEach(x=>usadas.add(x[t[1]])); if(data.length<1000)break} }
const set=r=>new Set((r.receta_ingredientes??[]).map(i=>i.alimento_id).filter(Boolean))
const jac=(a,b)=>{ if(!a.size||!b.size) return 0; let i=0; for(const x of a) if(b.has(x)) i++; return i/(a.size+b.size-i) }
const puntos=r=>(r.imagen_url?100:0)+(r.verificacion?50:0)+(usadas.has(r.id)?30:0)+(r.score_calidad??0)/10
const sets=new Map(rec.map(r=>[r.id,set(r)]))
// agrupar por unión (misma categoría + tipo + jaccard ≥ 0.8 con alguno del grupo)
const grupos=[]; const visto=new Set()
for(const r of rec){ if(visto.has(r.id)) continue; const g=[r]; visto.add(r.id)
  for(let i=0;i<g.length;i++) for(const o of rec) if(!visto.has(o.id) && o.categoria===g[i].categoria && o.tipo_receta===g[i].tipo_receta && jac(sets.get(g[i].id),sets.get(o.id))>=0.8){ g.push(o); visto.add(o.id) }
  if(g.length>1) grupos.push(g) }
const descartar=[]
for(const g of grupos){ const o=[...g].sort((a,b)=>puntos(b)-puntos(a)); const [queda,...resto]=o
  console.log(`\n= ${g.length} variantes (${queda.categoria}) · se conserva «${queda.nombre}»`)
  for(const r of resto) { const uso=usadas.has(r.id); console.log(`   ${uso?'EN USO, se deja':'→ descartar'}: ${r.nombre}`); if(!uso) descartar.push(r.id) } }
console.log(`\n${grupos.length} grupos · ${descartar.length} recetas a descartar de ${rec.length}`)
if(APPLY){ for(const id of descartar) await db.from('recetas').update({estado:'descartada'}).eq('id',id); fs.writeFileSync(COPIA,JSON.stringify(descartar)); console.log('descartadas; copia en',COPIA) }
