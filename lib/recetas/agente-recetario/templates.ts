// lib/recetas/agente-recetario/templates.ts
// Templates legacy — referenciados desde generator.ts
// Los esqueletos nuevos están en lib/recetas/esqueletos/

import type { RecetaCandidata } from './types'

type TemplateInput = {
  objetivo: string
  deporte?: string
  momento?: string
}

type TemplateFactory = (input: TemplateInput) => Omit<RecetaCandidata, 'nombre' | 'descripcion' | 'instrucciones'>

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
      objetivos: [input.objetivo],
      deportes: input.deporte ? [input.deporte, 'endurance'] : ['endurance'],
      momentos: input.momento ? [input.momento] : ['tapering'],
      tipoPlato: 'Comida',
      digestibilidad: 'alta',
      ingredientes: [
        { nombre: 'arroz blanco',      cantidadGramos: 95,  rolIngrediente: 'carbohidrato_base' },
        { nombre: 'pechuga de pollo',  cantidadGramos: 125, rolIngrediente: 'proteina_principal' },
        { nombre: 'calabacín',         cantidadGramos: 100, rolIngrediente: 'verdura_volumen' },
        { nombre: 'aceite de oliva',   cantidadGramos: 6,   rolIngrediente: 'grasa_saludable' },
      ],
      trazabilidad: { plantillaId: 'tapering-arroz-pollo-calabacin', motivoGeneracion: 'tapering endurance', modo: 'dry-run' },
    }),
  },
  {
    id: 'tapering-patata-merluza-zanahoria',
    objetivos: ['rendimiento'],
    momentos: ['tapering'],
    tipoPlato: 'Cena',
    factory: (input) => ({
      objetivos: [input.objetivo],
      deportes: input.deporte ? [input.deporte, 'endurance'] : ['endurance'],
      momentos: input.momento ? [input.momento] : ['tapering'],
      tipoPlato: 'Cena',
      digestibilidad: 'alta',
      ingredientes: [
        { nombre: 'patata',           cantidadGramos: 260, rolIngrediente: 'carbohidrato_base' },
        { nombre: 'merluza',          cantidadGramos: 150, rolIngrediente: 'proteina_principal' },
        { nombre: 'zanahoria',        cantidadGramos: 80,  rolIngrediente: 'verdura_volumen' },
        { nombre: 'aceite de oliva',  cantidadGramos: 5,   rolIngrediente: 'grasa_saludable' },
      ],
      trazabilidad: { plantillaId: 'tapering-patata-merluza-zanahoria', motivoGeneracion: 'tapering endurance', modo: 'dry-run' },
    }),
  },
  {
    id: 'tapering-tostadas-pavo-platano',
    objetivos: ['rendimiento'],
    momentos: ['tapering'],
    tipoPlato: 'Desayuno',
    factory: (input) => ({
      objetivos: [input.objetivo],
      deportes: input.deporte ? [input.deporte, 'endurance'] : ['endurance'],
      momentos: input.momento ? [input.momento] : ['tapering'],
      tipoPlato: 'Desayuno',
      digestibilidad: 'alta',
      ingredientes: [
        { nombre: 'pan blanco',       cantidadGramos: 90,  rolIngrediente: 'carbohidrato_base' },
        { nombre: 'pavo',             cantidadGramos: 75,  rolIngrediente: 'proteina_principal' },
        { nombre: 'plátano',          cantidadGramos: 100, rolIngrediente: 'fruta_complemento' },
        { nombre: 'miel',             cantidadGramos: 10,  rolIngrediente: 'salsa_condimento' },
      ],
      trazabilidad: { plantillaId: 'tapering-tostadas-pavo-platano', motivoGeneracion: 'tapering endurance', modo: 'dry-run' },
    }),
  },
  {
    id: 'carga-cho-pasta-pavo-tomate',
    objetivos: ['rendimiento'],
    momentos: ['carga_cho'],
    tipoPlato: 'Comida',
    factory: (input) => ({
      objetivos: [input.objetivo],
      deportes: input.deporte ? [input.deporte, 'endurance'] : ['endurance'],
      momentos: input.momento ? [input.momento] : ['carga_cho'],
      tipoPlato: 'Comida',
      digestibilidad: 'media',
      ingredientes: [
        { nombre: 'pasta',              cantidadGramos: 110, rolIngrediente: 'carbohidrato_base' },
        { nombre: 'pavo',               cantidadGramos: 110, rolIngrediente: 'proteina_principal' },
        { nombre: 'tomate triturado',   cantidadGramos: 90,  rolIngrediente: 'salsa_condimento' },
        { nombre: 'aceite de oliva',    cantidadGramos: 7,   rolIngrediente: 'grasa_saludable' },
      ],
      trazabilidad: { plantillaId: 'carga-cho-pasta-pavo-tomate', motivoGeneracion: 'carga de carbohidratos endurance', modo: 'dry-run' },
    }),
  },
  {
    id: 'post-entreno-yogur-avena-platano',
    objetivos: ['rendimiento', 'recomposicion'],
    momentos: ['post_entreno'],
    tipoPlato: 'Merienda',
    factory: (input) => ({
      objetivos: [input.objetivo],
      deportes: input.deporte ? [input.deporte] : ['general'],
      momentos: input.momento ? [input.momento] : ['post_entreno'],
      tipoPlato: 'Merienda',
      digestibilidad: 'media',
      ingredientes: [
        { nombre: 'yogur griego natural', cantidadGramos: 180, rolIngrediente: 'proteina_principal' },
        { nombre: 'avena',                cantidadGramos: 45,  rolIngrediente: 'carbohidrato_base' },
        { nombre: 'plátano',              cantidadGramos: 120, rolIngrediente: 'fruta_complemento' },
        { nombre: 'miel',                 cantidadGramos: 8,   rolIngrediente: 'salsa_condimento' },
      ],
      trazabilidad: { plantillaId: 'post-entreno-yogur-avena-platano', motivoGeneracion: 'post-entreno recuperación', modo: 'dry-run' },
    }),
  },
  {
    id: 'pre-entreno-pan-platano-miel',
    objetivos: ['rendimiento'],
    momentos: ['pre_entreno'],
    tipoPlato: 'Merienda',
    factory: (input) => ({
      objetivos: [input.objetivo],
      deportes: input.deporte ? [input.deporte, 'endurance'] : ['endurance'],
      momentos: input.momento ? [input.momento] : ['pre_entreno'],
      tipoPlato: 'Merienda',
      digestibilidad: 'alta',
      ingredientes: [
        { nombre: 'pan blanco',   cantidadGramos: 75,  rolIngrediente: 'carbohidrato_base' },
        { nombre: 'plátano',      cantidadGramos: 100, rolIngrediente: 'fruta_complemento' },
        { nombre: 'miel',         cantidadGramos: 12,  rolIngrediente: 'salsa_condimento' },
      ],
      trazabilidad: { plantillaId: 'pre-entreno-pan-platano-miel', motivoGeneracion: 'pre-entreno digestivo', modo: 'dry-run' },
    }),
  },
  {
    id: 'pre-entreno-arroz-pavo',
    objetivos: ['rendimiento'],
    momentos: ['pre_entreno'],
    tipoPlato: 'Comida',
    factory: (input) => ({
      objetivos: [input.objetivo],
      deportes: input.deporte ? [input.deporte, 'endurance'] : ['endurance'],
      momentos: input.momento ? [input.momento] : ['pre_entreno'],
      tipoPlato: 'Comida',
      digestibilidad: 'alta',
      ingredientes: [
        { nombre: 'arroz blanco', cantidadGramos: 85,  rolIngrediente: 'carbohidrato_base' },
        { nombre: 'pavo',         cantidadGramos: 90,  rolIngrediente: 'proteina_principal' },
        { nombre: 'plátano',      cantidadGramos: 80,  rolIngrediente: 'fruta_complemento' },
      ],
      trazabilidad: { plantillaId: 'pre-entreno-arroz-pavo', motivoGeneracion: 'pre-entreno digestivo', modo: 'dry-run' },
    }),
  },
  {
    id: 'perdida-grasa-merluza-calabacin-yogur',
    objetivos: ['perdida_grasa'],
    momentos: ['cena'],
    tipoPlato: 'Cena',
    factory: (input) => ({
      objetivos: [input.objetivo],
      deportes: input.deporte ? [input.deporte] : ['general'],
      momentos: input.momento ? [input.momento] : ['cena'],
      tipoPlato: 'Cena',
      digestibilidad: 'media',
      ingredientes: [
        { nombre: 'merluza',            cantidadGramos: 170, rolIngrediente: 'proteina_principal' },
        { nombre: 'calabacín',          cantidadGramos: 180, rolIngrediente: 'verdura_volumen' },
        { nombre: 'yogur griego natural', cantidadGramos: 80, rolIngrediente: 'lacteo_complemento' },
        { nombre: 'aceite de oliva',    cantidadGramos: 5,   rolIngrediente: 'grasa_saludable' },
      ],
      trazabilidad: { plantillaId: 'perdida-grasa-merluza-calabacin-yogur', motivoGeneracion: 'cena ligera pérdida grasa', modo: 'dry-run' },
    }),
  },
]
