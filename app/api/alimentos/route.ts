import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

// Categorías que consideramos "no alimenticias" — productos que se cuelan
// de BEDCA, OpenFoodFacts o scraping y no son comestibles reales.
const CATEGORIAS_NO_ALIMENTO = [
    'Suplementos',  // no todos, pero algunos como proteína en polvo sí son alimentos
]

// Palabras clave en el nombre que indican que NO es un alimento comestible
// SINCRONIZADO con scripts/limpiar-todo-alimentos.mjs
const STOPWORDS_NO_ALIMENTO = [
    // ── Chicles / caramelos / golosinas no nutritivas ──
    'chicle', 'chicles', 'goma de mascar', 'goma mascar',
    // ── Higiene personal ──────────────────────────────
    'champú', 'champu', 'acondicionador', 'mascarilla capilar', 'sérum capilar', 'serum capilar',
    'gel de ducha', 'gel ducha', 'desodorante', 'antitranspirante', 'colonia',
    'crema corporal', 'loción corporal', 'manteca corporal',
    'aceite corporal', 'crema reductora', 'anticelulítico',
    'crema facial', 'sérum facial', 'contorno de ojos',
    'gel de afeitar', 'espuma de afeitar', 'aftershave',
    'pasta de dientes', 'dentifrico', 'dentífrico', 'cepillo de dientes', 'enjuague bucal', 'hilo dental',
    'jabón de manos', 'champú seco', 'jabón',
    'tampón', 'tampones', 'compresas', 'salvaslip', 'copa menstrual',
    'pañal', 'pañales', 'toallitas bebé', 'biberón', 'chupete',
    // ── Cosmética / belleza ───────────────────────────
    'maquillaje', 'colorete', 'base de maquillaje', 'pintalabios', 'labial',
    'máscara de pestañas', 'delineador de ojos', 'sombra de ojos',
    'laca de uñas',
    'agua micelar',
    'tónico facial', 'toallita desmaquillante', 'disco desmaquillante',
    'mascarilla facial', 'exfoliante', 'exfoliante facial',
    'bálsamo labial', 'balsamo labial', 'protector labial',
    'protector solar', 'crema solar', 'spray solar', 'spf',
    'autobronceador',
    'algodón hidrófilo', 'bastoncillos',
    // ── Farmacia / sanidad ────────────────────────────
    'apósitos', 'apositos', 'tiritas', 'vendas', 'venda',
    'suero fisiológico',
    'laxante',
    // ── Limpieza hogar ────────────────────────────────
    'detergente', 'suavizante', 'lejía',
    'limpiador', 'limpiacristales', 'desengrasante', 'lavavajillas',
    'fregona', 'fregasuelos', 'bolsa basura', 'bolsas basura',
    'papel higiénico', 'papel de cocina', 'papel aluminio', 'film transparente',
    'ambientador', 'insecticida',
    'estropajo', 'esponja',
    'vela', 'incienso',
    // ── Mascotas ──────────────────────────────────────
    'arena gatos', 'pienso', 'comida para gato', 'comida para perro',
    'comida perro', 'comida gato', 'alimento perro', 'alimento gato',
    'arena gato', 'cama perro',
    // ── Ropa y textil ─────────────────────────────────
    'calcetines', 'calcetín', 'chaqueta', 'edredón', 'edredon',
    'almohada', 'bufanda', 'gorro', 'vestido', 'camiseta',
    'toalla', 'toallas', 'sábanas', 'sabana',
    // ── Ferretería / bricolaje ────────────────────────
    'tornillo', 'tuerca', 'destornillador', 'taladro', 'broca',
    'cable eléctrico', 'enchufe',
    'pilas', 'bombilla',
    'cera', 'barniz', 'pintura', 'pegamento', 'cola',
    // ── Menaje no alimenticio ─────────────────────────
    'abrelatas', 'tabla de cortar', 'cubertería', 'cuberteria',
    'cuchillo de cocina',
    // ── Juguetes ──────────────────────────────────────
    'juguete', 'peluche', 'muñeco', 'muñeca', 'accesorio',
    // ── Decoración / plantas ──────────────────────────
    'maceta', 'planta decorativa', 'planta artificial',
    // ── Electrodomésticos ─────────────────────────────
    'cafetera', 'batidora', 'freidora', 'hervidor', 'licuadora',
    'robot de cocina',
    // ── Bebidas alcohólicas ───────────────────────────
    // Cerveza
    'cerveza', 'cervesa', 'birra', 'pilsner', 'lager', 'ipa', 'ale', 'stout',
    // Vino
    'vino', 'vinico', 'vinícola', 'vinicola',
    'cava', 'cava brut', 'champán', 'champagne', 'champaña',
    'prosecco', 'lambrusco',
    // Destilados
    'whisky', 'whiskey', 'bourbon', 'scotch',
    'vodka', 'ginebra', 'gin',
    'tequila', 'mezcal',
    'ron', 'brandy', 'coñac', 'cognac',
    // Licores
    'licor', 'anís', 'anisete', 'pacharán', 'pacharan',
    'amaretto', 'absenta', 'absinthe',
    'vermut', 'vermouth', 'martini',
    // Vinos fortificados
    'oporto', 'madeira', 'jerez', 'moscatel',
    // Sidra
    'sidra',
    // Combinados / RTD
    'sangría', 'sangria', 'tinto de verano',
    'calimocho', 'kalimotxo',
    // Alcohol puro no alimenticio
    'alcohol etílico', 'alcohol sanitario',
]

