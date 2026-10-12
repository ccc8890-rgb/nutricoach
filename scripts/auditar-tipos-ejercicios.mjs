// Solo lectura: lista ejercicios del catálogo cuyo tipo (cardio/funcional/flexibilidad) no cuadra con su nombre.
// Uso: node scripts/auditar-tipos-ejercicios.mjs   (revisar a mano: «Rodillo» y «Zancadas caminando» son falsos avisos conocidos)
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,'')]}))
const H={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`}
const r=await (await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/ejercicios?select=id,nombre,tipo&limit=1000`,{headers:H})).json()
const reglas=[
 [/ski\s?erg|remo erg|row(ing)?\b|assault|air bike|bici|ciclismo|natación|nataci|crol|trote|carrera|correr|rodaje|intervalos|series a ritmo|cinta|elíptica|elipt|caminar|senderismo|marcha|escaleras|stepper|comba|saltar la cuerda/i,'cardio'],
 [/farmer|granjero|sled|trineo|wall ?ball|burpee|thruster|sandbag|saco|slam|battle rope|cuerdas ondulantes|bear crawl|lunges? con peso|zancadas caminando|kettlebell swing/i,'funcional'],
 [/movilidad|estiramiento|foam|rodillo|flexibilidad|yoga|pilates|tai chi/i,'flexibilidad'],
]
const sosp=[]
for(const e of r){ for(const [re,t] of reglas){ if(re.test(e.nombre)&&e.tipo!==t){ sosp.push(`${e.nombre} [${e.tipo}] → ${t}?`); break } } }
console.log(r.length,'ejercicios;',sosp.length,'sospechosos\n'+sosp.join('\n'))
