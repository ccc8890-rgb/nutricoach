export type TipoSesion = 'hibrido' | 'carrera' | 'mixto'

const ETIQUETAS_TIPO_SESION: Record<TipoSesion, string> = {
  carrera: 'CARRERA',
  hibrido: 'HÍBRIDA',
  mixto: 'MIXTA',
}

export function etiquetaTipoSesion(tipo: TipoSesion) {
  return ETIQUETAS_TIPO_SESION[tipo]
}

export function tituloSesionSinModalidad(nombre: string, tipo: TipoSesion) {
  const prefijo = tipo === 'hibrido'
    ? 'h(?:í|i)brid[oa](?:\\s+[a-z0-9])?'
    : tipo === 'carrera'
      ? 'carrera'
      : 'mixt[oa]'
  const limpio = nombre
    .replace(new RegExp(`^\\s*${prefijo}\\s*[:\\-\\u2013\\u2014]\\s*`, 'i'), '')
    .trim()
  return limpio || nombre.trim()
}
