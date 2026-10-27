// Marca de «cantidad estimada» en la ficha del coach.
// Una receta importada de un reel/web (url_origen) solo tiene `cantidad_original` en los ingredientes cuya cantidad dijo el vídeo;
// en el resto los gramos los estimó el sistema. En una receta hecha a mano los gramos son de Carlos, y una vez aprobada ya está revisada.
export function cantidadEstimada(
  ing: { cantidad_gramos: number; cantidad_original?: number | null; es_opcional?: boolean | null },
  receta: { estado?: string | null; url_origen?: string | null },
): boolean {
  if (!receta.url_origen || (receta.estado !== 'en_revision' && receta.estado !== 'borrador')) return false
  return !ing.es_opcional && Number(ing.cantidad_gramos) > 0 && !ing.cantidad_original
}
