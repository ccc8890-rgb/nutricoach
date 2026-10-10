'use client'
import { useRef, useState } from 'react'
import { Bloque, COLOR, tipoLegible } from './comun'

interface Resultado {
  fecha: string
  tipo: string
  duracion_min: number
  km: number | null
  potencia_media: number | null
  potencia_normalizada: number | null
  tss: number | null
  tss_metodo: string | null
  sin_ftp: boolean
}

/** Sube un archivo .fit (iGPSPORT, Wahoo, Garmin…) y lo añade a los entrenos del atleta. */
export default function SubirActividadFit({ clienteId, onSubido }: { clienteId: string; onSubido: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<Resultado | null>(null)

  async function subir(archivo: File) {
    setSubiendo(true)
    setError(null)
    setHecho(null)
    try {
      const form = new FormData()
      form.append('archivo', archivo)
      const r = await fetch(`/api/clientes/${clienteId}/entrenos/fit`, { method: 'POST', body: form })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error ?? 'No se pudo subir el archivo.')
      setHecho(j.entreno)
      onSubido()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir el archivo.')
    } finally {
      setSubiendo(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <Bloque titulo="Subir actividad (.fit)" nota="Para entrenos que no llegan solos desde Garmin, como los del iGPSPORT. Exporta el archivo .fit desde su app y súbelo aquí: se guardan potencia, pulso, cadencia y vueltas.">
      <input ref={input} type="file" accept=".fit" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void subir(f) }} />
      <button onClick={() => input.current?.click()} disabled={subiendo} className="rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-60"
        style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text)' }}>
        {subiendo ? 'Subiendo…' : 'Elegir archivo .fit'}
      </button>
      {error && <p className="mt-2 text-xs" style={{ color: COLOR.fatiga }} role="alert">{error}</p>}
      {hecho && (
        <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }} role="status">
          Guardado: {tipoLegible[hecho.tipo] ?? hecho.tipo} del {hecho.fecha} · {hecho.duracion_min} min{hecho.km ? ` · ${hecho.km} km` : ''}
          {hecho.potencia_media ? ` · ${hecho.potencia_media} W de media${hecho.potencia_normalizada ? ` (normalizada ${hecho.potencia_normalizada} W)` : ''}` : ''}
          {hecho.tss !== null ? ` · carga ${Math.round(hecho.tss)} TSS (${hecho.tss_metodo === 'potencia' ? 'por potencia' : 'por pulso'})` : ''}.
          {hecho.sin_ftp && ' Falta el FTP del atleta (Perfil atleta) para calcular la carga por potencia; de momento se usó el pulso.'}
        </p>
      )}
    </Bloque>
  )
}
