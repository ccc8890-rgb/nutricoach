#!/usr/bin/env node
// Pasada autónoma del recetario (cada 6 h, la lanza launchd con node: /bin/bash no puede leer Desktop bajo launchd).
//  1. Intolerancias  2. Enlaces ingrediente→alimento (reglas aprobadas)  3. Campos (dificultad, cocción, tipo, categoría, tags, ración, momentos, objetivos)
//  4. Puntuaciones derivadas  5. Resumen + aviso en pantalla si cambió algo. Copias antes/después en salidas/.
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFileSync } from 'node:fs'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const env = { ...process.env, PATH: '/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin' }
const run = (cmd, args) => { const r = spawnSync(cmd, args, { cwd: raiz, env, encoding: 'utf8', timeout: 20 * 60 * 1000 }); return (r.stdout || '') + (r.stderr || '') }
const lineas = (txt, re) => txt.split('\n').filter(l => re.test(l)).join('\n')
console.log(`=== ${new Date().toLocaleString('es-ES')} ===`)

const int = run('node', ['scripts/auditar-intolerancias-completo.mjs', '--aplica'])
console.log(lineas(int, /^Recetas:|^Aplicado/))
const mat = run('node', ['scripts/auditar-matches-ingredientes.mjs'])
writeFileSync('/tmp/nutricoach-matches.txt', mat)
console.log(mat.split('\n')[0])
const cor = run('node', ['scripts/aplicar-correcciones-matches.mjs', '--aplica'])
console.log(lineas(cor, /^filas a corregir|^Nada que corregir/))
const cam = run('npx', ['tsx', 'scripts/completar-campos-recetas.mts', '--aplica'])
console.log(lineas(cam, /^recetas|^Aplicado|^Avisos/))
const ri = run('npx', ['tsx', 'scripts/recalcular-recipe-intelligence.ts', '--apply', '--limite=2000'])
console.log(/"file"/.test(ri) ? 'Puntuaciones de inteligencia de receta recalculadas' : 'ERROR recalculando puntuaciones')
console.log(lineas(run('npx', ['tsx', 'scripts/batch-audit-profesional.ts', '--apply']), /^Auditadas/))
const pas = run('node', ['scripts/auditar-pasos-ingredientes.mjs'])
console.log(pas.split('\n')[0])
const urg = (mat.match(/URGENTES[^:]*: (\d+)/) || [])[1]
console.log(`Enlaces urgentes pendientes de revisión manual: ${urg ?? '?'}`)

if (/Aplicado en [1-9]|filas a corregir: [1-9]|con cambios: [1-9]/.test(`${int}\n${cor}\n${cam}`)) {
  run('osascript', ['-e', 'display notification "Recetario revisado y corregido. Mira logs/nutricoach-auditoria.log" with title "NutriCoach"'])
}
