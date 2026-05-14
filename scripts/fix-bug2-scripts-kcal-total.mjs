#!/usr/bin/env node
/**
 * fix-bug2-scripts-kcal-total.mjs
 *
 * BUG 2: Varios scripts escriben `kcal = totalKcal` (TOTAL de la receta)
 * en vez de `kcal = totalKcal / porciones` (POR PORCIÓN).
 *
 * Esto causa que la columna `kcal` tenga el valor total de la receta,
 * mientras que `kcal_por_porcion` tiene el valor correcto por porción.
 *
 * Archivos a corregir (por proyecto):
 *   - fix-ingredients-ia.ts
 *   - fix-orphan-ingredients.ts
 *   - fix-orphan-ingredients-v2.ts
 *   - revisar-recetas-cola-ia.ts
 *   - clean-instagram-raw.ts
 *
 * USO:
 *   node scripts/fix-bug2-scripts-kcal-total.mjs
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')

const PROYECTOS = [
    'nutricoach',
    'nutricoach-modulos',
    'nutricoach-ui',
]

const ARCHIVOS = [
    'scripts/fix-ingredients-ia.ts',
    'scripts/fix-orphan-ingredients.ts',
    'scripts/fix-orphan-ingredients-v2.ts',
    'scripts/revisar-recetas-cola-ia.ts',
    'scripts/clean-instagram-raw.ts',
]

/**
 * Busca el patrón exacto y aplica el fix.
 * 
 * Antes:
 *   kcal: Math.round(totalKcal * 100) / 100,
 *   proteinas: Math.round(totalP * 100) / 100,
 *   carbohidratos: Math.round(totalC * 100) / 100,
 *   grasas: Math.round(totalG * 100) / 100,
 *   fibra: Math.round(totalFibra * 100) / 100,
 * 
 * Después:
 *   kcal: Math.round((totalKcal / porciones) * 100) / 100,
 *   proteinas: Math.round((totalP / porciones) * 100) / 100,
 *   carbohidratos: Math.round((totalC / porciones) * 100) / 100,
 *   grasas: Math.round((totalG / porciones) * 100) / 100,
 *   fibra: Math.round((totalFibra / porciones) * 100) / 100,
 */
function fixFile(filePath) {
    const content = readFileSync(filePath, 'utf-8')
    const original = content

    // El patrón a buscar: `X: Math.round(totalX * 100) / 100,`
    // que NO esté seguido de `/ porciones`
    const re = /(\s+)(kcal|proteinas|carbohidratos|grasas|fibra): Math\.round\((total(Kcal|P|C|G|Fibra)) \* 100\) \/ 100,/g

    const fixed = content.replace(re, (match, spaces, field, totalVar) => {
        return `${spaces}${field}: Math.round((${totalVar} / porciones) * 100) / 100,`
    })

    if (fixed === original) {
        return { fixed: false, changes: 0 }
    }

    writeFileSync(filePath, fixed, 'utf-8')
    const changes = (fixed.match(/\/ porciones\)/g) || []).length
    return { fixed: true, changes }
}

let totalFixed = 0
let totalChanges = 0

for (const proyecto of PROYECTOS) {
    console.log(`\n📁 ${proyecto}/`)
    for (const archivo of ARCHIVOS) {
        const fullPath = resolve(RAÍZ, '..', proyecto, archivo)
        try {
            const result = fixFile(fullPath)
            if (result.fixed) {
                console.log(`  ✅ ${archivo} — ${result.changes} líneas corregidas`)
                totalFixed++
                totalChanges += result.changes
            } else {
                console.log(`  ⏭️  ${archivo} — sin cambios (ya corregido o patrón no encontrado)`)
            }
        } catch (err) {
            console.log(`  ❌ ${archivo} — ERROR: ${err.message}`)
        }
    }
}

console.log(`\n═══════════════════════════════════════`)
console.log(`✅ Archivos corregidos: ${totalFixed}`)
console.log(`✅ Líneas totales cambiadas: ${totalChanges}`)
console.log(`═══════════════════════════════════════\n`)
