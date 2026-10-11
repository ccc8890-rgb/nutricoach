'use client'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Grafica, { type Fila } from '@/components/rendimiento/Grafica'
import type { DatosCliente as Datos, Tendencia } from '@/lib/rendimiento/datos-cliente'

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
const COLOR = { azul: '#5B8DEF', verde: '#6AAF85', ambar: '#C8A96A', rosa: '#E0557A' }

function Seccion({ titulo, ayuda, children }: { titulo: string; ayuda: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{titulo}</h2>
      <div className="mt-3">{children}</div>
      <details className="mt-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <summary className="cursor-pointer select-none font-medium" style={{ color: 'var(--text-muted)' }}>¿Qué es esto?</summary>
        <p className="mt-1.5 leading-relaxed">{ayuda}</p>
      </details>
    </section>
  )
}

function Cifra({ etiqueta, valor, pie }: { etiqueta: string; valor: string; pie?: string }) {
  return (
    <div>
      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{etiqueta}</p>
      <p className="text-lg font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{valor}</p>
      {pie && <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{pie}</p>}
    </div>
  )
}

function MiniTendencia({ titulo, t, unidad, color }: { titulo: string; t: Tendencia; unidad: string; color: string }) {
  const filas = useMemo<Fila[]>(() => t.puntos.map(p => ({ fecha: p.fecha, v: p.valor })), [t])
  const lectura = t.posicion === 'dentro' ? 'dentro de tu rango habitual' : t.posicion === 'sobre' ? 'por encima de tu rango habitual' : t.posicion === 'bajo' ? 'por debajo de tu rango habitual' : 'aún sin rango habitual (faltan días)'
  return (
    <div>
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}><span className="font-semibold" style={{ color: 'var(--text)' }}>{titulo}: {t.actual} {unidad}</span> · {lectura}</p>
      <Grafica datos={filas} alto={90} banda={t.normal} series={[{ key: 'v', label: titulo, color }]} formato={v => `${Math.round(v)} ${unidad}`} />
    </div>
  )
}

