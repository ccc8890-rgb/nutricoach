import { getImageProps } from 'next/image'
import { preload } from 'react-dom'

// Mismas medidas que la foto grande de /cliente/receta/[id]: así el navegador reutiliza la imagen precargada.
const MEDIDAS = { width: 512, height: 512, sizes: '(max-width: 448px) 100vw, 448px' } as const

export function propsImagenReceta(src: string, alt: string) {
  return getImageProps({ src, alt, ...MEDIDAS }).props
}

export function precargarImagenReceta(src?: string | null) {
  if (!src || typeof window === 'undefined') return
  const { src: url, srcSet } = propsImagenReceta(src, '')
  preload(url, { as: 'image', imageSrcSet: srcSet, imageSizes: MEDIDAS.sizes })
}
