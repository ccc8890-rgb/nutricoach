// scripts/benchmark-modelos-plan.ts
// Banco de pruebas de modelos de IA para generar planes de entrenamiento: mismo caso, mismo prompt, mismos validadores; solo cambia el modelo.
// No escribe nada en la base de datos. Uso: npx tsx scripts/benchmark-modelos-plan.ts [--modelos=a,b] [--casos=carlos,natalia]
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { generarPlanEntrenoIA, type ProveedorIA } from '../lib/entrenos/generar-plan-ia'
import { evaluarPlanIA } from '../lib/entrenos/evaluar-plan-ia'

for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const i = l.indexOf('=')
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i)] = process.env[l.slice(0, i)] ?? l.slice(i + 1).replace(/^"|"$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const DEEPSEEK = 'https://api.deepseek.com/v1/chat/completions'
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
const OPENAI = 'https://api.openai.com/v1/chat/completions'
const MODELOS: ProveedorIA[] = [
  { nombre: 'deepseek-chat (actual)', url: DEEPSEEK, claveEnv: 'DEEPSEEK_API_KEY', modelo: 'deepseek-chat', maxTokens: 6000 },
  { nombre: 'deepseek-v4-pro', url: DEEPSEEK, claveEnv: 'DEEPSEEK_API_KEY', modelo: 'deepseek-v4-pro', maxTokens: 16000 },
  { nombre: 'gemini-2.5-pro', url: GEMINI, claveEnv: 'GEMINI_API_KEY', modelo: 'gemini-2.5-pro', maxTokens: 20000 },
  { nombre: 'gemini-3.1-pro', url: GEMINI, claveEnv: 'GEMINI_API_KEY', modelo: 'gemini-3.1-pro-preview', maxTokens: 20000 },
  { nombre: 'gpt-5.5', url: OPENAI, claveEnv: 'OPENAI_API_KEY', modelo: 'gpt-5.5-2026-04-23', maxTokens: 20000, razonamientoOpenAI: true },
]
const CASOS = [
  { clave: 'carlos', prefijo: '04cc53b3', esperadas: 6, desc: 'híbrido Hyrox+running, avanzado' },
  { clave: 'natalia', prefijo: 'a0117446', esperadas: null, desc: 'running, maratón Valencia' },
  { clave: 'marcos', prefijo: '0f9ea8ab', esperadas: 6, desc: 'híbrido, Hyrox Madrid Open' },
  { clave: 'andres', prefijo: 'ef85659e', esperadas: null, desc: 'gym fuerza, LDL alto (clínico)' },
]
const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1]?.split(',')
const sel = arg('modelos'), selCasos = arg('casos')

async function main() {
  const { data: clientes } = await db.from('clientes').select('id')
  const id = (pre: string) => clientes!.find(c => c.id.startsWith(pre))!.id as string
  const fecha = new Date().toISOString().slice(0, 10)
  const dir = path.join('salidas', 'benchmark-modelos', fecha)
  fs.mkdirSync(dir, { recursive: true })
  const modelos = MODELOS.filter(m => !sel || sel.some(s => m.nombre.includes(s)))
  const casos = CASOS.filter(c => !selCasos || selCasos.includes(c.clave))

  // Un hilo por modelo (en paralelo entre modelos, en serie entre casos) para no saturar a cada proveedor.
  const filas = (await Promise.all(modelos.map(async m => {
    const out: Record<string, unknown>[] = []
    for (const c of casos) {
      const t0 = Date.now()
      try {
        const r = await generarPlanEntrenoIA(db, { clienteId: id(c.prefijo), proveedor: m })
        const seg = Math.round((Date.now() - t0) / 1000)
        const ev = evaluarPlanIA(r, c.esperadas)
        fs.writeFileSync(path.join(dir, `${c.clave}__${m.modelo}.json`), JSON.stringify({ evaluacion: ev, uso: r.metadata.uso, plan: r.planIA, validacion: r.validacion }, null, 2))
        out.push({ modelo: m.nombre, caso: c.clave, ok: true, seg, puntuacion: ev.puntuacion, ...ev.metricas, uso: r.metadata.uso })
        console.log(`✔ ${m.nombre} · ${c.clave}: ${ev.puntuacion} pts, ${seg}s, ${ev.metricas.erroresValidador} err / ${ev.metricas.avisosValidador} avisos`)
      } catch (e) {
        const seg = Math.round((Date.now() - t0) / 1000)
        out.push({ modelo: m.nombre, caso: c.clave, ok: false, seg, puntuacion: 0, error: e instanceof Error ? e.message : String(e) })
        console.log(`✘ ${m.nombre} · ${c.clave}: ${e instanceof Error ? e.message : e} (${seg}s)`)
      }
    }
    return out
  }))).flat()
  fs.writeFileSync(path.join(dir, 'resumen.json'), JSON.stringify(filas, null, 2))
  console.log('\nRESUMEN por modelo (media de puntuación, fallos, segundos medios):')
  for (const m of modelos) {
    const f = filas.filter(x => x.modelo === m.nombre)
    const ok = f.filter(x => x.ok)
    console.log(`${m.nombre.padEnd(24)} ${String(Math.round(f.reduce((a, x) => a + (x.puntuacion as number), 0) / f.length)).padStart(3)} pts · ${f.length - ok.length} fallos · ${Math.round(f.reduce((a, x) => a + (x.seg as number), 0) / f.length)} s`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
