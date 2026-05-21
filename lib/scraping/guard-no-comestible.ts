// ═══════════════════════════════════════════════════════════════════════
// 🛡️ GUARD — Productos No Comestibles (ÚNICO PUNTO DE VERDAD)
// ═══════════════════════════════════════════════════════════════════════
// Este es el ÚNICO archivo que define qué productos no comestibles
// rechazar. TODOS los entry points deben importar `esProductoNoComestible`
// desde aquí. NO duplicar listas en otros archivos.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Limpia acentos y normaliza para comparación consistente.
 */
function limpiar(nombre: string): string {
  return nombre.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

// ── Patrones regex unificados ─────────────────────────────────────────
// Cada regex captura una familia de productos no comestibles.
// Usamos regex en lugar de keywords sueltos para mayor precisión
// (evita falsos positivos con palabras como "vela" en "vela chorizo").

const PATRONES_NO_COMESTIBLE: RegExp[] = [
  // ── Mascotas ──────────────────────────────────────────────────
  /comida (gato|gatos|perro|perros|perr[oa])/i,
  /comida (seca|humeda) (gatos|perros)/i,
  /pienso|arena (para )?gato|snack (para )?(perro|gato)/i,
  /mascotas|empapadores mascotas|lecho mascotas/i,

  // ── Higiene femenina / íntima ─────────────────────────────────
  /compresa|salvaslip|protegeslip|tampon|copa menstrual/i,
  /pan (banador|bano|braguita)/i,
  /preservativo|lubricante sexual/i,

  // ── Cuidado dental ────────────────────────────────────────────
  /pasta (dientes|encias)|dentifrico|cepillo dental|hilo dental/i,
  /enjuague bucal|irrigador dental|arcos dentales/i,

  // ── Champú / cuidado capilar ──────────────────────────────────
  /champu|acondicionador (cabello|pelo)/i,
  /mascarilla (cabello|capilar)/i,
  /gel fijador|laca (pelo|cabello)|cera pelo|fijador cabello/i,
  /tinte (cabello|pelo)|decolorante cabello|aclarante cabello/i,
  /coloracion permanente|coloracion hombre/i,
  /ampollas (capilares|cabello|tratamiento|flash)/i,
  /serum cabello|serum capilar/i,
  /espuma cabello|espuma pelo/i,

  // ── Jabón / Gel / Ducha ───────────────────────────────────────
  /jabon (manos|ban|o|intimo|glicerina|marsella)/i,
  /gel (ban|o|ducha|intimo)/i,

  // ── Desodorante / Perfumes ────────────────────────────────────
  /desodorante|antitranspirante/i,
  /colonia|perfume|eau de (parfum|toilette)/i,
  /body spray|body mist/i,

  // ── Crema / loción corporal ───────────────────────────────────
  /crema (anti|hidrat|nutrit|reafirm|repar|corporal|facial|manos|contorno|reductora)/i,
  /crema (manos|cara|ban|o|dia|noche)/i,
  /crema y barra protectora/i,
  /lotion|locion (corporal|reafirmante)/i,
  /aceite corporal|manteca corporal|sorbete corporal/i,
  /balsamo (corporal|reparador)/i,

  // ── Facial / Cosmética facial ─────────────────────────────────
  /crema facial|contorno de ojos/i,
  /serum facial|serum facial|tonico facial/i,
  /agua (micelar|facial|de peinado)/i,
  /mascarilla facial|exfoliante facial/i,
  /desmaquillante|desmaquillador/i,

  // ── Labial ────────────────────────────────────────────────────
  /labial|labios|barra labial|barra labios/i,
  /pintalabios|perfilador (labios|labial)/i,
  /balsamo (labios|reparador labios)/i,
  /vaselina perfumada labios|desmaquillador ojos labios/i,
  /mascarilla labial|mascarilla labios/i,

  // ── Maquillaje ────────────────────────────────────────────────
  /maquillaje|base de maquillaje|colorete|corrector maquillaje/i,
  /mascara de pestanas|delineador ojos|sombra ojos/i,
  /brillos|polvos (translucidos|compactos)/i,

  // ── Uñas ──────────────────────────────────────────────────────
  /esmalte unas|quitaesmalte|unas postizas|cuticula/i,
  /unas acrilico|laca de unas|tratamiento para unas/i,
  /cuidado de unas|unas y complementos/i,

  // ── Brochas / Pinceles / Accesorios maquillaje ────────────────
  /pincel|brocha|esponja maquillaje/i,
  /bastoncillos cosmeticos|kit esponjas|aplicador sombra/i,
  /rizador pestanas|pinzas (cejas|depilar)/i,
  /cejas|perfilador cejas|sombra cejas/i,

  // ── Cosmética Deliplus (Mercadona) ────────────────────────────
  /deliplus maquillaje|deliplus labial|deliplus perfilador/i,
  /deliplus balsamo labios|deliplus crema corporal/i,
  /deliplus champu|deliplus acondicionador/i,
  /deliplus mascarilla cabello|deliplus gel/i,
  /deliplus jabon|deliplus desodorante/i,
  /deliplus men care/i,

  // ── Solar / Protección ────────────────────────────────────────
  /protector solar|crema solar|spray solar|spf \d/i,
  /aftersun|after sun|auto bronceador|autobronceador/i,

  // ── Depilación ────────────────────────────────────────────────
  /cera depilatoria|bandas depilatorias|crema depilatoria/i,
  /maquinilla (afeitar|depilar)|cuchilla afeitar/i,
  /gel depilar|espuma afeitar|after shave|aftershave/i,

  // ── Limpieza hogar ────────────────────────────────────────────
  /lejia|lejía|limpia(dor)? (cocina|ban|o|wc|hogar|suelos|alfombras)/i,
  /detergente (ropa|lavavajillas|lavado)|suavizante/i,
  /fregasuelos|friegasuelos|ambientador/i,
  /lavavajillas|pastillas lavavajillas|gel lavavajillas/i,
  /quitamanchas|prelavado|aditivo textil|desinfectante textil/i,
  /limpia(cristales|vidrios|gafas|metales|fondos)/i,
  /limpia(hornos|ban|os|coches|tapicerias)/i,
  /estropajo|bayeta|fregona|mopa|recambio mopa/i,
  /bolsa basura|bolsas basura|bolsas reutilizables/i,
  /papel (higienico|cocina|aluminio|vegetal|film)/i,
  /abrillantador|desengrasante|desincrustante|antical|quitacal/i,
  /desatascador|limpiajuntas|sosa caustica|alcohol 96/i,
  /agua oxigenada|amoniaco|blanqueador juntas/i,
  /cera multisuperficies|borrador magico/i,
  /colgador wc|perlas perfume ropa|ropa frescor/i,
  /insecticida|trampa ratas|repelente (insectos|mosquitos)/i,
  /antipolilla|antipolillas|absorbeolores/i,
  /citronela (colgador|pulsera)/i,

  // ── Menaje / Descartables / No comida ─────────────────────────
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

  // ── Bebés / Infantil no comida ────────────────────────────────
  /panal|panales|panal bebe|toallitas bebe/i,
  /biberon|chupete|tetina|cepillo limpiabiberon/i,
  /infantil talla|junior talla/i,

  // ── Otros no comestibles ───────────────────────────────────────
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

  // ── Excepciones que suenan a comida pero NO lo son ────────────

  // ── Alcohol ────────────────────────────────────────────────────
  /cerveza|cervesa|cerveza sin|cerveza 0,0/i,
  /vino (tinto|blanco|rosado|espumoso|dulce|jerez|generoso|ecologico|variedad|crianza|reserva|gran reserva)/i,
  /vi (negre|blanc|rosat|escumos|dolc|ranci)/i,
  /cava (brut|semi|rosado|nature|benjamin)/i,
  /whisky|whiskey|bourbon|vodka|ginebra|tequila|mezcal/i,
  /brandy|conac|cognac|amaretto|absenta|absinthe/i,
  /ron (anejo|blanco|negro|dorado)/i,
  /licor (cafe|menta|hierbas|naranja|almendra|anis)/i,
  /anís|anisete|anis seco|vermut|vermouth|moscatel/i,
  /oporto|sangria|tinto de verano|champan|champagne/i,
  /sidra|mosto de uva/i,
  /bebida preparada de (ron|vodka|gin)/i,

  // ── Bebidas energéticas ────────────────────────────────────────
  /monster energy|red bull|redbull|burn energy|rockstar energy/i,
  /hell energy|boost energy|te energy|amper energy/i,
  /battery energy|bullit energy|dark dog|enjoy energy/i,
  /free way energy|go fast energy|lifefuel|megamon/i,
  /mutant energy|one energy shot|panda energy|playmatte energy/i,
  /pro tension|pure energy|red fire|select energy|spark energy/i,
  /speed energy|tnt energy|torque energy|v energy|viper energy/i,
  /volt energy|wakal energy|x-force energy|x-raid energy|zero effect/i,
  /bebida energetica|energy drink/i,

  // ── Electrodomésticos (vatios / potencia) ──────────────────────
  /\d{3,}\s*w/i,
  /\(w\)/i,

  // ── Otros no saludables ────────────────────────────────────────
  /zumo fermentado|hidromiel/i,
  /calipo |cubata |destornillador /i,
]

/**
 * Excepciones: productos que CONTIENEN palabras de no-comestible
 * pero SÍ son comida (ej: "miel con dosificador", "chorizo extra vela").
 */
const EXCEPCIONES: RegExp[] = [
  /miel.*(dosificador|envase)/i,
  /chorizo.*vela|vela.*chorizo/i,
  /jabon.*glicerina/i,               // jabón con glicerina = ingrediente alimentario
  /grill (brocheta|minigrill|tostada|biscotes)/i,
  /freidora.*(aire|aceite)/i,        // freidora de aire SÍ es comida
  /microondas/i,                     // microondas + comida ("palomitas microondas")
  /adhesivo/i,                       // "papel adhesivo" vs "adhesivo comestible"
  // Excepciones alcohol — platos cocinados o alimentos que usan alcohol como ingrediente
  /al vino|en vino|con vino|estofado|guiso/i,
  /al licor|bombones|trufas|pralines/i,
  /al ron|flambead/i,
  /vinagre/i,                        // vinagre de vino NO es alcohol
  /vitamina/i,                       // "vino con vitaminas"
  /pasas/i,                          // "pasas al ron"
  /uva moscatel|uvas moscatel/i,
]

/**
 * Evalúa si un nombre de producto NO es comestible.
 * @returns `true` si el producto debe ser rechazado
 */
export function esProductoNoComestible(nombre: string): boolean {
  if (!nombre || nombre.trim().length === 0) return false

  const n = limpiar(nombre)

  // Primero verificar excepciones (evitar falsos positivos)
  if (EXCEPCIONES.some(ex => ex.test(n))) return false

  // Luego verificar patrones no comestibles
  return PATRONES_NO_COMESTIBLE.some(p => p.test(n))
}

/**
 * Versión para arrays (útil en pipelines de scraping).
 */
export function filtrarComestibles(productos: Array<{ nombre: string }>): Array<{ nombre: string }> {
  return productos.filter(p => !esProductoNoComestible(p.nombre))
}