/** Pestaña «Datos»: recuperación, sueño, carga y progreso del entrenamiento, con lo que el reloj y los entrenos realmente miden. */
export default function DatosCliente({ codigo, ultimoPeso, cambioPeso, onVerProgreso, onAjustes }: {
  codigo: string
  ultimoPeso: number | null
  cambioPeso: number | null
  onVerProgreso: () => void
  onAjustes: () => void
}) {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let vivo = true
    fetch(`/api/cliente/${encodeURIComponent(codigo)}/datos`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => { if (vivo) setDatos(d) })
      .catch(() => { if (vivo) setError(true) })
    return () => { vivo = false }
  }, [codigo])

  const semanas = useMemo<Fila[]>(() => (datos?.carga?.semanas ?? []).map(s => ({ fecha: s.semana, tss: s.tss })), [datos])
  const sueno = useMemo<Fila[]>(() => (datos?.sueno?.noches ?? []).map(n => ({ fecha: n.fecha, h: n.horas })), [datos])

  if (error) return <p className="px-1 text-sm" style={{ color: 'var(--text-muted)' }}>No se pudieron cargar tus datos. Inténtalo de nuevo en un momento.</p>
  if (!datos) return <div className="h-40 animate-pulse rounded-3xl" style={{ background: 'var(--surface)' }} />

  const r = datos.recuperacion
  const b = datos.baseAerobica
  const colorNivel = r ? { baja: COLOR.ambar, moderada: COLOR.azul, alta: COLOR.verde }[r.nivel] : COLOR.azul

  return (
    <div className="flex flex-col gap-4">
      {!datos.tieneReloj && (
        <div className="rounded-3xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Conecta tu reloj</p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>Con tu reloj verás aquí tu recuperación, tu pulso en reposo y cómo mejora tu entrenamiento.</p>
          <button className="btn btn-primary mt-3 rounded-xl cursor-pointer" onClick={onAjustes}>Conectar en Ajustes</button>
        </div>
      )}

      {r && (
        <Seccion titulo="Recuperación" ayuda="Es la puntuación de «preparación para entrenar» de tu Garmin (0 a 100). Combina cómo has dormido, cuánto has entrenado, tu variabilidad cardiaca (HRV) y tu estrés. Alta: puedes apretar. Baja: mejor suave o descansar. Es una guía del reloj, no un diagnóstico.">
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-bold tabular-nums" style={{ color: colorNivel }}>{r.puntuacion}</span>
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{{ baja: 'Recuperación baja', moderada: 'Recuperación moderada', alta: 'Recuperación alta' }[r.nivel]}</span>
          </div>
          {r.motivo && <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{r.motivo}</p>}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {r.pulsoReposo != null && <Cifra etiqueta="Pulso en reposo" valor={`${r.pulsoReposo} ppm`} />}
            {r.hrvSemanal != null && <Cifra etiqueta="HRV (media semanal)" valor={`${r.hrvSemanal} ms`} />}
            {r.bateriaMax != null && <Cifra etiqueta="Batería corporal" valor={`${r.bateriaMax}`} pie="máx. de hoy" />}
          </div>
          <div className="mt-4 space-y-4">
            {datos.tendencias.preparacion && <MiniTendencia titulo="Preparación" t={datos.tendencias.preparacion} unidad="" color={COLOR.azul} />}
            {datos.tendencias.pulsoReposo && <MiniTendencia titulo="Pulso en reposo" t={datos.tendencias.pulsoReposo} unidad="ppm" color={COLOR.rosa} />}
          </div>
        </Seccion>
      )}

      {datos.sueno && (
        <Seccion titulo="Sueño" ayuda="Horas dormidas según tu reloj en las últimas noches. Para que se registre, llévalo puesto al dormir. Lo recomendable para quien entrena es dormir entre 7 y 9 horas.">
          <p className="text-sm" style={{ color: 'var(--text)' }}><span className="text-2xl font-semibold tabular-nums">{datos.sueno.mediaHoras} h</span> <span className="text-xs" style={{ color: 'var(--text-muted)' }}>de media en las últimas {datos.sueno.noches.length} noches</span></p>
          <Grafica datos={sueno} alto={90} series={[{ key: 'h', label: 'Horas', color: COLOR.azul, tipo: 'barras' }]} formato={v => `${v.toFixed(1)} h`} />
        </Seccion>
      )}

      {datos.carga && (
        <Seccion titulo="Entrenamiento" ayuda="Cada sesión suma un «estrés de entrenamiento» según su duración e intensidad. La barra es el total de cada semana. Lo sano es subir poco a poco y bajar una semana de cada tres o cuatro. «Cómo vienes» resume si vas descansado, equilibrado o cargado.">
          <p className="text-sm" style={{ color: 'var(--text)' }}>Cómo vienes: <span className="font-semibold">{datos.carga.estado}</span></p>
          {datos.carga.semanaActual && (
            <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>Esta semana: {datos.carga.semanaActual.sesiones} sesiones{datos.carga.semanaActual.km > 0 ? ` · ${datos.carga.semanaActual.km} km` : ''}</p>
          )}
          <Grafica datos={semanas} alto={100} series={[{ key: 'tss', label: 'Estrés de entrenamiento', color: COLOR.verde, tipo: 'barras' }]} formato={v => `${Math.round(v)}`} />
        </Seccion>
      )}

      {b.valoracion !== 'sin_datos' && b.reciente && b.previa && b.fcRef && b.cambioSeg !== null && (
        <Seccion titulo="Tu base aeróbica" ayuda="Compara tus rodajes suaves de las últimas 4 semanas con los de las 4 anteriores. Si a igual pulso corres más rápido, tu cuerpo es más eficiente: es la mejor señal de que el entrenamiento funciona. Un cambio pequeño es normal por el calor, el sueño o el terreno; fíjate en la tendencia de varias semanas.">
          <p className="text-sm" style={{ color: 'var(--text)' }}>
            A <span className="font-semibold tabular-nums">{b.fcRef} ppm</span> corres a <span className="font-semibold tabular-nums">{mmss(b.reciente.ritmoRef)}/km</span>
          </p>
          <p className="mt-1 text-xs" style={{ color: b.valoracion === 'mejora' ? COLOR.verde : b.valoracion === 'retrocede' ? COLOR.ambar : 'var(--text-secondary)' }}>
            {b.valoracion === 'mejora' ? `Mejoras: ${Math.abs(Math.round(b.cambioSeg))} s/km más rápido que hace un mes con el mismo pulso.`
              : b.valoracion === 'retrocede' ? `Ahora mismo vas ${Math.abs(Math.round(b.cambioSeg))} s/km más lento con el mismo pulso. Puede ser cansancio o calor; tu coach lo tiene en cuenta.`
              : 'Estable respecto al mes pasado.'}
          </p>
        </Seccion>
      )}

      {ultimoPeso != null && (
        <Seccion titulo="Cuerpo" ayuda="Tu último peso registrado y el cambio desde el inicio. El peso varía varios cientos de gramos de un día a otro; mira la tendencia de semanas, no el dato de hoy.">
          <div className="flex items-end justify-between gap-3">
            <p className="text-3xl font-bold tabular-nums" style={{ color: 'var(--text)' }}>{ultimoPeso} <span className="text-base font-medium" style={{ color: 'var(--text-secondary)' }}>kg</span></p>
            {cambioPeso !== null && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{cambioPeso > 0 ? '+' : ''}{cambioPeso.toFixed(1)} kg desde el inicio</p>}
          </div>
          <button className="btn mt-3 rounded-xl cursor-pointer" onClick={onVerProgreso}>Ver mi progreso</button>
        </Seccion>
      )}
    </div>
  )
}
