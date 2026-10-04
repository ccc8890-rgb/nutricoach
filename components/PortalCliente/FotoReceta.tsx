'use client'
import { useState } from 'react'
import Image from 'next/image'
import cloudinaryLoader from '@/lib/cloudinary-loader'
import { propsImagenReceta } from '@/lib/cliente/imagen-receta'

// Foto grande de la receta en dos capas: debajo, la versión de 640 px que la tarjeta de la lista ya descargó (misma URL,
// sale de caché al instante); encima, la grande, que se funde cuando termina de cargar.
export default function FotoReceta({ src, alt }: { src: string; alt: string }) {
  const [grandeLista, setGrandeLista] = useState(false)
  return (
    <div className="relative w-full h-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cloudinaryLoader({ src, width: 640 })} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" />
      <Image
        {...propsImagenReceta(src, alt)}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
        style={{ opacity: grandeLista ? 1 : 0 }}
        onLoad={() => setGrandeLista(true)}
        ref={el => { if (el?.complete && el.naturalWidth > 0) setGrandeLista(true) }}
        priority
      />
    </div>
  )
}
