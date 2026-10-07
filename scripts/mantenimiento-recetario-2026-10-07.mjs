// Mantenimiento del recetario aprobado (07-10-2026). Simula por defecto; --apply escribe.
//  1) recetas sin categoría (invisibles para el planificador) → categoría = tipo de plato
//  2) nombres poco claros → nombre en castellano   3) instrucciones demasiado cortas
//  4) duplicados exactos de nombre → se queda la mejor y las demás pasan a «descartada» (si ningún plan las usa)
import fs from 'fs'; import { createClient } from '@supabase/supabase-js'
for (const l of fs.readFileSync('.env.local','utf8').split('\n')){const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m) process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'')}
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY)
const APPLY=process.argv.includes('--apply')
const rec=[]; for(let f=0;;f+=1000){const {data}=await db.from('recetas').select('id,nombre,categoria,tipo_plato,imagen_url,verificacion,score_calidad,instrucciones').eq('estado','aprobada').range(f,f+999); rec.push(...data); if(data.length<1000)break}
const norm=t=>(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim()
let n=0
const upd=async(r,campos,txt)=>{ n++; console.log(`${r.id.slice(0,8)} | ${r.nombre} → ${txt}`); if(APPLY){const {error}=await db.from('recetas').update(campos).eq('id',r.id); if(error) console.log('  ERROR',error.message)} }

// 1) categoría: solo las de buena calidad (≥75); el resto sigue oculto y se lista para decidir
const ocultas=[]
for (const r of rec) if(!r.categoria && r.tipo_plato){
  const cat=/almuerzo/i.test(r.tipo_plato)?'Snack':r.tipo_plato
  const rara=['6f5cd90e','250539d5'].includes(r.id.slice(0,8)) // combinaciones poco apetecibles (pavo con mermelada de fresa)
  if(!rara && (r.score_calidad??0)>=75) await upd(r,{categoria:cat},`categoría ${cat}`); else ocultas.push(r) }
if(ocultas.length){ console.log(`\n${ocultas.length} recetas sin categoría con score <75: siguen ocultas para el planificador:`); ocultas.forEach(r=>console.log(`  ${r.id.slice(0,8)} | ${r.nombre} | score ${r.score_calidad}`)); console.log('') }
const canelon=rec.find(r=>r.id.startsWith('5ad63548')); if(canelon&&canelon.categoria==='Postre') await upd(canelon,{categoria:'Comida'},'categoría Comida')

// 2) nombres
const NOMBRES={'4000943e':'Tiras de pollo crujiente picante','a3e0dfa6':'Overnight oats de plátano caramelizado','d62401ab':'Bocados de nuez pecana y caramelo','035a667c':'Pollo con salsa barbacoa y miel',
 '106ca42c':'Boniato relleno de pollo búfalo','4577989f':'Tacos de hamburguesa smash','12aa19ba':'Pancakes de avena para llevar','f491ed02':'Bolas de proteína y chocolate','0e59172e':'Pudding proteico de chocolate',
 'e27695a0':'Wrap de pollo estilo César','9252b083':'Donuts proteicos','d6c7b9bf':'Pancakes proteicos','feeef635':'Tiramisú proteico','8c9fff9e':'Wrap pizza alto en proteína','9b02254d':'Overnight de Weetabix','1907ff8b':'Mini tacos de carne','0b4d65b0':'Bowl de carne y boniato','2c73c72c':'Tacos estilo Big Mac'}
for (const r of rec){ const k=r.id.slice(0,8); if(NOMBRES[k]) await upd(r,{nombre:NOMBRES[k]},`nombre «${NOMBRES[k]}»`) }
{ const r=rec.find(x=>/^Pollo sees burger/i.test(x.nombre)); if(r) await upd(r,{nombre:'Burger de pollo con salsa vodka'},'nombre «Burger de pollo con salsa vodka»') }

// 3) instrucciones cortas
const INSTR={
 'Skyr con fresas y chía':'1. Pon el skyr en un bol.\n2. Añade las fresas laminadas y las semillas de chía por encima.\n3. Sirve frío.',
 'Tortitas de arroz con requesón y plátano':'1. Unta el requesón sobre las tortitas de arroz.\n2. Cubre con el plátano en rodajas.\n3. Sirve al momento para que no se reblandezcan.',
 'Yogur natural con nueces y miel':'1. Pon el yogur natural en un bol.\n2. Añade las nueces troceadas.\n3. Termina con un hilo de miel.',
 'Fruta y frutos secos':'1. Lava y corta la fruta.\n2. Acompáñala con un puñado de frutos secos al natural.\n3. Pésalos una vez y usa siempre la misma ración.',
 'Café con leche':'1. Prepara el café.\n2. Calienta la leche sin que hierva.\n3. Mezcla ambos en una taza y sirve caliente.',
 'Tostada de hummus y pepino':'1. Tuesta el pan integral hasta que quede crujiente.\n2. Unta el hummus por toda la superficie.\n3. Cubre con el pepino en rodajas finas y sirve.',
 'Tostada de queso crema y mermelada':'1. Tuesta el pan.\n2. Extiende el queso crema por toda la superficie.\n3. Termina con la mermelada y sirve.',
 'Yogur con pera y nueces':'1. Pon el yogur en un bol.\n2. Añade la pera lavada y cortada en dados.\n3. Termina con las nueces troceadas y sirve frío.',
 'Requesón con piña y semillas':'1. Pon el requesón en un bol.\n2. Añade la piña troceada.\n3. Reparte las semillas por encima y sirve.',
 'Queso fresco con higos y nueces':'1. Corta el queso fresco en dados o láminas.\n2. Parte los higos en cuartos.\n3. Sirve junto con las nueces troceadas.',
 'Yogur griego con pasas y anacardos':'1. Pon el yogur griego en un bol.\n2. Añade las pasas y los anacardos.\n3. Mezcla ligeramente y sirve frío.'}
for (const r of rec) if(INSTR[r.nombre] && (r.instrucciones||'').length<80) await upd(r,{instrucciones:INSTR[r.nombre]},'instrucciones ampliadas')

// 4) duplicados exactos de nombre
const usadas=new Set()
for(const t of [['comidas','receta_id'],['comida_alimentos','complemento_receta_id'],['comidas_planificadas','receta_id']]){
  for(let f=0;;f+=1000){const {data,error}=await db.from(t[0]).select(t[1]).not(t[1],'is',null).range(f,f+999); if(error||!data) break; data.forEach(x=>usadas.add(x[t[1]])); if(data.length<1000)break} }
const grupos={}; for(const r of rec) (grupos[norm(r.nombre)]??=[]).push(r)
const puntos=r=>(r.imagen_url?100:0)+(r.verificacion?50:0)+(usadas.has(r.id)?30:0)+(r.score_calidad??0)/10
for (const l of Object.values(grupos)) if(l.length>1){
  const orden=[...l].sort((a,b)=>puntos(b)-puntos(a)); const [queda,...resto]=orden
  for(const r of resto){ if(usadas.has(r.id)) console.log(`${r.id.slice(0,8)} | ${r.nombre} → duplicado EN USO en un plan, se deja (se conserva ${queda.id.slice(0,8)})`); else await upd(r,{estado:'descartada'},`duplicado de ${queda.id.slice(0,8)}: descartada`) } }
console.log(`\n${n} cambios${APPLY?' aplicados':' (simulación, usa --apply)'}`)
