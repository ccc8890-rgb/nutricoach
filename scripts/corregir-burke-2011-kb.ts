#!/usr/bin/env tsx
/**
 * Corrige la entrada de Burke 2011 en la base de estudios (10-10-2026):
 *  - desactiva (no borra) las 2 copias activas sin DOI («Carbohidratos perientrino/perientreno…»),
 *  - quita de la entrada con DOI la etiqueta errónea «ACSM» (es un consenso del COI en J Sports Sci)
 *    y avisa de que algunas cifras no figuran en el abstract.
 * USO: npx tsx scripts/corregir-burke-2011-kb.ts [--apply]   (simula por defecto)
 */
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createServiceSupabase } from '../lib/supabase-server'

const DOI = '10.1080/02640414.2011.585473'
const AVISO = 'Aviso: la pre-carga 7-12 g/kg y el 1-1,5 g/kg posejercicio de este resumen no figuran en el abstract original; para recuperación entre sesiones usar ISSN nutrient timing (10.1186/s12970-017-0189-4) y Beelen 2010 (10.1123/ijsnem.20.6.515).'

;(async () => {
  const aplicar = process.argv.includes('--apply')
  const db = createServiceSupabase()
  const { data: copias } = await db.from('knowledge_base').select('id, titulo, activo').is('doi', null).ilike('titulo', 'Carbohidratos perien%').eq('activo', true)
  console.log(`Copias activas sin DOI (títulos «Carbohidratos perien…») a desactivar: ${(copias ?? []).length}`)
  for (const c of copias ?? []) console.log('  -', c.id, c.titulo)

  const { data: principal } = await db.from('knowledge_base').select('id, resumen, puntos_clave').eq('doi', DOI).eq('activo', true).maybeSingle()
  if (!principal) { console.log('No se encontró la entrada con DOI'); return }
  const resumenNuevo = (principal.resumen ?? '').replace('Revisión del American College of Sports Medicine (ACSM) sobre', 'Consenso del Comité Olímpico Internacional (J Sports Sci, 2011) sobre')
  const puntos: string[] = Array.isArray(principal.puntos_clave) ? principal.puntos_clave : []
  const puntosNuevos = puntos.includes(AVISO) ? puntos : [...puntos, AVISO]
  console.log(`Etiqueta ACSM corregida: ${resumenNuevo !== principal.resumen ? 'sí' : 'no (no estaba)'}`)

  if (!aplicar) { console.log('(simulación; usa --apply)'); return }
  for (const c of copias ?? []) await db.from('knowledge_base').update({ activo: false }).eq('id', c.id)
  await db.from('knowledge_base').update({ resumen: resumenNuevo, puntos_clave: puntosNuevos }).eq('id', principal.id)
  console.log('✓ aplicado')
})()
