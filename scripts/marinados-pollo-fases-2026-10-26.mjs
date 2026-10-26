/**
 * Reorganiza «5 marinados de pollo para congelar» en una sola receta con 5 fases (grupo por marinado),
 * enlaces corregidos y 20 raciones (5 bolsas × 4 de 150 g de pollo). Borra las 5 recetas sueltas creadas antes.
 *   node scripts/marinados-pollo-fases-2026-10-26.mjs [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const APPLY = process.argv.includes('--apply')
const ID = '392195a9-b0e1-481d-8994-e49a4686a42a'
const SUELTAS = ['668c28b4-c0a3-4ac5-818b-84f6e2c7ec23', '6442f652-547d-4e5e-bee7-89c7a36f1846', '6454198e-b07f-4c9a-9034-adf2fa36980e', '3f387f92-df96-47b8-811f-9624c267a980', '6444d278-606f-4016-aa41-b759f18b63c0']

const lote = JSON.parse(readFileSync('scripts/lotes/2026-10-26_marinados-pollo-congelar.json', 'utf8'))
const ALIM = { ...lote.alimentos, chile: { nombre: 'Hojuelas de chile (chili flakes)', prefijo: '2a7ea4dc', rol: 'especias_aromaticos' } }
const id = {}
for (const [k, a] of Object.entries(ALIM)) {
  const { data } = await db.from('alimentos').select('id').eq('nombre', a.nombre).eq('es_comestible', true)
  const c = (data ?? []).filter(x => x.id.startsWith(a.prefijo))
  if (c.length !== 1) throw new Error(`${k}: ${c.length} coincidencias`)
  id[k] = c[0].id
}

const FASES = [
  { n: 'Fajitas', ing: [['pollo', 600], ['aceite', 30], ['miel', 15], ['lima', 10], ['cebolla', 5], ['ajo', 5], ['pimenton', 5], ['cayena', 3], ['comino', 2.5], ['sal', 3]],
    p: ['Corta 600 g de pechuga de pollo en tiras.', 'En una bolsa de congelación, mezcla 2 cdas de aceite de oliva, 1 cda de miel, 2 cdtas de zumo de lima, 1 cdta de cebolla en polvo, 1 cdta de ajo en polvo, 1 cdta de pimentón, ½ cdta de cayena, ½ cdta de comino y ½ cdta de sal. Añade el pollo y masajea para repartir el marinado.'] },
  { n: 'Cilantro y lima', ing: [['pollo', 600], ['aceite', 30], ['lima', 20], ['cilantro', 15], ['sal', 3], ['pimienta', 1]],
    p: ['Corta 600 g de pechuga de pollo en tiras o filetes y pica fino el cilantro (unos 15 g).', 'En otra bolsa, mezcla 2 cdas de aceite de oliva, 4 cdtas de zumo de lima, el cilantro picado, ½ cdta de sal y una pizca de pimienta. Añade el pollo y masajea.'] },
  { n: 'Piña y soja', ing: [['pollo', 600], ['aceite', 30], ['pina', 100], ['soja', 45], ['cebolla', 3], ['pimienta', 1]],
    p: ['Corta 600 g de pechuga de pollo en dados o tiras.', 'En otra bolsa, mezcla 2 cdas de aceite de oliva, 100 ml de zumo de piña, 3 cdas de salsa de soja, ½ cdta de cebolla en polvo y una pizca de pimienta (no lleva sal: la soja ya aporta). Añade el pollo y masajea.'] },
  { n: 'Miel y mostaza', ing: [['pollo', 600], ['aceite', 30], ['limon', 15], ['miel', 30], ['mostaza', 30], ['sal', 3], ['pimienta', 1]],
    p: ['Corta 600 g de pechuga de pollo en filetes o tiras.', 'En otra bolsa, mezcla 2 cdas de aceite de oliva, 1 cda de zumo de limón, 2 cdas de miel, 2 cdas de mostaza de Dijon, ½ cdta de sal y una pizca de pimienta. Añade el pollo y masajea.'] },
  { n: 'Barbacoa', ing: [['pollo', 600], ['bbq', 100], ['miel', 15], ['limon', 7.5], ['chile', 2], ['sal', 3]],
    p: ['Deja 600 g de pechuga entera con unos cortes superficiales para que el marinado entre bien.', 'En otra bolsa, mezcla 100 g (unos 100 ml) de salsa barbacoa, 1 cda de miel, 1½ cdtas de zumo de limón, ½ cdta de copos de chile y ½ cdta de sal. Añade el pollo y masajea.'] },
]
const FINAL = ['Etiqueta cada bolsa con el nombre del marinado, saca el aire, cierra y congélalas en plano (ocupan menos y se descongelan antes).', 'La noche antes de cocinarlo, pasa la bolsa que quieras a la nevera para descongelar.', 'Cocina el pollo con su marinado en sartén o plancha bien caliente, unos 5-6 minutos por lado, hasta que quede dorado y hecho por dentro.']

let n = 0
const instrucciones = [...FASES.map(f => `## ${f.n}\n` + f.p.map(t => `${++n}. ${t}`).join('\n')), `## Congelar y cocinar\n` + FINAL.map(t => `${++n}. ${t}`).join('\n')].join('\n')
const filas = FASES.flatMap(f => f.ing.map(([k, g]) => ({ receta_id: ID, alimento_id: id[k], nombre_libre: ALIM[k].nombre, cantidad_gramos: g, rol_ingrediente: ALIM[k].rol, es_cantidad_fija: false, grupo: f.n })))
filas.forEach((f, i) => { f.orden = i })

const { data: orig } = await db.from('recetas').select('*').eq('id', ID).single()
const { data: ingOrig } = await db.from('receta_ingredientes').select('*').eq('receta_id', ID)
const { data: sueltas } = await db.from('recetas').select('id, nombre').in('id', SUELTAS)
console.log(`${filas.length} ingredientes en 5 fases · ${instrucciones.split('\n').length} líneas de pasos · borraría ${sueltas.length} recetas sueltas:`, sueltas.map(s => s.nombre))
if (!APPLY) { console.log('Simulación. --apply para escribir.'); process.exit(0) }

writeFileSync('salidas/26-10-2026_BACKUP-5-marinados-pollo.json', JSON.stringify({ receta: orig, ingredientes: ingOrig }, null, 1))
await db.from('receta_ingredientes').delete().eq('receta_id', ID)
const { error: e1 } = await db.from('receta_ingredientes').insert(filas); if (e1) throw e1
const { error: e2 } = await db.from('recetas').update({
  nombre: '5 marinados de pollo para congelar',
  descripcion: 'Cinco marinados para tener pollo listo en el congelador: fajitas, cilantro y lima, piña y soja, miel y mostaza y barbacoa. Cada uno es para 600 g de pechuga (4 raciones de 150 g), así que la receta da 20 raciones y los valores nutricionales son la media de los cinco.',
  instrucciones, porciones: 20, tiempo_prep_min: 40,
  consejos: 'Congela las bolsas en plano. La noche de antes pásala a la nevera y al día siguiente solo tienes que cocinar. Las fajitas van bien en tortillas con pimiento y cebolla; la piña y la mostaza con arroz y verduras; la barbacoa entera, al horno a 200 °C unos 25 minutos.',
  intolerancias: ['Sin Lactosa', 'Sin Huevo', 'Sin Mariscos', 'Sin Pescado', 'Sin Cerdo', 'Sin Frutos Secos', 'Gluten', 'Soja', 'Mostaza'],
}).eq('id', ID); if (e2) throw e2
await db.from('receta_ingredientes').delete().in('receta_id', SUELTAS)
const { error: e3 } = await db.from('recetas').delete().in('id', SUELTAS); if (e3) throw e3
console.log('✅ Hecho. Copia en salidas/26-10-2026_BACKUP-5-marinados-pollo.json')