export async function GET(request: NextRequest) {
    try {
        const supabase = createServiceSupabase()
        const { searchParams } = new URL(request.url)
        const q = searchParams.get('q') ?? ''
        const categoria = searchParams.get('categoria') ?? ''
        const custom = searchParams.get('custom')
        const fuente = searchParams.get('fuente') ?? ''
        // Filtro opcional: excluir calorias=0 cuando hay categoria conocida
        // (evita carnes/huevos/lácteos con macros=0)
        const soloConDatos = searchParams.get('soloConDatos') === 'true'

        let query = supabase.from('alimentos').select('*', { count: 'exact' })
            .eq('es_comestible', true)  // ocultar no-comestibles

        if (q) {
            query = query.ilike('nombre', `%${q}%`)
        }

        if (categoria) query = query.eq('categoria', categoria)
        if (custom === 'true') query = query.eq('custom', true)
        else if (custom === 'false') query = query.eq('custom', false)
        if (fuente) query = query.eq('fuente', fuente)

        // Filtro: excluir calorias=0 para categorías que siempre deberían tener datos
        if (soloConDatos) {
            query = query.gt('calorias', 0)
        }

        if (q) {
            query = query.order("calorias", { ascending: false, nullsFirst: false })
            query = query.order("nombre", { ascending: true })
            query = query.limit(80)
        } else {
            query = query.order("categoria", { ascending: true })
            query = query.order("nombre", { ascending: true })
            // Sin límite fijo — cargamos todo el catálogo
            // (los alimentos se agrupan en frontend, el volumen es manejable)
            query = query.limit(5000)
            const from = parseInt(searchParams.get("from") || "")
            const to = parseInt(searchParams.get("to") || "")
            if (!isNaN(from) && !isNaN(to)) {
                query = query.range(from, to)
            }
        }

        const { data, error, count } = await query
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })

        // Filtro post-query: eliminar no-alimentos por nombre
        // También excluir explícitamente categorías de limpieza/droguería
        const CULT = CATEGORIAS_NO_ALIMENTO
        const filtrados = (data ?? []).filter(a => {
            const nombreLower = a.nombre?.toLowerCase() ?? ''
            // No es no-alimento por stopwords
            const esNoAlimento = STOPWORDS_NO_ALIMENTO.some(sw => nombreLower.includes(sw))
            if (esNoAlimento) return false
            return true
        })

        const response = filtrados as typeof data
        return NextResponse.json(response)
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = createApiSupabase(request)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const body = await request.json()
        const { nombre, categoria, calorias, proteinas, carbohidratos, grasas, fibra, fuente, codigo_externo } = body

        if (!nombre || calorias === undefined) {
            return NextResponse.json({ error: 'nombre y calorias son obligatorios' }, { status: 400 })
        }

        // 🚫 Rechazar productos no comestibles
        const n = (nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        const NO_COMESTIBLE = /comida (gato|gatos|perro|perros)|barra labial|barra labios|labial (limitless|glass shine|ink matte)|pasta encias/
        if (NO_COMESTIBLE.test(n)) {
            return NextResponse.json({ error: 'Producto no comestible rechazado' }, { status: 400 })
        }

        // Evitar duplicados (mismo nombre normalizado y coach)
        const nombreNormalizado = nombre.trim()
        const { data: existentes } = await supabase
            .from('alimentos')
            .select('id')
            .eq('coach_id', user.id)
            .ilike('nombre', nombreNormalizado)

        if (existentes && existentes.length > 0) {
            return NextResponse.json({ id: existentes[0].id, duplicado: true })
        }

        const { data, error } = await supabase.from('alimentos').insert({
            nombre: nombreNormalizado,
            categoria: categoria ?? 'Supermercado',
            calorias,
            proteinas: proteinas ?? 0,
            carbohidratos: carbohidratos ?? 0,
            grasas: grasas ?? 0,
            fibra: fibra ?? 0,
            fuente: fuente ?? undefined,
            codigo_externo: codigo_externo ?? null,
            custom: true,
            coach_id: user.id,
        }).select().single()

        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        return NextResponse.json(data)
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 })
    }
}
