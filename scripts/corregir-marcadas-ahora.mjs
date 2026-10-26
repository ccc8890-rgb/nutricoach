#!/usr/bin/env node
// Atiende las recetas marcadas «Corregir» (foto + resto de aspectos). Lo lanza launchd cada 10 min (com.carlos.nutricoach-correcciones);
// si no hay nada marcado solo hace una consulta. La pasada de 6 h ya no las atiende (evita doble proceso y doble gasto de imágenes).
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const env = { ...process.env, PATH: '/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin' }
const run = (cmd, args) => { const r = spawnSync(cmd, args, { cwd: raiz, env, encoding: 'utf8', timeout: 9 * 60 * 1000 }); return (r.stdout || '') + (r.stderr || '') }
const lineas = (txt, re) => txt.split('\n').filter(l => re.test(l)).join('\n')

const fotos = run('node', ['scripts/corregir-marcadas.mjs', '--aplica', '--limite=10'])
const resto = run('npx', ['tsx', 'scripts/corregir-marcadas-motor.ts', '--aplica', '--limite=10'])
const f = lineas(fotos, /^Fotos regeneradas|sin saldo/)
const r = lineas(resto, /^Correcciones del motor|^❌|^\S.* — pendiente:/)
if (f || r) console.log(`=== ${new Date().toLocaleString('es-ES')} ===\n${[f, r].filter(Boolean).join('\n')}`)
