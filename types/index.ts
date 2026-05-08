export type UserRole = 'coach' | 'cliente'

export interface Profile {
  id: string
  role: UserRole
  nombre: string
  apellidos?: string
  email?: string
  telefono?: string
  avatar_url?: string
  created_at: string
}

export interface Cliente {
  id: string
  profile_id: string
  coach_id: string
  objetivo?: 'perder_grasa' | 'ganar_musculo' | 'recomposicion' | 'mantenimiento' | 'rendimiento'
  nivel?: 'principiante' | 'intermedio' | 'avanzado'
  peso_inicial?: number
  altura?: number
  edad?: number
  sexo?: 'hombre' | 'mujer' | 'otro'
  restricciones_alimentarias?: string
  notas?: string
  activo: boolean
  created_at: string
  updated_at: string
  profile?: Profile
}

export interface Alimento {
  id: string
  nombre: string
  categoria: string
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
  fibra: number
  azucares?: number
  custom: boolean
  coach_id?: string
  // Fuente de datos
  fuente?: 'curada' | 'bedca' | 'usda' | 'openfoodfacts' | 'ia' | 'coach'
  codigo_externo?: string
  micros_actualizados_en?: string
  // Micronutrientes - Vitaminas
  vitamina_a_ug?: number
  vitamina_c_mg?: number
  vitamina_d_ug?: number
  vitamina_e_mg?: number
  vitamina_k_ug?: number
  vitamina_b6_mg?: number
  vitamina_b12_ug?: number
  tiamina_mg?: number
  riboflavina_mg?: number
  niacina_mg?: number
  folato_ug?: number
  // Micronutrientes - Minerales
  calcio_mg?: number
  hierro_mg?: number
  magnesio_mg?: number
  fosforo_mg?: number
  potasio_mg?: number
  sodio_mg?: number
  zinc_mg?: number
  cobre_mg?: number
  selenio_ug?: number
  // Perfil lipídico
  saturados_g?: number
  monoinsaturados_g?: number
  poliinsaturados_g?: number
  colesterol_mg?: number
}

export interface PlanNutricion {
  id: string
  coach_id: string
  cliente_id: string
  nombre: string
  descripcion?: string
  kcal_objetivo?: number
  proteinas_objetivo?: number
  carbohidratos_objetivo?: number
  grasas_objetivo?: number
  activo: boolean
  codigo_publico?: string
  generado_por_ia?: boolean
  created_at: string
  updated_at: string
  cliente?: Cliente
  comidas?: Comida[]
}

export interface Comida {
  id: string
  plan_id: string
  nombre: string
  orden: number
  hora_sugerida?: string
  alimentos?: ComidaAlimento[]
}

export interface ComidaAlimento {
  id: string
  comida_id: string
  alimento_id: string
  cantidad_gramos: number
  alimento?: Alimento
}

export interface Ejercicio {
  id: string
  nombre: string
  grupo_muscular?: string
  tipo?: 'fuerza' | 'cardio' | 'flexibilidad' | 'funcional'
  descripcion?: string
  video_url?: string
  custom: boolean
  coach_id?: string
}

export interface PlanEntrenamiento {
  id: string
  coach_id: string
  cliente_id: string
  nombre: string
  descripcion?: string
  duracion_semanas?: number
  activo: boolean
  created_at: string
  updated_at: string
  cliente?: Cliente
  sesiones?: SesionEntrenamiento[]
}

export interface SesionEntrenamiento {
  id: string
  plan_id: string
  nombre: string
  dia_semana?: string
  orden: number
  notas?: string
  ejercicios?: SesionEjercicio[]
}

export interface SesionEjercicio {
  id: string
  sesion_id: string
  ejercicio_id: string
  series?: number
  repeticiones?: string
  descanso_segundos?: number
  peso_sugerido?: string
  notas?: string
  orden: number
  ejercicio?: Ejercicio
}

export interface SeguimientoPeso {
  id: string
  cliente_id: string
  fecha: string
  peso?: number
  notas?: string
}

// Macros calculados
export interface Macros {
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
  fibra: number
}

// ============================================================
// Tipos para Fase 1 - Cuestionarios y Plantillas
// ============================================================

export type TipoPregunta = 'texto' | 'textarea' | 'numero' | 'select' | 'multiselect' | 'checkbox' | 'fecha'

export interface OpcionPregunta {
  id: string
  label: string
  value: string
}

export interface Pregunta {
  id: string
  tipo: TipoPregunta
  titulo: string
  descripcion?: string
  requerida: boolean
  opciones?: OpcionPregunta[]
  placeholder?: string
  orden: number
}

export interface Cuestionario {
  id: string
  coach_id: string
  titulo: string
  descripcion?: string
  preguntas: Pregunta[]
  activo: boolean
  codigo_publico: string
  created_at: string
  updated_at: string
}

export type EstadoRespuesta = 'nueva' | 'procesando' | 'dieta_lista' | 'dieta_aprobada' | 'dieta_rechazada'

export interface RespuestaCliente {
  id: string
  cuestionario_id: string
  coach_id: string
  respuestas: Record<string, string | string[] | number>
  estado: EstadoRespuesta
  nombre_cliente?: string
  email_cliente?: string
  plan_id?: string
  codigo_publico?: string
  leida?: boolean
  created_at: string
  updated_at: string
  cuestionario?: Cuestionario
}

