/**
 * Loader de next/image: las imágenes de Cloudinary se piden ya redimensionadas (f_auto = webp/avif según el
 * navegador, q_auto, ancho exacto) directamente al CDN de Cloudinary, sin pasar por el optimizador de Vercel
 * (un salto más, transformación en frío y cuota limitada). Cualquier otra URL se devuelve tal cual.
 */
// Calidad fija (q_auto) y pocos anchos (ver deviceSizes/imageSizes en next.config.mjs): Cloudinary genera cada variante la
// primera vez que se pide (~0,8 s) y después la sirve desde caché (~0,1 s). Pocas variantes = fáciles de precalentar
// (scripts/calentar-imagenes-cloudinary.mjs, que debe usar exactamente esta misma cadena).
export default function cloudinaryLoader({ src, width }: { src: string; width: number }): string {
  if (src.includes('res.cloudinary.com') && src.includes('/upload/')) {
    return src.replace('/upload/', `/upload/f_auto,q_auto,w_${width},c_limit/`)
  }
  return src
}
