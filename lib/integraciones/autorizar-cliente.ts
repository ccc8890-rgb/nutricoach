// Autorización inyectable para endpoints de integraciones por cliente.
// Reglas:
//  - Sesión requerida (userId no nulo).
//  - Acceso permitido si el cliente es el propio (profile_id === userId)
//    o si el usuario es coach del cliente (coach_id === userId) y su rol es 'coach'.
//  - Si se pasan `codigo` y `clienteIdParam`, ambos deben resolver al MISMO cliente.
//  - Si solo se pasa `codigo`, se resuelve el cliente por código.
//  - Si solo se pasa `clienteIdParam`, se resuelve por id.
//  - Si no se pasa ninguno, se hace fallback al cliente propio del usuario.
//  - Cualquier error del lookup deniega el acceso (fail-closed).

export interface ClienteLookup {
  porId(clienteId: string): Promise<ClienteRow | null>
  porCodigo(codigo: string): Promise<ClienteRow | null>
  porProfileId(userId: string): Promise<ClienteRow | null>
  rolDePerfil(userId: string): Promise<string | null>
}

export interface ClienteRow {
  id: string
  coach_id: string | null
  profile_id: string | null
}

export interface AutorizarInput {
  userId: string | null
  clienteIdParam?: string | null
  codigo?: string | null
}

export type AutorizarResult =
  | { ok: true; clienteId: string }
  | { ok: false; status: number; error: string }

const DENEGADO: AutorizarResult = {
  ok: false,
  status: 403,
  error: 'No autorizado',
}

// Comprueba que el usuario puede operar sobre el cliente dado.
async function puedeAcceder(
  userId: string,
  cliente: ClienteRow,
  lookup: ClienteLookup
): Promise<boolean> {
  if (cliente.profile_id && cliente.profile_id === userId) return true
  if (cliente.coach_id && cliente.coach_id === userId) {
    const rol = await lookup.rolDePerfil(userId)
    return rol === 'coach'
  }
  return false
}

export async function autorizarCliente(
  input: AutorizarInput,
  lookup: ClienteLookup
): Promise<AutorizarResult> {
  const { userId, clienteIdParam, codigo } = input

  // Sesión requerida.
  if (!userId) {
    return { ok: false, status: 401, error: 'No autenticado' }
  }

  try {
    let cliente: ClienteRow | null = null

    if (clienteIdParam && codigo) {
      // Ambos presentes: deben coincidir en el mismo cliente.
      const [porId, porCodigo] = await Promise.all([
        lookup.porId(clienteIdParam),
        lookup.porCodigo(codigo),
      ])
      if (!porId || !porCodigo || porId.id !== porCodigo.id) {
        return DENEGADO
      }
      cliente = porId
    } else if (codigo) {
      cliente = await lookup.porCodigo(codigo)
    } else if (clienteIdParam) {
      cliente = await lookup.porId(clienteIdParam)
    } else {
      // Fallback: cliente propio del usuario.
      cliente = await lookup.porProfileId(userId)
    }

    if (!cliente) return DENEGADO

    const autorizado = await puedeAcceder(userId, cliente, lookup)
    if (!autorizado) return DENEGADO

    return { ok: true, clienteId: cliente.id }
  } catch {
    // Fail-closed: cualquier error del lookup deniega.
    return DENEGADO
  }
}
