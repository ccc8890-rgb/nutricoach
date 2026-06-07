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
const TRAINING_COMPONENTS = [
  join(ROOT, 'components/training/SemanaEntrenoCard.tsx'),
]
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
// Las páginas /cliente/sesion/[id] y /cliente/semana deben usar replace=true
// en todos los links de vuelta a /cliente para evitar acumulación de historial.
const SECONDARY_PORTAL_PAGES = [
  join(ROOT, 'app/cliente/sesion/[id]/page.tsx'),
  join(ROOT, 'app/cliente/semana/page.tsx'),
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

// ─── Regla 4: router.push hacia /cliente/semana desde portal principal ────────
// El "Ver semana completa" en /cliente/page.tsx debe usar push (no replace).
// Ya está correcto — esta regla verifica que no se cambie a replace.
const MAIN_PORTAL = join(ROOT, 'app/cliente/page.tsx')
const mainContent = readFile(MAIN_PORTAL)
if (mainContent.includes("router.replace('/cliente/semana')")) {
  warnings.push({
    file: rel(MAIN_PORTAL),
    rule: 'SEMANA_SHOULD_USE_PUSH',
    msg: `"Ver semana completa" debe usar router.push (no replace) para que iOS swipe-back vuelva al portal`,
  })
}

// ─── Regla 5: /cliente/[codigo] no debe renderizar portal antiguo si hay sesión ─
// Esta ruta existe por compatibilidad pública, pero un cliente autenticado debe
// acabar siempre en /cliente. Si no, el historial puede volver a DashboardCliente.
const PUBLIC_CODE_PORTAL = join(ROOT, 'app/cliente/[codigo]/page.tsx')
const publicCodeContent = readFile(PUBLIC_CODE_PORTAL)
if (publicCodeContent.includes("'use client'") || publicCodeContent.includes('"use client"')) {
  errors.push({
    file: rel(PUBLIC_CODE_PORTAL),
    line: 1,
    rule: 'CLIENT_CODE_PORTAL_MUST_BE_SERVER_GUARDED',
    msg: `/cliente/[codigo] debe ser Server Component para redirigir a /cliente antes de renderizar DashboardCliente`,
    code: publicCodeContent.split('\n')[0]?.trim(),
  })
}
if (!publicCodeContent.includes("redirect('/cliente')") && !publicCodeContent.includes('redirect("/cliente")')) {
  errors.push({
    file: rel(PUBLIC_CODE_PORTAL),
    rule: 'MISSING_CLIENT_ROLE_REDIRECT',
    msg: `/cliente/[codigo] debe redirigir a /cliente cuando detecta sesión con role cliente`,
  })
}
if (!publicCodeContent.includes('createServerSupabase')) {
  errors.push({
    file: rel(PUBLIC_CODE_PORTAL),
    rule: 'MISSING_SERVER_SESSION_CHECK',
    msg: `/cliente/[codigo] debe comprobar sesión en servidor antes de renderizar DashboardCliente`,
  })
}

// ─── Regla 6: links públicos a sesiones deben conservar codigo ───────────────
// El coach puede revisar el portal público por código. Si DashboardCliente abre
// /cliente/sesion/[id] sin codigo, la API intenta resolver cliente por sesión
// autenticada y un coach cae en "Sesión no encontrada" → /cliente → /dashboard.
const PUBLIC_DASHBOARD = join(ROOT, 'components/PortalCliente/DashboardCliente.tsx')
const publicDashboardContent = readFile(PUBLIC_DASHBOARD)
const publicDashboardLines = publicDashboardContent.split('\n')
for (let i = 0; i < publicDashboardLines.length; i++) {
  const line = publicDashboardLines[i]
  if (line.includes('/cliente/sesion/') && !line.includes('codigo=')) {
    errors.push({
      file: rel(PUBLIC_DASHBOARD),
      line: i + 1,
      rule: 'PUBLIC_SESSION_LINK_NEEDS_CODE',
      msg: `Links desde DashboardCliente a /cliente/sesion deben incluir ?codigo=... para que el flujo público/coach no dependa del usuario autenticado`,
      code: line.trim(),
    })
  }
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
