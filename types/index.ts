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
  onboarding_completado?: boolean
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
  es_generico?: boolean
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

// ─── Training Pro v2 ─────────────────────────────────────────
export type SportModality =
  | 'gym_estetica' | 'gym_fuerza' | 'funcional'
  | 'hyrox' | 'ciclismo' | 'running' | 'hibrido' | 'calistenia'
  | 'natacion' | 'triatlon'

export type TrainingTier = 'general' | 'elite'

export type UnidadEjercicio = 'reps' | 'cal' | 'metros' | 'segundos' | 'km' | 'pct_ftp' | 'km_h' | 'kg'
export type CargaTipo = 'peso_kg' | 'pct_rm' | 'pct_ftp' | 'rpe' | 'zona_fc' | 'rir' | 'sin_carga'

export interface PerfilEntrenoCliente {
  id: string
  cliente_id: string
  sport_modality?: SportModality
  objetivo_especifico?: string
  nivel?: PlantillaEntrenoNivel
  dias_disponibles: number
  mejor_momento_sesion?: 'manana' | 'tarde' | 'noche' | 'variable'
  ftp_watts?: number
  vdot?: number
  rm_sentadilla_kg?: number
  rm_banca_kg?: number
  rm_peso_muerto_kg?: number
  dominadas_max_reps?: number
  capacidad_recuperacion: 'baja' | 'media' | 'alta'
  respuesta_a_volumen: 'bajo' | 'medio' | 'alto'
  patron_lesiones: Array<{ zona: string; frecuencia: string; ultima_vez: string }>
  adherencia_historica_pct?: number
  respuesta_psicologica: 'variedad' | 'rutina' | 'competicion'
  plateau_detectado: boolean
  semanas_sin_progresion: number
  equipo_disponible: string[]
  restricciones_temporales?: string
  hrv_baseline?: number
  hrv_fecha_ultimo?: string
  vo2max_estimado?: number
  fms_score?: Record<string, number>
  garmin_user_id?: string
  strava_athlete_id?: string
  apple_health_enabled: boolean
  fisio_informe: Array<{ fecha: string; diagnostico: string; contraindicados: string[]; correctivos: string[] }>
  analisis_sangre: Array<{ fecha: string; ferritina?: number; vit_d?: number; hemoglobina?: number }>
  created_at: string
  updated_at: string
}

export interface AjusteSesionCliente {
  id: string
  cliente_id: string
  plantilla_sesion_id?: string
  fecha_semana: string
  motivo: 'lesion' | 'molestia' | 'fatiga_alta' | 'hrv_bajo' | 'viaje' | 'equipo_no_disponible' | 'sobreentrenamiento' | 'deload' | 'coach_manual'
  detalle_motivo?: string
  ajuste_aplicado?: Record<string, unknown>
  razonamiento_ia?: string
  generado_por: 'ia' | 'coach'
  estado: 'propuesto' | 'aprobado' | 'modificado' | 'revertido'
  coach_notas?: string
  created_at: string
}
// ─── Fin Training Pro v2 ─────────────────────────────────────

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
  // Training Pro v2
  sport_modality?: SportModality
  objetivo_especifico?: string
  tier: TrainingTier
  phase_adjustments?: Record<string, { volumen: number; intensidad: number }>
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
  // Training Pro v2
  unidad?: UnidadEjercicio
  carga_tipo?: CargaTipo
  carga_valor?: number
  notas_tecnicas?: string
  sustituciones?: Array<{ condicion: string; ejercicio_id: string }>
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
  foto_url?: string
  nota_coach?: string
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

// ============================================================
// Tipos para Módulo de Precios de Supermercado
// ============================================================

export interface Supermercado {
  id: string
  nombre: string
  slug: string
  logo_url?: string
  color?: string
  activo: boolean
  created_at: string
  /** Indica si hay un módulo scraper implementado para este supermercado */
  tiene_scraper?: boolean
}

export interface ProductoSupermercado {
  id: string
  supermercado_id: string
  alimento_id: string
  precio_por_kg: number
  precio_unidad?: number
  unidad: string
  url_producto?: string
  fecha_precio: string
  notas?: string
  created_at: string
  updated_at: string
}

export interface PrecioActual extends ProductoSupermercado {
  supermercado_nombre: string
  supermercado_slug: string
  supermercado_color?: string
  alimento_nombre: string
  alimento_categoria: string
}

export interface CosteAlimento {
  alimento_id: string
  alimento_nombre: string
  categoria: string
  cantidad_total_gramos: number
  precio_por_kg: number
  coste_total_euros: number
  /** % de merma estimado (pérdida en cocción/manipulación) — ej: 10 = 10% */
  merma_pct?: number
  /** Coste real aplicando la merma: coste_euros / (1 - merma/100) */
  coste_con_merma?: number
  /** Coste por porción (coste_total_euros / porciones del plan) */
  coste_por_porcion?: number
  recetas_json?: { comida_nombre: string; gramos: number }[]
}

