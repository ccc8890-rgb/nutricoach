import type { RecetaCandidata } from './types'

export function construirPayloadInsercionReceta(receta: RecetaCandidata) {
  return {
    receta: {
      nombre: receta.nombre,
      descripcion: receta.descripcion,
      instrucciones: receta.instrucciones.join('\n'),
      estado: 'en_revision' as const,
      objetivos: receta.objetivos,
      deportes: receta.deportes,
      momentos: receta.momentos,
      tipo_plato: receta.tipoPlato,
      digestibilidad: receta.digestibilidad,
      planning_roles: receta.trazabilidad,
    },
    ingredientes: receta.ingredientes.map((ingrediente) => ({
      alimento_id: ingrediente.alimentoId,
      cantidad_gramos: ingrediente.cantidadGramos,
      rol_ingrediente: ingrediente.rolIngrediente,
      es_cantidad_fija: ingrediente.esCantidadFija ?? false,
    })),
  }
}
