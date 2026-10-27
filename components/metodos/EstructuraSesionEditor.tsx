'use client'

import { BLOQUES_SESION, etiquetaBloqueSesion } from '@/lib/training/session-blocks'
import type { BloqueMetodo, EjercicioMetodo } from '@/lib/metodos/constantes'

const NUEVO_EJERCICIO: EjercicioMetodo = { texto_original: '', ejercicio_id: null, series: null, reps: null, duracion_seg: null, pausa_seg: null, intensidad: null, nota: null }

function mover<T>(lista: T[], i: number, hacia: -1 | 1): T[] {
  const j = i + hacia
  if (j < 0 || j >= lista.length) return lista
  const copia = [...lista]
  ;[copia[i], copia[j]] = [copia[j], copia[i]]
  return copia
}
const numero = (v: string): number | null => (v.trim() === '' ? null : Number(v))

// Editor de los bloques y ejercicios de una ficha de tipo «sesión». Sin enlazar con el catálogo: eso se hace al usar la ficha.
export default function EstructuraSesionEditor({ valor, onCambio }: { valor: BloqueMetodo[]; onCambio: (v: BloqueMetodo[]) => void }) {
  const cambiarBloque = (i: number, parche: Partial<BloqueMetodo>) => onCambio(valor.map((b, k) => (k === i ? { ...b, ...parche } : b)))
  const cambiarEjercicio = (i: number, j: number, parche: Partial<EjercicioMetodo>) =>
    cambiarBloque(i, { ejercicios: valor[i].ejercicios.map((e, k) => (k === j ? { ...e, ...parche } : e)) })

  return (
    <div className="space-y-4">
      {valor.map((b, i) => (
        <section key={i} className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 flex-wrap">
            <select className="input" style={{ maxWidth: 220 }} value={b.tipo} onChange={e => cambiarBloque(i, { tipo: e.target.value as BloqueMetodo['tipo'] })} aria-label="Tipo de bloque">
              {BLOQUES_SESION.map(t => <option key={t} value={t}>{etiquetaBloqueSesion(t)}</option>)}
            </select>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onCambio(mover(valor, i, -1))} aria-label="Subir bloque">↑</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onCambio(mover(valor, i, 1))} aria-label="Bajar bloque">↓</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onCambio(valor.filter((_, k) => k !== i))}>Quitar bloque</button>
          </div>
          {b.ejercicios.map((e, j) => (
            <div key={j} className="grid gap-2 items-center" style={{ gridTemplateColumns: 'minmax(0,3fr) 70px 80px 80px minmax(0,1.5fr) auto' }}>
              <input className="input" value={e.texto_original} onChange={ev => cambiarEjercicio(i, j, { texto_original: ev.target.value })} placeholder="Ejercicio" aria-label="Ejercicio" />
              <input className="input" type="number" min={1} max={20} value={e.series ?? ''} onChange={ev => cambiarEjercicio(i, j, { series: numero(ev.target.value) })} placeholder="Series" aria-label="Series" />
              <input className="input" value={e.reps ?? ''} onChange={ev => cambiarEjercicio(i, j, { reps: ev.target.value || null })} placeholder="Reps" aria-label="Repeticiones" />
              <input className="input" type="number" min={0} max={900} value={e.pausa_seg ?? ''} onChange={ev => cambiarEjercicio(i, j, { pausa_seg: numero(ev.target.value) })} placeholder="Pausa s" aria-label="Pausa en segundos" />
              <input className="input" value={e.intensidad ?? ''} onChange={ev => cambiarEjercicio(i, j, { intensidad: ev.target.value || null })} placeholder="Intensidad / nota" aria-label="Intensidad" />
              <span className="flex gap-1">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => cambiarBloque(i, { ejercicios: mover(b.ejercicios, j, -1) })} aria-label="Subir ejercicio">↑</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => cambiarBloque(i, { ejercicios: mover(b.ejercicios, j, 1) })} aria-label="Bajar ejercicio">↓</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => cambiarBloque(i, { ejercicios: b.ejercicios.filter((_, k) => k !== j) })} aria-label="Quitar ejercicio">✕</button>
              </span>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => cambiarBloque(i, { ejercicios: [...b.ejercicios, { ...NUEVO_EJERCICIO }] })}>+ Ejercicio</button>
        </section>
      ))}
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => onCambio([...valor, { tipo: 'principal', ejercicios: [{ ...NUEVO_EJERCICIO }] }])}>+ Bloque</button>
    </div>
  )
}
