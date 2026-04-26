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
  custom: boolean
  coach_id?: string
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
