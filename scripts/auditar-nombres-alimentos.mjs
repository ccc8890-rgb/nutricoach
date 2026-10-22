/**
 * auditar-nombres-alimentos.mjs (solo lectura)
 * Revisa los alimentos que USAN las recetas: nombre en minúscula, duplicados (mismo nombre sin tildes/mayúsculas),
 * palabras raras que solo aparecen en un alimento del catálogo (posible errata, p. ej. «queso cotas») y macros que no
 * casan con el nombre (queso fresco/cottage con más de 15 g de grasa).
 *   node scripts/auditar-nombres-alimentos.mjs
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const todo = async (t, c) => { const o = []; for (let f = 0; ; f += 1000) { const { data, error } = await sb.from(t).select(c).range(f, f + 999); if (error) throw error; o.push(...data); if (data.length < 1000) break } return o }
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

const alimentos = await todo('alimentos', 'id,nombre,calorias,grasas')
const usos = new Map()
for (const r of await todo('receta_ingredientes', 'alimento_id')) if (r.alimento_id) usos.set(r.alimento_id, (usos.get(r.alimento_id) || 0) + 1)
const usados = alimentos.filter(a => usos.has(a.id))

const minus = usados.filter(a => /^\p{Ll}/u.test(a.nombre))
const grupos = new Map()
for (const a of usados) { const k = norm(a.nombre); (grupos.get(k) ?? grupos.set(k, []).get(k)).push(a) }
const dup = [...grupos.values()].filter(g => g.length > 1)

const freq = new Map()
for (const a of alimentos) for (const t of new Set(norm(a.nombre).split(' '))) if (t.length >= 4) freq.set(t, (freq.get(t) || 0) + 1)
const raras = usados.filter(a => norm(a.nombre).split(' ').some(t => t.length >= 4 && freq.get(t) === 1 && !/\d/.test(t)) && (usos.get(a.id) <= 3))

const incoh = usados.filter(a => /\b(queso (fresco|cottage|batido)|cottage|requeson)\b/.test(norm(a.nombre)) && a.grasas > 15)

console.log(`Alimentos en uso: ${usados.length} | en minúscula: ${minus.length} | grupos duplicados: ${dup.length} | nombres con palabra única (posible errata): ${raras.length} | macros que no casan: ${incoh.length}`)
for (const a of minus) console.log('  MINÚSCULA', a.nombre)
for (const g of dup) console.log('  DUPLICADO', g.map(a => `${a.nombre} (${usos.get(a.id)} usos, ${a.calorias} kcal)`).join('  ~  '))
for (const a of raras) console.log('  ¿ERRATA?', a.nombre, `(${usos.get(a.id)} usos)`)
for (const a of incoh) console.log('  MACROS', a.nombre, `${a.calorias} kcal, ${a.grasas} g grasa`)
