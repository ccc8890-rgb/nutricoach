#!/usr/bin/env node
/**
 * limpiar-productos-supermercado.mjs
 *
 * Limpia la tabla `productos_supermercado` de items no comestibles
 * usando los mismos patrones que guard-no-comestible.ts.
 *
 * USO:
 *   node scripts/limpiar-productos-supermercado.mjs             (dry-run)
 *   node scripts/limpiar-productos-supermercado.mjs --aplicar   (elimina)
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
  /preservativo|lubricante sexual/i,
  /pasta (dientes|encias)|dentifrico|cepillo dental|hilo dental/i,
  /enjuague bucal|irrigador dental/i,
  /champu|acondicionador (cabello|pelo)/i,
  /mascarilla (cabello|capilar)/i,
  /gel fijador|laca (pelo|cabello)|cera pelo|fijador cabello/i,
  /tinte (cabello|pelo)|decolorante cabello/i,
  /coloracion permanente/i,
  /ampollas (capilares|cabello|tratamiento)/i,
  /serum cabello|serum capilar/i,
  /espuma cabello|espuma pelo/i,
  /jabon (manos|ban|o|intimo)/i,
  /gel (ban|o|ducha|intimo)/i,
  /desodorante|antitranspirante/i,
  /colonia|perfume|eau de (parfum|toilette)/i,
  /body spray|body mist/i,
  /crema (anti|hidrat|nutrit|reafirm|repar|corporal|facial|manos|contorno|reductora)/i,
  /crema (manos|cara|dia|noche)/i,
  /crema y barra protectora/i,
  /lotion|locion corporal/i,
  /aceite corporal|manteca corporal/i,
  /balsamo (corporal|reparador)/i,
  /crema facial|contorno de ojos/i,
  /serum facial|tonico facial/i,
  /agua (micelar|facial)/i,
  /mascarilla facial|exfoliante facial/i,
  /desmaquillante|desmaquillador/i,
  /labial|barra labial|barra labios/i,
  /pintalabios|perfilador (labios|labial)/i,
  /vaselina perfumada labios/i,
  /mascarilla labial/i,
  /maquillaje|base de maquillaje|colorete/i,
  /mascara de pestanas|delineador ojos|sombra ojos/i,
  /esmalte unas|quitaesmalte|unas postizas/i,
  /laca de unas|tratamiento para unas/i,
  /cuidado de unas/i,
  /pincel|brocha|esponja maquillaje/i,
  /bastoncillos cosmeticos/i,
  /rizador pestanas|pinzas (cejas|depilar)/i,
  /perfilador cejas|sombra cejas/i,
  /deliplus/i,
  /protector solar|crema solar|spray solar|spf \d/i,
  /aftersun|after sun|autobronceador/i,
  /cera depilatoria|bandas depilatorias|crema depilatoria/i,
  /maquinilla (afeitar|depilar)|cuchilla afeitar/i,
  /gel depilar|espuma afeitar|after shave|aftershave/i,
  /lejia|lejía/i,
  /limpiahogar|limpiador (cocina|wc|hogar|suelos)/i,
  /detergente (ropa|lavavajillas|lavado)/i,
  /suavizante ropa|suavizante lavadora/i,
  /fregasuelos|friegasuelos|ambientador/i,
  /pastillas lavavajillas|gel lavavajillas/i,
  /quitamanchas|aditivo textil|desinfectante textil/i,
  /limpiacristales|limpiagafas/i,
  /limpiahornos|limpiacoches/i,
  /estropajo|bayeta|fregona|mopa/i,
  /bolsa basura|bolsas basura/i,
  /papel higienico|papel de cocina|papel aluminio|papel vegetal/i,
  /desengrasante|desincrustante|antical|quitacal/i,
  /desatascador|sosa caustica|alcohol 96/i,
  /agua oxigenada|amoniaco/i,
  /borrador magico/i,
  /insecticida|trampa ratas|repelente (insectos|mosquitos)/i,
  /antipolilla|absorbeolor/i,
  /vela |velas |mechero/i,
  /guantes (desechables|domesticos|limpieza)/i,
  /bolsa basura|papel regalo/i,
  /panal|panales|toallitas bebe|protector absorbente/i,
  /biberon|chupete|tetina/i,
  /bastoncillos/i,
  /apositos|tiritas/i,
  /suero fisiologico|laxante/i,
  /lentes contacto/i,
  /clorhexidina|minoxidil/i,
  /anticelulitis|antiestrias/i,
  /body (lotion|milk|cream)/i,
  /kit (viaje|higiene|bebe|cosmetico)/i,
  /cuidado personal|higiene personal/i,
  /bolsa reutilizable|bolsas reutilizables/i,
  /film transparente|papel film/i,
  /bandeja (carton|papel|plastico)/i,
  /cubiertos desechables|vasos desechables|pajitas/i,
  /bolsa zip|bolsas zip|bolsas congelacion/i,
  // Hogar y menaje
  /fiambrera|tupper|taper/i,
  /hermetico|herméticos/i,
  /escobilla|escobillero|fregona|mopa/i,
  /filtros cafe|filtros café/i,
  /tratamiento piscina|limpia piscina/i,
  /perfumador ropa|perlas perfume/i,
  /rasqueta vitrocer/i,
  /molde papel.*freidora/i,
  /vinagre.*limpieza|vinagre limpieza/i,
  // Alcohol (excluyendo vinagre)
  /cerveza|cervesa/i,
  /vino (tinto|blanco|rosado|espumoso|dulce|jerez)/i,
  /cava (brut|semi|rosado|nature)/i,
  /whisky|whiskey|bourbon|vodka|ginebra|tequila|mezcal/i,
  /brandy|conac|cognac|amaretto/i,
  /ron (anejo|blanco|negro|dorado)/i,
  /licor (cafe|menta|hierbas|naranja|almendra|anis)/i,
  /anisete|anis seco|vermut|vermouth/i,
  /sangria|tinto de verano|champan|champagne/i,
  /sidra/i,
  /bebida espirituosa/i,
  /whisky|bacardi|brugal|havana club|absolut|smirnoff|beefeater|larios|tanqueray|ballantines/i,
  /mojito|daiquiri/i,
  /bebida energetica|energy drink/i,
  /monster energy|red bull|redbull/i,
  // Electrodomésticos
  /\d{3,}\s*w/i,
]

// Excepciones
const EXCEPCIONES = [
  /vinagre\b/i,  // vinagre de vino = condimento
  /miel.*(dosificador|envase)/i,
  /chorizo.*vela|vela.*chorizo/i,
  /freidora.*(aire|aceite)/i,
  /microondas/i,
  /al vino|en vino|con vino|estofado/i,
  /al ron|flambead/i,
  /vitamina/i,
  /pasas/i,
  /levadura cerveza/i,
  /tarta|helado|bombon|trufa/i,
  /pasa moscatel|uva moscatel/i,
]

function esNoComestible(nombre) {
  if (!nombre || nombre.trim().length === 0) return false
  const n = limpiar(nombre)
  if (EXCEPCIONES.some(ex => ex.test(n))) return false
  return PATRONES_NO_COMESTIBLE.some(p => p.test(n))
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🧹 LIMPIEZA productos_supermercado — No Comestibles')
  console.log(`📋 Modo: ${APLICAR ? '🔴 APLICAR' : '🔍 DRY RUN'}`)
  console.log()

  // 1. Cargar todos los productos (paginado)
  const PAGE = 1000
  let offset = 0
  let todos = []
  while (true) {
    const { data, error } = await supabase
      .from('productos_supermercado')
      .select('id, nombre_original, supermercado_id')
      .range(offset, offset + PAGE - 1)
      .order('id')
    if (error) { console.error('Error:', error.message); process.exit(1) }
    if (!data || data.length === 0) break
    todos.push(...data)
    if (data.length < PAGE) break
    offset += PAGE
  }
  console.log(`📦 Total productos_supermercado: ${todos.length}`)

  const noComestibles = todos.filter(p => esNoComestible(p.nombre_original))
  console.log(`🗑️  Detectados ${noComestibles.length} no-comestibles`)

  if (noComestibles.length === 0) {
    console.log('✅ productos_supermercado ya está limpio.')
    return
  }

  // Agrupar por categoría de patrón para mostrar
  const muestra = noComestibles.slice(0, 30)
  console.log(`\nPrimeros ${muestra.length} ejemplos:`)
  for (const p of muestra) {
    console.log(`  - "${p.nombre_original}"`)
  }
  if (noComestibles.length > 30) {
    console.log(`  ... y ${noComestibles.length - 30} más`)
  }

  if (!APLICAR) {
    console.log(`\n💡 Para eliminarlos: node scripts/limpiar-productos-supermercado.mjs --aplicar`)
    return
  }

  // Eliminar en lotes de 100
  const ids = noComestibles.map(p => p.id)
  let eliminados = 0
  let errores = 0
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    // También limpiar precios históricos (ignorar errores si la tabla no existe)
    try { await supabase.from('precios_historico').delete().in('producto_supermercado_id', chunk) } catch (_) {}
    const { error } = await supabase.from('productos_supermercado').delete().in('id', chunk)
    if (error) {
      console.error(`Error lote ${i}: ${error.message}`)
      errores += chunk.length
    } else {
      eliminados += chunk.length
      process.stdout.write(`\r  Eliminados: ${eliminados}/${ids.length}`)
    }
  }

  console.log()
  console.log(`\n✅ ${eliminados} eliminados | ❌ ${errores} errores`)
}

main().catch(console.error)
