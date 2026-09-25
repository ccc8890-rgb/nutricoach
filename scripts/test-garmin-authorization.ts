// Pruebas locales de autorizarCliente con un lookup en memoria (sin red ni BD).
// Ejecutar: npx tsx scripts/test-garmin-authorization.ts

import {
  autorizarCliente,
  type ClienteLookup,
  type ClienteRow,
} from '../lib/integraciones/autorizar-cliente'

interface Fixture {
  clientes: ClienteRow[]
  roles: Record<string, string>
  codigos: Record<string, string> // codigo_publico -> cliente_id
  fallar?: boolean
}

function crearLookup(fx: Fixture): ClienteLookup {
  const talVez = () => {
    if (fx.fallar) throw new Error('lookup boom')
  }
  return {
    async porId(clienteId) {
      talVez()
      return fx.clientes.find((c) => c.id === clienteId) ?? null
    },
    async porCodigo(codigo) {
      talVez()
      const id = fx.codigos[codigo]
      if (!id) return null
      return fx.clientes.find((c) => c.id === id) ?? null
    },
    async porProfileId(userId) {
      talVez()
      return fx.clientes.find((c) => c.profile_id === userId) ?? null
    },
    async rolDePerfil(userId) {
      talVez()
      return fx.roles[userId] ?? null
    },
  }
}

let fallos = 0
let total = 0

async function caso(
  nombre: string,
  fx: Fixture,
  input: Parameters<typeof autorizarCliente>[0],
  esperado: { ok: boolean; clienteId?: string; status?: number }
) {
  total++
  const res = await autorizarCliente(input, crearLookup(fx))
  const ok =
    res.ok === esperado.ok &&
    (res.ok
      ? res.clienteId === esperado.clienteId
      : res.status === esperado.status)
  if (!ok) {
    fallos++
    console.error(`✗ ${nombre}`)
    console.error('  esperado:', esperado)
    console.error('  obtenido:', res)
  } else {
    console.log(`✓ ${nombre}`)
  }
}

async function main() {
  const clientePropio: ClienteRow = {
    id: 'c1',
    coach_id: 'coach1',
    profile_id: 'user1',
  }
  const clienteDeCoach: ClienteRow = {
    id: 'c2',
    coach_id: 'coach1',
    profile_id: 'user2',
  }
  const clienteAjeno: ClienteRow = {
    id: 'c3',
    coach_id: 'coach9',
    profile_id: 'user9',
  }

  const base: Fixture = {
    clientes: [clientePropio, clienteDeCoach, clienteAjeno],
    roles: { coach1: 'coach', user1: 'cliente', user9: 'cliente' },
    codigos: { ABC: 'c1', XYZ: 'c2', AJENO: 'c3' },
  }

  // Sesión requerida.
  await caso('sin sesión → 401', base, { userId: null }, { ok: false, status: 401 })

  // Cliente propio por fallback.
  await caso(
    'cliente propio (fallback)',
    base,
    { userId: 'user1' },
    { ok: true, clienteId: 'c1' }
  )

  // Cliente propio por id.
  await caso(
    'cliente propio por id',
    base,
    { userId: 'user1', clienteIdParam: 'c1' },
    { ok: true, clienteId: 'c1' }
  )

  // Coach accede a su cliente.
  await caso(
    'coach accede a su cliente',
    base,
    { userId: 'coach1', clienteIdParam: 'c2' },
    { ok: true, clienteId: 'c2' }
  )

  // Coach accede por código.
  await caso(
    'coach accede por código',
    base,
    { userId: 'coach1', codigo: 'XYZ' },
    { ok: true, clienteId: 'c2' }
  )

  // id + codigo coincidentes.
  await caso(
    'id + codigo coincidentes',
    base,
    { userId: 'coach1', clienteIdParam: 'c2', codigo: 'XYZ' },
    { ok: true, clienteId: 'c2' }
  )

  // id + codigo NO coincidentes → denegado.
  await caso(
    'id + codigo no coincidentes → 403',
    base,
    { userId: 'coach1', clienteIdParam: 'c1', codigo: 'XYZ' },
    { ok: false, status: 403 }
  )

  // Cliente ajeno → denegado.
  await caso(
    'cliente ajeno → 403',
    base,
    { userId: 'user1', clienteIdParam: 'c3' },
    { ok: false, status: 403 }
  )

  // coach_id propio pero rol no coach → denegado.
  await caso(
    'coach_id propio sin rol coach → 403',
    { ...base, roles: { coach1: 'cliente' } },
    { userId: 'coach1', clienteIdParam: 'c2' },
    { ok: false, status: 403 }
  )

  // Código inexistente → denegado.
  await caso(
    'código inexistente → 403',
    base,
    { userId: 'coach1', codigo: 'NOPE' },
    { ok: false, status: 403 }
  )

  // Error del lookup → denegado (fail-closed).
  await caso(
    'error lookup → 403',
    { ...base, fallar: true },
    { userId: 'user1' },
    { ok: false, status: 403 }
  )

  // Coach ajeno (no es coach del cliente) → denegado.
  await caso(
    'coach ajeno → 403',
    base,
    { userId: 'coach9', clienteIdParam: 'c2' },
    { ok: false, status: 403 }
  )

  // Cliente propio accede por su propio código.
  await caso(
    'cliente propio por código',
    base,
    { userId: 'user1', codigo: 'ABC' },
    { ok: true, clienteId: 'c1' }
  )

  // Anónimo con código válido → 401 (sesión requerida antes de resolver).
  await caso(
    'anónimo con código → 401',
    base,
    { userId: null, codigo: 'ABC' },
    { ok: false, status: 401 }
  )

  // Fallo al consultar el rol del coach → denegado (fail-closed).
  await caso(
    'fallo rol coach → 403',
    { ...base, roles: {} },
    { userId: 'coach1', clienteIdParam: 'c2' },
    { ok: false, status: 403 }
  )

  console.log(`\n${total - fallos}/${total} pruebas OK`)
  if (fallos > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
