import { CLAVES_MARCADORES_ANALITICA } from './analiticas-marcadores'

export type ValoresAnalitica = Record<string, number>

export type ResultadoValidacionAnalitica =
  | { ok: true; valores: Record<string, number | null>; notas?: string }
  | { ok: false; error: string }

export function validarEdicionAnalitica(body: unknown): ResultadoValidacionAnalitica {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Datos de analítica inválidos' }
  const datos = body as Record<string, unknown>
  if (!datos.valores || typeof datos.valores !== 'object' || Array.isArray(datos.valores)) return { ok: false, error: 'Los valores de la analítica son obligatorios' }
  if (datos.notas !== undefined && (typeof datos.notas !== 'string' || datos.notas.length > 1000)) return { ok: false, error: 'Las notas no pueden superar 1000 caracteres' }

  const valores: Record<string, number | null> = {}
  for (const [clave, valor] of Object.entries(datos.valores as Record<string, unknown>)) {
    if (!CLAVES_MARCADORES_ANALITICA.has(clave)) return { ok: false, error: `Marcador no permitido: ${clave}` }
    if (valor === null) {
      valores[clave] = null
      continue
    }
    if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0 || valor >= 100000) return { ok: false, error: `Valor inválido para ${clave}` }
    valores[clave] = valor
  }
  return { ok: true, valores, ...(datos.notas !== undefined ? { notas: datos.notas as string } : {}) }
}

export function fusionarValoresAnalitica(existentes: unknown, cambios: Record<string, number | null>): ValoresAnalitica {
  const fusionados: ValoresAnalitica = {}
  if (existentes && typeof existentes === 'object' && !Array.isArray(existentes)) {
    for (const [clave, valor] of Object.entries(existentes as Record<string, unknown>)) {
      const numero = typeof valor === 'number' ? valor : typeof valor === 'string' ? Number(valor.replace(',', '.')) : NaN
      if (Number.isFinite(numero) && numero > 0 && numero < 100000) fusionados[clave] = numero
    }
  }
  for (const [clave, valor] of Object.entries(cambios)) {
    if (valor === null) delete fusionados[clave]
    else fusionados[clave] = valor
  }
  return fusionados
}
