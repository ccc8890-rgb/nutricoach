/**
 * T33 — Pruebas de autorización de las rutas de comidas.
 *
 * Carga los handlers reales (materializar y mover-dia) con dependencias
 * simuladas (Supabase auth + service role) usando transpileModule + vm.
 * Sin red, sin credenciales, sin tocar producción.
 *
 * Ejecutar: npx tsx scripts/test-comidas-authorization.ts
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import { NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const CODIGO = 'CODIGO_TEST'
const CLIENTE_PROPIO = 'user-cliente-propio'
const COACH_PROPIETARIO = 'user-coach-propietario'
const CLIENTE_AJENO = 'user-cliente-ajeno'
const COACH_AJENO = 'user-coach-ajeno'

const PLAN_ID = 'plan-1'
const PLAN_AJENO_ID = 'plan-ajeno'
const CLIENTE_ID = 'cliente-1'
const COMIDA_PROPIA = 'comida-propia'
const COMIDA_AJENA = 'comida-ajena'
const COMIDA_RECURRENTE = 'comida-recurrente'
const COMIDA_RECURRENTE_2 = 'comida-recurrente-2'
const COMIDA_AJENA_RECURRENTE = 'comida-ajena-recurrente'
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

// ---------------------------------------------------------------------------
// Mock de Supabase
// ---------------------------------------------------------------------------
interface Filtro {
  op: 'eq' | 'is' | 'in'
  col: string
  val: unknown
}

interface Mutacion {
  table: string
  op: 'insert' | 'update' | 'delete'
  filtros: Filtro[]
  rows?: unknown
  values?: unknown
}

interface MockState {
  user: { id: string } | null
  authError: unknown
  plan: { id: string; cliente_id: string; codigo_publico: string; activo: boolean } | null
  planError: unknown
  cliente: { id: string; profile_id: string | null; coach_id: string | null } | null
  clienteError: unknown
  perfil: { id: string; role: string } | null
  perfilError: unknown
  // Filas de comidas del plan propio y del plan ajeno (fixture intacto).
  comidas: Array<Record<string, unknown>>
  comidasAjenas: Array<Record<string, unknown>>
  comidasError: unknown
  comida: { id: string; plan_id: string; dia_semana: string | null } | null
  comidaError: unknown
  // comida_alimentos indexado por comida_id.
  alimentos: Record<string, Array<Record<string, unknown>>>
  // Registro de mutaciones para verificar "cero mutaciones denegadas".
  mutaciones: Mutacion[]
  // Contadores de efectos colaterales del guard.
  serviceClientCreado: number
  bodyParseado: number
}

function freshState(): MockState {
  return {
    user: { id: CLIENTE_PROPIO },
    authError: null,
    plan: { id: PLAN_ID, cliente_id: CLIENTE_ID, codigo_publico: CODIGO, activo: true },
    planError: null,
    cliente: { id: CLIENTE_ID, profile_id: CLIENTE_PROPIO, coach_id: COACH_PROPIETARIO },
    clienteError: null,
    perfil: { id: COACH_PROPIETARIO, role: 'coach' },
    perfilError: null,
    comidas: [],
    comidasAjenas: [],
    comidasError: null,
    comida: null,
    comidaError: null,
    alimentos: {},
    mutaciones: [],
    serviceClientCreado: 0,
    bodyParseado: 0,
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

// Builder que respeta filtros eq/is/in y reproduce las cadenas reales:
//   .select(...).eq(...).is(...)            → array (thenable)
//   .select(...).eq(...).single()           → objeto
//   .insert(rows).select('id')              → array de filas creadas
//   .update(values).eq(...)                 → mutación registrada
//   .delete().eq(...) / .delete().in(...)   → mutación registrada
function makeQueryBuilder(state: MockState, table: string) {
  const filtros: Filtro[] = []
  let modo: 'select' | 'insert' | 'update' | 'delete' = 'select'
  let insertRows: unknown = null
  let updateValues: unknown = null

  const builder: Record<string, unknown> = {}

  builder.select = () => builder
  builder.order = () => builder
  builder.limit = () => builder

  builder.eq = (col: string, val: unknown) => {
    filtros.push({ op: 'eq', col, val })
    return builder
  }
  builder.is = (col: string, val: unknown) => {
    filtros.push({ op: 'is', col, val })
    return builder
  }
  builder.in = (col: string, val: unknown) => {
    filtros.push({ op: 'in', col, val })
    return builder
  }

  const filasDeTabla = (): Array<Record<string, unknown>> => {
    if (table === 'comidas') {
      // El plan propio y el ajeno viven en fixtures separados; los filtros
      // (plan_id, dia_semana) deciden qué se devuelve.
      return [...state.comidas, ...state.comidasAjenas]
    }
    if (table === 'comida_alimentos') {
      const comidaId = filtros.find(f => f.col === 'comida_id')?.val
      if (typeof comidaId === 'string') return state.alimentos[comidaId] ?? []
      return Object.values(state.alimentos).flat()
    }
    return []
  }

  // single valida los filtros de identidad acumulados (eq/is/in) contra el
  // fixture correspondiente. Si el handler retira un filtro de propiedad
  // (p. ej. codigo_publico, activo, id, profile_id), coincideFila no
  // encontrará la fila y devolverá null → el test falla.
  builder.single = async () => {
    if (table === 'planes_nutricion') {
      if (state.planError) return { data: null, error: state.planError }
      const data = state.plan && coincideFila(state.plan as unknown as Record<string, unknown>, filtros)
        ? state.plan
        : null
      return { data, error: null }
    }
    if (table === 'clientes') {
      if (state.clienteError) return { data: null, error: state.clienteError }
      const data = state.cliente && coincideFila(state.cliente as unknown as Record<string, unknown>, filtros)
        ? state.cliente
        : null
      return { data, error: null }
    }
    if (table === 'profiles') {
      if (state.perfilError) return { data: null, error: state.perfilError }
      const data = state.perfil && coincideFila(state.perfil as unknown as Record<string, unknown>, filtros)
        ? state.perfil
        : null
      return { data, error: null }
    }
    if (table === 'comidas') {
      if (state.comidaError) return { data: null, error: state.comidaError }
      const data = state.comida && coincideFila(state.comida as unknown as Record<string, unknown>, filtros)
        ? state.comida
        : null
      return { data, error: null }
    }
    return { data: null, error: null }
  }
  builder.maybeSingle = builder.single

  builder.then = (onFulfilled: (v: unknown) => unknown) => {
    if (modo === 'insert') {
      const rows = Array.isArray(insertRows) ? insertRows : [insertRows]
      const creadas = rows.map((_, i) => ({ id: `nueva-${table}-${i}` }))
      // La mutación se registra al ejecutar (then), con todos los filtros ya
      // aplicados. En insert no hay filtros de identidad que perder.
      state.mutaciones.push({ table, op: 'insert', filtros: [...filtros], rows: insertRows })
      return Promise.resolve({ data: creadas, error: null }).then(onFulfilled)
    }
    if (modo === 'update') {
      // Registro diferido: aquí ya están todos los .eq()/.is()/.in() aplicados.
      state.mutaciones.push({ table, op: 'update', filtros: [...filtros], values: updateValues })
      return Promise.resolve({ data: null, error: null }).then(onFulfilled)
    }
    if (modo === 'delete') {
      state.mutaciones.push({ table, op: 'delete', filtros: [...filtros] })
      return Promise.resolve({ data: null, error: null }).then(onFulfilled)
    }
    const data = filasDeTabla().filter(f => coincideFila(f, filtros))
    const error = table === 'comidas' ? state.comidasError : null
    return Promise.resolve({ data, error }).then(onFulfilled)
  }

  builder.insert = (rows: unknown) => {
    modo = 'insert'
    insertRows = rows
    return builder
  }

  builder.update = (values: unknown) => {
    modo = 'update'
    updateValues = values
    return builder
  }

  builder.delete = () => {
    modo = 'delete'
    return builder
  }

  return builder
}

function makeAdmin(state: MockState) {
  return {
    from: (table: string) => makeQueryBuilder(state, table),
  }
}

function makeApiSupabase(state: MockState) {
  return {
    auth: {
      getUser: async () => ({ data: { user: state.user }, error: state.authError }),
    },
  }
}

// ---------------------------------------------------------------------------
// Carga de handlers reales con dependencias simuladas
// ---------------------------------------------------------------------------
interface LoadedHandlers {
  materializar: (req: unknown, ctx: { params: Promise<{ codigo: string }> }) => Promise<Response>
  moverDia: (req: unknown, ctx: { params: Promise<{ codigo: string }> }) => Promise<Response>
  registrarComidaPost: (req: unknown, ctx: { params: Promise<{ codigo: string }> }) => Promise<Response>
  registrarComidaDelete: (req: unknown, ctx: { params: Promise<{ codigo: string }> }) => Promise<Response>
}

// Carga recursiva de módulos TS reales en VM. El helper de autorización
// (lib/cliente/autorizar-escritura-plan.ts) NO se mockea: se transpila y
// ejecuta de verdad, con sus propias dependencias resueltas recursivamente.
// Solo se sustituyen los módulos externos (next/server, @/lib/supabase-server)
// por dobles controlados por el estado del test.
function loadHandlers(state: MockState): LoadedHandlers {
  const root = resolve(__dirname, '..')
  const cache = new Map<string, Record<string, unknown>>()

  const resolveModulePath = (id: string, fromDir: string): string | null => {
    if (id.startsWith('@/')) {
      return resolve(root, id.slice(2))
    }
    if (id.startsWith('.')) {
      return resolve(fromDir, id)
    }
    return null
  }

  const loadModule = (absPath: string): Record<string, unknown> => {
    const withExt = absPath.endsWith('.ts') ? absPath : `${absPath}.ts`
    if (cache.has(withExt)) return cache.get(withExt)!

    const source = readFileSync(withExt, 'utf8')
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    })

    const moduleObj = { exports: {} as Record<string, unknown> }
    cache.set(withExt, moduleObj.exports)

    const dir = resolve(withExt, '..')
    const sandbox = {
      module: moduleObj,
      exports: moduleObj.exports,
      require: (id: string) => {
        if (id === 'next/server') {
          // NextResponse real: es una clase, así que `instanceof` funciona.
          // No realiza red ni I/O.
          return { NextResponse }
        }
        if (id === '@/lib/supabase-server') {
          return {
            createApiSupabase: () => makeApiSupabase(state),
            createServiceSupabase: () => {
              state.serviceClientCreado++
              return makeAdmin(state)
            },
          }
        }
        const resolved = resolveModulePath(id, dir)
        if (resolved) return loadModule(resolved)
        throw new Error(`require no simulado: ${id}`)
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

  const mat = loadModule(resolve(root, 'app/api/cliente/[codigo]/comidas/materializar/route.ts'))
  const mov = loadModule(resolve(root, 'app/api/cliente/[codigo]/comidas/mover-dia/route.ts'))
  const reg = loadModule(resolve(root, 'app/api/cliente/[codigo]/registrar-comida/route.ts'))

  return {
    materializar: mat.POST as LoadedHandlers['materializar'],
    moverDia: mov.POST as LoadedHandlers['moverDia'],
    registrarComidaPost: reg.POST as LoadedHandlers['registrarComidaPost'],
    registrarComidaDelete: reg.DELETE as LoadedHandlers['registrarComidaDelete'],
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
let passed = 0
let failed = 0

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++
    console.log(`  ✅ ${name}`)
  } else {
    failed++
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function makeRequest(state: MockState, body?: unknown): unknown {
  return {
    json: async () => {
      state.bodyParseado++
      return body ?? {}
    },
    cookies: { getAll: () => [], set: () => {} },
  }
}

const ctx = { params: Promise.resolve({ codigo: CODIGO }) }

// Helpers de aserción sobre mutaciones.
function mutacionesDe(state: MockState, table: string, op: Mutacion['op']): Mutacion[] {
  return state.mutaciones.filter(m => m.table === table && m.op === op)
}

function sinMutaciones(state: MockState): boolean {
  return state.mutaciones.length === 0
}

// Fixture de comida recurrente con ingredientes.
function comidaRecurrente(id: string, planId: string, nombre: string): Record<string, unknown> {
  return {
    id,
    plan_id: planId,
    nombre,
    orden: 0,
    hora_sugerida: null,
    kcal_target: 500,
    proteinas_target: 30,
    carbos_target: 50,
    grasas_target: 15,
    notas_peri_entreno: null,
    receta_id: null,
    alternativas_receta_ids: null,
    dia_semana: null,
    dieta_habitual_id: null,
    origen_adherencia: null,
    adaptacion_habitual: null,
  }
}

function ingredientesDe(comidaId: string): Array<Record<string, unknown>> {
  return [
    { comida_id: comidaId, alimento_id: 'alimento-1', cantidad_gramos: 100, factor_ajuste: 1 },
    { comida_id: comidaId, alimento_id: 'alimento-2', cantidad_gramos: 50, factor_ajuste: 1 },
  ]
}

// Verifica el caso feliz de materializar para un usuario autorizado.
async function casoMaterializarFeliz(
  etiqueta: string,
  userId: string,
  perfil: { id: string; role: string } | null
) {
  const state = freshState()
  state.user = { id: userId }
  state.perfil = perfil
  state.comidas = [
    comidaRecurrente(COMIDA_RECURRENTE, PLAN_ID, 'Desayuno'),
    comidaRecurrente(COMIDA_RECURRENTE_2, PLAN_ID, 'Cena'),
  ]
  state.comidasAjenas = [comidaRecurrente(COMIDA_AJENA_RECURRENTE, PLAN_AJENO_ID, 'Ajena')]
  state.alimentos = {
    [COMIDA_RECURRENTE]: ingredientesDe(COMIDA_RECURRENTE),
    [COMIDA_RECURRENTE_2]: ingredientesDe(COMIDA_RECURRENTE_2),
    [COMIDA_AJENA_RECURRENTE]: ingredientesDe(COMIDA_AJENA_RECURRENTE),
  }

  const h = loadHandlers(state)
  const r = await h.materializar(makeRequest(state), ctx)
  check(`${etiqueta} → materializar 200`, r.status === 200)
  const body = await r.json()
  check(`${etiqueta} → materializar ok`, body.ok === true)
  check(`${etiqueta} → materializadas = 2`, body.materializadas === 2)

  const insertsComidas = mutacionesDe(state, 'comidas', 'insert')
  check(`${etiqueta} → 2 inserts de comidas (uno por recurrente)`, insertsComidas.length === 2)

  // Cada insert debe contener exactamente 7 copias, todas del plan propio.
  const todasFilas = insertsComidas.flatMap(m => (Array.isArray(m.rows) ? m.rows : [m.rows])) as Array<Record<string, unknown>>
  check(`${etiqueta} → 14 filas insertadas (2×7)`, todasFilas.length === 14)
  check(`${etiqueta} → todas las filas son del plan propio`, todasFilas.every(f => f.plan_id === PLAN_ID))
  check(`${etiqueta} → ninguna fila del plan ajeno`, todasFilas.every(f => f.plan_id !== PLAN_AJENO_ID))
  const diasInsertados = new Set(todasFilas.map(f => f.dia_semana))
  check(`${etiqueta} → cubre los 7 días`, DIAS.every(d => diasInsertados.has(d)))

  // Inserta ingredientes para las 14 copias (2 por copia).
  const insertsAlimentos = mutacionesDe(state, 'comida_alimentos', 'insert')
  check(`${etiqueta} → 2 inserts de comida_alimentos`, insertsAlimentos.length === 2)
  const filasAlimentos = insertsAlimentos.flatMap(m => (Array.isArray(m.rows) ? m.rows : [m.rows])) as Array<Record<string, unknown>>
  check(`${etiqueta} → 28 filas de ingredientes (14×2)`, filasAlimentos.length === 28)

  // Borrado: solo las recurrentes autorizadas del plan propio.
  const deletesComidas = mutacionesDe(state, 'comidas', 'delete')
  check(`${etiqueta} → 2 deletes de comidas`, deletesComidas.length === 2)
  const idsBorrados = deletesComidas.map(m => m.filtros.find(f => f.col === 'id')?.val)
  check(`${etiqueta} → borra solo recurrentes propias`, idsBorrados.every(id => id === COMIDA_RECURRENTE || id === COMIDA_RECURRENTE_2))
  check(`${etiqueta} → no borra la recurrente ajena`, !idsBorrados.includes(COMIDA_AJENA_RECURRENTE))

  const deletesAlimentos = mutacionesDe(state, 'comida_alimentos', 'delete')
  check(`${etiqueta} → 2 deletes de comida_alimentos`, deletesAlimentos.length === 2)
  const comidaIdsAlimentosBorrados = deletesAlimentos.map(m => m.filtros.find(f => f.col === 'comida_id')?.val)
  check(`${etiqueta} → limpia ingredientes solo de recurrentes propias`, comidaIdsAlimentosBorrados.every(id => id === COMIDA_RECURRENTE || id === COMIDA_RECURRENTE_2))

  // Fixture del plan ajeno intacto.
  check(`${etiqueta} → fixture plan ajeno intacto`, state.comidasAjenas.length === 1 && state.comidasAjenas[0].id === COMIDA_AJENA_RECURRENTE)
}

// Verifica el caso feliz de mover-dia para un usuario autorizado.
async function casoMoverDiaFeliz(etiqueta: string, userId: string, perfil: { id: string; role: string } | null) {
  const state = freshState()
  state.user = { id: userId }
  state.perfil = perfil
  state.comida = { id: COMIDA_PROPIA, plan_id: PLAN_ID, dia_semana: 'Lunes' }
  state.comidasAjenas = [comidaRecurrente(COMIDA_AJENA_RECURRENTE, PLAN_AJENO_ID, 'Ajena')]

  const h = loadHandlers(state)
  const r = await h.moverDia(makeRequest(state, { comida_id: COMIDA_PROPIA, dia_semana: 'Martes' }), ctx)
  check(`${etiqueta} → mover-dia 200`, r.status === 200)

  const updates = mutacionesDe(state, 'comidas', 'update')
  check(`${etiqueta} → 1 update de comidas`, updates.length === 1)
  check(`${etiqueta} → update cambia dia_semana a Martes`, (updates[0]?.values as Record<string, unknown>)?.dia_semana === 'Martes')
  check(`${etiqueta} → update filtra por id de la comida propia`, updates[0]?.filtros.find(f => f.col === 'id')?.val === COMIDA_PROPIA)
  check(`${etiqueta} → sin deletes`, mutacionesDe(state, 'comidas', 'delete').length === 0)
  check(`${etiqueta} → fixture plan ajeno intacto`, state.comidasAjenas.length === 1)
}

// Verifica que una denegación no escribe ni parsea body.
// `sinServiceClient` solo aplica cuando la denegación ocurre ANTES de
// consultar la DB (sin sesión / error de auth). En 403/404 por propiedad es
// legítimo crear el service client para comprobar la titularidad del plan.
function checkDenegacionLimpia(
  etiqueta: string,
  state: MockState,
  opts: { sinServiceClient?: boolean } = {}
) {
  check(`${etiqueta} → cero mutaciones`, sinMutaciones(state))
  if (opts.sinServiceClient) {
    check(`${etiqueta} → no crea service client`, state.serviceClientCreado === 0)
  }
  check(`${etiqueta} → no parsea body`, state.bodyParseado === 0)
}

async function run() {
  console.log('\nT33 — Autorización comidas (materializar + mover-dia)\n')

  // --- Sin sesión -----------------------------------------------------------
  {
    const state = freshState()
    state.user = null
    const h = loadHandlers(state)
    const r1 = await h.materializar(makeRequest(state), ctx)
    const r2 = await h.moverDia(makeRequest(state, { comida_id: COMIDA_PROPIA, dia_semana: 'Lunes' }), ctx)
    check('sin sesión → materializar 401', r1.status === 401)
    check('sin sesión → mover-dia 401', r2.status === 401)
    checkDenegacionLimpia('sin sesión', state, { sinServiceClient: true })
  }

  // --- getUser error aunque user presente -----------------------------------
  {
    const state = freshState()
    state.authError = new Error('boom')
    const h = loadHandlers(state)
    const r1 = await h.materializar(makeRequest(state), ctx)
    const r2 = await h.moverDia(makeRequest(state, { comida_id: COMIDA_PROPIA, dia_semana: 'Lunes' }), ctx)
    check('getUser error → materializar 401', r1.status === 401)
    check('getUser error → mover-dia 401', r2.status === 401)
    checkDenegacionLimpia('getUser error', state, { sinServiceClient: true })
  }

  // --- Cliente ajeno --------------------------------------------------------
  {
    const state = freshState()
    state.user = { id: CLIENTE_AJENO }
    const h = loadHandlers(state)
    const r1 = await h.materializar(makeRequest(state), ctx)
    const r2 = await h.moverDia(makeRequest(state, { comida_id: COMIDA_PROPIA, dia_semana: 'Lunes' }), ctx)
    check('cliente ajeno → materializar 403', r1.status === 403)
    check('cliente ajeno → mover-dia 403', r2.status === 403)
    checkDenegacionLimpia('cliente ajeno', state)
  }

  // --- Coach ajeno ----------------------------------------------------------
  {
    const state = freshState()
    state.user = { id: COACH_AJENO }
    const h = loadHandlers(state)
    const r1 = await h.materializar(makeRequest(state), ctx)
    const r2 = await h.moverDia(makeRequest(state, { comida_id: COMIDA_PROPIA, dia_semana: 'Lunes' }), ctx)
    check('coach ajeno → materializar 403', r1.status === 403)
    check('coach ajeno → mover-dia 403', r2.status === 403)
    checkDenegacionLimpia('coach ajeno', state)
  }

  // --- Coach propietario pero rol NO coach → 403 (ambas rutas) --------------
  {
    const state = freshState()
    state.user = { id: COACH_PROPIETARIO }
    state.perfil = { id: COACH_PROPIETARIO, role: 'cliente' }
    const h = loadHandlers(state)
    const r1 = await h.materializar(makeRequest(state), ctx)
    const r2 = await h.moverDia(makeRequest(state, { comida_id: COMIDA_PROPIA, dia_semana: 'Lunes' }), ctx)
    check('rol != coach → materializar 403', r1.status === 403)
    check('rol != coach → mover-dia 403', r2.status === 403)
    checkDenegacionLimpia('rol != coach', state)
  }

  // --- Coach propietario, perfil null → 403 (ambas rutas) -------------------
  {
    const state = freshState()
    state.user = { id: COACH_PROPIETARIO }
    state.perfil = null
    const h = loadHandlers(state)
    const r1 = await h.materializar(makeRequest(state), ctx)
    const r2 = await h.moverDia(makeRequest(state, { comida_id: COMIDA_PROPIA, dia_semana: 'Lunes' }), ctx)
    check('perfil null → materializar 403', r1.status === 403)
    check('perfil null → mover-dia 403', r2.status === 403)
    checkDenegacionLimpia('perfil null', state)
  }

  // --- Coach propietario, error perfil → 403 (ambas rutas) ------------------
  {
    const state = freshState()
    state.user = { id: COACH_PROPIETARIO }
    state.perfilError = new Error('db down')
    const h = loadHandlers(state)
    const r1 = await h.materializar(makeRequest(state), ctx)
    const r2 = await h.moverDia(makeRequest(state, { comida_id: COMIDA_PROPIA, dia_semana: 'Lunes' }), ctx)
    check('error perfil → materializar 403', r1.status === 403)
    check('error perfil → mover-dia 403', r2.status === 403)
    checkDenegacionLimpia('error perfil', state)
  }

  // --- Error consulta plan → 404 (ambas rutas) ------------------------------
  {
    const state = freshState()
    state.planError = new Error('db down')
    const h = loadHandlers(state)
    const r1 = await h.materializar(makeRequest(state), ctx)
    const r2 = await h.moverDia(makeRequest(state, { comida_id: COMIDA_PROPIA, dia_semana: 'Lunes' }), ctx)
    check('error consulta plan → materializar 404', r1.status === 404)
    check('error consulta plan → mover-dia 404', r2.status === 404)
    checkDenegacionLimpia('error consulta plan', state)
  }

  // --- Plan inexistente → 404 (ambas rutas) ---------------------------------
  {
    const state = freshState()
    state.plan = null
    const h = loadHandlers(state)
    const r1 = await h.materializar(makeRequest(state), ctx)
    const r2 = await h.moverDia(makeRequest(state, { comida_id: COMIDA_PROPIA, dia_semana: 'Lunes' }), ctx)
    check('plan inexistente → materializar 404', r1.status === 404)
    check('plan inexistente → mover-dia 404', r2.status === 404)
    checkDenegacionLimpia('plan inexistente', state)
  }

  // --- Plan inactivo (activo=false, el filtro .eq('activo', true) no casa) --
  {
    const state = freshState()
    state.plan = { id: PLAN_ID, cliente_id: CLIENTE_ID, codigo_publico: CODIGO, activo: false }
    const h = loadHandlers(state)
    const r1 = await h.materializar(makeRequest(state), ctx)
    const r2 = await h.moverDia(makeRequest(state, { comida_id: COMIDA_PROPIA, dia_semana: 'Lunes' }), ctx)
    check('plan inactivo → materializar 404', r1.status === 404)
    check('plan inactivo → mover-dia 404', r2.status === 404)
    checkDenegacionLimpia('plan inactivo', state)
  }

  // --- Código equivocado (codigo_publico no casa) → 404 --------------------
  {
    const state = freshState()
    state.plan = { id: PLAN_ID, cliente_id: CLIENTE_ID, codigo_publico: 'OTRO_CODIGO', activo: true }
    const h = loadHandlers(state)
    const r1 = await h.materializar(makeRequest(state), ctx)
    const r2 = await h.moverDia(makeRequest(state, { comida_id: COMIDA_PROPIA, dia_semana: 'Lunes' }), ctx)
    check('código equivocado → materializar 404', r1.status === 404)
    check('código equivocado → mover-dia 404', r2.status === 404)
    checkDenegacionLimpia('código equivocado', state)
  }

  // --- Error consulta cliente → 403 fail-closed (ambas rutas) ---------------
  {
    const state = freshState()
    state.clienteError = new Error('db down')
    const h = loadHandlers(state)
    const r1 = await h.materializar(makeRequest(state), ctx)
    const r2 = await h.moverDia(makeRequest(state, { comida_id: COMIDA_PROPIA, dia_semana: 'Lunes' }), ctx)
    check('error consulta cliente → materializar 403', r1.status === 403)
    check('error consulta cliente → mover-dia 403', r2.status === 403)
    checkDenegacionLimpia('error consulta cliente', state)
  }

  // --- Cliente null → 403 fail-closed (ambas rutas) -------------------------
  {
    const state = freshState()
    state.cliente = null
    const h = loadHandlers(state)
    const r1 = await h.materializar(makeRequest(state), ctx)
    const r2 = await h.moverDia(makeRequest(state, { comida_id: COMIDA_PROPIA, dia_semana: 'Lunes' }), ctx)
    check('cliente null → materializar 403', r1.status === 403)
    check('cliente null → mover-dia 403', r2.status === 403)
    checkDenegacionLimpia('cliente null', state)
  }

  // --- Mover comida ajena → 404 ---------------------------------------------
  {
    const state = freshState()
    state.user = { id: CLIENTE_PROPIO }
    state.comida = { id: COMIDA_AJENA, plan_id: PLAN_AJENO_ID, dia_semana: 'Lunes' }
    const h = loadHandlers(state)
    const r = await h.moverDia(makeRequest(state, { comida_id: COMIDA_AJENA, dia_semana: 'Martes' }), ctx)
    check('mover comida ajena → 404', r.status === 404)
    check('mover comida ajena → cero mutaciones', sinMutaciones(state))
  }

  // --- Mover comida recurrente → 409 ----------------------------------------
  {
    const state = freshState()
    state.user = { id: CLIENTE_PROPIO }
    state.comida = { id: COMIDA_RECURRENTE, plan_id: PLAN_ID, dia_semana: null }
    const h = loadHandlers(state)
    const r = await h.moverDia(makeRequest(state, { comida_id: COMIDA_RECURRENTE, dia_semana: 'Martes' }), ctx)
    check('mover comida recurrente → 409', r.status === 409)
    check('mover comida recurrente → cero mutaciones', sinMutaciones(state))
  }

  // --- Parámetros inválidos → 400 -------------------------------------------
  {
    const state = freshState()
    state.user = { id: CLIENTE_PROPIO }
    const h = loadHandlers(state)
    const r = await h.moverDia(makeRequest(state, { comida_id: COMIDA_PROPIA, dia_semana: 'Finde' }), ctx)
    check('día inválido → 400', r.status === 400)
    check('día inválido → cero mutaciones', sinMutaciones(state))
  }

  // --- registrar-comida: comida ajena → 404 sin mutación --------------------
  {
    const state = freshState()
    state.user = { id: CLIENTE_PROPIO }
    // La comida consultada pertenece a otro plan: el filtro id+plan_id no casa.
    state.comida = { id: COMIDA_AJENA, plan_id: PLAN_AJENO_ID, dia_semana: 'Lunes' }
    const h = loadHandlers(state)
    const r = await h.registrarComidaPost(
      makeRequest(state, { comida_id: COMIDA_AJENA, estado: 'completada' }),
      ctx
    )
    check('registrar-comida comida ajena → 404', r.status === 404)
    check('registrar-comida comida ajena → cero mutaciones', sinMutaciones(state))
  }

  // --- registrar-comida DELETE: comida ajena → 404 sin mutación -------------
  {
    const state = freshState()
    state.user = { id: CLIENTE_PROPIO }
    state.comida = { id: COMIDA_AJENA, plan_id: PLAN_AJENO_ID, dia_semana: 'Lunes' }
    const h = loadHandlers(state)
    const r = await h.registrarComidaDelete(
      makeRequest(state, { comida_id: COMIDA_AJENA }),
      ctx
    )
    check('registrar-comida DELETE comida ajena → 404', r.status === 404)
    check('registrar-comida DELETE comida ajena → cero mutaciones', sinMutaciones(state))
  }

  // --- registrar-comida: error consulta comida → 404 sin mutación -----------
  {
    const state = freshState()
    state.user = { id: CLIENTE_PROPIO }
    state.comidaError = new Error('db down')
    const h = loadHandlers(state)
    const r = await h.registrarComidaPost(
      makeRequest(state, { comida_id: COMIDA_PROPIA, estado: 'completada' }),
      ctx
    )
    check('registrar-comida error consulta comida → 404', r.status === 404)
    check('registrar-comida error consulta comida → cero mutaciones', sinMutaciones(state))
  }

  // --- Casos felices: materializar (cliente y coach) ------------------------
  await casoMaterializarFeliz('cliente propio', CLIENTE_PROPIO, { id: CLIENTE_PROPIO, role: 'cliente' })
  await casoMaterializarFeliz('coach propietario', COACH_PROPIETARIO, { id: COACH_PROPIETARIO, role: 'coach' })

  // --- Casos felices: mover-dia (cliente y coach) ---------------------------
  await casoMoverDiaFeliz('cliente propio', CLIENTE_PROPIO, { id: CLIENTE_PROPIO, role: 'cliente' })
  await casoMoverDiaFeliz('coach propietario', COACH_PROPIETARIO, { id: COACH_PROPIETARIO, role: 'coach' })

  console.log(`\nResultado: ${passed} pasadas, ${failed} fallidas\n`)
  if (failed > 0) process.exit(1)
}

run().catch(err => {
  console.error('Error en el runner:', err)
  process.exit(1)
})
