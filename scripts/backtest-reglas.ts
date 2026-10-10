#!/usr/bin/env tsx
/**
 * Backtest del motor de reglas sobre el historial real de un atleta (solo lectura): para cada fecha recorta los entrenos hasta ese día
 * y muestra qué habría propuesto el motor. Sirve para detectar reglas que disparan sin sentido o que no avisan cuando debían.
 * No incluye competición ni plan (no hay histórico de ambos): tapering y fuerza_sin_registro no se ejercitan aquí.
 *
 * USO:  npx tsx scripts/backtest-reglas.ts [clienteId] [--cada=14]
 */
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createServiceSupabase } from '../lib/supabase-server'
import { construirPanel, type EntrenoPanel } from '../lib/rendimiento/panel'
import { calcularAlertas } from '../lib/rendimiento/alertas'
import { construirEstado } from '../lib/rendimiento/estado'
import { evaluarReglas } from '../lib/rendimiento/reglas'
import { leerUmbrales } from '../lib/rendimiento/garmin-entrenos'

const CLIENTE = process.argv.find(a => /^[0-9a-f-]{36}$/.test(a)) ?? '04cc53b3-851e-43f9-b271-daf1577b743e'
const CADA = Number(process.argv.find(a => a.startsWith('--cada='))?.split('=')[1] ?? 14)
const sumar = (f: string, n: number) => { const d = new Date(`${f}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

;(async () => {
  const db = createServiceSupabase()
  const [{ data: entrenos }, umbrales, { data: perfil }] = await Promise.all([
    db.from('entrenos_realizados').select('fecha,tipo,nombre,duracion_s,distancia_m,ritmo_medio_s_km,fc_media,tss,tss_metodo,carga_garmin,vo2max,tiempo_zona_fc,mejores_parciales,vueltas,raw').eq('cliente_id', CLIENTE).order('fecha'),
    leerUmbrales(db, CLIENTE),
    db.from('perfil_entreno_cliente').select('vdot').eq('cliente_id', CLIENTE).maybeSingle(),
  ])
  const todos = (entrenos ?? []) as EntrenoPanel[]
  const vdot = perfil?.vdot ? Number(perfil.vdot) : null
  const hoy = new Date().toISOString().slice(0, 10)
  const desde = sumar(hoy, -CADA * 14)
  const conteo: Record<string, number> = {}
  let fechas = 0

  for (let f = desde; f <= hoy; f = sumar(f, CADA)) {
    const hasta = todos.filter(e => e.fecha <= f)
    if (!hasta.length) continue
    const panel = construirPanel(hasta, [], f, 180, umbrales.fcUmbral, umbrales.fcMax)
    const alertas = calcularAlertas({ resumen: panel.resumen, semanas: panel.semanas, diasParaCompeticion: null })
    const estado = construirEstado({ hoy: f, panel, fcUmbral: umbrales.fcUmbral, vdot, diasCompeticion: null, ejecucion: [], nombresSesionesPlan: [], alertas })
    const r = evaluarReglas(estado)
    fechas++
    for (const p of r.propuestas) conteo[p.regla] = (conteo[p.regla] ?? 0) + 1
    const resumen = `CTL ${estado.carga?.ctl ?? '-'} TSB ${estado.carga?.tsb ?? '-'} · ${estado.carreras6sem} carreras/6sem · suave ${estado.intensidad.valoracion === 'sin_datos' ? 's/d' : estado.intensidad.pctSuave + '%'} · deriva ${estado.deriva.media?.toFixed(1) ?? 's/d'}`
    console.log(`${f}  ${resumen}\n   → ${r.propuestas.map(p => p.regla).join(', ') || '(sin propuestas)'}${r.notas.length ? `   [nota: ${r.notas[0].slice(0, 70)}…]` : ''}`)
  }
  console.log(`\nFechas evaluadas: ${fechas}. Reglas disparadas: ${JSON.stringify(conteo)}`)
})()
