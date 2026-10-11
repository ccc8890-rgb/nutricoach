// scripts/benchmark-modelos-plan.ts
// Banco de pruebas de modelos de IA para generar planes de entrenamiento: mismo caso, mismo prompt, mismos validadores; solo cambia el modelo.
// No escribe nada en la base de datos. Uso: npx tsx scripts/benchmark-modelos-plan.ts [--modelos=a,b] [--casos=carlos,natalia]
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { generarPlanEntrenoIA, type ProveedorIA } from '../lib/entrenos/generar-plan-ia'
import { evaluarPlanIA } from '../lib/entrenos/evaluar-plan-ia'

for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const i = l.indexOf('=')
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i)] = process.env[l.slice(0, i)] ?? l.slice(i + 1).replace(/^"|"$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const DEEPSEEK = 'https://api.deepseek.com/v1/chat/completions'
const OPENAI = 'https://api.openai.com/v1/chat/completions'
/** Claude por la CLI (usa el inicio de sesión de la suscripción, sin clave de API). Solo para el banco de pruebas: no es utilizable en Vercel. */
function claudeCLI(nombre: string, modelo: string): ProveedorIA {
  return {
    nombre, url: '', claveEnv: '', modelo,
    llamar: (sistema, usuario) => new Promise((resolve, reject) => {
      const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-claude-')) // carpeta vacía: que no cargue el CLAUDE.md del proyecto
      const hijo = spawn('claude', ['-p', '--model', modelo, '--system-prompt', sistema, '--tools', '', '--setting-sources', '', '--no-session-persistence', '--output-format', 'json', '--effort', 'high'], { cwd })
      let out = '', err = ''
      hijo.stdout.on('data', d => { out += d })
      hijo.stderr.on('data', d => { err += d })
      hijo.on('error', reject)
      hijo.on('close', code => {
        try {
          const j = JSON.parse(out)
          if (code !== 0 || j.is_error) return reject(new Error(String(j.result ?? err).slice(0, 300)))
          resolve({ texto: String(j.result ?? ''), uso: { completion_tokens: j.usage?.output_tokens ?? null, prompt_tokens: j.usage?.input_tokens ?? null, coste_equivalente_usd: j.total_cost_usd ?? null } })
        } catch { reject(new Error((err || out).slice(0, 300))) }
      })
      hijo.stdin.end(usuario)
    }),
  }
}

const MODELOS: ProveedorIA[] = [
  claudeCLI('claude-opus', 'opus'),
  claudeCLI('claude-sonnet', 'sonnet'),
  { nombre: 'deepseek-chat (actual)', url: DEEPSEEK, claveEnv: 'DEEPSEEK_API_KEY', modelo: 'deepseek-chat', maxTokens: 6000 },
  { nombre: 'deepseek-v4-pro', url: DEEPSEEK, claveEnv: 'DEEPSEEK_API_KEY', modelo: 'deepseek-v4-pro', maxTokens: 16000 },
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
