#!/usr/bin/env node
/**
 * audit-portal-patterns.mjs
 * Detecta patrones peligrosos en el portal cliente antes de deploy.
 * Ejecutar: node scripts/audit-portal-patterns.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const ROOT = new URL('..', import.meta.url).pathname
const errors = []
const warnings = []

function readFile(path) {
  try { return readFileSync(path, 'utf8') } catch { return '' }
}

function walkFiles(dir, ext = '.tsx', out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory() && !['node_modules', '.next', '.git'].includes(entry.name)) {
      walkFiles(full, ext, out)
    } else if (entry.isFile() && full.endsWith(ext)) {
      out.push(full)
    }
  }
  return out
}

function rel(path) { return relative(ROOT, path) }

// ─── Regla 1: window.location.href en páginas del portal ─────────────────────
// Las páginas bajo /app/cliente/ y /app/onboarding/ deben usar window.location.replace()
// para redirigir — href añade al historial y crea bucles iOS swipe-back
const PORTAL_PAGES_DIR = join(ROOT, 'app/cliente')
const PORTAL_FILES = walkFiles(PORTAL_PAGES_DIR)

for (const file of PORTAL_FILES) {
  const content = readFile(file)
  const lines = content.split('\n')
  lines.forEach((line, i) => {
    if (/window\.location\.href\s*=/.test(line) && !line.trim().startsWith('//')) {
      errors.push({
        file: rel(file),
        line: i + 1,
        rule: 'USE_REPLACE_NOT_HREF',
        msg: `window.location.href en página portal — usar window.location.replace() para evitar bucle historial iOS`,
        code: line.trim(),
      })
    }
  })
}

// ─── Regla 2: import supabase en componentes PortalCliente ───────────────────
// Los componentes PortalCliente NO deben hacer queries directas a Supabase.
// Deben usar fetch a /api/ con service role para evitar que RLS silencia resultados.
const PORTAL_COMPONENTS_DIR = join(ROOT, 'components/PortalCliente')
const TRAINING_COMPONENTS = []
const PORTAL_COMPONENTS = [
  ...walkFiles(PORTAL_COMPONENTS_DIR),
  ...TRAINING_COMPONENTS,
]

for (const file of PORTAL_COMPONENTS) {
  const content = readFile(file)
  if (/from ['"]@\/lib\/supabase['"]/.test(content) || /from ['"]\.\..*supabase['"]/.test(content)) {
    const lines = content.split('\n')
    lines.forEach((line, i) => {
      if (/supabase\.from\s*\(/.test(line) && !line.trim().startsWith('//')) {
        errors.push({
          file: rel(file),
          line: i + 1,
          rule: 'NO_DIRECT_SUPABASE_IN_PORTAL',
          msg: `Query directa Supabase en componente portal — usar fetch('/api/...') con service role para evitar que RLS silencia joins cruzados`,
          code: line.trim(),
        })
      }
    })
  }
}

// ─── Regla 3: Links sin replace en páginas secundarias del portal ─────────────
// La página /cliente/sesion/[id] debe usar replace=true
// en todos los links de vuelta a /cliente para evitar acumulación de historial.
const SECONDARY_PORTAL_PAGES = [
  join(ROOT, 'app/cliente/sesion/[id]/page.tsx'),
]

for (const file of SECONDARY_PORTAL_PAGES) {
  const content = readFile(file)
  // Buscar Link href="/cliente" sin replace en la línea siguiente
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/href=["'`]\/cliente["'`]/.test(line) || /href=\{`\/cliente`\}/.test(line)) {
      // Buscar "replace" en las 3 líneas siguientes
      const context = lines.slice(i, i + 4).join('\n')
      if (!context.includes('replace')) {
        errors.push({
          file: rel(file),
          line: i + 1,
          rule: 'MISSING_REPLACE_ON_BACK_LINK',
          msg: `Link a /cliente sin prop "replace" en página secundaria — añadir replace para evitar acumulación en historial iOS`,
          code: line.trim(),
        })
      }
    }
  }
}

// ─── Regla 5: /cliente/[codigo] solo reenvía a /cliente ──────────────────────
// El portal antiguo por código se eliminó (11-10-2026). La ruta queda como
// reenvío para enlaces viejos: nunca debe volver a renderizar un portal propio.
const PUBLIC_CODE_PORTAL = join(ROOT, 'app/cliente/[codigo]/page.tsx')
const publicCodeContent = readFile(PUBLIC_CODE_PORTAL)
if (!publicCodeContent.includes("redirect('/cliente')") && !publicCodeContent.includes('redirect("/cliente")')) {
  errors.push({
    file: rel(PUBLIC_CODE_PORTAL),
    rule: 'CODE_PORTAL_MUST_REDIRECT',
    msg: `/cliente/[codigo] debe limitarse a redirigir a /cliente (no renderizar un portal antiguo)`,
  })
}
if (publicCodeContent.includes('DashboardCliente')) {
  errors.push({
    file: rel(PUBLIC_CODE_PORTAL),
    rule: 'OLD_PORTAL_RETURNED',
    msg: `/cliente/[codigo] no debe volver a montar DashboardCliente`,
  })
}

// ─── Regla 7: Service Worker no debe cachear APIs de cliente ─────────────────
// Las APIs del portal dependen de cookies, usuario y estado actual. Cachearlas
// conserva 401/403/404 o datos de otro flujo en la PWA instalada.
const SERVICE_WORKER = join(ROOT, 'public/sw.js')
const swContent = readFile(SERVICE_WORKER)
if (!swContent.includes("const CACHE = 'nutricoach-v7'")) {
  warnings.push({
    file: rel(SERVICE_WORKER),
    rule: 'BUMP_SW_CACHE_VERSION',
    msg: `Al cambiar estrategia PWA, subir versión CACHE para forzar limpieza de caches antiguas`,
  })
}
if (!swContent.includes('if (pathname.startsWith(\'/api/\'))') && !swContent.includes('if (pathname.startsWith("/api/"))')) {
  errors.push({
    file: rel(SERVICE_WORKER),
    rule: 'MISSING_API_NETWORK_ONLY_RULE',
    msg: `sw.js debe manejar APIs explícitamente como network-only`,
  })
}
if (/pathname\.startsWith\(['"]\/api\/['"]\)[\s\S]{0,400}caches\.match\(request\)/.test(swContent)) {
  errors.push({
    file: rel(SERVICE_WORKER),
    rule: 'NO_API_CACHE_FALLBACK',
    msg: `No usar caches.match(request) como fallback para APIs; puede devolver errores auth antiguos en PWA`,
  })
}

// ─── Regla 8: PWA cliente no debe arrancar en portal publico por codigo ──────
// iOS conserva el start_url de la PWA instalada. Si apunta a /cliente/[codigo],
// al limpiar sesion vuelve al DashboardCliente publico antiguo.
const CLIENT_MANIFEST = join(ROOT, 'public/manifest-cliente-carlos.json')
const clientManifestContent = readFile(CLIENT_MANIFEST)
try {
  const manifest = JSON.parse(clientManifestContent)
  if (manifest.start_url !== '/cliente') {
    errors.push({
      file: rel(CLIENT_MANIFEST),
      rule: 'CLIENT_PWA_STARTS_AT_AUTH_PORTAL',
      msg: `manifest-cliente-carlos.json debe usar start_url "/cliente"; nunca /cliente/[codigo]`,
      code: `"start_url": ${JSON.stringify(manifest.start_url)}`,
    })
  }
} catch {
  errors.push({
    file: rel(CLIENT_MANIFEST),
    rule: 'CLIENT_MANIFEST_INVALID_JSON',
    msg: `manifest-cliente-carlos.json no es JSON valido`,
  })
}

const CLEAN_SW = join(ROOT, 'public/limpiar-sw.html')
const cleanSwContent = readFile(CLEAN_SW)
if (!cleanSwContent.includes('/login?next=%2Fcliente&limpiado=1')) {
  errors.push({
    file: rel(CLEAN_SW),
    rule: 'CLEAN_SW_MUST_RETURN_TO_CLIENT_LOGIN',
    msg: `limpiar-sw.html debe redirigir a /login?next=%2Fcliente&limpiado=1 para evitar que el cliente acabe en /dashboard`,
  })
}

// ─── Regla 7: una sola fuente para lo que el atleta ve de una sesión en una fecha ─────────────
// Lista de ejercicios, pasos del reloj y km salen de lib/entrenos/sesion-semana.ts (progresión semanal). Si una ruta del atleta calcula km o
// devuelve pasos/ejercicios sin pasar por esos helpers, las semanas 2-4 dejan de coincidir con la lista y con Garmin.
const RUTAS_ATLETA = [
  'app/api/cliente/sesion/[id]/route.ts',
  'app/api/entrenos/semana-completa/route.ts',
  'app/api/entrenos/mes-completo/route.ts',
]
for (const f of RUTAS_ATLETA) {
  const c = readFile(join(ROOT, f))
  const usaKm = /kmDeSesion\(/.test(c)
  const devuelvePasos = /pasos:\s*sesion\.pasos\s*\?\?\s*null/.test(c)
  if ((usaKm && !/pasosParaFecha\(/.test(c)) || devuelvePasos) {
    errors.push({ file: f, rule: 'SESION_SIN_PROGRESION_SEMANAL', msg: 'Calcula km/pasos de una sesión sin pasosParaFecha/ejerciciosParaFecha (lib/entrenos/sesion-semana.ts): las semanas del bloque quedarían desincronizadas.' })
  }
  if (f.includes('cliente/sesion') && !/ejerciciosParaFecha\(/.test(c)) {
    errors.push({ file: f, rule: 'SESION_SIN_PROGRESION_SEMANAL', msg: 'Devuelve los ejercicios de la sesión sin ejerciciosParaFecha.' })
  }
}

// ─── Resultado ────────────────────────────────────────────────────────────────
console.log('\n🔍 Auditoría patrones portal cliente\n')

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ Sin problemas detectados\n')
  process.exit(0)
}

if (warnings.length > 0) {
  console.log(`⚠️  ${warnings.length} advertencia(s):\n`)
  for (const w of warnings) {
    console.log(`  [${w.rule}] ${w.file}`)
    console.log(`  → ${w.msg}\n`)
  }
}

if (errors.length > 0) {
  console.log(`❌ ${errors.length} error(es) encontrados:\n`)
  for (const e of errors) {
    console.log(`  [${e.rule}] ${e.file}:${e.line}`)
    console.log(`  → ${e.msg}`)
    if (e.code) console.log(`  Código: ${e.code}\n`)
  }
  process.exit(1)
}
