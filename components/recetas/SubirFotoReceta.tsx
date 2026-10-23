'use client'

import { useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

const LADO_MAX = 1600

/** Reduce la captura a JPEG de máx. 1600 px para que suba rápido. */
async function reducir(file: Blob): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(file)
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.88))
  if (!blob) throw new Error('No se pudo procesar la imagen')
  return new Uint8Array(await blob.arrayBuffer())
}

/**
 * Foto propia de una receta: elegir archivo o pegar una captura (clic en el botón y ⌘V / Ctrl+V).
 * La foto queda como «propia» y revisada.
 */
export default function SubirFotoReceta({ recetaId, tieneFoto, onSubida }: { recetaId: string; tieneFoto: boolean; onSubida: () => void | Promise<void> }) {
  const { addToast } = useToast()
  const entrada = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)

  async function subir(file: Blob) {
    setSubiendo(true)
    try {
      const bytes = await reducir(file)
      const res = await fetch('/api/subir-imagen-receta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receta_id: recetaId, buffer: Array.from(bytes), fileName: `${recetaId}.jpg`, metodo: 'captura_coach' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'No se pudo subir la foto')
      const res2 = await fetch(`/api/recetas/${recetaId}/imagen`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagen_estado: 'aprobada', imagen_origen: 'uploaded', imagen_tipo: 'propia', imagen_needs_review: false }),
      })
      if (!res2.ok) throw new Error('La foto se subió pero no se pudo marcar como revisada')
      addToast({ type: 'success', title: 'Foto guardada' })
      await onSubida()
    } catch (err) {
      addToast({ type: 'error', title: 'No se pudo guardar la foto', message: err instanceof Error ? err.message : 'Error desconocido' })
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <>
      <input ref={entrada} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void subir(f); e.target.value = '' }} />
      <button
        type="button"
        disabled={subiendo}
        title="Elegir un archivo, o hacer clic aquí y pegar una captura con ⌘V"
        onClick={() => entrada.current?.click()}
        onPaste={e => { const f = [...e.clipboardData.files].find(x => x.type.startsWith('image/')); if (f) { e.preventDefault(); void subir(f) } }}
        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40"
        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
      >
        {subiendo ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}{tieneFoto ? 'Cambiar foto' : 'Subir foto'}
      </button>
    </>
  )
}