export type PlantillaDietaTipo = 'normal' | 'carga' | 'suplementos'

export interface PlantillaDieta {
  id: string
  coach_id: string
  nombre: string
  descripcion?: string
  tipo?: PlantillaDietaTipo
  kcal_objetivo?: number
  proteinas_objetivo?: number
  carbohidratos_objetivo?: number
  grasas_objetivo?: number
  activo: boolean
  created_at: string
  updated_at: string
}

// ============================================================
// Tipos para Plantillas de Entrenamiento
// ============================================================

export type PlantillaEntrenoTipo = 'gimnasio' | 'cardio' | 'mixto'
export type PlantillaEntrenoNivel = 'principiante' | 'intermedio' | 'avanzado'
export type PlantillaEntrenoObjetivo = 'hipertrofia' | 'fuerza' | 'perdida_grasa' | 'cardio' | 'tonificacion' | 'rendimiento'

export interface PlantillaEntrenamiento {
  id: string
  coach_id: string
  nombre: string
  descripcion?: string
  tipo?: PlantillaEntrenoTipo
  duracion_semanas?: number
  nivel?: PlantillaEntrenoNivel
  objetivo?: PlantillaEntrenoObjetivo
  dias_por_semana?: number
  activo: boolean
  progresion?: ProgresionPlantilla[]
  created_at: string
  updated_at: string
  sesiones?: PlantillaSesion[]
}

export interface ProgresionPlantilla {
  semana: number
  titulo: string
  descripcion: string
  ajustes: string[]
}

export interface PlantillaSesion {
  id: string
  plantilla_id: string
  nombre: string
  dia_semana?: string
  orden: number
  notas?: string
  ejercicios?: PlantillaSesionEjercicio[]
}

export interface PlantillaSesionEjercicio {
  id: string
  sesion_id: string
  ejercicio_id: string
  series?: number
  repeticiones?: string
  descanso_segundos?: number
  peso_sugerido?: string
  rpe?: string
  notas?: string
  orden: number
  ejercicio?: Ejercicio
}

export const PLANTILLA_DIETA_TIPO_LABELS: Record<PlantillaDietaTipo, string> = {
  normal: 'Normal',
  carga: 'Carga de carbohidratos',
  suplementos: 'Suplementación',
}

export interface ProtocoloCompeticion {
  id: string
  cliente_id: string
  coach_id: string
  nombre: string
  deporte?: string
  fecha_competicion?: string
  peso_inicial?: number
  peso_objetivo?: number
  // Fase de carga
  carga_dias_previos: number
  carga_carbs_kg: number
  carga_proteinas_kg: number
  carga_grasas_kg: number
  carga_inicio?: string
  // Suplementación
  geles_marca?: string
  geles_carbs_por_gel: number
  geles_cada_minutos: number
  electrolitos_marca?: string
  electrolitos_cada_minutos: number
  cafeina_mg?: number
  hidratacion_ml_cada_15min: number
  // Notas
  notas_previa?: string
  notas_durante?: string
  notas_post?: string
  activo: boolean
  created_at: string
  updated_at: string
}

export interface ProtocoloCompeticionForm {
  nombre: string
  deporte: string
  fecha_competicion: string
  peso_inicial: string
  peso_objetivo: string
  carga_dias_previos: string
  carga_carbs_kg: string
  carga_proteinas_kg: string
  carga_grasas_kg: string
  carga_inicio: string
  geles_marca: string
  geles_carbs_por_gel: string
  geles_cada_minutos: string
  electrolitos_marca: string
  electrolitos_cada_minutos: string
  cafeina_mg: string
  hidratacion_ml_cada_15min: string
  notas_previa: string
  notas_durante: string
  notas_post: string
}

export const PLANTILLA_TIPO_LABELS: Record<PlantillaEntrenoTipo, string> = {
  gimnasio: 'Gimnasio',
  cardio: 'Cardio',
  mixto: 'Mixto',
}

export const PLANTILLA_NIVEL_LABELS: Record<PlantillaEntrenoNivel, string> = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

export const PLANTILLA_OBJETIVO_LABELS: Record<PlantillaEntrenoObjetivo, string> = {
  hipertrofia: 'Hipertrofia',
  fuerza: 'Fuerza',
  perdida_grasa: 'Pérdida de grasa',
  cardio: 'Cardio',
  tonificacion: 'Tonificación',
  rendimiento: 'Rendimiento deportivo',
}

// ============================================================
// Tipos para Portal Cliente (Dashboard público)
// ============================================================

export interface CheckIn {
  id: string
  cliente_id: string
  fecha: string
  peso?: number
  adherencia?: number
  energia?: number
  sueno?: number
  notas?: string
  created_at: string
}

export interface SeguimientoPesoConFecha extends SeguimientoPeso {
  // Extiende el tipo existente
}

export interface NotaCoach {
  id: string
  cliente_id: string
  coach_id: string
  contenido: string
  created_at: string
  leida?: boolean
}

export interface DashboardPortalResponse {
  plan: PlanNutricion
  cliente: Pick<Cliente, 'id' | 'peso_inicial' | 'objetivo'> & { nombre?: string; fecha_proxima_revision?: string }
  entreno: PlanEntrenamiento | null
  checkins: CheckIn[]
  peso: SeguimientoPeso[]
  notas: NotaCoach[]
}
