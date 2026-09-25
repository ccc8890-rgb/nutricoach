import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { aplicarSesionesCompletadas, crearClienteWeekSummary } from '../lib/training/client-week'

const summary = crearClienteWeekSummary({
  sesiones: [
    { id: 's1', nombre: 'Fuerza full body', dia_semana: 'Lunes', duracion_estimada_min: 55, ejercicios_count: 6, completada: true, esHoy: false },
    { id: 's2', nombre: 'Hyrox engine', dia_semana: 'Miércoles', duracion_estimada_min: 45, ejercicios_count: 5, completada: false, esHoy: true },
    { id: 's3', nombre: 'Zona 2', dia_semana: 'Viernes', duracion_estimada_min: null, ejercicios_count: 1, completada: false, esHoy: false },
  ],
})

assert.equal(summary.totalSesiones, 3)
assert.equal(summary.completadas, 1)
assert.equal(summary.pendientes, 2)
assert.equal(summary.progresoPct, 33)
assert.equal(summary.minutosPlanificados, 100)
assert.equal(summary.estadoSemana, 'en_curso')
assert.equal(summary.sesionPrincipal?.id, 's2')
assert.equal(summary.mensajeCliente, 'Hoy toca Hyrox engine. Ejecuta con control y registra sensaciones al terminar.')

const empty = crearClienteWeekSummary({ sesiones: [] })
assert.equal(empty.estadoSemana, 'sin_plan')
assert.equal(empty.mensajeCliente, 'Tu coach todavía no ha cargado sesiones para esta semana.')

const sesionesPersistidas = aplicarSesionesCompletadas([
  { id: 's1', nombre: 'Fuerza full body', dia_semana: 'Lunes', duracion_estimada_min: 55, ejercicios_count: 6, completada: false, esHoy: false },
  { id: 's2', nombre: 'Hyrox engine', dia_semana: 'Miércoles', duracion_estimada_min: 45, ejercicios_count: 5, completada: false, esHoy: true },
], ['s2'])
assert.equal(sesionesPersistidas[0].completada, false)
assert.equal(sesionesPersistidas[1].completada, true)

console.log('training client week tests passed')

// ---------------------------------------------------------------------------
// Pruebas de integración para GET app/api/entrenos/sesiones-plan/route.ts
// Sin red ni DB real: se transpila el route a CommonJS y se ejecuta con
// require fake para next/server y @/lib/supabase-server.
//
// Contrato real del route (verificado leyendo app/api/entrenos/sesiones-plan/route.ts):
//   - Query param: plan_id (NO clienteId)
//   - Resuelve cliente vía admin.from('clientes').eq('profile_id', user.id).single()
//   - Verifica ownership vía admin.from('planes_entrenamiento').eq('id', plan_id).single()
//   - Sesiones: admin.from('sesiones_entrenamiento').eq('plan_id', plan_id)
//   - Ejercicios por sesión: admin.from('sesion_ejercicios').in('sesion_id', sesIds)
//   - Registros: admin.from('registros_sets') con eq('fecha', hoy) para completadas_hoy
//     y gte/lt lunes-domingo (UTC) para registradas_semana
//   - Respuesta: { sesiones, completadas_hoy: string[], registradas_semana: string[] }
//     (arrays de IDs de SESIÓN, no de registro)
// ---------------------------------------------------------------------------

type Row = Record<string, any>

