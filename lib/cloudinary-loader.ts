/**
 * Loader de next/image: las imágenes de Cloudinary se piden ya redimensionadas (f_auto = webp/avif según el
 * navegador, q_auto, ancho exacto) directamente al CDN de Cloudinary, sin pasar por el optimizador de Vercel
 * (un salto más, transformación en frío y cuota limitada). Cualquier otra URL se devuelve tal cual.
 */
export default function cloudinaryLoader({ src, width, quality }: { src: string; width: number; quality?: number }): string {
  if (src.includes('res.cloudinary.com') && src.includes('/upload/')) {
    return src.replace('/upload/', `/upload/f_auto,q_${quality ?? 'auto'},w_${width},c_limit/`)
  }
  return src
}
