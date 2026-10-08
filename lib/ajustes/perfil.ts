type Resultado = { ok: true; cambios: Record<string, string | null> } | { ok: false; error: string }

const MAX_TEXTO = 80
const TELEFONO_RE = /^[+()\d\s.-]{6,20}$/

// Solo estos campos se pueden cambiar desde Ajustes. El rol, el correo y el id nunca.
export function limpiarPerfil(body: unknown): Resultado {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Datos no válidos' }
  const b = body as Record<string, unknown>
  const cambios: Record<string, string | null> = {}

  if ('nombre' in b) {
    if (typeof b.nombre !== 'string') return { ok: false, error: 'Nombre no válido' }
    const nombre = b.nombre.trim()
    if (!nombre || nombre.length > MAX_TEXTO) return { ok: false, error: 'El nombre es obligatorio (máximo 80 caracteres)' }
    cambios.nombre = nombre
  }

  if ('apellidos' in b) {
    if (typeof b.apellidos !== 'string') return { ok: false, error: 'Apellidos no válidos' }
    const apellidos = b.apellidos.trim()
    if (apellidos.length > MAX_TEXTO) return { ok: false, error: 'Los apellidos admiten máximo 80 caracteres' }
    cambios.apellidos = apellidos || null
  }

  if ('telefono' in b) {
    if (typeof b.telefono !== 'string') return { ok: false, error: 'Teléfono no válido' }
    const telefono = b.telefono.trim()
    if (telefono && !TELEFONO_RE.test(telefono)) return { ok: false, error: 'Teléfono no válido' }
    cambios.telefono = telefono || null
  }

  return { ok: true, cambios }
}