export interface CosteComida {
  alimento_id: string
  alimento_nombre: string
  cantidad_gramos: number
  precio_por_kg: number
  coste_euros: number
  /** % de merma estimado para este ingrediente */
  merma_pct?: number
  /** Coste incluyendo merma */
  coste_con_merma?: number
}

export interface CostePorReceta {
  comida_nombre: string
  coste_total: number
  /** Coste total incluyendo merma */
  coste_total_con_merma?: number
  alimentos: CosteComida[]
}

export interface ResumenCostesPlan {
  supermercado_seleccionado: string | null
  precio_total: number
  /** Precio total incluyendo merma */
  precio_total_con_merma?: number
  /** Coste por porción del plan (precio_total / porciones) */
  coste_por_porcion?: number
  /** % de merma media ponderada */
  merma_media_pct?: number
  /** Precio de venta recomendado (precio_total_con_merma * (1 + margen/100)) */
  precio_venta_sin_iva?: number
  /** Precio de venta con IVA (10% por defecto para alimentación) */
  precio_venta_con_iva?: number
  /** Margen de beneficio aplicado (%) — ej: 30 = 30% */
  margen_beneficio_pct?: number
  /** Beneficio neto estimado (precio_venta_sin_iva - precio_total_con_merma) */
  beneficio_neto?: number
  alimentos: CosteAlimento[]
  coste_por_comida: CostePorReceta[]
}

// ============================================================
// Tipos para Productos vs Alimentos (multi-precio)
// ============================================================

/** Producto detallado de supermercado (con info del supermercado) */
export interface ProductoSupermercadoDetalle {
  id: string
  supermercado_id: string
  supermercado_nombre: string
  supermercado_slug: string
  supermercado_color?: string
  alimento_id: string
  alimento_nombre: string
  nombre_original?: string          // nombre real del producto en tienda
  marca?: string
  precio_por_kg: number
  precio_unidad?: number
  url_producto?: string
  preferido: boolean
  fecha_precio: string
}

/** Una opción dentro del escandallo (alimento + producto seleccionado + alternativas) */
export interface OpcionEscandallo {
  alimento_id: string
  alimento_nombre: string
  categoria: string
  cantidad_gramos: number
  producto_seleccionado: {
    id: string
    nombre_original?: string
    supermercado_nombre: string
    precio_por_kg: number
  }
  coste_euros: number
  /** % de merma estimado (pérdida en cocción/manipulación) */
  merma_pct?: number
  /** Coste real aplicando la merma */
  coste_con_merma?: number
  alternativas: {
    id: string
    supermercado_nombre: string
    precio_por_kg: number
    es_preferido: boolean
  }[]
}

/** Resultado completo del cálculo de escandallo con multi-precio */
export interface EscandalloPlan {
  precio_total: number
  /** Precio total incluyendo merma */
  precio_total_con_merma?: number
  /** Coste por porción (precio_total / porciones) */
  coste_por_porcion?: number
  /** % de merma media ponderada */
  merma_media_pct?: number
  supermercado_base?: string        // supermercado del preferido mayoritario
  alimentos: OpcionEscandallo[]
  ahorro_potencial: number          // lo que se ahorraría yendo al más barato
  /** Precio de venta recomendado (precio_total_con_merma * (1 + margen/100)) */
  precio_venta_sin_iva?: number
  /** Precio de venta con IVA */
  precio_venta_con_iva?: number
  /** Margen de beneficio aplicado (%) */
  margen_beneficio_pct?: number
  /** Beneficio neto estimado */
  beneficio_neto?: number
}

// ============================================================
// Tipos para Scraping Automático de Precios (Fase 1)
// ============================================================

/** Producto scrapeado de un supermercado, ya normalizado */
export interface ProductoScraped {
  nombre: string
  nombre_normalizado: string
  precio_actual: number
  precio_por_kg?: number
  unidad?: string
  url_producto: string
  imagen_url?: string
  marca?: string
  cantidad?: string
  disponible: boolean
}

/** Resultado completo de una operación de scraping */
export interface ResultadoScraping {
  supermercado_id: string
  supermercado_nombre: string
  productos: ProductoScraped[]
  fecha_scraping: string
  duracion_ms: number
  errores: string[]
  total_procesados: number
  nuevos_productos: number
  actualizados: number
  no_encontrados: number
}

/** Precio histórico para tendencias */
export interface PrecioHistorico {
  id: string
  supermercado_id: string
  supermercado_nombre?: string
  alimento_id: string | null
  alimento_nombre?: string
  nombre_producto?: string
  precio_por_kg: number
  precio_unidad?: number
  unidad: string
  url_producto?: string
  fecha_precio: string
  fuente: 'manual' | 'scraping_http' | 'scraping_playwright' | 'apify'
  metadatos?: Record<string, unknown>
  created_at: string
}

/** Tendencia de precio de un alimento en un supermercado */
export interface TendenciaPrecio {
  alimento_id: string
  alimento_nombre: string
  supermercado_id: string
  supermercado_nombre: string
  precio_inicial: number
  precio_actual: number
  variacion_porcentual: number
  periodo: '30d' | '90d' | '1y'
  puntos: { fecha: string; precio: number }[]
}

