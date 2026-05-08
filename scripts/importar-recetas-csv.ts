/**
 * Script para importar recetas desde CSV de Notion a Supabase.
 *
 * USO:
 *   1. Exporta tu recetario de Notion como CSV
 *   2. Coloca el CSV en la carpeta raíz del proyecto (ej: recetas.csv)
 *   3. Ejecuta: npx ts-node --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/importar-recetas-csv.ts <ruta-del-csv>
 *
 * FORMATO ESPERADO DEL CSV (columnas):
 *   Nombre, Categoría, Tipo de Plato, Kcal, Proteína (g), Carbos (g), Grasa (g),
 *   Ingredientes, Intolerancias, Dificultad, Tipo Cocción, Porciones, Tiempo (min), URL
 *
 * Exportado desde Notion como CSV (··· → Export → CSV).
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ── Cargar .env.local ANTES de cualquier otra cosa ──
function loadEnvLocal(): void {
    const possiblePaths = [
        path.resolve(__dirname, '..', '.env.local'),
        path.resolve(process.cwd(), '.env.local'),
    ]
    for (const envPath of possiblePaths) {
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf-8')
            for (const line of envContent.split('\n')) {
                const trimmed = line.trim()
                if (trimmed && !trimmed.startsWith('#')) {
                    const eqIdx = trimmed.indexOf('=')
                    if (eqIdx > 0) {
                        const key = trimmed.slice(0, eqIdx).trim()
                        let value = trimmed.slice(eqIdx + 1).trim()
                        if ((value.startsWith('"') && value.endsWith('"')) ||
                            (value.startsWith("'") && value.endsWith("'"))) {
                            value = value.slice(1, -1)
                        }
                        if (!process.env[key]) {
                            process.env[key] = value
                        }
                    }
                }
            }
            return
        }
    }
}

loadEnvLocal()

// ── Cliente Supabase con service role (para CLI) ──
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    console.error('❌ Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')
    console.error('   Asegúrate de tener un .env.local en nutricoach/')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

// ── Interfaces ──
interface RecetaRow {
    nombre: string
    categoria: string
    tipo_plato?: string
    tipo_coccion?: string
    dificultad?: string
    porciones: number
    tiempo_prep_min?: number
    kcal: number
    proteinas: number
    carbohidratos: number
    grasas: number
    ingredientes_raw?: string
    intolerancias?: string[]
    url_origen?: string
}

// Mapeo de nombres de columnas (español/inglés) → campo DB
const MAPEO_COLUMNAS: Record<string, keyof RecetaRow> = {
    nombre: 'nombre',
    name: 'nombre',
    categoría: 'categoria',
    categoria: 'categoria',
    category: 'categoria',
    'tipo de plato': 'tipo_plato',
    'meal type': 'tipo_plato',
    'tipo cocción': 'tipo_coccion',
    'tipo coccion': 'tipo_coccion',
    difficulty: 'dificultad',
    dificultad: 'dificultad',
    kcal: 'kcal',
    calorías: 'kcal',
    calorias: 'kcal',
    proteína: 'proteinas',
    proteina: 'proteinas',
    'proteína (g)': 'proteinas',
    'proteina (g)': 'proteinas',
    protein: 'proteinas',
    carbohidratos: 'carbohidratos',
    carbs: 'carbohidratos',
    'carbos (g)': 'carbohidratos',
    'carbos': 'carbohidratos',
    grasas: 'grasas',
    grasa: 'grasas',
    'grasa (g)': 'grasas',
    'grasas (g)': 'grasas',
    fat: 'grasas',
    ingredientes: 'ingredientes_raw',
    ingredients: 'ingredientes_raw',
    intolerancias: 'intolerancias',
    alergenos: 'intolerancias',
    allergens: 'intolerancias',
    url: 'url_origen',
    fuente: 'url_origen',
    source: 'url_origen',
    porciones: 'porciones',
    servings: 'porciones',
    'tiempo (min)': 'tiempo_prep_min',
    tiempo: 'tiempo_prep_min',
    'tiempo prep': 'tiempo_prep_min',
}

function parseCSV(content: string): Record<string, string>[] {
    // Eliminar BOM (Byte Order Mark) si existe
    const clean = content.replace(/^\uFEFF/, '')
    const lines = clean.split('\n').filter(line => line.trim())
    if (lines.length < 2) {
        throw new Error('El CSV debe tener al menos una cabecera y una fila de datos')
    }

    // Detectar delimitador
    const primeraLinea = lines[0]
    const delimiter = primeraLinea.includes(';') ? ';' : ','

    const headers = primeraLinea.split(delimiter).map(h => h.trim().toLowerCase())

    return lines.slice(1).map(line => {
        const values = line.split(delimiter).map(v => v.trim())
        const record: Record<string, string> = {}
        headers.forEach((header, i) => {
            if (i < values.length) {
                record[header] = values[i]
            }
        })
        return record
    })
}

function mapearReceta(row: Record<string, string>): Partial<RecetaRow> {
    const receta: Partial<RecetaRow> = {}

    for (const [columnaRaw, valor] of Object.entries(row)) {
        const columna = columnaRaw.toLowerCase().trim()
        const campo = MAPEO_COLUMNAS[columna]
        if (campo) {
            let valorLimpio = valor.replace(/^["']|["']$/g, '').trim()

            // Campos numéricos
            const CAMPOS_NUMERICOS = ['kcal', 'proteinas', 'carbohidratos', 'grasas', 'porciones', 'tiempo_prep_min'] as const
            if ((CAMPOS_NUMERICOS as readonly string[]).includes(campo)) {
                const num = parseFloat(valorLimpio.replace(',', '.'))
                if (campo === 'porciones') {
                    (receta as any)[campo] = isNaN(num) ? 1 : Math.round(num)
                } else if (campo === 'tiempo_prep_min') {
                    (receta as any)[campo] = isNaN(num) ? undefined : Math.round(num)
                } else {
                    (receta as any)[campo] = isNaN(num) ? 0 : num
                }
            } else if (campo === 'ingredientes_raw') {
                receta[campo] = valorLimpio || undefined
            } else if (campo === 'intolerancias') {
                receta[campo] = valorLimpio
                    ? valorLimpio.split(/[,;]/).map(i => i.trim()).filter(Boolean)
                    : []
            } else {
                (receta as any)[campo] = valorLimpio || undefined
            }
        }
    }

    return receta
}

// Normalizar categorías (Tipo de Plato del CSV)
function normalizarTipoPlato(tipo?: string): string | undefined {
    if (!tipo) return undefined
    const map: Record<string, string> = {
        desayuno: 'Desayuno',
        desayunos: 'Desayuno',
        almuerzo: 'Almuerzo',
        'media mañana': 'Almuerzo',
        comida: 'Comida',
        cena: 'Cena',
        merienda: 'Merienda',
        snack: 'Snack',
        snacks: 'Snack',
        postre: 'Postre',
        postres: 'Postre',
        'batido/ smoothie': 'Snack',
        batido: 'Snack',
        smoothie: 'Snack',
    }
    return map[tipo.toLowerCase().trim()] || tipo
}

// Normalizar categoría (Categoria del CSV - dulce, carnse, etc.)
function normalizarCategoria(cat?: string): string {
    if (!cat) return 'Otras'
    const map: Record<string, string> = {
        dulce: 'Dulces',
        carnes: 'Carnes',
        pescados: 'Pescados',
        ensaladas: 'Ensaladas',
        sopas: 'Sopas',
        arroces: 'Arroces',
        pastas: 'Pastas',
        verduras: 'Verduras',
        legumbres: 'Legumbres',
        bowls: 'Bowls',
        'bowls fruta': 'Bowls',
        gofres: 'Gofres',
        tostas: 'Tostas',
        'tostas/bagels': 'Tostas',
        burritos: 'Burritos',
        'fajitas/tacos': 'Fajitas/Tacos',
        salsas: 'Salsas',
        entrante: 'Entrantes',
        'platos variados': 'Platos Variados',
        mealpreps: 'Mealpreps',
        mealprep: 'Mealpreps',
    }
    return map[cat.toLowerCase().trim()] || cat
}

export async function importarRecetasDesdeCSV(rutaCSV: string): Promise<{
    success: boolean
    importadas: number
    duplicadas: number
    errores: string[]
}> {
    const resultado = {
        success: false,
        importadas: 0,
        duplicadas: 0,
        errores: [] as string[],
    }

    try {
        // 1. Obtener primer coach (usuario con role='coach')
        const { data: coaches, error: coachError } = await supabase
            .from('profiles')
            .select('id, nombre')
            .eq('role', 'coach')
            .limit(1)

        if (coachError || !coaches || coaches.length === 0) {
            resultado.errores.push('No se encontró ningún coach en la base de datos.')
            return resultado
        }

        const coach = coaches[0]
        console.log(`👤 Coach: ${coach.nombre} (${coach.id})`)

        // 2. Leer CSV
        const content = fs.readFileSync(rutaCSV, 'utf-8')
        const rows = parseCSV(content)
        console.log(`📄 CSV leído: ${rows.length} filas`)

        // Mostrar primeras columnas detectadas para debug
        if (rows.length > 0) {
            const columnas = Object.keys(rows[0])
            console.log(`📋 Columnas detectadas: ${columnas.join(', ')}`)
        }

        // 3. Obtener recetas existentes para evitar duplicados
        const { data: existentes } = await supabase
            .from('recetas')
            .select('nombre')
            .eq('coach_id', coach.id)
        const nombresExistentes = new Set((existentes ?? []).map(r => r.nombre.toLowerCase()))

        // 4. Procesar cada fila
        for (let i = 0; i < rows.length; i++) {
            try {
                const mapeada = mapearReceta(rows[i])
                if (!mapeada.nombre) {
                    resultado.errores.push(`Fila ${i + 1}: falta el nombre, se omite`)
                    continue
                }

                // Solo importar si es "Listo" o "Sin empezar" — el usuario decide
                // Permitimos ambas

                // Verificar duplicado
                if (nombresExistentes.has(mapeada.nombre.toLowerCase())) {
                    resultado.duplicadas++
                    console.log(`  ⏭️  Duplicado: "${mapeada.nombre}"`)
                    continue
                }

                // La columna categoria en BD almacena el tipo de comida (Desayuno, Postre...)
                // Si el CSV tiene Tipo de Plato, lo usamos; si no, usamos Categoria
                const categoriaFinal = normalizarTipoPlato(mapeada.tipo_plato) || normalizarCategoria(mapeada.categoria) || 'Otras'

                const recetaInsert: Record<string, any> = {
                    coach_id: coach.id,
                    nombre: mapeada.nombre,
                    categoria: categoriaFinal,
                    tipo_coccion: mapeada.tipo_coccion || null,
                    dificultad: mapeada.dificultad || null,
                    porciones: mapeada.porciones || 1,
                    tiempo_prep_min: mapeada.tiempo_prep_min || null,
                    kcal: mapeada.kcal || 0,
                    proteinas: mapeada.proteinas || 0,
                    carbohidratos: mapeada.carbohidratos || 0,
                    grasas: mapeada.grasas || 0,
                    instrucciones: mapeada.ingredientes_raw || null,
                    intolerancias: mapeada.intolerancias || [],
                    url_origen: mapeada.url_origen || null,
                    fuente: mapeada.url_origen ? 'url' : 'import',
                }

                const { error: insertError } = await supabase
                    .from('recetas')
                    .insert(recetaInsert)

                if (insertError) {
                    resultado.errores.push(`Fila ${i + 1} "${mapeada.nombre}": ${insertError.message}`)
                    continue
                }

                resultado.importadas++
                nombresExistentes.add(mapeada.nombre.toLowerCase())
                const kcal = mapeada.kcal ?? '?'
                console.log(`  ✅ "${mapeada.nombre}" — ${kcal} kcal`)

            } catch (rowError: any) {
                resultado.errores.push(`Fila ${i + 1}: error inesperado: ${rowError.message}`)
            }
        }

        resultado.success = true
        console.log(`\n📊 RESULTADO:`)
        console.log(`  ✅ Importadas: ${resultado.importadas}`)
        console.log(`  ⏭️  Duplicadas: ${resultado.duplicadas}`)
        console.log(`  ❌ Errores: ${resultado.errores.length}`)
        if (resultado.errores.length > 0) {
            console.log(`  Primer error: ${resultado.errores[0]}`)
        }

        return resultado

    } catch (error: any) {
        resultado.errores.push(`Error general: ${error.message}`)
        console.error('❌ Error en importación:', error.message)
        return resultado
    }
}

// Auto-ejecución
if (require.main === module) {
    const ruta = process.argv[2]
    if (!ruta) {
        console.error('❌ Uso: npx ts-node --compiler-options \'{"module":"commonjs","moduleResolution":"node"}\' scripts/importar-recetas-csv.ts <ruta-del-csv>')
        console.error('   Ej: npx ts-node scripts/importar-recetas-csv.ts ./recetas.csv')
        process.exit(1)
    }

    const rutaAbsoluta = path.resolve(ruta)
    if (!fs.existsSync(rutaAbsoluta)) {
        console.error(`❌ Archivo no encontrado: ${rutaAbsoluta}`)
        process.exit(1)
    }

    ; (async () => {
        console.log('🌱 Importando recetas desde CSV...')
        console.log(`   Archivo: ${rutaAbsoluta}`)
        console.log('')
        const result = await importarRecetasDesdeCSV(rutaAbsoluta)
        process.exit(result.success ? 0 : 1)
    })()
}
