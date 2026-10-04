/**
 * Loader de next/image: las imágenes de Cloudinary se piden ya redimensionadas (f_auto = webp/avif según el
 * navegador, q_auto, ancho exacto) directamente al CDN de Cloudinary, sin pasar por el optimizador de Vercel
 * (un salto más, transformación en frío y cuota limitada). Cualquier otra URL se devuelve tal cual.
 */
// Formato y calidad FIJOS (f_webp,q_75), no f_auto/q_auto: estos últimos hacen que Cloudinary responda con
// `Vary: Accept, User-Agent, Save-Data` y cachee una copia distinta por navegador (la primera petición de cada
// navegador tarda ~0,8 s aunque se haya precalentado con otro). Con valores fijos hay UNA sola variante por ancho,
// compartida por todos los dispositivos. Pocos anchos (ver deviceSizes/imageSizes en next.config.mjs): Cloudinary genera cada variante la
// primera vez que se pide (~0,8 s) y después la sirve desde caché (~0,1 s). Pocas variantes = fáciles de precalentar
// (scripts/calentar-imagenes-cloudinary.mjs, que debe usar exactamente esta misma cadena).
export default function cloudinaryLoader({ src, width }: { src: string; width: number }): string {
  if (src.includes('res.cloudinary.com') && src.includes('/upload/')) {
    return src.replace('/upload/', `/upload/f_webp,q_75,w_${width},c_limit/`)
  }
  return src
}
