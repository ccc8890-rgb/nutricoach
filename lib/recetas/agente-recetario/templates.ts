import type { RecetaCandidata } from './types'

type TemplateInput = {
  objetivo: string
  deporte?: string
  momento?: string
}

type TemplateFactory = (input: TemplateInput) => RecetaCandidata

export const PLANTILLAS_RECETARIO_PRO: Array<{
  id: string
  momentos: string[]
  factory: TemplateFactory
}> = [
  {
    id: 'tapering-arroz-pollo-calabacin',
    momentos: ['tapering'],
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
      tipoPlato: 'comida',
      digestibilidad: 'alta',
      ingredientes: [
        { nombre: 'arroz blanco', cantidadGramos: 95, rolIngrediente: 'carbohidrato_principal' },
        { nombre: 'pechuga de pollo', cantidadGramos: 125, rolIngrediente: 'proteina_principal' },
        { nombre: 'calabacin', cantidadGramos: 100, rolIngrediente: 'verdura_fibra' },
        { nombre: 'aceite de oliva', cantidadGramos: 6, rolIngrediente: 'grasas' },
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
    momentos: ['tapering'],
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
      tipoPlato: 'cena',
      digestibilidad: 'alta',
      ingredientes: [
        { nombre: 'patata', cantidadGramos: 260, rolIngrediente: 'carbohidrato_principal' },
        { nombre: 'merluza', cantidadGramos: 150, rolIngrediente: 'proteina_principal' },
        { nombre: 'zanahoria', cantidadGramos: 80, rolIngrediente: 'verdura_fibra' },
        { nombre: 'aceite de oliva', cantidadGramos: 5, rolIngrediente: 'grasas' },
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
    momentos: ['tapering'],
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
      tipoPlato: 'desayuno',
      digestibilidad: 'alta',
      ingredientes: [
        { nombre: 'pan blanco', cantidadGramos: 90, rolIngrediente: 'carbohidrato_principal' },
        { nombre: 'pavo', cantidadGramos: 75, rolIngrediente: 'proteina_principal' },
        { nombre: 'platano', cantidadGramos: 100, rolIngrediente: 'frutas' },
        { nombre: 'miel', cantidadGramos: 10, rolIngrediente: 'salsas_condimentos' },
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
    momentos: ['carga_cho'],
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
      tipoPlato: 'comida',
      digestibilidad: 'media',
      ingredientes: [
        { nombre: 'pasta', cantidadGramos: 110, rolIngrediente: 'carbohidrato_principal' },
        { nombre: 'pavo', cantidadGramos: 110, rolIngrediente: 'proteina_principal' },
        { nombre: 'tomate triturado', cantidadGramos: 90, rolIngrediente: 'salsas_condimentos' },
        { nombre: 'aceite de oliva', cantidadGramos: 7, rolIngrediente: 'grasas' },
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
    momentos: ['post_entreno'],
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
      tipoPlato: 'merienda',
      digestibilidad: 'media',
      ingredientes: [
        { nombre: 'yogur griego natural', cantidadGramos: 180, rolIngrediente: 'proteina_principal' },
        { nombre: 'avena', cantidadGramos: 45, rolIngrediente: 'carbohidrato_principal' },
        { nombre: 'platano', cantidadGramos: 120, rolIngrediente: 'frutas' },
        { nombre: 'miel', cantidadGramos: 8, rolIngrediente: 'salsas_condimentos' },
      ],
      trazabilidad: {
        plantillaId: 'post-entreno-yogur-avena-platano',
        motivoGeneracion: 'Hueco de post-entreno',
        modo: 'dry-run',
      },
    }),
  },
]
