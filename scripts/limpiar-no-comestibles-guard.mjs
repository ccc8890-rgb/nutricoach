#!/usr/bin/env node
/**
 * limpiar-no-comestibles-guard.mjs
 *
 * Limpia la tabla `alimentos` usando los MISMOS patrones que
 * guard-no-comestible.ts — el ÚNICO PUNTO DE VERDAD.
 *
 * Los patrones están duplicados aquí (JS) porque los scripts .mjs
 * no pueden importar TypeScript directamente.
 * Si añades patrones al guard, añádelos también aquí.
 *
 * USO:
 *   node scripts/limpiar-no-comestibles-guard.mjs             (dry-run)
 *   node scripts/limpiar-no-comestibles-guard.mjs --aplicar   (elimina)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim().replace(/^"|"$/g, '')
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
const APLICAR = process.argv.includes('--aplicar')

// ── Mismos patrones que guard-no-comestible.ts ─────────────────────────────

function limpiar(nombre) {
  return nombre.toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

const PATRONES_NO_COMESTIBLE = [
  /comida (gato|gatos|perro|perros|perr[oa])/i,
  /comida (seca|humeda) (gatos|perros)/i,
  /pienso|arena (para )?gato|snack (para )?(perro|gato)/i,
  /mascotas|empapadores mascotas|lecho mascotas/i,
  /compresa|salvaslip|protegeslip|tampon|copa menstrual/i,
  /pan (banador|bano|braguita)/i,
  /preservativo|lubricante sexual/i,
  /pasta (dientes|encias)|dentifrico|cepillo dental|hilo dental/i,
  /enjuague bucal|irrigador dental|arcos dentales/i,
  /champu|acondicionador (cabello|pelo)/i,
  /mascarilla (cabello|capilar)/i,
  /gel fijador|laca (pelo|cabello)|cera pelo|fijador cabello/i,
  /tinte (cabello|pelo)|decolorante cabello|aclarante cabello/i,
  /coloracion permanente|coloracion hombre/i,
  /ampollas (capilares|cabello|tratamiento|flash)/i,
  /serum cabello|serum capilar/i,
  /espuma cabello|espuma pelo/i,
  /jabon (manos|ban|o|intimo|glicerina|marsella)/i,
  /gel (ban|o|ducha|intimo)/i,
  /desodorante|antitranspirante/i,
  /colonia|perfume|eau de (parfum|toilette)/i,
  /body spray|body mist/i,
  /crema (anti|hidrat|nutrit|reafirm|repar|corporal|facial|manos|contorno|reductora)/i,
  /crema (manos|cara|ban|o|dia|noche)/i,
  /crema y barra protectora/i,
  /lotion|locion (corporal|reafirmante)/i,
  /aceite corporal|manteca corporal|sorbete corporal/i,
  /balsamo (corporal|reparador)/i,
  /crema facial|contorno de ojos/i,
  /serum facial|serum facial|tonico facial/i,
  /agua (micelar|facial|de peinado)/i,
  /mascarilla facial|exfoliante facial/i,
  /desmaquillante|desmaquillador/i,
  /labial|labios|barra labial|barra labios/i,
  /pintalabios|perfilador (labios|labial)/i,
  /balsamo (labios|reparador labios)/i,
  /vaselina perfumada labios|desmaquillador ojos labios/i,
  /mascarilla labial|mascarilla labios/i,
  /maquillaje|base de maquillaje|colorete|corrector maquillaje/i,
  /mascara de pestanas|delineador ojos|sombra ojos/i,
  /brillos|polvos (translucidos|compactos)/i,
  /esmalte unas|quitaesmalte|unas postizas|cuticula/i,
  /unas acrilico|laca de unas|tratamiento para unas/i,
  /cuidado de unas|unas y complementos/i,
  /pincel|brocha|esponja maquillaje/i,
  /bastoncillos cosmeticos|kit esponjas|aplicador sombra/i,
  /rizador pestanas|pinzas (cejas|depilar)/i,
  /cejas|perfilador cejas|sombra cejas/i,
  /deliplus maquillaje|deliplus labial|deliplus perfilador/i,
  /deliplus balsamo labios|deliplus crema corporal/i,
  /deliplus champu|deliplus acondicionador/i,
  /deliplus mascarilla cabello|deliplus gel/i,
  /deliplus jabon|deliplus desodorante/i,
  /deliplus men care/i,
  /protector solar|crema solar|spray solar|spf \d/i,
  /aftersun|after sun|auto bronceador|autobronceador/i,
  /cera depilatoria|bandas depilatorias|crema depilatoria/i,
  /maquinilla (afeitar|depilar)|cuchilla afeitar/i,
  /gel depilar|espuma afeitar|after shave|aftershave/i,
  /lejia|lejía|limpia(dor)? (cocina|ban|o|wc|hogar|suelos|alfombras)/i,
  /detergente (ropa|lavavajillas|lavado)|suavizante/i,
  /fregasuelos|friegasuelos|ambientador/i,
  /lavavajillas|pastillas lavavajillas|gel lavavajillas/i,
  /quitamanchas|prelavado|aditivo textil|desinfectante textil/i,
  /limpia(cristales|vidrios|gafas|metales|fondos)/i,
  /limpia(hornos|ban|os|coches|tapicerias)/i,
  /estropajo|bayeta|fregona|mopa|recambio mopa/i,
  /bolsa basura|bolsas basura|bolsas reutilizables/i,
  /papel (higienico|cocina|hogar|aluminio|vegetal|film)/i,
  /abrillantador|desengrasante|desincrustante|antical|quitacal/i,
  /desatascador|limpiajuntas|sosa caustica|alcohol 96/i,
  /agua oxigenada|amoniaco|blanqueador juntas/i,
  /cera multisuperficies|borrador magico/i,
  /colgador wc|perlas perfume ropa|ropa frescor/i,
  /insecticida|trampa ratas|repelente (insectos|mosquitos)/i,
  /antipolilla|antipolillas|absorbeolor(es)?|absorbe olor/i,
  /elimina olor(es)?|neutraliza olor(es)?/i,
  /lavanda.*(reposapies|colgador|aceite esencial perfumado)/i,
  /citronela (colgador|pulsera)/i,
  /vela |velas |mechero|cerilla/i,
  /pilas|bombilla|candado|cerradura/i,
  /bombona|butano|propano/i,
  /guantes (desechables|domesticos|limpieza)/i,
  /mascarilla (quirurgica|protectora)|cubrecalzado/i,
  /bolsas papel bocadillo|bandeja (carton|papel|plastico)/i,
  /plato biodegradable|plato desechable/i,
  /cubiertos desechables|vasos desechables|pajitas/i,
  /cuaderno|boligrafo|rotulador|subrayador|sacapuntas/i,
  /pegamento|cinta adhesiva|tijeras|grapas|clip/i,
  /barreno|barren|bolsa isotermica/i,
  /panal|panales|panal bebe|toallitas bebe|protector absorbente|discos (absorbentes|lactancia)/i,
  /biberon|chupete|tetina|cepillo limpiabiberon/i,
  /infantil talla|junior talla/i,
  /esponjas (ban|o|maquillaje|cosmeticos)/i,
  /algodon (hidrofilo|magico)|bastoncillos/i,
  /alicate unas|lima unas|cortaunas/i,
  /apositos|apositos|tiritas|venda |vendas/i,
  /suero fisiologico|laxante|laxforte/i,
  /lentes contacto|solucion unica lentes/i,
  /lagrimas hidratantes|spray desinfectante antiseptico/i,
  /clorhexidina|minoxidil|analizador/i,
  /antiedad|reductor|anticelulitis|antiestrias/i,
  /body (lotion|milk|cream)/i,
  /body-.*iones/i,
  /kit (viaje|higiene|bebe|cosmetico)/i,
  /cuidado personal|higiene personal/i,
  /papel regalo|bolsa regalo|tarjeta regalo/i,
  /presoterapia|aparato electrico|electroestimulador/i,
  /recambio (electrico|maquinilla|cepillo)/i,
  /cuidado de unas/i,
  // Alcohol
  /cerveza|cervesa|cerveza sin|cerveza 0,0/i,
  /vino (tinto|blanco|rosado|espumoso|dulce|jerez|generoso|ecologico|variedad|crianza|reserva|gran reserva)/i,
  /vi (negre|blanc|rosat|escumos|escum[oó]s|dolc|ranci)/i,
  /cava (brut|semi|rosado|nature|benjamin)/i,
  /whisky|whiskey|bourbon|vodka|ginebra|tequila|mezcal/i,
  /brandy|conac|cognac|amaretto|absenta|absinthe/i,
  /ron (anejo|blanco|negro|dorado|caribeno|dominicano)|rom (blanc|negre|anyenc|ane|dorat)/i,
  /licor (cafe|menta|hierbas|naranja|almendra|anis)/i,
  /anís|anisete|anis seco|vermut|vermouth|moscatel/i,
  /vino de oporto|oporto (fine|tawny|reserva|ruby|crusted|l.b.v|lbv|vintage|colheita|garrafeira)/i,
  /sangria|tinto de verano|champan|champagne/i,
  /sidra|mosto de uva/i,
  /bebida preparada de (ron|vodka|gin)/i,
  /bebida espirituosa|beguda espirituosa/i,
  /bacardi|brugal|havana club|ron barcelo|barcelo|absolut|smirnoff|beefeater|larios|tanqueray|ballantines/i,
  /coctel mojito|mojito|daiquiri|pin?a colada|pin colada|combinado (gin|whisky|vodka|ron)|combinat/i,
  /cocktail whisky|crema whisky|orujo/i,
  // Energéticas
  /monster energy|red bull|redbull|burn energy|rockstar energy/i,
  /bebida energetica|energy drink/i,
  // Electrodomésticos
  /\d{3,}\s*w/i,
  /\(w\)/i,
  // Otros no saludables
  /zumo fermentado|hidromiel/i,
  /calipo |cubata |destornillador /i,
]

// Excepciones — NO eliminar aunque coincidan con un patrón
const EXCEPCIONES = [
  /miel.*(dosificador|envase)/i,
  /chorizo.*vela|vela.*chorizo/i,
  /jabon.*glicerina/i,
  /grill (brocheta|minigrill|tostada|biscotes)/i,
  /freidora.*(aire|aceite)/i,
  /microondas/i,
  /adhesivo/i,
  /al vino|en vino|con vino|estofado|guiso/i,
  /al licor|bombones|trufas|pralines/i,
  /al ron|flambead/i,
  /vinagre/i,
  /vitamina/i,
  /pasas/i,
  /oporto.*(carne|carrillera|cerdo|ternera|pollo|salsa|sals[ao]|estofado|guiso|lomo)/i,
  /aceite.*crema|crema.*oliva|crema.*balsamico/i,
  /pasa moscatel/i,
  /uva moscatel|uvas moscatel/i,
  /levadura cerveza/i,
  /tarta|helado|bombon|bombones|trufa|trufas/i,
  /nescafe latte/i,
  // Excepciones adicionales para la BD (conservar aunque el guard los marque)
  /pasta de dientes dental\s+kids/i,   // evitar falsos positivos en comida para niños
]

function esNoComestible(nombre) {
  if (!nombre || nombre.trim().length === 0) return false
  const n = limpiar(nombre)
  if (EXCEPCIONES.some(ex => ex.test(n))) return false
  return PATRONES_NO_COMESTIBLE.some(p => p.test(n))
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🧹 LIMPIEZA GUARD-BASED — No Comestibles')
  console.log(`📋 Modo: ${APLICAR ? '🔴 APLICAR (elimina de verdad)' : '🔍 DRY RUN (solo muestra)'}`)
  console.log()

  // 1. Cargar todos los alimentos (paginado)
  const PAGE = 1000
  let offset = 0
  let todos = []
  while (true) {
    const { data, error } = await supabase
      .from('alimentos')
      .select('id, nombre, calorias, categoria')
      .range(offset, offset + PAGE - 1)
      .order('id')
    if (error) { console.error('Error cargando alimentos:', error.message); process.exit(1) }
    if (!data || data.length === 0) break
    todos.push(...data)
    if (data.length < PAGE) break
    offset += PAGE
  }
  console.log(`📦 Total alimentos en BD: ${todos.length}`)

  // 2. Detectar no-comestibles
  const noComestibles = todos.filter(a => esNoComestible(a.nombre))

  // 3. Separar los usados en recetas (NO eliminar)
  let usadosEnRecetas = new Set()
  if (noComestibles.length > 0) {
    const ids = noComestibles.map(a => a.id)
    // Supabase IN filter tiene límite, paginar en lotes de 100
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100)
      const { data } = await supabase
        .from('receta_ingredientes')
        .select('alimento_id')
        .in('alimento_id', chunk)
      if (data) for (const r of data) usadosEnRecetas.add(r.alimento_id)
    }
  }

  const aEliminar = noComestibles.filter(a => !usadosEnRecetas.has(a.id))
  const protegidos = noComestibles.filter(a => usadosEnRecetas.has(a.id))

  console.log(`🗑️  Detectados ${noComestibles.length} no-comestibles:`)
  console.log(`   ✅ Candidatos a eliminar (no usados en recetas): ${aEliminar.length}`)
  if (protegidos.length > 0) {
    console.log(`   ⚠️  Protegidos (usados en recetas, NO se eliminan): ${protegidos.length}`)
    for (const a of protegidos) {
      console.log(`      - [PROTEGIDO] "${a.nombre}" (${a.calorias ?? 0} kcal)`)
    }
  }

  console.log()
  if (aEliminar.length > 0) {
    console.log('Candidatos a eliminar:')
    for (const a of aEliminar) {
      const kcalStr = a.calorias != null ? `${a.calorias} kcal` : 'sin kcal'
      console.log(`  - [${a.categoria || 'Sin categoría'}] "${a.nombre}" (${kcalStr})`)
    }
    console.log()
  }

  if (!APLICAR) {
    console.log('💡 Para eliminarlos: node scripts/limpiar-no-comestibles-guard.mjs --aplicar')
    return
  }

  // 4. Eliminar (en lotes de 50)
  let eliminados = 0
  let errores = 0
  const IDS_A_ELIMINAR = aEliminar.map(a => a.id)

  for (let i = 0; i < IDS_A_ELIMINAR.length; i += 50) {
    const chunk = IDS_A_ELIMINAR.slice(i, i + 50)
    // Primero eliminar de productos_supermercado (FK)
    await supabase.from('productos_supermercado').delete().in('alimento_id', chunk)
    // Luego de alimentos_enriquecimiento_cola si existe
    await supabase.from('alimentos_enriquecimiento_cola').delete().in('alimento_id', chunk)
    // Finalmente el alimento
    const { error } = await supabase.from('alimentos').delete().in('id', chunk)
    if (error) {
      console.error(`  Error eliminando lote [${i}-${i+50}]: ${error.message}`)
      errores += chunk.length
    } else {
      eliminados += chunk.length
      process.stdout.write(`\r  Eliminados: ${eliminados}/${IDS_A_ELIMINAR.length}`)
    }
  }

  console.log()
  console.log()
  if (eliminados > 0) console.log(`✅ ${eliminados} no-comestibles eliminados de la BD`)
  if (errores > 0) console.log(`❌ ${errores} errores`)
  if (protegidos.length > 0) console.log(`⚠️  ${protegidos.length} protegidos (usados en recetas, revisar manualmente)`)
}

main().catch(console.error)
