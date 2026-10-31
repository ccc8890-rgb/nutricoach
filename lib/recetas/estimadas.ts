// Marca de «cantidad estimada» en la ficha del coach.
// Una receta importada de un reel (url_origen de TikTok/Instagram/YouTube) solo tiene `cantidad_original` en los ingredientes cuya cantidad dijo el vídeo;
// en el resto los gramos los estimó el sistema. Las recetas de WEBS traen todas sus cantidades de la ficha original (aunque no guarden cantidad_original): no son estimaciones. En una receta hecha a mano los gramos son de Carlos, y una vez aprobada ya está revisada.
export const esUrlDeReel = (url?: string | null) => /tiktok\.com|instagram\.com|youtube\.com|youtu\.be/i.test(url ?? '')

export function cantidadEstimada(
  ing: { cantidad_gramos: number; cantidad_original?: number | null; es_opcional?: boolean | null },
  receta: { estado?: string | null; url_origen?: string | null },
): boolean {
  if (!esUrlDeReel(receta.url_origen) || (receta.estado !== 'en_revision' && receta.estado !== 'borrador')) return false
  return !ing.es_opcional && Number(ing.cantidad_gramos) > 0 && !ing.cantidad_original
}
