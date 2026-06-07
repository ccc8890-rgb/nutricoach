import type { RecetaCandidata } from './types'

type TemplateInput = {
  objetivo: string
  deporte?: string
  momento?: string
}

type TemplateFactory = (input: TemplateInput) => RecetaCandidata

export const PLANTILLAS_RECETARIO_PRO: Array<{
  id: string
  objetivos: string[]
  momentos: string[]
  tipoPlato: string
  factory: TemplateFactory
}> = [
  {
    id: 'tapering-arroz-pollo-calabacin',
    objetivos: ['rendimiento'],
    momentos: ['tapering'],
    tipoPlato: 'Comida',
    factory: (input) => ({
      nombre: 'Arroz suave con pollo y calabacin para tapering',
      descripcion: 'Comida digestiva alta en carbohidrato y baja en grasa para los dias previos a competicion.',
      instrucciones: [
        'Cocer el arroz hasta que quede tierno.',
        'Cocinar el pollo a la plancha con poca grasa.',
        'Saltear el calabacin brevemente y montar el plato con aceite medido.',
      ],
      objetivos: [input.objetivo],
      deportes: input.deporte ? [input.deporte, 'endurance'] : ['endurance'],
      momentos: input.momento ? [input.momento] : ['tapering'],
      tipoPlato: 'Comida',
      digestibilidad: 'alta',
      ingredientes: [
        { nombre: 'arroz blanco', cantidadGramos: 95, rolIngrediente: 'carbohidrato_base' },
        { nombre: 'pechuga de pollo', cantidadGramos: 125, rolIngrediente: 'proteina_principal' },
        { nombre: 'calabacin', cantidadGramos: 100, rolIngrediente: 'verdura_volumen' },
        { nombre: 'aceite de oliva', cantidadGramos: 6, rolIngrediente: 'grasa_saludable' },
      ],
      trazabilidad: {
        plantillaId: 'tapering-arroz-pollo-calabacin',
        motivoGeneracion: 'Hueco de tapering endurance',
        modo: 'dry-run',
      },
    }),
  },
  {
    id: 'tapering-patata-merluza-zanahoria',
    objetivos: ['rendimiento'],
    momentos: ['tapering'],
    tipoPlato: 'Cena',
    factory: (input) => ({
      nombre: 'Patata cocida con merluza y zanahoria para tapering',
      descripcion: 'Plato simple y digestivo con carbohidrato principal, proteina magra y fibra moderada.',
      instrucciones: [
        'Cocer la patata y la zanahoria hasta que queden tiernas.',
        'Cocinar la merluza al vapor o plancha suave.',
        'Servir con aceite medido.',
      ],
      objetivos: [input.objetivo],
      deportes: input.deporte ? [input.deporte, 'endurance'] : ['endurance'],
      momentos: input.momento ? [input.momento] : ['tapering'],
      tipoPlato: 'Cena',
      digestibilidad: 'alta',
      ingredientes: [
        { nombre: 'patata', cantidadGramos: 260, rolIngrediente: 'carbohidrato_base' },
        { nombre: 'merluza', cantidadGramos: 150, rolIngrediente: 'proteina_principal' },
        { nombre: 'zanahoria', cantidadGramos: 80, rolIngrediente: 'verdura_volumen' },
        { nombre: 'aceite de oliva', cantidadGramos: 5, rolIngrediente: 'grasa_saludable' },
      ],
      trazabilidad: {
        plantillaId: 'tapering-patata-merluza-zanahoria',
        motivoGeneracion: 'Hueco de tapering endurance',
        modo: 'dry-run',
      },
    }),
  },
  {
    id: 'tapering-tostadas-pavo-platano',
    objetivos: ['rendimiento'],
    momentos: ['tapering'],
    tipoPlato: 'Desayuno',
    factory: (input) => ({
      nombre: 'Tostadas de pavo y platano para desayuno de tapering',
      descripcion: 'Desayuno bajo en grasa y facil de digerir para aumentar carbohidratos sin pesadez.',
      instrucciones: [
        'Tostar el pan hasta que quede crujiente.',
        'Anadir pavo en lonchas y platano laminado.',
        'Servir con miel medida si se necesita un extra de carbohidrato rapido.',
      ],
      objetivos: [input.objetivo],
      deportes: input.deporte ? [input.deporte, 'endurance'] : ['endurance'],
      momentos: input.momento ? [input.momento] : ['tapering'],
      tipoPlato: 'Desayuno',
      digestibilidad: 'alta',
      ingredientes: [
        { nombre: 'pan blanco', cantidadGramos: 90, rolIngrediente: 'carbohidrato_base' },
        { nombre: 'pavo', cantidadGramos: 75, rolIngrediente: 'proteina_principal' },
        { nombre: 'platano', cantidadGramos: 100, rolIngrediente: 'fruta_complemento' },
        { nombre: 'miel', cantidadGramos: 10, rolIngrediente: 'salsa_condimento' },
      ],
      trazabilidad: {
        plantillaId: 'tapering-tostadas-pavo-platano',
        motivoGeneracion: 'Hueco de tapering endurance',
        modo: 'dry-run',
      },
    }),
  },
  {
    id: 'carga-cho-pasta-pavo-tomate',
    objetivos: ['rendimiento'],
    momentos: ['carga_cho'],
    tipoPlato: 'Comida',
    factory: (input) => ({
      nombre: 'Pasta con pavo y tomate para carga de carbohidratos',
      descripcion: 'Plato alto en carbohidratos con proteina magra y grasa controlada.',
      instrucciones: [
        'Cocer la pasta al dente.',
        'Cocinar el pavo sin exceso de aceite.',
        'Mezclar con tomate triturado.',
      ],
      objetivos: [input.objetivo],
      deportes: input.deporte ? [input.deporte, 'endurance'] : ['endurance'],
      momentos: input.momento ? [input.momento] : ['carga_cho'],
      tipoPlato: 'Comida',
      digestibilidad: 'media',
      ingredientes: [
        { nombre: 'pasta', cantidadGramos: 110, rolIngrediente: 'carbohidrato_base' },
        { nombre: 'pavo', cantidadGramos: 110, rolIngrediente: 'proteina_principal' },
        { nombre: 'tomate triturado', cantidadGramos: 90, rolIngrediente: 'salsa_condimento' },
        { nombre: 'aceite de oliva', cantidadGramos: 7, rolIngrediente: 'grasa_saludable' },
      ],
      trazabilidad: {
        plantillaId: 'carga-cho-pasta-pavo-tomate',
        motivoGeneracion: 'Hueco de carga de carbohidratos',
        modo: 'dry-run',
      },
    }),
  },
  {
    id: 'post-entreno-yogur-avena-platano',
    objetivos: ['rendimiento', 'recomposicion'],
    momentos: ['post_entreno'],
    tipoPlato: 'Merienda',
    factory: (input) => ({
      nombre: 'Bol de yogur, avena y platano post-entreno',
      descripcion: 'Recuperacion simple con carbohidrato, proteina y baja complejidad culinaria.',
      instrucciones: [
        'Mezclar yogur y avena.',
        'Anadir platano laminado.',
        'Servir frio o dejar reposar diez minutos.',
      ],
      objetivos: [input.objetivo],
      deportes: input.deporte ? [input.deporte] : ['general'],
      momentos: input.momento ? [input.momento] : ['post_entreno'],
      tipoPlato: 'Merienda',
      digestibilidad: 'media',
      ingredientes: [
        { nombre: 'yogur griego natural', cantidadGramos: 180, rolIngrediente: 'proteina_principal' },
        { nombre: 'avena', cantidadGramos: 45, rolIngrediente: 'carbohidrato_base' },
        { nombre: 'platano', cantidadGramos: 120, rolIngrediente: 'fruta_complemento' },
        { nombre: 'miel', cantidadGramos: 8, rolIngrediente: 'salsa_condimento' },
      ],
      trazabilidad: {
        plantillaId: 'post-entreno-yogur-avena-platano',
        motivoGeneracion: 'Hueco de post-entreno',
        modo: 'dry-run',
      },
    }),
  },
  {
    id: 'pre-entreno-pan-platano-miel',
    objetivos: ['rendimiento'],
    momentos: ['pre_entreno'],
    tipoPlato: 'Merienda',
    factory: (input) => ({
      nombre: 'Pan blanco con platano y miel pre-entreno',
      descripcion: 'Snack alto en carbohidrato, bajo en grasa y facil de digerir antes de entrenar.',
      instrucciones: [
        'Tostar ligeramente el pan si se quiere mejor textura.',
        'Anadir platano laminado y miel medida.',
        'Tomar entre 60 y 120 minutos antes del entrenamiento.',
      ],
      objetivos: [input.objetivo],
      deportes: input.deporte ? [input.deporte, 'endurance'] : ['endurance'],
      momentos: input.momento ? [input.momento] : ['pre_entreno'],
      tipoPlato: 'Merienda',
      digestibilidad: 'alta',
      ingredientes: [
        { nombre: 'pan blanco', cantidadGramos: 75, rolIngrediente: 'carbohidrato_base' },
        { nombre: 'platano', cantidadGramos: 100, rolIngrediente: 'fruta_complemento' },
        { nombre: 'miel', cantidadGramos: 12, rolIngrediente: 'salsa_condimento' },
      ],
      trazabilidad: {
        plantillaId: 'pre-entreno-pan-platano-miel',
        motivoGeneracion: 'Hueco de pre-entreno digestivo',
        modo: 'dry-run',
      },
    }),
  },
  {
    id: 'pre-entreno-arroz-pavo',
    objetivos: ['rendimiento'],
    momentos: ['pre_entreno'],
    tipoPlato: 'Comida',
    factory: (input) => ({
      nombre: 'Arroz blanco con pavo pre-entreno',
      descripcion: 'Comida pre-entreno simple con carbohidrato base, proteina magra y grasa muy baja.',
      instrucciones: [
        'Cocer el arroz hasta que quede tierno.',
        'Cocinar el pavo a la plancha sin exceso de aceite.',
        'Servir templado y evitar salsas pesadas.',
      ],
      objetivos: [input.objetivo],
      deportes: input.deporte ? [input.deporte, 'endurance'] : ['endurance'],
      momentos: input.momento ? [input.momento] : ['pre_entreno'],
      tipoPlato: 'Comida',
      digestibilidad: 'alta',
      ingredientes: [
        { nombre: 'arroz blanco', cantidadGramos: 85, rolIngrediente: 'carbohidrato_base' },
        { nombre: 'pavo', cantidadGramos: 90, rolIngrediente: 'proteina_principal' },
        { nombre: 'platano', cantidadGramos: 80, rolIngrediente: 'fruta_complemento' },
      ],
      trazabilidad: {
        plantillaId: 'pre-entreno-arroz-pavo',
        motivoGeneracion: 'Hueco de pre-entreno digestivo',
        modo: 'dry-run',
      },
    }),
  },
  {
    id: 'perdida-grasa-merluza-calabacin-yogur',
    objetivos: ['perdida_grasa'],
    momentos: ['cena'],
    tipoPlato: 'Cena',
    factory: (input) => ({
      nombre: 'Merluza con calabacin y salsa de yogur ligera',
      descripcion: 'Cena alta en proteina, baja en grasa y con volumen digestivo para perdida de grasa.',
      instrucciones: [
        'Cocinar la merluza a la plancha suave.',
        'Saltear el calabacin con aceite medido.',
        'Servir con yogur griego natural como salsa ligera.',
      ],
      objetivos: [input.objetivo],
      deportes: input.deporte ? [input.deporte] : ['general'],
      momentos: input.momento ? [input.momento] : ['cena'],
      tipoPlato: 'Cena',
      digestibilidad: 'media',
      ingredientes: [
        { nombre: 'merluza', cantidadGramos: 170, rolIngrediente: 'proteina_principal' },
        { nombre: 'calabacin', cantidadGramos: 180, rolIngrediente: 'verdura_volumen' },
        { nombre: 'yogur griego natural', cantidadGramos: 80, rolIngrediente: 'lacteo_complemento' },
        { nombre: 'aceite de oliva', cantidadGramos: 5, rolIngrediente: 'grasa_saludable' },
      ],
      trazabilidad: {
        plantillaId: 'perdida-grasa-merluza-calabacin-yogur',
        motivoGeneracion: 'Hueco de cena ligera para perdida de grasa',
        modo: 'dry-run',
      },
    }),
  },
]
