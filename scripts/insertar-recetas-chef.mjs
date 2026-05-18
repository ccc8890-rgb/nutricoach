/**
 * insertar-recetas-chef.mjs
 *
 * Inserta las 10 recetas "Serie Chef" con ingredientes, imágenes personalizadas
 * y las marca con notas_coach para revisión posterior de Carlos.
 *
 * USO:
 *   node scripts/insertar-recetas-chef.mjs              → inserta todas
 *   node scripts/insertar-recetas-chef.mjs --dry-run    → muestra lo que haría sin insertar
 *   node scripts/insertar-recetas-chef.mjs --sin-imagen → inserta sin generar imágenes
 *   node scripts/insertar-recetas-chef.mjs --id C1      → inserta solo esa receta
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')

// ── Cargar .env.local ──────────────────────────────────────────────
function loadEnv() {
    const envPath = resolve(RAÍZ, '.env.local')
    if (!existsSync(envPath)) { console.error('❌ No se encuentra .env.local'); process.exit(1) }
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
        if (!process.env[key]) process.env[key] = value
    }
}
loadEnv()

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

const COACH_ID = process.env.NUTRICOACH_COACH_ID
const OPENAI_KEY = process.env.OPENAI_API_KEY
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const SIN_IMAGEN = args.includes('--sin-imagen')
const idIdx = args.indexOf('--id')
const soloId = args.find(a => a.startsWith('--id='))?.split('=')[1] ?? (idIdx !== -1 ? args[idIdx + 1] : undefined)

// ── Definición de las 10 recetas ──────────────────────────────────
const RECETAS = [
    {
        id_ref: 'C1',
        nombre: 'Tataki de atún rojo con ponzu de naranja sanguina y aguacate en láminas',
        descripcion: 'Atún rojo sellado a fuego máximo, crudo por dentro, con ponzu de naranja sanguina, aguacate en láminas y sésamo negro. Técnica japonesa con ingredientes mediterráneos.',
        categoria: 'Pescados',
        tipo_plato: 'Comida',
        dificultad: 'Medio',
        tipo_coccion: 'Plancha',
        porciones: 2,
        tiempo_prep_min: 20,
        kcal: 400,
        proteinas: 38,
        carbohidratos: 8,
        grasas: 24,
        instrucciones: `1. Mezclar salsa de soja + zumo de naranja + vinagre de arroz + aceite de sésamo + jengibre rallado. Reservar como ponzu.
2. Cubrir todos los lados del bloque de atún con sésamo negro, presionando para que adhiera.
3. Calentar sartén de hierro a fuego máximo hasta que humee. Añadir el AOVE.
4. Sellar el atún exactamente 20 segundos por cada cara (4 caras). El interior debe quedar completamente crudo.
5. Sacar inmediatamente y dejar reposar 2 minutos en plato frío para detener la cocción.
6. Cortar en láminas de 5 mm con cuchillo bien afilado.
7. Laminar el aguacate finamente.
8. En el plato: alternar láminas de atún y aguacate en abanico. Salsear con el ponzu. Terminar con cebollino picado.`,
        consejos: 'La sartén debe estar MUY caliente antes de añadir el atún. El atún debe ir directamente del frigo a la sartén: cuanto más frío, mejor queda el interior crudo. Si no encuentras naranja sanguina, el zumo de mandarina funciona perfectamente. Cuchillo muy afilado = láminas limpias.',
        intolerancias: ['Sin Gluten', 'Sin Lactosa'],
        ingredientes: [
            { nombre: 'Atún rojo fresco', gramos: 300 },
            { nombre: 'Aguacate', gramos: 100 },
            { nombre: 'Sésamo negro', gramos: 10 },
            { nombre: 'Salsa de soja', gramos: 20 },
            { nombre: 'Naranja', gramos: 80 },
            { nombre: 'Vinagre de arroz', gramos: 15 },
            { nombre: 'Aceite de sésamo', gramos: 5 },
            { nombre: 'Jengibre fresco', gramos: 5 },
            { nombre: 'Aceite de oliva virgen extra', gramos: 10 },
            { nombre: 'Cebollino', gramos: 10 },
        ],
        prompt_imagen: 'Overhead food photography, natural light from left, minimalist styling. Two fans of thin rare tuna tataki slices (bright red-pink interior visible) alternating with paper-thin avocado slices on a white ceramic plate. Dish drizzled with small pools of amber ponzu sauce. Black sesame seeds scattered over. Thin green chive pieces on top. Dark grey slate surface underneath. Clean white linen napkin folded to the right. Editorial restaurant food photography, shallow depth of field, ultra-realistic, no text, no watermarks.',
    },
    {
        id_ref: 'C2',
        nombre: 'Pollo tikka masala light con arroz de coliflor especiado',
        descripcion: 'Pollo marinado 12h en yogur y especias, cocinado en salsa de tomate aromática. Con arroz de coliflor como base ligera. Cocina india reconvertida en plato fit sin perder la esencia.',
        categoria: 'Carnes',
        tipo_plato: 'Comida',
        dificultad: 'Fácil',
        tipo_coccion: 'Sartén/Wok',
        porciones: 2,
        tiempo_prep_min: 35,
        kcal: 380,
        proteinas: 48,
        carbohidratos: 18,
        grasas: 10,
        instrucciones: `1. Cortar el pollo en trozos de 3 cm. Marinar con 100 g de yogur + garam masala + cúrcuma + pimentón + jengibre rallado + 1 ajo rallado. Mínimo 2 horas, ideal toda la noche en nevera.
2. Triturar la coliflor en procesador hasta textura de grano de arroz. Saltear en sartén seca 3-4 minutos con sal y comino hasta que pierda la humedad.
3. Sofreír cebolla picada fina en AOVE a fuego medio-bajo, 10 minutos, hasta transparente y ligeramente dorada.
4. Añadir ajo y jengibre rallados. 1 minuto. Añadir el resto de especias. 30 segundos más.
5. Añadir tomate triturado. Cocinar 8 minutos a fuego medio.
6. Incorporar el pollo marinado. Cocinar 8-10 minutos removiendo.
7. Fuera del fuego, añadir los 50 g de yogur restantes. No volver a hervir.
8. Servir sobre el arroz de coliflor con cilantro fresco picado.`,
        consejos: 'El marinado en yogur es el secreto: las enzimas ablandan la proteína. El yogur al final fuera del fuego mantiene la salsa cremosa. Versión atleta: sustituir la coliflor por 150 g de arroz basmati cocido.',
        intolerancias: ['Sin Gluten', 'Sin Lactosa'],
        ingredientes: [
            { nombre: 'Pechuga de pollo', gramos: 400 },
            { nombre: 'Yogur griego', gramos: 150 },
            { nombre: 'Tomate triturado', gramos: 200 },
            { nombre: 'Cebolla', gramos: 150 },
            { nombre: 'Ajo', gramos: 15 },
            { nombre: 'Jengibre fresco', gramos: 15 },
            { nombre: 'Garam masala', gramos: 8 },
            { nombre: 'Cúrcuma', gramos: 3 },
            { nombre: 'Pimentón ahumado', gramos: 3 },
            { nombre: 'Comino molido', gramos: 3 },
            { nombre: 'Coliflor', gramos: 500 },
            { nombre: 'Aceite de oliva virgen extra', gramos: 15 },
            { nombre: 'Cilantro fresco', gramos: 15 },
        ],
        prompt_imagen: '45-degree angle food photography, natural window light. Deep white bowl with rich deep-orange tikka masala sauce surrounding golden-brown chicken pieces. White cauliflower rice base visible underneath the sauce. Fresh green cilantro leaves scattered generously on top. Small orange sauce dots around the rim. Dark terracotta-colored linen background. Ceramic bowl with slight texture. Subtle steam rising. Warm moody food photography. Ultra-realistic, no text.',
    },
    {
        id_ref: 'C3',
        nombre: 'Burger de ternera con cheddar ahumado, boniato fries y alioli de sriracha',
        descripcion: 'Hamburguesa de ternera con cheddar ahumado, servida con boniato fries al horno y alioli de sriracha. El plato que demuestra que se puede comer una burger haciendo dieta.',
        categoria: 'Carnes',
        tipo_plato: 'Comida',
        dificultad: 'Fácil',
        tipo_coccion: 'Horno',
        porciones: 2,
        tiempo_prep_min: 40,
        kcal: 580,
        proteinas: 42,
        carbohidratos: 48,
        grasas: 22,
        instrucciones: `1. Precalentar horno a 200 °C. Cortar boniato en bastones finos de 5 mm. Sazonar con sal, pimentón ahumado y ajo en polvo. Hornear 25-30 minutos dando la vuelta a mitad.
2. Mezclar mayonesa light con sriracha al gusto. Reservar.
3. Dividir la carne en 2 bolas de 160 g. Aplanar hasta 1,5 cm de grosor. No añadir sal hasta el momento de cocinar.
4. Sartén de hierro o plancha a fuego máximo. Poner las burgers, salar y pimentar en ese momento.
5. Cocinar 3 minutos sin mover. Dar la vuelta, poner el cheddar encima, cocinar 2 minutos más.
6. Tostar el pan en la misma sartén 30 segundos.
7. Montar: base del pan → rúcula → tomate → burger con cheddar → pepinillo → cebolla morada → alioli sriracha → tapa.`,
        consejos: 'Regla de la burger perfecta: nunca aplastar con la espátula mientras cocina. El cheddar ahumado marca la diferencia vs el normal. Versión sin pan: servir sobre lechuga romana, ahorra 200 kcal y 35 g de carbos.',
        intolerancias: [],
        ingredientes: [
            { nombre: 'Carne picada de ternera', gramos: 320 },
            { nombre: 'Queso cheddar', gramos: 40 },
            { nombre: 'Pan integral', gramos: 160 },
            { nombre: 'Boniato', gramos: 400 },
            { nombre: 'Tomate', gramos: 120 },
            { nombre: 'Cebolla morada', gramos: 75 },
            { nombre: 'Rúcula', gramos: 30 },
            { nombre: 'Pepinillo en vinagre', gramos: 30 },
            { nombre: 'Mayonesa', gramos: 30 },
            { nombre: 'Aceite de oliva virgen extra', gramos: 10 },
        ],
        prompt_imagen: '45-degree angle food photography, dramatic side lighting. Tall stacked burger on dark cutting board: toasted whole-grain bun, melted amber smoked cheddar draped over juicy beef patty with slight char marks, crisp green arugula, bright red tomato slice, purple pickled onion rings, orange sriracha aioli dripping slightly. Beside the burger: a pile of thin crispy orange sweet potato fries and a small dipping bowl of sriracha sauce. Rustic dark wood background. Moody dramatic commercial lighting. Ultra-realistic, no text.',
    },
    {
        id_ref: 'C4',
        nombre: 'Solomillo de cerdo en costra de pistachos y tomillo con puré de chirivía y salsa de naranja',
        descripcion: 'Solomillo de cerdo con costra de pistachos y tomillo, sobre puré de chirivía y salsa de naranja reducida. Técnica de restaurante adaptada para cocinar en casa.',
        categoria: 'Carnes',
        tipo_plato: 'Comida',
        dificultad: 'Medio',
        tipo_coccion: 'Horno',
        porciones: 2,
        tiempo_prep_min: 45,
        kcal: 510,
        proteinas: 45,
        carbohidratos: 28,
        grasas: 22,
        instrucciones: `1. Precalentar horno a 200 °C.
2. Triturar pistachos con tomillo hasta textura de migas gruesas. Mezclar con 5 ml AOVE y sal.
3. Cocer chirivías peladas y troceadas en agua con sal 20 minutos. Escurrir y triturar con leche + 5 ml AOVE + sal hasta puré liso.
4. Sazonar el solomillo. Dorar en sartén caliente con AOVE 2 minutos por cada cara (4 caras).
5. Pintar el solomillo con mostaza de Dijon. Cubrir toda la superficie con la costra de pistacho presionando para que adhiera.
6. Hornear 12-15 minutos (temperatura interior: 63-65 °C). Reposar 5 minutos antes de cortar.
7. Reducir zumo de naranja + caldo + miel + ralladura en cazo pequeño hasta ligeramente espeso (~8 minutos).
8. Servir el solomillo en medallones sobre el puré de chirivía. Salsear con la naranja.`,
        consejos: 'La chirivía tiene sabor dulce-anisado que combina perfecto con naranja. Si no la encuentras, pastinaca o nabo también van bien. Termómetro de cocina obligatorio: 63-65 °C = rosado perfecto. La costra de pistacho se aplica justo antes de hornear.',
        intolerancias: ['Sin Gluten', 'Sin Lactosa'],
        ingredientes: [
            { nombre: 'Solomillo de cerdo', gramos: 400 },
            { nombre: 'Pistacho', gramos: 50 },
            { nombre: 'Tomillo fresco', gramos: 8 },
            { nombre: 'Mostaza de Dijon', gramos: 15 },
            { nombre: 'Chirivía', gramos: 400 },
            { nombre: 'Leche de avena', gramos: 50 },
            { nombre: 'Aceite de oliva virgen extra', gramos: 20 },
            { nombre: 'Naranja', gramos: 150 },
            { nombre: 'Caldo de pollo', gramos: 100 },
            { nombre: 'Miel', gramos: 8 },
        ],
        prompt_imagen: '45-degree angle fine dining food photography, soft natural light. Elegant white plate with a smooth ivory parsnip purée base. Three thick medallions of pork tenderloin with visible green pistachio-herb crust on top, showing pale pink interior. Amber orange glaze pooled artfully around the purée. Small fresh thyme sprigs as garnish. Orange zest curls on top of the meat. White fine dining plate with thin rim. Marble surface underneath. Refined elegant plating. Ultra-realistic food photography, no text.',
    },
    {
        id_ref: 'C5',
        nombre: 'Bacalao confitado a 65 °C con pil-pil de ajo negro y espárragos a la plancha',
        descripcion: 'Bacalao confitado en aceite a temperatura controlada, con pil-pil emulsionado de ajo negro y espárragos a la plancha. Técnica vasca elevada con el sabor meloso del ajo negro.',
        categoria: 'Pescados',
        tipo_plato: 'Comida',
        dificultad: 'Difícil',
        tipo_coccion: 'Sartén/Wok',
        porciones: 2,
        tiempo_prep_min: 50,
        kcal: 380,
        proteinas: 42,
        carbohidratos: 6,
        grasas: 20,
        instrucciones: `1. Calentar el aceite en cazuela pequeña exactamente a 65 °C con termómetro. Introducir los lomos de bacalao desalado. Confitar 25-30 minutos manteniendo la temperatura constante.
2. Extraer el bacalao con cuidado. En el mismo aceite, añadir ajo blanco en láminas y la guindilla. Sofreír a fuego muy bajo 3-4 minutos.
3. Añadir ajo negro aplastado + caldo de pescado frío. Emulsionar con movimientos circulares de la cazuela hasta que la salsa ligue y espese. Corregir sal.
4. Planchar los espárragos a fuego fuerte 2-3 minutos con sal hasta que aparezcan marcas.
5. Servir el bacalao sobre el pil-pil negro con los espárragos al lado. Terminar con ralladura de limón y perejil.`,
        consejos: 'La temperatura de 65 °C es crítica: más caliente y el bacalao se seca. Termómetro de cocina obligatorio. El aceite de confitar no se desperdicia: úsalo para huevos o ensaladas. El ajo negro tiene sabor suave y meloso, casi balsámico, no picante.',
        intolerancias: ['Sin Gluten', 'Sin Lactosa'],
        ingredientes: [
            { nombre: 'Bacalao desalado', gramos: 400 },
            { nombre: 'Aceite de oliva', gramos: 300 },
            { nombre: 'Ajo negro', gramos: 20 },
            { nombre: 'Ajo', gramos: 20 },
            { nombre: 'Espárragos verdes', gramos: 250 },
            { nombre: 'Caldo de pescado', gramos: 100 },
            { nombre: 'Limón', gramos: 50 },
            { nombre: 'Perejil fresco', gramos: 10 },
        ],
        prompt_imagen: 'Overhead food photography, dramatic side light from right. White deep plate. Central piece of perfectly flaked pearl-white confited cod loin sitting in a dark glossy black garlic sauce (pil-pil). The sauce is smooth and dark brown-black, almost lacquer-like. Four bright green asparagus spears arranged alongside. Small fresh parsley leaves scattered. Lemon zest curls on top of the fish. Minimal elegant plating. Dark charcoal stone surface. Fine dining editorial photography, ultra-realistic, no text, no watermarks.',
    },
    {
        id_ref: 'N1',
        nombre: 'Lubina entera en costra de sal con alioli verde de rúcula y tomate confitado',
        descripcion: 'Lubina entera cocinada en costra de sal, que actúa como cámara de vapor sellada. Se sirve rompiendo la costra en la mesa con un golpe dramático. Alioli verde de rúcula y tomates confitados como acompañamiento.',
        categoria: 'Pescados',
        tipo_plato: 'Cena',
        dificultad: 'Medio',
        tipo_coccion: 'Horno',
        porciones: 2,
        tiempo_prep_min: 50,
        kcal: 380,
        proteinas: 40,
        carbohidratos: 8,
        grasas: 20,
        instrucciones: `1. Precalentar horno a 220 °C.
2. Confitar tomates cherry en bandeja con AOVE, ajo en láminas y romero a 160 °C durante 30 minutos. Reservar.
3. Mezclar sal gruesa con claras de huevo hasta textura de arena húmeda compacta.
4. Rellenar la lubina con rodajas de limón y las hierbas frescas.
5. En bandeja: cama de sal de 1 cm. Lubina encima. Cubrir completamente con el resto de sal hasta que no se vea nada.
6. Hornear 25 minutos (para pieza de 600-700 g).
7. Alioli verde: triturar rúcula + mayonesa + zumo de limón + 1 diente de ajo hasta salsa homogénea.
8. Al sacar del horno, romper la costra en la mesa con golpe seco. Piel y escamas salen con la sal, dejando el pescado perfectamente jugoso.`,
        consejos: 'La costra de sal no sala el pescado: actúa como cámara de vapor sellada. El resultado es la textura más jugosa posible. No hace falta quitar las escamas antes: se van con la piel al romper la costra. El ritual de romper la costra delante del comensal es parte del plato.',
        intolerancias: ['Sin Gluten', 'Sin Lactosa'],
        ingredientes: [
            { nombre: 'Lubina', gramos: 650 },
            { nombre: 'Sal gruesa', gramos: 1500 },
            { nombre: 'Clara de huevo', gramos: 60 },
            { nombre: 'Tomillo fresco', gramos: 10 },
            { nombre: 'Romero fresco', gramos: 10 },
            { nombre: 'Limón', gramos: 80 },
            { nombre: 'Tomate cherry', gramos: 200 },
            { nombre: 'Aceite de oliva virgen extra', gramos: 30 },
            { nombre: 'Ajo', gramos: 10 },
            { nombre: 'Rúcula', gramos: 60 },
            { nombre: 'Mayonesa', gramos: 40 },
        ],
        prompt_imagen: 'Dramatic 45-degree food photography. Large oval white plate. A whole sea bass just removed from its white salt crust, the crust cracked open dramatically showing perfectly moist white fish inside. The broken salt dome pieces visible around the fish. Alongside: bright orange-red confited cherry tomatoes glistening with olive oil and a small white bowl of vibrant green rúcula aioli sauce. Rustic linen underneath, natural stone surface. Soft warm side lighting. Dramatic and elegant restaurant style. Ultra-realistic, no text.',
    },
    {
        id_ref: 'N2',
        nombre: 'Shakshuka de piquillos asados con feta y pan de masa madre',
        descripcion: 'Huevos escalfados en salsa de piquillos asados y tomate especiado, con queso feta desmigado y pan de masa madre para dipear. Versión española del clásico marroquí.',
        categoria: 'Platos variados',
        tipo_plato: 'Cena',
        dificultad: 'Fácil',
        tipo_coccion: 'Sartén/Wok',
        porciones: 2,
        tiempo_prep_min: 35,
        kcal: 350,
        proteinas: 22,
        carbohidratos: 18,
        grasas: 20,
        instrucciones: `1. Si usas piquillos frescos: asar en horno a 200 °C con AOVE durante 25 minutos. Pelar, despepitar y cortar en tiras. Si usas de lata: escurrir bien.
2. Sofreír cebolla en juliana fina en AOVE a fuego medio, 10 minutos. Añadir ajo picado. 1 minuto más.
3. Añadir los piquillos y las especias. Sofreír 2 minutos.
4. Añadir tomate triturado + sal. Cocinar 12-15 minutos a fuego medio hasta que reduzca y espese.
5. Hacer 4 huecos en la salsa con cuchara. Cascar un huevo en cada hueco. Tapar y cocinar a fuego bajo 5-6 minutos (yema líquida) o 8 minutos (cuajada).
6. Desmigar el feta por encima. Terminar con cilantro o perejil y un hilo de AOVE.
7. Tostar el pan de masa madre y servir al lado.`,
        consejos: 'El piquillo asado en casa marca la diferencia frente al de lata. La yema líquida es parte del plato, no lo cocines de más. Esta receta escala perfectamente: con sartén grande, para 4 personas sin cambiar la técnica.',
        intolerancias: ['Vegetariano'],
        ingredientes: [
            { nombre: 'Huevos', gramos: 240 },
            { nombre: 'Pimiento del piquillo', gramos: 200 },
            { nombre: 'Tomate triturado', gramos: 400 },
            { nombre: 'Cebolla', gramos: 150 },
            { nombre: 'Ajo', gramos: 15 },
            { nombre: 'Comino molido', gramos: 4 },
            { nombre: 'Pimentón ahumado', gramos: 4 },
            { nombre: 'Queso feta', gramos: 60 },
            { nombre: 'Aceite de oliva virgen extra', gramos: 15 },
            { nombre: 'Cilantro fresco', gramos: 15 },
            { nombre: 'Pan de masa madre', gramos: 100 },
        ],
        prompt_imagen: 'Overhead food photography, warm natural light. Cast iron skillet on a dark grey stone surface. Deep red tomato and roasted piquillo pepper sauce with 4 eggs nestled inside, yolks visible and barely set, golden-orange. White crumbled feta cheese scattered generously over the top. Fresh green cilantro leaves. Small olive oil pools glistening. Beside the skillet: two slices of rustic sourdough bread. Warm cozy Mediterranean aesthetic. Shadows visible from natural light source. Ultra-realistic food photography, no text, no watermarks.',
    },
    {
        id_ref: 'N3',
        nombre: 'Gambas al ajillo con fideos konjac, espinacas baby y ralladura de limón',
        descripcion: 'Gambas al ajillo sobre fideos konjac salteados con espinacas baby y ralladura de limón. Cena completa de menos de 300 kcal con toda la satisfacción del ajillo clásico.',
        categoria: 'Pescados',
        tipo_plato: 'Cena',
        dificultad: 'Fácil',
        tipo_coccion: 'Sartén/Wok',
        porciones: 2,
        tiempo_prep_min: 20,
        kcal: 280,
        proteinas: 30,
        carbohidratos: 5,
        grasas: 16,
        instrucciones: `1. Escurrir los fideos konjac y enjuagar bajo agua fría. Secar con papel. Tostar en sartén seca sin aceite 2-3 minutos para eliminar la humedad residual — paso imprescindible.
2. Laminar el ajo fino. Calentar AOVE en sartén amplia a fuego medio. Dorar el ajo lentamente con las cayenas enteras 3-4 minutos hasta dorado pero no quemado.
3. Subir el fuego a máximo. Añadir las gambas. Cocinar exactamente 1 minuto por cada lado. Sacar y reservar.
4. En el mismo aceite: añadir los fideos konjac tostados. Saltear 2 minutos.
5. Añadir las espinacas. Dejar que se marchiten 1 minuto.
6. Volver a incorporar las gambas. Añadir zumo de limón + ralladura + perejil picado. Saltear todo 30 segundos.
7. Servir inmediatamente.`,
        consejos: 'Tostar los konjac en seco es el paso que la mayoría no conoce: elimina el olor y mejora la textura. Las gambas en segundos a fuego máximo: si se cocinan de más quedan gomosas. El aceite aromatizado es el sabor del plato.',
        intolerancias: ['Sin Gluten', 'Sin Lactosa'],
        ingredientes: [
            { nombre: 'Gambas', gramos: 300 },
            { nombre: 'Fideos konjac', gramos: 400 },
            { nombre: 'Espinacas', gramos: 80 },
            { nombre: 'Ajo', gramos: 30 },
            { nombre: 'Cayena', gramos: 2 },
            { nombre: 'Aceite de oliva virgen extra', gramos: 25 },
            { nombre: 'Limón', gramos: 50 },
            { nombre: 'Perejil fresco', gramos: 15 },
        ],
        prompt_imagen: 'Overhead food photography, bright natural daylight. White wide bowl. Translucent shirataki konjac noodles coated in golden garlic oil, surrounded by bright pink-red plump shrimp, wilted dark green baby spinach. Golden caramelized garlic slices and small red dried chili pieces visible throughout. Bright lemon zest curled on top, fresh green parsley scattered. Oil glistening. Clean fresh Mediterranean aesthetic. Light marble surface. Ultra-realistic food photography, no text.',
    },
    {
        id_ref: 'N4',
        nombre: 'Revuelto cremoso de espárragos, aceite de trufa y jamón ibérico con pan de centeno',
        descripcion: 'Revuelto a baja temperatura con espárragos verdes, aceite de trufa y jamón ibérico en crudo encima. Plato de 5 estrellas listo en 20 minutos.',
        categoria: 'Platos variados',
        tipo_plato: 'Cena',
        dificultad: 'Fácil',
        tipo_coccion: 'Plancha',
        porciones: 2,
        tiempo_prep_min: 20,
        kcal: 420,
        proteinas: 28,
        carbohidratos: 18,
        grasas: 26,
        instrucciones: `1. Limpiar espárragos, cortar en trozos de 3 cm. Saltear en sartén con AOVE a fuego fuerte 2-3 minutos. Salpimentar. Reservar.
2. Batir los huevos con la nata, sal y pimienta. No batir en exceso: no queremos incorporar aire.
3. Calentar sartén antiadherente a fuego BAJO. Añadir la mantequilla.
4. Verter los huevos. Con espátula de silicona, mover continuamente de borde a centro muy lentamente. El revuelto se hace en 5-7 minutos a fuego bajo.
5. Cuando los huevos estén casi cuajados pero todavía cremosos y brillantes, retirar del fuego. El calor residual termina la cocción.
6. Añadir el aceite de trufa y los espárragos. Mezclar suavemente.
7. Tostar el pan de centeno. Servir el revuelto sobre el pan, coronar con jamón ibérico en crudo y cebollino picado.`,
        consejos: 'La temperatura baja es el único secreto del revuelto cremoso: nunca a fuego alto. El jamón ibérico va crudo encima, nunca cocinado. El calor del revuelto lo tibia ligeramente y funde su grasa.',
        intolerancias: [],
        ingredientes: [
            { nombre: 'Huevos', gramos: 300 },
            { nombre: 'Espárragos verdes', gramos: 200 },
            { nombre: 'Jamón ibérico', gramos: 60 },
            { nombre: 'Aceite de trufa', gramos: 10 },
            { nombre: 'Mantequilla', gramos: 10 },
            { nombre: 'Nata para cocinar', gramos: 30 },
            { nombre: 'Pan de centeno', gramos: 80 },
            { nombre: 'Cebollino', gramos: 10 },
            { nombre: 'Aceite de oliva virgen extra', gramos: 5 },
        ],
        prompt_imagen: '45-degree angle food photography, warm golden hour light from the side. Thick slice of dark rye bread on a white ceramic plate, topped generously with soft creamy slightly glossy scrambled eggs folded around bright green asparagus pieces. Three thin slices of jamón ibérico draped on top, translucent and marbled. Small green chive pieces scattered. A few drops of truffle oil glistening on the eggs. Warm cozy luxurious evening aesthetic. Dark moody background. Ultra-realistic, no text.',
    },
    {
        id_ref: 'N5',
        nombre: 'Crema fría de pepino y yogur griego con langostinos marinados en lima',
        descripcion: 'Gazpacho blanco de pepino y yogur griego, con langostinos marinados en lima y ají. Cena de verano de restaurante de lujo con cero cocción y menos de 250 kcal.',
        categoria: 'Pescados',
        tipo_plato: 'Cena',
        dificultad: 'Fácil',
        tipo_coccion: 'No Bake',
        porciones: 2,
        tiempo_prep_min: 15,
        kcal: 240,
        proteinas: 28,
        carbohidratos: 12,
        grasas: 8,
        instrucciones: `1. Marinar los langostinos: mezclar con zumo de 1 lima + ralladura + ají + 5 ml AOVE + sal. Reservar en frío mínimo 20 minutos.
2. Pelar y despepitar los pepinos. Reservar unas rodajas finas para decorar.
3. Triturar pepino + yogur griego + ajo + menta + vinagre de manzana + 10 ml AOVE + sal. Añadir agua fría poco a poco hasta textura de crema fluida.
4. Probar y corregir sal y acidez. La crema debe estar muy fría.
5. Enfriar en nevera mínimo 30 minutos si no estaba ya fría.
6. Servir en plato hondo. Colocar los langostinos marinados encima. Decorar con rodajas finas de pepino, ralladura de lima, menta fresca y un hilo de AOVE.`,
        consejos: 'Despepitar bien el pepino es clave: las semillas dan amargor. La menta es el alma del plato, no sustituir por albahaca. Para más proteína, añadir 100 g de langostinos extra sin cambiar el perfil de la crema.',
        intolerancias: ['Sin Gluten', 'Sin Lactosa'],
        ingredientes: [
            { nombre: 'Pepino', gramos: 600 },
            { nombre: 'Yogur griego', gramos: 250 },
            { nombre: 'Langostinos cocidos', gramos: 200 },
            { nombre: 'Lima', gramos: 60 },
            { nombre: 'Ajo', gramos: 5 },
            { nombre: 'Menta fresca', gramos: 20 },
            { nombre: 'Aceite de oliva virgen extra', gramos: 15 },
            { nombre: 'Vinagre de manzana', gramos: 10 },
        ],
        prompt_imagen: 'Overhead food photography, bright clean natural light, minimalist styling. Deep white bowl with smooth pale green cucumber-yogurt cold soup. On top: 4-5 large pink-white cooked langostinos arranged naturally. Ultra-thin cucumber slices fanned beside the prawns. Fresh mint leaves scattered. Lime zest curled on top. A thin drizzle of olive oil creating a glossy swirl. White clean marble surface, white linen napkin. Fresh summer clean aesthetic. Ultra-realistic, no text, no watermarks.',
    },
]

// ── Helpers ────────────────────────────────────────────────────────

function normalizar(str) {
    return str.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ').trim()
}

async function buscarAlimento(nombre) {
    const norm = normalizar(nombre)
    const palabras = norm.split(' ').filter(p => p.length > 2)

    // Nivel 1: exacto
    const { data: exacto } = await supabase
        .from('alimentos')
        .select('id, nombre, calorias')
        .ilike('nombre', nombre)
        .gt('calorias', 0)
        .limit(1)
    if (exacto?.length) return exacto[0]

    // Nivel 2: startsWith
    const { data: starts } = await supabase
        .from('alimentos')
        .select('id, nombre, calorias')
        .ilike('nombre', `${palabras[0]}%`)
        .gt('calorias', 0)
        .order('nombre')
        .limit(5)
    if (starts?.length) {
        const match = starts.find(a => normalizar(a.nombre).includes(norm.slice(0, 10)))
        if (match) return match
        return starts[0]
    }

    // Nivel 3: contains
    for (const palabra of palabras) {
        if (palabra.length < 3) continue
        const { data: contains } = await supabase
            .from('alimentos')
            .select('id, nombre, calorias')
            .ilike('nombre', `%${palabra}%`)
            .gt('calorias', 0)
            .order('nombre')
            .limit(3)
        if (contains?.length) return contains[0]
    }

    return null
}

async function generarImagen(prompt, nombreReceta) {
    if (!OPENAI_KEY) { console.log('    ⚠️  Sin OPENAI_API_KEY — saltando imagen'); return null }
    try {
        console.log(`    📸 Generando imagen con OpenAI...`)
        const res = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
            body: JSON.stringify({
                model: 'gpt-image-1',
                prompt,
                n: 1,
                size: '1024x1024',
            }),
        })
        const json = await res.json()
        if (!res.ok) { console.log(`    ❌ OpenAI error: ${json.error?.message}`); return null }
        const b64 = json.data?.[0]?.b64_json
        if (!b64) { console.log('    ❌ Sin b64_json en respuesta'); return null }
        return Buffer.from(b64, 'base64')
    } catch (e) {
        console.log(`    ❌ Error generando imagen: ${e.message}`)
        return null
    }
}

async function subirImagen(buffer, recetaId) {
    const fileName = `${recetaId}.jpg`
    const { error } = await supabase.storage
        .from('recetas')
        .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true })
    if (error) { console.log(`    ❌ Error subiendo imagen: ${error.message}`); return null }
    const { data } = supabase.storage.from('recetas').getPublicUrl(fileName)
    return data.publicUrl
}

// ── Main ───────────────────────────────────────────────────────────

async function insertarReceta(receta) {
    console.log(`\n${'─'.repeat(60)}`)
    console.log(`📌 ${receta.id_ref} — ${receta.nombre}`)

    if (DRY_RUN) {
        console.log('  [DRY RUN] Se insertaría esta receta con sus ingredientes.')
        for (const ing of receta.ingredientes) {
            const match = await buscarAlimento(ing.nombre)
            const estado = match ? `✅ ${match.nombre} (${match.calorias} kcal/100g)` : `⚠️  NO ENCONTRADO → ${ing.nombre}`
            console.log(`  ${estado}`)
        }
        return
    }

    // 1. Insertar receta
    const { data: nuevaReceta, error: errReceta } = await supabase
        .from('recetas')
        .insert({
            nombre: receta.nombre,
            descripcion: receta.descripcion,
            categoria: receta.categoria,
            tipo_plato: receta.tipo_plato,
            dificultad: receta.dificultad,
            tipo_coccion: receta.tipo_coccion,
            porciones: receta.porciones,
            tiempo_prep_min: receta.tiempo_prep_min,
            kcal: receta.kcal,
            proteinas: receta.proteinas,
            carbohidratos: receta.carbohidratos,
            grasas: receta.grasas,
            instrucciones: receta.instrucciones,
            consejos: receta.consejos,
            intolerancias: receta.intolerancias,
            estado: 'en_revision',
            notas_coach: `PENDIENTE REVISIÓN CARLOS — Serie Chef ${receta.id_ref} — Imagen generada con prompt personalizado`,
            fuente: 'manual',
            fuente_tipo: 'manual',
            coach_id: COACH_ID,
        })
        .select('id')
        .single()

    if (errReceta) { console.log(`  ❌ Error insertando receta: ${errReceta.message}`); return }
    console.log(`  ✅ Receta insertada: ${nuevaReceta.id}`)

    // 2. Insertar ingredientes
    let contMatch = 0
    for (let i = 0; i < receta.ingredientes.length; i++) {
        const ing = receta.ingredientes[i]
        const match = await buscarAlimento(ing.nombre)
        if (match) {
            console.log(`  🥗 ${ing.nombre} → ${match.nombre}`)
            contMatch++
        } else {
            console.log(`  ⚠️  ${ing.nombre} → sin match en BD`)
        }
        const { error: errIng } = await supabase
            .from('receta_ingredientes')
            .insert({
                receta_id: nuevaReceta.id,
                alimento_id: match?.id ?? null,
                nombre_libre: ing.nombre,
                cantidad_gramos: ing.gramos,
                orden: i + 1,
            })
        if (errIng) console.log(`    ❌ Error insertando ingrediente: ${errIng.message}`)
    }
    console.log(`  📊 Ingredientes: ${contMatch}/${receta.ingredientes.length} con match en BD`)

    // 3. Generar imagen
    if (!SIN_IMAGEN) {
        const imgBuffer = await generarImagen(receta.prompt_imagen, receta.nombre)
        if (imgBuffer) {
            const imgUrl = await subirImagen(imgBuffer, nuevaReceta.id)
            if (imgUrl) {
                await supabase.from('recetas').update({ imagen_url: imgUrl }).eq('id', nuevaReceta.id)
                console.log(`  🖼️  Imagen subida: ${imgUrl}`)
            }
        }
    }

    console.log(`  ✅ COMPLETADA — ${receta.id_ref}`)
    return nuevaReceta.id
}

async function main() {
    console.log(`\n🍽️  Insertar Recetas Chef — Serie 10 recetas`)
    console.log(`   Modo: ${DRY_RUN ? 'DRY RUN' : 'REAL'} | Imágenes: ${SIN_IMAGEN ? 'NO' : 'SÍ'}`)
    console.log(`   Coach ID: ${COACH_ID}`)

    const recetasAInsertar = soloId
        ? RECETAS.filter(r => r.id_ref === soloId)
        : RECETAS

    if (!recetasAInsertar.length) {
        console.error(`❌ No se encontró receta con id_ref "${soloId}"`)
        console.log('IDs disponibles:', RECETAS.map(r => r.id_ref).join(', '))
        process.exit(1)
    }

    const resultados = []
    for (const receta of recetasAInsertar) {
        const id = await insertarReceta(receta)
        resultados.push({ id_ref: receta.id_ref, nombre: receta.nombre, uuid: id ?? 'DRY_RUN' })
    }

    console.log(`\n${'═'.repeat(60)}`)
    console.log('📋 RESUMEN')
    for (const r of resultados) {
        console.log(`  ${r.id_ref} → ${r.uuid} | ${r.nombre.slice(0, 50)}...`)
    }

    if (!DRY_RUN) {
        const salidaPath = resolve(RAÍZ, '..', 'salidas', `${new Date().toISOString().slice(0,10).split('-').reverse().join('-')}_RECETAS_CHEF_INSERTADAS.json`)
        writeFileSync(salidaPath, JSON.stringify(resultados, null, 2))
        console.log(`\n💾 Resultado guardado en: ${salidaPath}`)
        console.log('\n🔍 Para revisar en NutriCoach: filtrar por estado "En progreso" + notas_coach contiene "Serie Chef"')
        console.log('🔍 Quality gate: cd nutricoach && node scripts/quality-gate-recetas.mjs --todas')
    }
}

main().catch(console.error)