/** Producto externo (suplementos, Amazon, MyProtein, etc.) */
export interface ProductoExterno {
  id: string
  coach_id: string
  nombre: string
  marca?: string
  categoria: 'suplementos' | 'ropa' | 'equipamiento' | 'otros'
  precio: number
  moneda: string
  cantidad?: number
  unidad_medida?: string
  url_producto?: string
  tienda?: string
  fecha_precio: string
  created_at: string
  updated_at: string
}

/** Comparativa de precios entre supermercados para una cesta */
export interface ComparativaSupermercados {
  supermercados: {
    id: string
    nombre: string
    color: string
    precio_total: number
    dif_respecto_barato: number
    es_mas_barato: boolean
  }[]
  ahorro_semanal: number
  ahorro_mensual: number
  ahorro_anual: number
  recomendado: string
  desglose: {
    alimento_id: string
    alimento_nombre: string
    precios: { supermercado_id: string; precio: number }[]
    mas_barato: string
  }[]
}

/** Proyección de ahorro entre dos supermercados */
export interface ProyeccionAhorro {
  semanal: number
  mensual: number
  anual: number
  supermercado_base: string
  supermercado_comparado: string
  diferencia_porcentual: number
}

// ── Enriquecimiento Nutricional IA ────────────────────────────

export interface CategoriaIA {
  id: string
  nombre: string
  descripcion: string | null
  grupo_alimenticio: string
  prioridad: number
}

export interface AlimentoPendienteEnriquecer {
  id: string
  nombre: string
  categoria: string | null
  calorias: number | null
  proteinas: number | null
  carbohidratos: number | null
  grasas: number | null
  estado_enriquecimiento: 'pendiente' | 'procesando' | 'completado' | 'error' | null
  error_ia: string | null
  ultimo_intento: string | null
  num_precios: number
  supermercados: string | null
}

export interface ResultadoEnriquecimiento {
  alimento_id: string
  nombre: string
  categoria_ia: string
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
  fibra: number | null
  confianza: 'alta' | 'media' | 'baja'
  explicacion?: string
}

export interface EscandalloReceta {
  id: string
  receta_id: string
  supermercado_id: string
  coste_total: number
  coste_por_porcion: number | null
  desglose: EscandalloItem[]
  fecha_calculo: string
}

export interface EscandalloItem {
  ingrediente: string
  cantidad_gramos: number
  precio_por_kg: number
  coste: number
}

export interface EscandalloCliente {
  cliente_id: string
  cliente_nombre: string
  plan_id: string
  plan_nombre: string
  supermercado_id: string
  supermercado_nombre: string
  coste_semanal: number
  coste_por_porcion: number | null
  coste_mensual_estimado: number
  coste_anual_estimado: number
  fecha_calculo: string
}

export interface StatsEnriquecimiento {
  total_pendientes: number
  total_completados: number
  total_errores: number
  total_alimentos_en_db: number
  supermercados_con_precios: number
  productos_con_precio: number
}

// ============================================================
// Tipos para Lista de la Compra Semanal con Precios
// ============================================================

/** Precio de un alimento en un supermercado concreto */
export interface PrecioOpcion {
  supermercado_id: string
  supermercado_nombre: string
  supermercado_slug: string
  supermercado_color?: string
  precio_por_kg: number
  coste_euros: number      // precio_por_kg * (cantidad_gramos / 1000)
  url_producto?: string
  es_mas_barato: boolean
}

/** Un ingrediente de la lista semanal con sus opciones de precio */
export interface IngredienteSemanal {
  alimento_id: string
  alimento_nombre: string
  categoria: string
  es_generico: boolean
  cantidad_gramos_total: number   // suma de todas las recetas de la semana
  recetas_origen: string[]        // nombres de comidas que lo incluyen
  precios: PrecioOpcion[]         // vacío si no hay precios en ningún super
  seleccion: SeleccionListaCompra | null  // null si no ha seleccionado aún
}

/** Selección guardada de un cliente para un ingrediente */
export interface SeleccionListaCompra {
  id?: string
  cliente_id: string
  plan_id: string
  alimento_id: string
  supermercado_id: string | null
  supermercado_nombre?: string
  producto_nombre?: string
  precio_por_kg?: number
  url_producto?: string
  semana_inicio: string           // formato YYYY-MM-DD (lunes)
  seleccionado_por: 'coach' | 'cliente'
}

/** Resumen por supermercado para el bloque final de la lista */
export interface ResumenSupermercado {
  supermercado_id: string
  supermercado_nombre: string
  supermercado_color?: string
  ingredientes: string[]          // nombres de los alimentos asignados
  coste_total: number
}

/** Respuesta completa de GET /api/lista-compra/semanal */
export interface ListaCompraSemanal {
  plan_id: string
  semana_inicio: string
  ingredientes: IngredienteSemanal[]
  resumen_por_supermercado: ResumenSupermercado[]
  coste_total: number
  coste_total_mas_caro: number    // si compraras todo en el super más caro
}