class FakeQuery {
  table: string
  filters: Array<{ op: string; col: string; val: any }> = []
  selected: string | null = null
  wantsSingle = false
  constructor(table: string) {
    this.table = table
  }
  select(cols?: string) {
    this.selected = cols ?? '*'
    return this
  }
  eq(col: string, val: any) {
    this.filters.push({ op: 'eq', col, val })
    return this
  }
  gte(col: string, val: any) {
    this.filters.push({ op: 'gte', col, val })
    return this
  }
  lt(col: string, val: any) {
    this.filters.push({ op: 'lt', col, val })
    return this
  }
  in(col: string, val: any[]) {
    this.filters.push({ op: 'in', col, val })
    return this
  }
  order() {
    return this
  }
  limit() {
    return this
  }
  maybeSingle() {
    this.wantsSingle = true
    return this
  }
  single() {
    this.wantsSingle = true
    return this
  }
  then(resolve: (v: any) => any, reject?: (e: any) => any) {
    return Promise.resolve(this._execute()).then(resolve, reject)
  }
  _execute() {
    const rows = (this._rows() ?? []).filter((r) => this._match(r))
    if (this.wantsSingle) {
      return { data: rows[0] ?? null, error: null }
    }
    return { data: rows, error: null }
  }
  _rows(): Row[] {
    return []
  }
  _match(r: Row): boolean {
    for (const f of this.filters) {
      const v = r[f.col]
      if (f.op === 'eq' && v !== f.val) return false
      if (f.op === 'gte' && !(v >= f.val)) return false
      if (f.op === 'lt' && !(v < f.val)) return false
      if (f.op === 'in' && !f.val.includes(v)) return false
    }
    return true
  }
}

class FakeDb {
  tables: Record<string, Row[]>
  calls: Array<{ table: string; filters: Array<{ op: string; col: string; val: any }>; selected: string | null }> = []
  constructor(tables: Record<string, Row[]>) {
    this.tables = tables
  }
  from(table: string) {
    const db = this
    const q = new FakeQuery(table)
    q._rows = () => db.tables[table] ?? []
    const origThen = q.then.bind(q)
    q.then = (resolve: any, reject: any) => {
      db.calls.push({ table, filters: q.filters.slice(), selected: q.selected })
      return origThen(resolve, reject)
    }
    return q
  }
}

