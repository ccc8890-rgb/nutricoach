// lib/metodos/constantes.ts
// Vocabularios cerrados de la biblioteca de métodos del coach. Los mismos valores están en los check de
// supabase/migrations/20261027120000_biblioteca_metodos.sql: si cambias uno, cambia el otro.
import type { TipoBloqueSesion } from '@/lib/training/session-blocks'

export const TIPOS_METODO = ['sesion', 'principio', 'tecnica'] as const
export const MODALIDADES = ['fuerza', 'running', 'hyrox', 'funcional', 'bici', 'natacion', 'movilidad', 'pliometria'] as const
export const NIVELES = ['principiante', 'intermedio', 'avanzado'] as const
export const OBJETIVOS = ['fuerza', 'hipertrofia', 'resistencia', 'potencia', 'movilidad', 'perdida_grasa', 'rendimiento'] as const
export const MATERIALES = ['barra', 'mancuernas', 'kettlebell', 'maquinas', 'poleas', 'banco', 'trx', 'gomas', 'cinta', 'pista', 'bici', 'remo', 'skierg', 'trineo', 'sin_material'] as const
export const CONFIANZAS = ['anecdotico', 'experto', 'respaldado'] as const
export const ESTADOS_METODO = ['en_revision', 'con_agente', 'aprobada', 'descartada'] as const
export const TIPOS_EVENTO_METODO = ['creada', 'editada', 'aprobada', 'descartada', 'reabierta', 'ia_activada', 'ia_desactivada'] as const

export type TipoMetodo = typeof TIPOS_METODO[number]
export type Modalidad = typeof MODALIDADES[number]
export type Nivel = typeof NIVELES[number]
export type Objetivo = typeof OBJETIVOS[number]
export type Material = typeof MATERIALES[number]
export type Confianza = typeof CONFIANZAS[number]
export type EstadoMetodo = typeof ESTADOS_METODO[number]
export type TipoEventoMetodo = typeof TIPOS_EVENTO_METODO[number]

/** Texto en español de cada valor de los vocabularios (para pantallas y filtros). */
export const ETIQUETA: Record<string, string> = {
  sesion: 'Sesión', principio: 'Principio', tecnica: 'Técnica',
  fuerza: 'Fuerza', running: 'Running', hyrox: 'Hyrox', funcional: 'Funcional', bici: 'Bici', natacion: 'Natación', movilidad: 'Movilidad', pliometria: 'Pliometría',
  principiante: 'Principiante', intermedio: 'Intermedio', avanzado: 'Avanzado',
  hipertrofia: 'Hipertrofia', resistencia: 'Resistencia', potencia: 'Potencia', perdida_grasa: 'Pérdida de grasa', rendimiento: 'Rendimiento',
  barra: 'Barra', mancuernas: 'Mancuernas', kettlebell: 'Kettlebell', maquinas: 'Máquinas', poleas: 'Poleas', banco: 'Banco', trx: 'TRX', gomas: 'Gomas',
  cinta: 'Cinta', pista: 'Pista', remo: 'Remo', skierg: 'SkiErg', trineo: 'Trineo', sin_material: 'Sin material',
  anecdotico: 'Anecdótico', experto: 'Experto', respaldado: 'Respaldado por estudio',
  en_revision: 'Por revisar', con_agente: 'Con el agente', aprobada: 'Aprobada', descartada: 'Descartada',
}

export interface EjercicioMetodo {
  texto_original: string
  /** Se rellena al usar la ficha (Fase 3); mientras tanto es null. */
  ejercicio_id: string | null
  series: number | null
  reps: string | null
  duracion_seg: number | null
  pausa_seg: number | null
  intensidad: string | null
  nota: string | null
}

export interface BloqueMetodo {
  tipo: TipoBloqueSesion
  ejercicios: EjercicioMetodo[]
}

/** Campos que Carlos puede escribir (alta y edición). */
export interface CamposMetodo {
  tipo: TipoMetodo
  titulo: string
  resumen: string | null
  modalidad: Modalidad
  objetivo: Objetivo | null
  nivel: Nivel | null
  material: Material[]
  duracion_min: number | null
  estructura: BloqueMetodo[]
  autor: string | null
  plataforma: string | null
  url_origen: string | null
  video_url: string | null
  miniatura_url: string | null
  confianza: Confianza
  notas_coach: string | null
  tags: string[]
}

/** Fila completa de `metodos`. */
export interface Metodo extends CamposMetodo {
  id: string
  coach_id: string
  estado: EstadoMetodo
  disponible_ia: boolean
  huella: string
  created_at: string
  updated_at: string
}
