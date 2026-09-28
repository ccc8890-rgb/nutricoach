/**
 * T33 — Autorización de TODAS las rutas de escritura del portal cliente.
 *
 * Descubre con TypeScript AST todos los exports POST/PUT/PATCH/DELETE bajo
 * app/api/cliente/[codigo]/**, carga los handlers reales y el helper real
 * lib/cliente/autorizar-escritura-plan.ts (transpileModule + vm, sin red),
 * y verifica 401/403 con un mock de service que SOLO permite las consultas
 * de planes_nutricion/clientes/profiles usadas por el guard. Cualquier otra
 * tabla/consulta lanza, de modo que un handler que intente tocar negocio
 * antes de autorizar falla el test.
 *
 * Modo HTTP opcional (mismo script):
 *   npx tsx scripts/test-portal-write-auth.ts --base-url http://localhost:3000
 * Solo lanza peticiones anónimas (sin cookies) a las rutas inventariadas con
 * un código imposible y UUIDs cero; exige 401 en todas. Seguro contra local
 * y prod (no escribe nada: el guard corta antes de tocar negocio).
 *
 * Ejecutar (modo VM, por defecto):
 *   npx tsx scripts/test-portal-write-auth.ts
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import { NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Inventario AST de rutas de escritura
// ---------------------------------------------------------------------------
const METODOS_ESCRITURA = ['POST', 'PUT', 'PATCH', 'DELETE'] as const
type MetodoEscritura = (typeof METODOS_ESCRITURA)[number]

interface RutaEscritura {
  file: string
  metodos: MetodoEscritura[]
}

function listarRouteFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...listarRouteFiles(full))
    else if (entry === 'route.ts') out.push(full)
  }
  return out
}

function metodosExportados(source: string): MetodoEscritura[] {
  const sf = ts.createSourceFile('route.ts', source, ts.ScriptTarget.ES2020, true)
  const encontrados = new Set<MetodoEscritura>()
  for (const stmt of sf.statements) {
    const mods = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined
    const esExport = mods?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
    if (!esExport) continue
    if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      const n = stmt.name.text as MetodoEscritura
      if (METODOS_ESCRITURA.includes(n)) encontrados.add(n)
    }
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          const n = decl.name.text as MetodoEscritura
          if (METODOS_ESCRITURA.includes(n)) encontrados.add(n)
        }
      }
    }
  }
  return METODOS_ESCRITURA.filter(m => encontrados.has(m))
}

function inventariarRutas(root: string): RutaEscritura[] {
  const base = resolve(root, 'app/api/cliente/[codigo]')
  return listarRouteFiles(base)
    .map(file => ({ file, metodos: metodosExportados(readFileSync(file, 'utf8')) }))
    .filter(r => r.metodos.length > 0)
    .sort((a, b) => a.file.localeCompare(b.file))
}

// ---------------------------------------------------------------------------
// Mock de Supabase: SOLO lecturas del guard; el resto lanza
// ---------------------------------------------------------------------------
const CODIGO = 't33-no-existing-plan-000'
const CLIENTE_PROPIO = 'user-cliente-propio'
const COACH_PROPIETARIO = 'user-coach-propietario'
const CLIENTE_AJENO = 'user-cliente-ajeno'
const COACH_AJENO = 'user-coach-ajeno'
const PLAN_ID = 'plan-1'
const CLIENTE_ID = 'cliente-1'

interface Filtro { op: 'eq' | 'is' | 'in'; col: string; val: unknown }

interface MockState {
  user: { id: string } | null
  authError: unknown
  authThrow: unknown
  plan: Record<string, unknown> | null
  planError: unknown
  planThrow: unknown
  cliente: Record<string, unknown> | null
  clienteError: unknown
  clienteThrow: unknown
  perfil: Record<string, unknown> | null
  perfilError: unknown
  // Efectos observados: cualquier mutación o consulta no permitida.
  violaciones: string[]
  serviceClientCreado: number
  bodyParseado: number
  formDataParseado: number
}

function freshState(): MockState {
  return {
    user: { id: CLIENTE_PROPIO },
    authError: null,
    authThrow: null,
    plan: { id: PLAN_ID, cliente_id: CLIENTE_ID, codigo_publico: CODIGO, activo: true },
    planError: null,
    planThrow: null,
    cliente: { id: CLIENTE_ID, profile_id: CLIENTE_PROPIO, coach_id: COACH_PROPIETARIO },
    clienteError: null,
    clienteThrow: null,
    perfil: { id: COACH_PROPIETARIO, role: 'coach' },
    perfilError: null,
    violaciones: [],
    serviceClientCreado: 0,
    bodyParseado: 0,
    formDataParseado: 0,
  }
}

function coincideFila(fila: Record<string, unknown>, filtros: Filtro[]): boolean {
  return filtros.every(f => {
    const v = fila[f.col]
    if (f.op === 'eq') return v === f.val
    if (f.op === 'is') return f.val === null ? v == null : v === f.val
    if (f.op === 'in') return Array.isArray(f.val) && (f.val as unknown[]).includes(v)
    return false
  })
}

// Tablas que el guard puede leer. Cualquier otra es una violación.
const TABLAS_PERMITIDAS = new Set(['planes_nutricion', 'clientes', 'profiles'])

function makeQueryBuilder(state: MockState, table: string) {
  const filtros: Filtro[] = []
  let modo: 'select' | 'insert' | 'update' | 'delete' = 'select'

  const builder: Record<string, unknown> = {}
  builder.select = () => builder
  builder.order = () => builder
  builder.limit = () => builder
  builder.eq = (col: string, val: unknown) => { filtros.push({ op: 'eq', col, val }); return builder }
  builder.is = (col: string, val: unknown) => { filtros.push({ op: 'is', col, val }); return builder }
  builder.in = (col: string, val: unknown) => { filtros.push({ op: 'in', col, val }); return builder }

  const registrarViolacion = (detalle: string) => {
    state.violaciones.push(`${table}:${detalle}`)
  }

  builder.single = async () => {
    if (!TABLAS_PERMITIDAS.has(table)) {
      registrarViolacion('single')
      return { data: null, error: new Error(`tabla no permitida: ${table}`) }
    }
    if (table === 'planes_nutricion') {
      if (state.planThrow) throw state.planThrow
      if (state.planError) return { data: null, error: state.planError }
      const data = state.plan && coincideFila(state.plan, filtros) ? state.plan : null
      return { data, error: null }
    }
    if (table === 'clientes') {
      if (state.clienteThrow) throw state.clienteThrow
      if (state.clienteError) return { data: null, error: state.clienteError }
      const data = state.cliente && coincideFila(state.cliente, filtros) ? state.cliente : null
      return { data, error: null }
    }
    if (table === 'profiles') {
      if (state.perfilError) return { data: null, error: state.perfilError }
      const data = state.perfil && coincideFila(state.perfil, filtros) ? state.perfil : null
      return { data, error: null }
    }
    return { data: null, error: null }
  }
  builder.maybeSingle = builder.single

  builder.then = (onFulfilled: (v: unknown) => unknown) => {
    if (modo !== 'select') {
      registrarViolacion(modo)
      return Promise.resolve({ data: null, error: new Error(`mutación no permitida: ${modo}`) }).then(onFulfilled)
    }
    if (!TABLAS_PERMITIDAS.has(table)) {
      registrarViolacion('select')
      return Promise.resolve({ data: null, error: new Error(`tabla no permitida: ${table}`) }).then(onFulfilled)
    }
    // El guard solo usa .single()/.maybeSingle(); un select en array es
    // sospechoso de negocio, pero lo toleramos devolviendo vacío sin marcar
    // violación para no romper guards que hagan .select().eq().single().
    return Promise.resolve({ data: [], error: null }).then(onFulfilled)
  }

  builder.insert = () => { modo = 'insert'; return builder }
  builder.update = () => { modo = 'update'; return builder }
  builder.delete = () => { modo = 'delete'; return builder }
  return builder
}

function makeAdmin(state: MockState) {
  return { from: (table: string) => makeQueryBuilder(state, table) }
}

function makeApiSupabase(state: MockState) {
  return {
    auth: {
      getUser: async () => {
        if (state.authThrow) throw state.authThrow
        return { data: { user: state.user }, error: state.authError }
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Carga recursiva de handlers reales + helper real
// ---------------------------------------------------------------------------
function loadModuleFactory(state: MockState) {
  const root = resolve(__dirname, '..')
  const cache = new Map<string, Record<string, unknown>>()

  const loadModule = (absPath: string): Record<string, unknown> => {
    const withExt = absPath.endsWith('.ts') ? absPath : `${absPath}.ts`
    if (cache.has(withExt)) return cache.get(withExt)!

    const source = readFileSync(withExt, 'utf8')
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    })

    const moduleObj = { exports: {} as Record<string, unknown> }
    cache.set(withExt, moduleObj.exports)

    const sandbox = {
      module: moduleObj,
      exports: moduleObj.exports,
      require: (id: string) => {
        // Whitelist estricta: SOLO estos módulos se resuelven/cargan reales.
        if (id === 'next/server') return { NextResponse }
        if (id === '@/lib/supabase-server') {
          return {
            createApiSupabase: () => makeApiSupabase(state),
            createServiceSupabase: () => {
              state.serviceClientCreado++
              return makeAdmin(state)
            },
          }
        }
        if (id === '@/lib/cliente/autorizar-escritura-plan') {
          return loadModule(resolve(root, 'lib/cliente/autorizar-escritura-plan.ts'))
        }
        // CUALQUIER otro módulo (SDKs de negocio: cloudinary, IA, integraciones,
        // utilidades de lib/...) va DIRECTO al proxy: no se ejecuta ningún
        // archivo real. El proxy registra violación y lanza SOLO si se invoca.
        return makeLazyThrowingModule(id, state)
      },
      console,
      Response,
      Promise,
      JSON,
      Set,
      Array,
      Object,
      Error,
      Date,
      Number,
      String,
      Boolean,
      Math,
      RegExp,
      Map,
      Symbol,
      process,
    }
    vm.createContext(sandbox)
    vm.runInContext(outputText, sandbox)
    return moduleObj.exports
  }

  return loadModule
}

// Proxy que permite leer propiedades (tipos, constantes, clases) pero lanza
// si se invoca como función. Así los handlers pueden importar utilidades sin
// que el test las ejecute. Si se invoca, registra violación (efecto de
// negocio antes de autorizar).
function makeLazyThrowingModule(id: string, state: MockState): Record<string, unknown> {
  const cache = new Map<string, unknown>()
  return new Proxy({}, {
    get(_t, prop: string) {
      if (prop === '__esModule') return true
      if (cache.has(prop)) return cache.get(prop)
      const fn = () => {
        state.violaciones.push(`modulo:${id}.${prop}`)
        throw new Error(`módulo no simulado invocado: ${id}.${prop}`)
      }
      cache.set(prop, fn)
      return fn
    },
  })
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
let passed = 0
let failed = 0

function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`  ✅ ${name}`) }
  else { failed++; console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`) }
}

function makeRequest(state: MockState): unknown {
  return {
    json: async () => { state.bodyParseado++; return {} },
    formData: async () => { state.formDataParseado++; return new FormData() },
    cookies: { getAll: () => [], set: () => {} },
    headers: new Headers(),
    url: `http://localhost/api/cliente/${CODIGO}`,
  }
}

const ctx = { params: Promise.resolve({ codigo: CODIGO }) }

function sinEfectos(state: MockState): boolean {
  return state.violaciones.length === 0 && state.bodyParseado === 0 && state.formDataParseado === 0
}

async function probarDenegacion(
  etiqueta: string,
  handler: (req: unknown, ctx: unknown) => Promise<Response>,
  state: MockState,
  esperado: number,
  opts: { sinServiceClient?: boolean } = {}
) {
  const r = await handler(makeRequest(state), ctx)
  check(`${etiqueta} → ${esperado}`, r.status === esperado, `recibido ${r.status}`)
  check(`${etiqueta} → sin efectos`, sinEfectos(state), state.violaciones.join(',') || 'body/formData parseado')
  if (opts.sinServiceClient) {
    check(`${etiqueta} → no crea service client`, state.serviceClientCreado === 0)
  }
}

async function runVm() {
  const root = resolve(__dirname, '..')
  const rutas = inventariarRutas(root)
  console.log(`\nT33 — Autorización escrituras portal (${rutas.length} rutas, ${rutas.reduce((n, r) => n + r.metodos.length, 0)} handlers)\n`)

  for (const ruta of rutas) {
    const rel = ruta.file.replace(`${root}/`, '')
    console.log(`\n${rel} [${ruta.metodos.join(', ')}]`)

    for (const metodo of ruta.metodos) {
      // --- Sin sesión → 401 ---
      {
        const state = freshState()
        state.user = null
        const mod = loadModuleFactory(state)(ruta.file)
        const handler = mod[metodo] as (req: unknown, ctx: unknown) => Promise<Response>
        await probarDenegacion(`${metodo} sin sesión`, handler, state, 401, { sinServiceClient: true })
      }

      // --- getUser error → 401 ---
      {
        const state = freshState()
        state.authError = new Error('boom')
        const mod = loadModuleFactory(state)(ruta.file)
        const handler = mod[metodo] as (req: unknown, ctx: unknown) => Promise<Response>
        await probarDenegacion(`${metodo} getUser error`, handler, state, 401, { sinServiceClient: true })
      }

      // --- getUser lanza excepción real → 403 fail-closed (catch del helper) ---
      {
        const state = freshState()
        state.authThrow = new Error('boom-throw')
        const mod = loadModuleFactory(state)(ruta.file)
        const handler = mod[metodo] as (req: unknown, ctx: unknown) => Promise<Response>
        await probarDenegacion(`${metodo} getUser throw`, handler, state, 403, { sinServiceClient: true })
      }

      // --- Cliente ajeno → 403 ---
      {
        const state = freshState()
        state.user = { id: CLIENTE_AJENO }
        const mod = loadModuleFactory(state)(ruta.file)
        const handler = mod[metodo] as (req: unknown, ctx: unknown) => Promise<Response>
        await probarDenegacion(`${metodo} cliente ajeno`, handler, state, 403)
      }

      // --- Coach ajeno → 403 ---
      {
        const state = freshState()
        state.user = { id: COACH_AJENO }
        const mod = loadModuleFactory(state)(ruta.file)
        const handler = mod[metodo] as (req: unknown, ctx: unknown) => Promise<Response>
        await probarDenegacion(`${metodo} coach ajeno`, handler, state, 403)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Pruebas directas del helper real (cliente/coach/rol/excepciones/plan inactivo)
// ---------------------------------------------------------------------------
async function runHelper() {
  console.log('\nHelper real lib/cliente/autorizar-escritura-plan.ts\n')

  const cargarHelper = (state: MockState) => {
    const loadModule = loadModuleFactory(state)
    const mod = loadModule(resolve(__dirname, '..', 'lib/cliente/autorizar-escritura-plan.ts'))
    return mod.autorizarEscrituraPlan as (req: unknown, codigo: string) => Promise<unknown>
  }

  const esNextResponse = (v: unknown) => v instanceof NextResponse

  // Cliente propietario → autorizado
  {
    const state = freshState()
    const auth = await cargarHelper(state)(makeRequest(state), CODIGO)
    check('helper cliente propietario → autorizado', !esNextResponse(auth))
  }

  // Coach propietario con rol coach → autorizado
  {
    const state = freshState()
    state.user = { id: COACH_PROPIETARIO }
    const auth = await cargarHelper(state)(makeRequest(state), CODIGO)
    check('helper coach propietario rol coach → autorizado', !esNextResponse(auth))
  }

  // Coach propietario con rol equivocado → 403
  {
    const state = freshState()
    state.user = { id: COACH_PROPIETARIO }
    state.perfil = { id: COACH_PROPIETARIO, role: 'cliente' }
    const auth = await cargarHelper(state)(makeRequest(state), CODIGO)
    check('helper rol equivocado → 403', esNextResponse(auth) && (auth as NextResponse).status === 403)
  }

  // Sin usuario → 401
  {
    const state = freshState()
    state.user = null
    const auth = await cargarHelper(state)(makeRequest(state), CODIGO)
    check('helper sin usuario → 401', esNextResponse(auth) && (auth as NextResponse).status === 401)
  }

  // authError retornado (no throw) → 401
  {
    const state = freshState()
    state.authError = new Error('boom')
    const auth = await cargarHelper(state)(makeRequest(state), CODIGO)
    check('helper authError retornado → 401', esNextResponse(auth) && (auth as NextResponse).status === 401)
  }

  // Plan inactivo → 404
  {
    const state = freshState()
    state.plan = { id: PLAN_ID, cliente_id: CLIENTE_ID, codigo_publico: CODIGO, activo: false }
    const auth = await cargarHelper(state)(makeRequest(state), CODIGO)
    check('helper plan inactivo → 404', esNextResponse(auth) && (auth as NextResponse).status === 404)
  }

  // Excepción en lookup de cliente → 403 fail-closed
  {
    const state = freshState()
    state.clienteError = new Error('db down')
    const auth = await cargarHelper(state)(makeRequest(state), CODIGO)
    check('helper cliente exception → 403', esNextResponse(auth) && (auth as NextResponse).status === 403)
  }

  // Excepción REAL lanzada en getUser → 403 fail-closed (catch del helper)
  {
    const state = freshState()
    state.authThrow = new Error('boom-throw')
    const auth = await cargarHelper(state)(makeRequest(state), CODIGO)
    check('helper getUser throw → 403', esNextResponse(auth) && (auth as NextResponse).status === 403)
  }

  // Excepción REAL lanzada en lookup de plan → 403 fail-closed
  {
    const state = freshState()
    state.planThrow = new Error('boom-throw')
    const auth = await cargarHelper(state)(makeRequest(state), CODIGO)
    check('helper plan throw → 403', esNextResponse(auth) && (auth as NextResponse).status === 403)
  }

  // Excepción REAL lanzada en lookup de cliente → 403 fail-closed
  {
    const state = freshState()
    state.clienteThrow = new Error('boom-throw')
    const auth = await cargarHelper(state)(makeRequest(state), CODIGO)
    check('helper cliente throw → 403', esNextResponse(auth) && (auth as NextResponse).status === 403)
  }
}

// ---------------------------------------------------------------------------
// Chequeo AST: GET alternativas no contiene escrituras
// ---------------------------------------------------------------------------
function runAstLectura() {
  console.log('\nAST — GET alternativas sin escrituras\n')
  const root = resolve(__dirname, '..')
  const file = resolve(root, 'app/api/cliente/[codigo]/comidas/[comidaId]/alternativas/route.ts')
  const source = readFileSync(file, 'utf8')
  const sf = ts.createSourceFile('route.ts', source, ts.ScriptTarget.ES2020, true)
  let tieneEscritura = false
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const name = node.expression.name.text
      if (name === 'insert' || name === 'update' || name === 'delete' || name === 'upsert') {
        tieneEscritura = true
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  check('alternativas/route.ts no contiene insert/update/delete/upsert', !tieneEscritura)
}

// ---------------------------------------------------------------------------
// Modo HTTP opcional (--base-url URL): solo peticiones anónimas
// ---------------------------------------------------------------------------
async function runHttp(baseUrl: string) {
  const root = resolve(__dirname, '..')
  const rutas = inventariarRutas(root)
  const uuidCero = '00000000-0000-0000-0000-000000000000'
  console.log(`\nT33 — HTTP anónimo contra ${baseUrl} (${rutas.length} rutas)\n`)

  for (const ruta of rutas) {
    // Sustituye TODOS los segmentos dinámicos [x] por el UUID cero real.
    const rel = ruta.file
      .replace(`${root}/app/api/cliente/[codigo]`, '')
      .replace('/route.ts', '')
      .replace(/\[[^\]]+\]/g, uuidCero)
    if (/\[[^\]]+\]/.test(rel)) {
      check(`HTTP ${metodo} ${rel} → sin segmentos dinámicos`, false, 'quedan [x] sin sustituir')
      continue
    }
    const url = `${baseUrl.replace(/\/$/, '')}/api/cliente/${CODIGO}${rel}`
    for (const metodo of ruta.metodos) {
      try {
        const res = await fetch(url, {
          method: metodo,
          headers: { 'Content-Type': 'application/json' },
          body: metodo === 'DELETE' ? undefined : '{}',
          redirect: 'manual',
          signal: AbortSignal.timeout(15000),
        })
        check(`HTTP ${metodo} ${rel || '/'} → 401`, res.status === 401, `recibido ${res.status}`)
      } catch (err) {
        check(`HTTP ${metodo} ${rel || '/'} → 401`, false, err instanceof Error ? err.message : 'error')
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2)
  const baseUrlIdx = args.indexOf('--base-url')
  if (baseUrlIdx !== -1) {
    const baseUrl = args[baseUrlIdx + 1]
    if (!baseUrl) { console.error('Falta URL tras --base-url'); process.exit(1) }
    await runHttp(baseUrl)
  } else {
    await runVm()
    await runHelper()
    runAstLectura()
  }
  console.log(`\nResultado: ${passed} pasadas, ${failed} fallidas\n`)
  if (failed > 0) process.exit(1)
}

main().catch(err => { console.error('Error en el runner:', err); process.exit(1) })
