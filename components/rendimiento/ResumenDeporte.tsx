'use client'
import { useMemo } from 'react'
import Grafica, { type Fila } from './Grafica'
import { Bloque, COLOR, Tarjeta, fechaCorta } from './comun'
import type { ResumenDeporte as Resumen } from '@/lib/rendimiento/panel'

/** Resumen de un deporte: totales de las últimas 4 semanas y su carga semanal (12 semanas). */
export default function ResumenDeporte({ resumen, nombre, conKm }: { resumen: Resumen; nombre: string; conKm: boolean }) {
  const filas = useMemo<Fila[]>(() => resumen.semanas.map(s => ({ fecha: s.semana, tss: s.tss, km: s.km })), [resumen])

  if (resumen.sesiones === 0) {
    return <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Todavía no hay entrenos de {nombre.toLowerCase()} para este atleta.</p>
  }

  const ult = resumen.semanas.slice(-4)
  const suma = (f: (s: (typeof ult)[number]) => number) => ult.reduce((a, s) => a + f(s), 0)
  const sesiones = suma(s => s.sesiones)
  const horas = suma(s => s.minutos) / 60

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tarjeta titulo="Sesiones" valor={String(sesiones)} pie="Últimas 4 semanas" />
        <Tarjeta titulo="Horas" valor={horas.toFixed(1)} pie="Últimas 4 semanas" />
        {conKm
          ? <Tarjeta titulo="Km" valor={String(Math.round(suma(s => s.km)))} pie="Últimas 4 semanas" />
          : <Tarjeta titulo="Total histórico" valor={String(resumen.sesiones)} pie="Sesiones registradas" />}
        <Tarjeta titulo="Carga (TSS)" valor={String(Math.round(suma(s => s.tss)))} pie={resumen.ultimaFecha ? `Última sesión: ${fechaCorta(resumen.ultimaFecha)}` : undefined} color={COLOR.forma} />
      </div>
      <div className={`grid gap-4 ${conKm ? 'lg:grid-cols-2' : ''}`}>
        <Bloque titulo="Carga por semana" nota={`Estrés de entrenamiento (TSS) de ${nombre.toLowerCase()}, últimas 12 semanas.`}>
          <Grafica datos={filas} alto={150} series={[{ key: 'tss', label: 'TSS semanal', color: COLOR.forma, tipo: 'barras' }]} formato={v => String(Math.round(v))} />
        </Bloque>
        {conKm && (
          <Bloque titulo="Kilómetros por semana" nota={`Distancia de ${nombre.toLowerCase()}, últimas 12 semanas.`}>
            <Grafica datos={filas} alto={150} series={[{ key: 'km', label: 'km', color: COLOR.fresc, tipo: 'barras' }]} formato={v => `${Math.round(v * 10) / 10} km`} />
          </Bloque>
        )}
      </div>
    </div>
  )
}