function loadRoute() {
  const routePath = path.resolve(__dirname, '..', 'app', 'api', 'entrenos', 'sesiones-plan', 'route.ts')
  const source = fs.readFileSync(routePath, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText

  const moduleObj = { exports: {} as any }
  const requireFake = (id: string) => {
    if (id === 'next/server') {
      return {
        NextResponse: {
          json: (body: any, init?: any) => {
            const status = init?.status ?? 200
            return {
              status,
              body,
              async json() {
                return body
              },
            }
          },
        },
      }
    }
    if (id === '@/lib/supabase-server') {
      // Wrappers estables: reenvían a __supabaseServerFake en el momento de
      // la LLAMADA, no en el momento del require (el módulo se carga una
      // sola vez, pero cada test reemplaza el fake antes de invocar GET).
      return {
        createApiSupabase: (...args: any[]) =>
          (globalThis as any).__supabaseServerFake.createApiSupabase(...args),
        createServiceSupabase: (...args: any[]) =>
          (globalThis as any).__supabaseServerFake.createServiceSupabase(...args),
      }
    }
    throw new Error('require inesperado: ' + id)
  }

  const fn = new Function('exports', 'require', 'module', '__dirname', '__filename', transpiled)
  fn(moduleObj.exports, requireFake, moduleObj, path.dirname(routePath), routePath)
  return moduleObj.exports
}

function makeSupabaseFake(opts: { user: any; db: FakeDb; serviceDb?: FakeDb }) {
  const auth = {
    async getUser() {
      return { data: { user: opts.user }, error: null }
    },
  }
  const client = {
    auth,
    from: (t: string) => opts.db.from(t),
  }
  const service = {
    from: (t: string) => (opts.serviceDb ?? opts.db).from(t),
  }
  return {
    createApiSupabase: (_req?: any) => client,
    createServiceSupabase: () => service,
  }
}

function freezeDate(iso: string) {
  const originalDate = Date
  const fixedNow = new Date(iso)
  class FrozenDate extends originalDate {
    constructor(...args: any[]) {
      if (args.length === 0) {
        super(fixedNow.getTime())
      } else {
        // @ts-ignore
        super(...args)
      }
    }
    static now() {
      return fixedNow.getTime()
    }
  }
  ;(globalThis as any).Date = FrozenDate
  return () => {
    ;(globalThis as any).Date = originalDate
  }
}

async function run() {
  const route = loadRoute()
  assert.equal(typeof route.GET, 'function', 'GET debe exportarse')

  // 1) GET anónimo -> 401 sin llamadas a service
  {
    const db = new FakeDb({})
    const serviceDb = new FakeDb({})
    ;(globalThis as any).__supabaseServerFake = makeSupabaseFake({ user: null, db, serviceDb })
    const res = await route.GET(new Request('http://localhost/api/entrenos/sesiones-plan'))
    assert.equal(res.status, 401)
    assert.equal(serviceDb.calls.length, 0, 'no debe consultar service si no hay usuario')
  }

  // 2) Plan ajeno -> 403 sin consultar sesiones
  {
    const serviceDb = new FakeDb({
      clientes: [{ id: 'cliente-1', profile_id: 'user-1' }],
      planes_entrenamiento: [{ id: 'p1', cliente_id: 'cliente-ajeno' }],
      sesiones_entrenamiento: [{ id: 's1', plan_id: 'p1', nombre: 'Fuerza', dia_semana: 'Lunes', orden: 1 }],
    })
    ;(globalThis as any).__supabaseServerFake = makeSupabaseFake({
      user: { id: 'user-1' },
      db: serviceDb,
      serviceDb,
    })
    const res = await route.GET(new Request('http://localhost/api/entrenos/sesiones-plan?plan_id=p1'))
    assert.equal(res.status, 403)
    const sesionesCalls = serviceDb.calls.filter((c) => c.table === 'sesiones_entrenamiento')
    assert.equal(sesionesCalls.length, 0, 'no debe consultar sesiones antes de validar ownership')
  }

  // 3) Propietario: registradas_semana incluye registro de ayer de esta semana,
  //    pero completadas_hoy solo incluye lo registrado hoy.
  {
    const unfreeze = freezeDate('2026-09-27T23:30:00.000Z') // domingo
    try {
      const tables = {
        clientes: [{ id: 'cliente-1', profile_id: 'user-1' }],
        planes_entrenamiento: [{ id: 'p1', cliente_id: 'cliente-1' }],
        sesiones_entrenamiento: [
          { id: 's1', plan_id: 'p1', nombre: 'Fuerza', dia_semana: 'Lunes', orden: 1 },
          { id: 's2', plan_id: 'p1', nombre: 'Zona 2', dia_semana: 'Domingo', orden: 2 },
        ],
        sesion_ejercicios: [
          { id: 'ej1', sesion_id: 's1' },
          { id: 'ej2', sesion_id: 's2' },
        ],
        registros_sets: [
          // ayer (sábado 2026-09-26) de esta semana -> cuenta en registradas_semana (s1), no en completadas_hoy
          { sesion_ejercicio_id: 'ej1', cliente_id: 'cliente-1', fecha: '2026-09-26' },
          // hoy (domingo 2026-09-27) -> completada_hoy (s2) y también registradas_semana (s2)
          { sesion_ejercicio_id: 'ej2', cliente_id: 'cliente-1', fecha: '2026-09-27' },
          // semana anterior (antes del lunes 21) -> no debe contar en ningún sitio
          { sesion_ejercicio_id: 'ej1', cliente_id: 'cliente-1', fecha: '2026-09-20' },
        ],
      }
      const serviceDb = new FakeDb(tables)
      ;(globalThis as any).__supabaseServerFake = makeSupabaseFake({
        user: { id: 'user-1' },
        db: serviceDb,
        serviceDb,
      })
      const res = await route.GET(new Request('http://localhost/api/entrenos/sesiones-plan?plan_id=p1'))
      assert.equal(res.status, 200)
      const body = await res.json()
      const registradas: string[] = body.registradas_semana ?? []
      const completadasHoy: string[] = body.completadas_hoy ?? []
      assert.ok(registradas.includes('s1'), 'debe incluir la sesión de ayer dentro de esta semana')
      assert.ok(registradas.includes('s2'), 'debe incluir la sesión de hoy dentro de esta semana')
      assert.ok(!completadasHoy.includes('s1'), 'no debe marcar como completada_hoy una sesión registrada ayer')
      assert.ok(completadasHoy.includes('s2'), 'debe marcar como completada_hoy la sesión registrada hoy')

      // Filtros exactos gte lunes UTC y lt lunes siguiente en la consulta de semana
      const regCalls = serviceDb.calls.filter((c) => c.table === 'registros_sets')
      const semanaCall = regCalls.find((c) => c.filters.some((f) => f.op === 'gte'))
      assert.ok(semanaCall, 'debe consultar registros_sets con filtro de semana (gte)')
      const gte = semanaCall!.filters.find((f) => f.op === 'gte')
      const lt = semanaCall!.filters.find((f) => f.op === 'lt')
      assert.ok(gte, 'debe aplicar gte')
      assert.ok(lt, 'debe aplicar lt')
      // lunes 2026-09-21 (semana del domingo 27)
      assert.equal(gte!.val, '2026-09-21')
      // lunes siguiente 2026-09-28
      assert.equal(lt!.val, '2026-09-28')
    } finally {
      unfreeze()
    }
  }

  // 4) Lunes siguiente cambia el rango de la semana
  {
    const unfreeze = freezeDate('2026-09-28T00:30:00.000Z') // lunes siguiente
    try {
      const tables = {
        clientes: [{ id: 'cliente-1', profile_id: 'user-1' }],
        planes_entrenamiento: [{ id: 'p1', cliente_id: 'cliente-1' }],
        sesiones_entrenamiento: [{ id: 's1', plan_id: 'p1', nombre: 'Fuerza', dia_semana: 'Lunes', orden: 1 }],
        sesion_ejercicios: [{ id: 'ej1', sesion_id: 's1' }],
        registros_sets: [] as Row[],
      }
      const serviceDb = new FakeDb(tables)
      ;(globalThis as any).__supabaseServerFake = makeSupabaseFake({
        user: { id: 'user-1' },
        db: serviceDb,
        serviceDb,
      })
      const res = await route.GET(new Request('http://localhost/api/entrenos/sesiones-plan?plan_id=p1'))
      assert.equal(res.status, 200)
      const regCalls = serviceDb.calls.filter((c) => c.table === 'registros_sets')
      const semanaCall = regCalls.find((c) => c.filters.some((f) => f.op === 'gte'))
      assert.ok(semanaCall, 'debe consultar registros_sets con filtro de semana (gte)')
      const gte = semanaCall!.filters.find((f) => f.op === 'gte')
      const lt = semanaCall!.filters.find((f) => f.op === 'lt')
      assert.equal(gte!.val, '2026-09-28')
      assert.equal(lt!.val, '2026-10-05')
    } finally {
      unfreeze()
    }
  }

  // 5) Plan sin sesiones: arrays vacíos, ninguna consulta con .in() vacío
  {
    const tables = {
      clientes: [{ id: 'cliente-1', profile_id: 'user-1' }],
      planes_entrenamiento: [{ id: 'p1', cliente_id: 'cliente-1' }],
      sesiones_entrenamiento: [] as Row[],
      sesion_ejercicios: [] as Row[],
      registros_sets: [] as Row[],
    }
    const serviceDb = new FakeDb(tables)
    ;(globalThis as any).__supabaseServerFake = makeSupabaseFake({
      user: { id: 'user-1' },
      db: serviceDb,
      serviceDb,
    })
    const res = await route.GET(new Request('http://localhost/api/entrenos/sesiones-plan?plan_id=p1'))
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.ok(Array.isArray(body.sesiones))
    assert.equal(body.sesiones.length, 0)
    assert.deepEqual(body.completadas_hoy, [])
    assert.deepEqual(body.registradas_semana, [])
    for (const call of serviceDb.calls) {
      for (const f of call.filters) {
        if (f.op === 'in') {
          assert.ok(Array.isArray(f.val) && f.val.length > 0, 'no debe usar .in con array vacío')
        }
      }
    }
    // Sin sesiones no debe llegar a consultar sesion_ejercicios ni registros_sets.
    assert.equal(serviceDb.calls.filter((c) => c.table === 'sesion_ejercicios').length, 0)
    assert.equal(serviceDb.calls.filter((c) => c.table === 'registros_sets').length, 0)
  }

  console.log('sesiones-plan route tests passed')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
