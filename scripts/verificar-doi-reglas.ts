#!/usr/bin/env tsx
/**
 * Comprueba que cada DOI que citan las reglas del motor existe, activo, en la base de conocimiento (lectura).
 * Si falla alguno, esa regla perdería su cita sin avisar: ejecutar tras tocar la base o las reglas.
 */
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createServiceSupabase } from '../lib/supabase-server'
import { estudiosPorDoi } from '../lib/rendimiento/evidencia'
import { DOI } from '../lib/rendimiento/reglas'
;(async () => {
  const dois = Object.values(DOI)
  const mapa = await estudiosPorDoi(createServiceSupabase(), dois)
  let faltan = 0
  for (const [nombre, d] of Object.entries(DOI)) {
    const e = mapa.get(d)
    if (!e) { faltan++; console.log(`✗ FALTA  ${nombre.padEnd(24)} ${d}`); continue }
    console.log(`✓ ${nombre.padEnd(24)} ${(e.anio ?? '----')} ${e.nivel.padEnd(22)} ${e.titulo.slice(0, 70)}`)
  }
  console.log(faltan ? `\n${faltan} DOI sin estudio en la base` : `\nLos ${dois.length} DOI de las reglas están en la base`)
  process.exit(faltan ? 1 : 0)
})()
