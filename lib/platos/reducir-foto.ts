// lib/platos/reducir-foto.ts
// Una foto de cámara (24-48 MP) supera el límite de ~4,5 MB del cuerpo de una petición en Vercel: se reduce en el navegador antes de subirla.

export function dimensionesReducidas(ancho: number, alto: number, ladoMax: number): { ancho: number; alto: number } {
  const a = Math.max(1, Math.round(ancho)), h = Math.max(1, Math.round(alto))
  const k = Math.min(1, ladoMax / Math.max(a, h))
  return { ancho: Math.max(1, Math.round(a * k)), alto: Math.max(1, Math.round(h * k)) }
}

/** JPEG de lado largo ≤ 1600 px. Si el navegador no puede decodificarla (p. ej. HEIC fuera de Safari) devuelve el archivo original. */
export async function reducirFoto(file: File, ladoMax = 1600, calidad = 0.85): Promise<File> {
  try {
    const bmp = await createImageBitmap(file)
    const { ancho, alto } = dimensionesReducidas(bmp.width, bmp.height, ladoMax)
    const canvas = document.createElement('canvas')
    canvas.width = ancho; canvas.height = alto
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, ancho, alto)
    bmp.close?.()
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', calidad))
    return blob ? new File([blob], 'plato.jpg', { type: 'image/jpeg' }) : file
  } catch {
    return file
  }
}
