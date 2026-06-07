export type RolIngrediente =
  | 'carbohidrato_base'
  | 'proteina_principal'
  | 'proteina_secundaria'
  | 'grasa_saludable'
  | 'verdura_volumen'
  | 'fruta_complemento'
  | 'salsa_condimento'
  | 'lacteo_base'
  | 'especias_aromaticos'

export type Tecnica =
  | 'plancha'
  | 'horno'
  | 'vapor'
  | 'guisado'
  | 'estofado'
  | 'salteado'
  | 'crudo'
  | 'plancha + vapor'
  | 'horno + plancha'

export type Digestibilidad = 'alta' | 'media' | 'baja'
export type NivelMacro = 'bajo' | 'medio' | 'alto'
export type FodmapNivel = 'bajos' | 'medios' | 'altos'

export type PerfilEsqueleto = 'perdida_grasa' | 'rendimiento' | 'patologia'

export type IngredienteEsqueleto = {
  rol: RolIngrediente
  nombre: string
  gramos: number
  esFijo?: boolean // si true, no se sustituye aunque el cliente rechace el alimento
}

export type MetadatosEsqueleto = {
  momentos: string[]          // ['pre_entreno', 'tapering', 'base', 'post_entreno', 'carga_cho', 'recuperacion', 'deficit', 'entreno', 'descanso']
  deportes: string[]          // ['running', 'ciclismo', 'hyrox', 'fuerza', 'natacion', 'endurance', 'todos']
  objetivos: string[]         // ['perdida_grasa', 'rendimiento', 'salud', 'ganancia_muscular']
  digestibilidad: Digestibilidad
  nivel_carbohidrato: NivelMacro
  nivel_proteina: NivelMacro
  nivel_grasa: NivelMacro
  patologias_compatibles: string[]  // ['resistencia_insulina', 'colon_irritable', 'hipotiroidismo', 'dislipidemia', 'ninguna']
  patologias_incompatibles: string[] // rechazar si el cliente tiene estas
  fodmaps: FodmapNivel
  adaptable_gramos: boolean
  timing_ideal: string[]      // ['manana', 'mediodia', 'tarde', 'noche']
}

export type SustitucionesPorRol = Partial<Record<RolIngrediente, string[]>>

export type Esqueleto = {
  id: string
  perfil: PerfilEsqueleto
  tipoPlato: string           // 'Desayuno' | 'Comida' | 'Cena' | 'Merienda' | 'Snack' | 'Almuerzo'
  ingredientes: IngredienteEsqueleto[]
  tecnica: Tecnica
  metadatos: MetadatosEsqueleto
  sustituciones: SustitucionesPorRol
}
