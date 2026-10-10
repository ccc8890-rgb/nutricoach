#!/usr/bin/env tsx
/**
 * Depuración de entradas antiguas de la base de conocimiento (running/híbrido/recuperación) contrastadas con PubMed el 10-10-2026.
 *  - Desactiva (activo=false, reversible) las que citan algo que no existe, tienen un DOI que apunta a otro artículo,
 *    afirman lo contrario de la evidencia actual o son duplicado de una entrada verificada.
 *  - Corrige la de Seiler y Kjerland 2006 (estudió esquiadores de fondo júnior, no remeros) con su abstract real.
 * Guarda copia de cada fila en salidas/ antes de tocarla.
 *
 * USO:  npx tsx scripts/depurar-kb-entrenamiento-2026-10-10.ts          # simula
 *       npx tsx scripts/depurar-kb-entrenamiento-2026-10-10.ts --apply  # aplica
 *       npx tsx scripts/depurar-kb-entrenamiento-2026-10-10.ts --revertir <archivo copia>  # devuelve las filas a su estado anterior
 */
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import fs from 'node:fs'
import { searchPubMed } from '../lib/ingesta-papers/pubmed-api'
import { createServiceSupabase } from '../lib/supabase-server'

const DESACTIVAR: { prefijo: string; motivo: string }[] = [
  { prefijo: 'f2461ac2', motivo: 'Casado 2022: el DOI 10.1007/s40279-022-01657-y no existe en PubMed; no se puede comprobar el «meta-análisis de 34 estudios» ni el «85-90 % polarizado».' },
  { prefijo: '7d8e9735', motivo: 'Mujika y Padilla «2003 Desentrenamiento»: el DOI apunta a otro artículo (aspectos bioquímicos del sobreentrenamiento) y está etiquetado como metaanálisis siendo una revisión.' },
  { prefijo: '90317f8d', motivo: '«Regla del 10 %»: sin DOI, atribuida a Gabbett 2016 (que trata de otra cosa), etiquetada como metaanálisis, y presenta el ACWR como mejor predictor de lesión, lo contrario de la crítica actual (Impellizzeri 2020-2021).' },
  { prefijo: '45d807a7', motivo: 'Polarizado en running: sin DOI, atribuida a Seiler y Kjerland 2006 (esquiadores), con afirmaciones absolutas («evitar la zona 3», «estudios con recreacionales») que no se pueden comprobar. Sustituida por Seiler 2010 y Stöggl y Sperlich 2014, verificados.' },
  { prefijo: '7c20aea3', motivo: 'Duplicado de Plews 2013 (la otra fila sí lleva DOI).' },
]
const SEILER_2006 = { prefijo: 'e0667596', doi: '10.1111/j.1600-0838.2004.00418.x' }

;(async () => {
  const db = createServiceSupabase()
  const arg = process.argv.indexOf('--revertir')
  if (arg !== -1) {
    const filas = JSON.parse(fs.readFileSync(process.argv[arg + 1], 'utf8')) as Record<string, unknown>[]
    for (const f of filas) { const { id, ...resto } = f; await db.from('knowledge_base').update(resto).eq('id', id as string) }
    console.log(`✓ ${filas.length} filas restauradas`); return
  }
  const aplicar = process.argv.includes('--apply')
  const { data } = await db.from('knowledge_base').select('*').in('disciplina', ['running', 'hibrido', 'recuperacion'])
  const por = (p: string) => (data ?? []).find(r => (r.id as string).startsWith(p))
  const copia: Record<string, unknown>[] = []

  for (const d of DESACTIVAR) {
    const r = por(d.prefijo)
    if (!r) { console.log(`✗ no está: ${d.prefijo}`); continue }
    console.log(`${r.activo ? '→ DESACTIVAR' : '= ya inactiva'} #${d.prefijo} ${String(r.titulo).slice(0, 80)}\n    ${d.motivo}`)
    if (r.activo) { copia.push(r); if (aplicar) await db.from('knowledge_base').update({ activo: false }).eq('id', r.id) }
  }

  const s = por(SEILER_2006.prefijo)
  if (s) {
    const pm = (await searchPubMed(`${SEILER_2006.doi}[aid]`, 'manual' as never, 1))[0]
    if (pm?.abstract) {
      console.log(`→ CORREGIR #${SEILER_2006.prefijo}: «${String(s.titulo).slice(0, 70)}» → Seiler 2006 con su abstract real (esquiadores de fondo júnior)`)
      copia.push(s)
      if (aplicar) await db.from('knowledge_base').update({
        titulo: 'Seiler KS & Kjerland GØ (2006) — Distribución de intensidad en esquiadores de fondo júnior bien entrenados',
        resumen: pm.abstract.slice(0, 500), contenido_completo: pm.abstract, nivel_evidencia: 'estudio_observacional',
        puntos_clave: ['Uso en NutriCoach: cuantificó la distribución de intensidad en 11 esquiadores de fondo júnior con tres métodos y delimitó tres zonas con los umbrales ventilatorios VT1 y VT2 (base del reparto suave/medio/duro del panel). No es un estudio de corredores.'],
      }).eq('id', s.id)
    }
  }

  if (aplicar && copia.length) {
    fs.mkdirSync('salidas', { recursive: true })
    const ruta = `salidas/10-10-2026_copia-kb-depuracion.json`
    fs.writeFileSync(ruta, JSON.stringify(copia, null, 2))
    console.log(`\n✓ aplicado; copia de las filas originales en ${ruta} (restaurar: --revertir ${ruta})`)
  } else if (!aplicar) console.log('\n(simulación; usa --apply para aplicar)')
})()
