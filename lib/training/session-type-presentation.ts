export type TipoSesion = 'hibrido' | 'carrera' | 'mixto'

const ETIQUETAS_TIPO_SESION: Record<TipoSesion, string> = {
  carrera: 'CARRERA',
  hibrido: 'HÍBRIDA',
  mixto: 'MIXTA',
}

export function etiquetaTipoSesion(tipo: TipoSesion) {
  return ETIQUETAS_TIPO_SESION[tipo]
}
