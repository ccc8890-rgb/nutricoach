#!/usr/bin/env node
/**
 * Script para poblar/actualizar alimentos con datos completos de BEDCA/USDA
 * Incluye macros + micronutrientes (vitaminas, minerales, perfil lipídico)
 *
 * Estrategia:
 *  1. Busca alimento por nombre (coincidencia aproximada) o lo crea
 *  2. Asigna fuente='bedca' y todos los valores nutricionales
 *  3. Los alimentos existentes se actualizan (no se duplican)
 *
 * Uso: node scripts/poblar-bedca-completo.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')

// ── Cargar .env.local ───────────────────────────────────────
function loadEnv() {
    const envPath = resolve(PROJECT_ROOT, '.env.local')
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        let value = trimmed.slice(eqIdx + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
        process.env[key] = value
    }
}
loadEnv()

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Dataset BEDCA completo con micronutrientes (por 100g) ──
// Fuentes: BEDCA (Base de Datos Española de Composición de Alimentos),
// USDA FoodData Central, FEN (Fundación Española de Nutrición)
// Valores redondeados a 2 decimales. 0 = no aplica o trazas insignificantes.

const ALIMENTOS_BEDCA = [
    // ═══════════════════════════════════════════════════════════
    // CARNES
    // ═══════════════════════════════════════════════════════════
    {
        nombre: 'Pechuga de pollo (cruda)',
        categoria: 'Carnes',
        calorias: 110, proteinas: 23.2, carbohidratos: 0, grasas: 1.9, fibra: 0, azucares: 0,
        vitamina_a_ug: 6, vitamina_c_mg: 0, vitamina_d_ug: 0.1, vitamina_e_mg: 0.27, vitamina_k_ug: 0.3,
        vitamina_b6_mg: 0.6, vitamina_b12_ug: 0.37, tiamina_mg: 0.07, riboflavina_mg: 0.11, niacina_mg: 10.6, folato_ug: 4,
        calcio_mg: 11, hierro_mg: 0.9, magnesio_mg: 27, fosforo_mg: 200, potasio_mg: 280, sodio_mg: 65, zinc_mg: 0.8, cobre_mg: 0.04, selenio_ug: 22,
        saturados_g: 0.5, monoinsaturados_g: 0.6, poliinsaturados_g: 0.4, colesterol_mg: 70,
    },
    {
        nombre: 'Pollo (muslo sin piel)',
        categoria: 'Carnes',
        calorias: 177, proteinas: 24.8, carbohidratos: 0, grasas: 8.2, fibra: 0, azucares: 0,
        vitamina_a_ug: 12, vitamina_c_mg: 0, vitamina_d_ug: 0.2, vitamina_e_mg: 0.3, vitamina_k_ug: 0.4,
        vitamina_b6_mg: 0.45, vitamina_b12_ug: 0.42, tiamina_mg: 0.09, riboflavina_mg: 0.18, niacina_mg: 6.8, folato_ug: 5,
        calcio_mg: 10, hierro_mg: 1.1, magnesio_mg: 22, fosforo_mg: 170, potasio_mg: 240, sodio_mg: 90, zinc_mg: 1.5, cobre_mg: 0.06, selenio_ug: 18,
        saturados_g: 2.3, monoinsaturados_g: 3.1, poliinsaturados_g: 1.6, colesterol_mg: 80,
    },
    {
        nombre: 'Pavo (pechuga)',
        categoria: 'Carnes',
        calorias: 104, proteinas: 22, carbohidratos: 0, grasas: 1.7, fibra: 0, azucares: 0,
        vitamina_a_ug: 5, vitamina_c_mg: 0, vitamina_d_ug: 0.1, vitamina_e_mg: 0.15, vitamina_k_ug: 0,
        vitamina_b6_mg: 0.65, vitamina_b12_ug: 0.42, tiamina_mg: 0.06, riboflavina_mg: 0.12, niacina_mg: 9.5, folato_ug: 7,
        calcio_mg: 12, hierro_mg: 0.7, magnesio_mg: 27, fosforo_mg: 210, potasio_mg: 260, sodio_mg: 65, zinc_mg: 1.1, cobre_mg: 0.05, selenio_ug: 25,
        saturados_g: 0.5, monoinsaturados_g: 0.4, poliinsaturados_g: 0.4, colesterol_mg: 65,
    },
    {
        nombre: 'Ternera (solomillo)',
        categoria: 'Carnes',
        calorias: 143, proteinas: 21.4, carbohidratos: 0, grasas: 6.1, fibra: 0, azucares: 0,
        vitamina_a_ug: 4, vitamina_c_mg: 0, vitamina_d_ug: 0.1, vitamina_e_mg: 0.35, vitamina_k_ug: 1.2,
        vitamina_b6_mg: 0.4, vitamina_b12_ug: 1.5, tiamina_mg: 0.08, riboflavina_mg: 0.19, niacina_mg: 6.5, folato_ug: 7,
        calcio_mg: 14, hierro_mg: 2.2, magnesio_mg: 21, fosforo_mg: 190, potasio_mg: 340, sodio_mg: 58, zinc_mg: 4.1, cobre_mg: 0.07, selenio_ug: 23,
        saturados_g: 2.4, monoinsaturados_g: 2.6, poliinsaturados_g: 0.3, colesterol_mg: 70,
    },
    {
        nombre: 'Lomo de cerdo',
        categoria: 'Carnes',
        calorias: 182, proteinas: 20.9, carbohidratos: 0, grasas: 10.7, fibra: 0, azucares: 0,
        vitamina_a_ug: 3, vitamina_c_mg: 0.6, vitamina_d_ug: 0.5, vitamina_e_mg: 0.3, vitamina_k_ug: 0,
        vitamina_b6_mg: 0.45, vitamina_b12_ug: 0.7, tiamina_mg: 0.75, riboflavina_mg: 0.24, niacina_mg: 5.8, folato_ug: 5,
        calcio_mg: 8, hierro_mg: 0.9, magnesio_mg: 24, fosforo_mg: 200, potasio_mg: 350, sodio_mg: 60, zinc_mg: 2.1, cobre_mg: 0.05, selenio_ug: 30,
        saturados_g: 3.5, monoinsaturados_g: 4.6, poliinsaturados_g: 1.4, colesterol_mg: 65,
    },
    {
        nombre: 'Jamón serrano',
        categoria: 'Carnes',
        calorias: 241, proteinas: 30.5, carbohidratos: 0.3, grasas: 13, fibra: 0, azucares: 0.3,
        vitamina_a_ug: 0, vitamina_c_mg: 0, vitamina_d_ug: 0.3, vitamina_e_mg: 0.22, vitamina_k_ug: 0,
        vitamina_b6_mg: 0.3, vitamina_b12_ug: 1.1, tiamina_mg: 0.55, riboflavina_mg: 0.21, niacina_mg: 6.3, folato_ug: 3,
        calcio_mg: 12, hierro_mg: 2.1, magnesio_mg: 21, fosforo_mg: 220, potasio_mg: 280, sodio_mg: 1150, zinc_mg: 2.8, cobre_mg: 0.09, selenio_ug: 20,
        saturados_g: 4.5, monoinsaturados_g: 6.1, poliinsaturados_g: 1.4, colesterol_mg: 72,
    },
    {
        nombre: 'Lomo embuchado',
        categoria: 'Carnes',
        calorias: 312, proteinas: 35, carbohidratos: 0.5, grasas: 18.5, fibra: 0, azucares: 0.5,
        vitamina_a_ug: 0, vitamina_c_mg: 0, vitamina_d_ug: 0.3, vitamina_e_mg: 0.25, vitamina_k_ug: 0,
        vitamina_b6_mg: 0.35, vitamina_b12_ug: 0.9, tiamina_mg: 0.65, riboflavina_mg: 0.23, niacina_mg: 5.8, folato_ug: 2,
        calcio_mg: 10, hierro_mg: 1.8, magnesio_mg: 20, fosforo_mg: 240, potasio_mg: 260, sodio_mg: 1400, zinc_mg: 3.0, cobre_mg: 0.08, selenio_ug: 18,
        saturados_g: 6.5, monoinsaturados_g: 8.5, poliinsaturados_g: 2.0, colesterol_mg: 80,
    },
    {
        nombre: 'Hígado de pollo',
        categoria: 'Carnes',
        calorias: 116, proteinas: 17.8, carbohidratos: 1.1, grasas: 4.4, fibra: 0, azucares: 0,
        vitamina_a_ug: 11500, vitamina_c_mg: 18, vitamina_d_ug: 0.1, vitamina_e_mg: 0.4, vitamina_k_ug: 0,
        vitamina_b6_mg: 0.55, vitamina_b12_ug: 16.9, tiamina_mg: 0.23, riboflavina_mg: 1.78, niacina_mg: 9.7, folato_ug: 580,
        calcio_mg: 10, hierro_mg: 9.2, magnesio_mg: 22, fosforo_mg: 350, potasio_mg: 230, sodio_mg: 72, zinc_mg: 3.3, cobre_mg: 0.35, selenio_ug: 55,
        saturados_g: 1.5, monoinsaturados_g: 1.1, poliinsaturados_g: 1.0, colesterol_mg: 345,
    },
    {
        nombre: 'Carne picada de ternera (5% grasa)',
        categoria: 'Carnes',
        calorias: 137, proteinas: 21.4, carbohidratos: 0, grasas: 5.5, fibra: 0, azucares: 0,
        vitamina_a_ug: 3, vitamina_c_mg: 0, vitamina_d_ug: 0.1, vitamina_e_mg: 0.3, vitamina_k_ug: 1.0,
        vitamina_b6_mg: 0.38, vitamina_b12_ug: 1.4, tiamina_mg: 0.07, riboflavina_mg: 0.17, niacina_mg: 6.0, folato_ug: 6,
        calcio_mg: 12, hierro_mg: 2.0, magnesio_mg: 20, fosforo_mg: 180, potasio_mg: 320, sodio_mg: 60, zinc_mg: 3.8, cobre_mg: 0.06, selenio_ug: 21,
        saturados_g: 2.2, monoinsaturados_g: 2.3, poliinsaturados_g: 0.3, colesterol_mg: 68,
    },
    {
        nombre: 'Fiambre de pavo',
        categoria: 'Carnes',
        calorias: 96, proteinas: 18.4, carbohidratos: 1.2, grasas: 1.7, fibra: 0, azucares: 0.8,
        vitamina_a_ug: 0, vitamina_c_mg: 0, vitamina_d_ug: 0.1, vitamina_e_mg: 0.15, vitamina_k_ug: 0,
        vitamina_b6_mg: 0.3, vitamina_b12_ug: 0.35, tiamina_mg: 0.05, riboflavina_mg: 0.1, niacina_mg: 5.5, folato_ug: 5,
        calcio_mg: 20, hierro_mg: 0.6, magnesio_mg: 18, fosforo_mg: 160, potasio_mg: 200, sodio_mg: 850, zinc_mg: 0.9, cobre_mg: 0.03, selenio_ug: 15,
        saturados_g: 0.5, monoinsaturados_g: 0.4, poliinsaturados_g: 0.3, colesterol_mg: 45,
    },
    // ═══════════════════════════════════════════════════════════
    // PESCADOS
    // ═══════════════════════════════════════════════════════════
    {
        nombre: 'Salmón (fresco)',
        categoria: 'Pescados',
        calorias: 208, proteinas: 20.4, carbohidratos: 0, grasas: 13.4, fibra: 0, azucares: 0,
        vitamina_a_ug: 12, vitamina_c_mg: 0, vitamina_d_ug: 11, vitamina_e_mg: 2.7, vitamina_k_ug: 0.1,
        vitamina_b6_mg: 0.75, vitamina_b12_ug: 3.2, tiamina_mg: 0.23, riboflavina_mg: 0.18, niacina_mg: 7.5, folato_ug: 25,
        calcio_mg: 10, hierro_mg: 0.5, magnesio_mg: 30, fosforo_mg: 280, potasio_mg: 370, sodio_mg: 49, zinc_mg: 0.5, cobre_mg: 0.05, selenio_ug: 32,
        saturados_g: 2.7, monoinsaturados_g: 4.4, poliinsaturados_g: 4.8, colesterol_mg: 55,
    },
    {
        nombre: 'Atún (fresco)',
        categoria: 'Pescados',
        calorias: 144, proteinas: 23.3, carbohidratos: 0, grasas: 5.1, fibra: 0, azucares: 0,
        vitamina_a_ug: 20, vitamina_c_mg: 0, vitamina_d_ug: 2.2, vitamina_e_mg: 1.0, vitamina_k_ug: 0.1,
        vitamina_b6_mg: 0.95, vitamina_b12_ug: 2.5, tiamina_mg: 0.24, riboflavina_mg: 0.12, niacina_mg: 15.0, folato_ug: 10,
        calcio_mg: 8, hierro_mg: 1.0, magnesio_mg: 50, fosforo_mg: 250, potasio_mg: 400, sodio_mg: 40, zinc_mg: 0.6, cobre_mg: 0.06, selenio_ug: 45,
        saturados_g: 1.3, monoinsaturados_g: 1.5, poliinsaturados_g: 1.8, colesterol_mg: 45,
    },
    {
        nombre: 'Merluza',
        categoria: 'Pescados',
        calorias: 74, proteinas: 17.4, carbohidratos: 0, grasas: 0.6, fibra: 0, azucares: 0,
        vitamina_a_ug: 10, vitamina_c_mg: 0, vitamina_d_ug: 0.3, vitamina_e_mg: 0.25, vitamina_k_ug: 0.1,
        vitamina_b6_mg: 0.2, vitamina_b12_ug: 1.2, tiamina_mg: 0.07, riboflavina_mg: 0.06, niacina_mg: 3.5, folato_ug: 7,
        calcio_mg: 30, hierro_mg: 0.4, magnesio_mg: 25, fosforo_mg: 230, potasio_mg: 340, sodio_mg: 74, zinc_mg: 0.4, cobre_mg: 0.02, selenio_ug: 25,
        saturados_g: 0.1, monoinsaturados_g: 0.1, poliinsaturados_g: 0.2, colesterol_mg: 55,
    },
    {
        nombre: 'Bacalao (fresco)',
        categoria: 'Pescados',
        calorias: 82, proteinas: 18, carbohidratos: 0, grasas: 0.7, fibra: 0, azucares: 0,
        vitamina_a_ug: 10, vitamina_c_mg: 0, vitamina_d_ug: 0.9, vitamina_e_mg: 0.6, vitamina_k_ug: 0.1,
        vitamina_b6_mg: 0.2, vitamina_b12_ug: 1.0, tiamina_mg: 0.08, riboflavina_mg: 0.07, niacina_mg: 2.8, folato_ug: 7,
        calcio_mg: 16, hierro_mg: 0.4, magnesio_mg: 32, fosforo_mg: 200, potasio_mg: 370, sodio_mg: 70, zinc_mg: 0.4, cobre_mg: 0.02, selenio_ug: 30,
        saturados_g: 0.1, monoinsaturados_g: 0.1, poliinsaturados_g: 0.2, colesterol_mg: 50,
    },
    {
        nombre: 'Dorada',
        categoria: 'Pescados',
        calorias: 96, proteinas: 19.4, carbohidratos: 0.6, grasas: 1.8, fibra: 0, azucares: 0.2,
        vitamina_a_ug: 12, vitamina_c_mg: 0, vitamina_d_ug: 2.0, vitamina_e_mg: 0.4, vitamina_k_ug: 0.1,
        vitamina_b6_mg: 0.45, vitamina_b12_ug: 1.7, tiamina_mg: 0.09, riboflavina_mg: 0.07, niacina_mg: 6.0, folato_ug: 9,
        calcio_mg: 20, hierro_mg: 0.5, magnesio_mg: 28, fosforo_mg: 210, potasio_mg: 350, sodio_mg: 90, zinc_mg: 0.5, cobre_mg: 0.03, selenio_ug: 35,
        saturados_g: 0.4, monoinsaturados_g: 0.5, poliinsaturados_g: 0.5, colesterol_mg: 55,
    },
    {
        nombre: 'Lubina',
        categoria: 'Pescados',
        calorias: 97, proteinas: 18.4, carbohidratos: 0, grasas: 2.5, fibra: 0, azucares: 0,
        vitamina_a_ug: 8, vitamina_c_mg: 0, vitamina_d_ug: 1.5, vitamina_e_mg: 0.3, vitamina_k_ug: 0.1,
        vitamina_b6_mg: 0.4, vitamina_b12_ug: 1.5, tiamina_mg: 0.08, riboflavina_mg: 0.06, niacina_mg: 5.0, folato_ug: 8,
        calcio_mg: 18, hierro_mg: 0.4, magnesio_mg: 30, fosforo_mg: 200, potasio_mg: 340, sodio_mg: 80, zinc_mg: 0.5, cobre_mg: 0.03, selenio_ug: 30,
        saturados_g: 0.6, monoinsaturados_g: 0.7, poliinsaturados_g: 0.7, colesterol_mg: 50,
    },
    {
        nombre: 'Sardinas (frescas)',
        categoria: 'Pescados',
        calorias: 208, proteinas: 19.8, carbohidratos: 0, grasas: 13.9, fibra: 0, azucares: 0,
        vitamina_a_ug: 40, vitamina_c_mg: 0, vitamina_d_ug: 5.5, vitamina_e_mg: 2.0, vitamina_k_ug: 0.1,
        vitamina_b6_mg: 0.3, vitamina_b12_ug: 8.9, tiamina_mg: 0.08, riboflavina_mg: 0.19, niacina_mg: 7.8, folato_ug: 10,
        calcio_mg: 320, hierro_mg: 2.5, magnesio_mg: 35, fosforo_mg: 450, potasio_mg: 350, sodio_mg: 90, zinc_mg: 1.2, cobre_mg: 0.1, selenio_ug: 40,
        saturados_g: 3.3, monoinsaturados_g: 4.0, poliinsaturados_g: 4.7, colesterol_mg: 60,
    },
    {
        nombre: 'Gambas',
        categoria: 'Pescados',
        calorias: 85, proteinas: 18.9, carbohidratos: 0.2, grasas: 0.6, fibra: 0, azucares: 0,
        vitamina_a_ug: 90, vitamina_c_mg: 0.5, vitamina_d_ug: 0.1, vitamina_e_mg: 1.2, vitamina_k_ug: 0.1,
        vitamina_b6_mg: 0.1, vitamina_b12_ug: 1.3, tiamina_mg: 0.03, riboflavina_mg: 0.03, niacina_mg: 2.5, folato_ug: 6,
        calcio_mg: 50, hierro_mg: 0.5, magnesio_mg: 45, fosforo_mg: 230, potasio_mg: 180, sodio_mg: 120, zinc_mg: 1.5, cobre_mg: 0.3, selenio_ug: 35,
        saturados_g: 0.1, monoinsaturados_g: 0.1, poliinsaturados_g: 0.2, colesterol_mg: 160,
    },
    {
        nombre: 'Mejillones (cocidos)',
        categoria: 'Pescados',
        calorias: 86, proteinas: 11.9, carbohidratos: 3.7, grasas: 2.2, fibra: 0, azucares: 0,
        vitamina_a_ug: 120, vitamina_c_mg: 3.5, vitamina_d_ug: 0.2, vitamina_e_mg: 0.6, vitamina_k_ug: 0.1,
        vitamina_b6_mg: 0.2, vitamina_b12_ug: 20, tiamina_mg: 0.12, riboflavina_mg: 0.15, niacina_mg: 2.0, folato_ug: 35,
        calcio_mg: 35, hierro_mg: 4.5, magnesio_mg: 35, fosforo_mg: 200, potasio_mg: 220, sodio_mg: 320, zinc_mg: 1.8, cobre_mg: 0.1, selenio_ug: 50,
        saturados_g: 0.4, monoinsaturados_g: 0.4, poliinsaturados_g: 0.6, colesterol_mg: 50,
    },
    {
        nombre: 'Calamar',
        categoria: 'Pescados',
        calorias: 92, proteinas: 15.6, carbohidratos: 3.1, grasas: 1.4, fibra: 0, azucares: 0,
        vitamina_a_ug: 8, vitamina_c_mg: 0, vitamina_d_ug: 0.1, vitamina_e_mg: 0.5, vitamina_k_ug: 0,
        vitamina_b6_mg: 0.05, vitamina_b12_ug: 1.3, tiamina_mg: 0.02, riboflavina_mg: 0.04, niacina_mg: 2.5, folato_ug: 5,
        calcio_mg: 30, hierro_mg: 0.5, magnesio_mg: 35, fosforo_mg: 200, potasio_mg: 240, sodio_mg: 90, zinc_mg: 1.0, cobre_mg: 0.2, selenio_ug: 45,
        saturados_g: 0.3, monoinsaturados_g: 0.2, poliinsaturados_g: 0.4, colesterol_mg: 230,
    },
    {
        nombre: 'Atún en lata al natural',
        categoria: 'Pescados',
        calorias: 103, proteinas: 23.5, carbohidratos: 0, grasas: 0.7, fibra: 0, azucares: 0,
        vitamina_a_ug: 5, vitamina_c_mg: 0, vitamina_d_ug: 1.0, vitamina_e_mg: 0.7, vitamina_k_ug: 0,
        vitamina_b6_mg: 0.35, vitamina_b12_ug: 2.2, tiamina_mg: 0.04, riboflavina_mg: 0.05, niacina_mg: 11.0, folato_ug: 5,
        calcio_mg: 10, hierro_mg: 0.8, magnesio_mg: 25, fosforo_mg: 170, potasio_mg: 230, sodio_mg: 340, zinc_mg: 0.5, cobre_mg: 0.04, selenio_ug: 55,
        saturados_g: 0.2, monoinsaturados_g: 0.1, poliinsaturados_g: 0.2, colesterol_mg: 30,
    },
    {
        nombre: 'Atún en lata en aceite de oliva',
        categoria: 'Pescados',
        calorias: 198, proteinas: 21.5, carbohidratos: 0, grasas: 12.1, fibra: 0, azucares: 0,
        vitamina_a_ug: 8, vitamina_c_mg: 0, vitamina_d_ug: 1.0, vitamina_e_mg: 2.5, vitamina_k_ug: 0.5,
        vitamina_b6_mg: 0.3, vitamina_b12_ug: 2.0, tiamina_mg: 0.03, riboflavina_mg: 0.04, niacina_mg: 10.0, folato_ug: 4,
        calcio_mg: 8, hierro_mg: 0.7, magnesio_mg: 22, fosforo_mg: 160, potasio_mg: 210, sodio_mg: 320, zinc_mg: 0.4, cobre_mg: 0.04, selenio_ug: 50,
        saturados_g: 2.0, monoinsaturados_g: 6.0, poliinsaturados_g: 2.5, colesterol_mg: 30,
    },
    // ═══════════════════════════════════════════════════════════
    // HUEVOS
    // ═══════════════════════════════════════════════════════════
    {
        nombre: 'Huevo entero (L)',
        categoria: 'Huevos',
        calorias: 155, proteinas: 13, carbohidratos: 1.1, grasas: 10.6, fibra: 0, azucares: 0.3,
        vitamina_a_ug: 260, vitamina_c_mg: 0, vitamina_d_ug: 2.2, vitamina_e_mg: 1.0, vitamina_k_ug: 0.3,
        vitamina_b6_mg: 0.17, vitamina_b12_ug: 1.1, tiamina_mg: 0.04, riboflavina_mg: 0.46, niacina_mg: 0.08, folato_ug: 47,
        calcio_mg: 56, hierro_mg: 1.8, magnesio_mg: 12, fosforo_mg: 200, potasio_mg: 140, sodio_mg: 140, zinc_mg: 1.3, cobre_mg: 0.07, selenio_ug: 30,
        saturados_g: 3.3, monoinsaturados_g: 4.1, poliinsaturados_g: 1.4, colesterol_mg: 370,
    },
    {
        nombre: 'Clara de huevo',
        categoria: 'Huevos',
        calorias: 52, proteinas: 10.9, carbohidratos: 0.7, grasas: 0.2, fibra: 0, azucares: 0.7,
        vitamina_a_ug: 0, vitamina_c_mg: 0, vitamina_d_ug: 0, vitamina_e_mg: 0, vitamina_k_ug: 0,
        vitamina_b6_mg: 0.01, vitamina_b12_ug: 0.09, tiamina_mg: 0.01, riboflavina_mg: 0.27, niacina_mg: 0.04, folato_ug: 3,
        calcio_mg: 7, hierro_mg: 0.1, magnesio_mg: 11, fosforo_mg: 15, potasio_mg: 160, sodio_mg: 170, zinc_mg: 0.03, cobre_mg: 0.02, selenio_ug: 20,
        saturados_g: 0, monoinsaturados_g: 0, poliinsaturados_g: 0, colesterol_mg: 0,
    },
    {
        nombre: 'Yema de huevo',
        categoria: 'Huevos',
        calorias: 339, proteinas: 15.9, carbohidratos: 3.6, grasas: 26.5, fibra: 0, azucares: 0.6,
        vitamina_a_ug: 650, vitamina_c_mg: 0, vitamina_d_ug: 5.5, vitamina_e_mg: 2.5, vitamina_k_ug: 0.7,
        vitamina_b6_mg: 0.35, vitamina_b12_ug: 2.5, tiamina_mg: 0.1, riboflavina_mg: 0.5, niacina_mg: 0.04, folato_ug: 150,
        calcio_mg: 130, hierro_mg: 4.5, magnesio_mg: 10, fosforo_mg: 600, potasio_mg: 110, sodio_mg: 60, zinc_mg: 3.1, cobre_mg: 0.15, selenio_ug: 60,
        saturados_g: 8.0, monoinsaturados_g: 10.0, poliinsaturados_g: 3.5, colesterol_mg: 1000,
    },
    // ═══════════════════════════════════════════════════════════
    // LÁCTEOS
    // ═══════════════════════════════════════════════════════════
    {
        nombre: 'Leche entera',
        categoria: 'Lácteos',
        calorias: 61, proteinas: 3.2, carbohidratos: 4.8, grasas: 3.5, fibra: 0, azucares: 4.8,
        vitamina_a_ug: 35, vitamina_c_mg: 1.0, vitamina_d_ug: 0.8, vitamina_e_mg: 0.07, vitamina_k_ug: 0.3,
        vitamina_b6_mg: 0.04, vitamina_b12_ug: 0.45, tiamina_mg: 0.04, riboflavina_mg: 0.17, niacina_mg: 0.09, folato_ug: 5,
        calcio_mg: 120, hierro_mg: 0.05, magnesio_mg: 12, fosforo_mg: 92, potasio_mg: 150, sodio_mg: 45, zinc_mg: 0.4, cobre_mg: 0.01, selenio_ug: 3,
        saturados_g: 2.2, monoinsaturados_g: 1.0, poliinsaturados_g: 0.1, colesterol_mg: 14,
    },
    {
        nombre: 'Leche desnatada',
        categoria: 'Lácteos',
        calorias: 33, proteinas: 3.4, carbohidratos: 4.9, grasas: 0.1, fibra: 0, azucares: 4.9,
        vitamina_a_ug: 5, vitamina_c_mg: 1.0, vitamina_d_ug: 0.8, vitamina_e_mg: 0.01, vitamina_k_ug: 0,
        vitamina_b6_mg: 0.04, vitamina_b12_ug: 0.45, tiamina_mg: 0.04, riboflavina_mg: 0.18, niacina_mg: 0.10, folato_ug: 5,
        calcio_mg: 120, hierro_mg: 0.05, magnesio_mg: 12, fosforo_mg: 95, potasio_mg: 155, sodio_mg: 46, zinc_mg: 0.4, cobre_mg: 0.01, selenio_ug: 3,
        saturados_g: 0.05, monoinsaturados_g: 0.03, poliinsaturados_g: 0.01, colesterol_mg: 2,
    },
    {
        nombre: 'Yogur griego natural (entero)',
        categoria: 'Lácteos',
        calorias: 115, proteinas: 7, carbohidratos: 4, grasas: 8, fibra: 0, azucares: 4,
        vitamina_a_ug: 40, vitamina_c_mg: 0.5, vitamina_d_ug: 0.2, vitamina_e_mg: 0.1, vitamina_k_ug: 0.3,
        vitamina_b6_mg: 0.05, vitamina_b12_ug: 0.5, tiamina_mg: 0.04, riboflavina_mg: 0.16, niacina_mg: 0.1, folato_ug: 7,
        calcio_mg: 110, hierro_mg: 0.05, magnesio_mg: 10, fosforo_mg: 85, potasio_mg: 140, sodio_mg: 50, zinc_mg: 0.4, cobre_mg: 0.01, selenio_ug: 3,
        saturados_g: 5.0, monoinsaturados_g: 2.2, poliinsaturados_g: 0.3, colesterol_mg: 20,
    },
    {
        nombre: 'Yogur griego natural (0%)',
        categoria: 'Lácteos',
        calorias: 57, proteinas: 9.9, carbohidratos: 4, grasas: 0.2, fibra: 0, azucares: 4,
        vitamina_a_ug: 2, vitamina_c_mg: 0.5, vitamina_d_ug: 0.1, vitamina_e_mg: 0.01, vitamina_k_ug: 0,
        vitamina_b6_mg: 0.05, vitamina_b12_ug: 0.5, tiamina_mg: 0.04, riboflavina_mg: 0.16, niacina_mg: 0.1, folato_ug: 7,
        calcio_mg: 110, hierro_mg: 0.05, magnesio_mg: 10, fosforo_mg: 85, potasio_mg: 140, sodio_mg: 50, zinc_mg: 0.4, cobre_mg: 0.01, selenio_ug: 3,
        saturados_g: 0.1, monoinsaturados_g: 0.05, poliinsaturados_g: 0, colesterol_mg: 2,
    },
    {
        nombre: 'Queso cottage (requesón)',
        categoria: 'Lácteos',
        calorias: 98, proteinas: 11.1, carbohidratos: 3.4, grasas: 4.3, fibra: 0, azucares: 2.7,
        vitamina_a_ug: 35, vitamina_c_mg: 0, vitamina_d_ug: 0.1, vitamina_e_mg: 0.08, vitamina_k_ug: 0.2,
        vitamina_b6_mg: 0.07, vitamina_b12_ug: 0.4, tiamina_mg: 0.02, riboflavina_mg: 0.17, niacina_mg: 0.09, folato_ug: 13,
        calcio_mg: 85, hierro_mg: 0.2, magnesio_mg: 9, fosforo_mg: 140, potasio_mg: 100, sodio_mg: 320, zinc_mg: 0.4, cobre_mg: 0.03, selenio_ug: 10,
        saturados_g: 2.5, monoinsaturados_g: 1.0, poliinsaturados_g: 0.1, colesterol_mg: 15,
    },
    {
        nombre: 'Queso mozzarella',
        categoria: 'Lácteos',
        calorias: 280, proteinas: 22.2, carbohidratos: 2.2, grasas: 20.3, fibra: 0, azucares: 1.0,
        vitamina_a_ug: 165, vitamina_c_mg: 0, vitamina_d_ug: 0.2, vitamina_e_mg: 0.3, vitamina_k_ug: 1.0,
        vitamina_b6_mg: 0.04, vitamina_b12_ug: 1.2, tiamina_mg: 0.02, riboflavina_mg: 0.19, niacina_mg: 0.1, folato_ug: 7,
        calcio_mg: 500, hierro_mg: 0.3, magnesio_mg: 18, fosforo_mg: 360, potasio_mg: 80, sodio_mg: 620, zinc_mg: 2.5, cobre_mg: 0.01, selenio_ug: 15,
        saturados_g: 12.0, monoinsaturados_g: 6.0, poliinsaturados_g: 0.7, colesterol_mg: 80,
    },
    {
        nombre: 'Queso parmesano',
        categoria: 'Lácteos',
        calorias: 431, proteinas: 38.5, carbohidratos: 3.2, grasas: 28.8, fibra: 0, azucares: 0.8,
        vitamina_a_ug: 260, vitamina_c_mg: 0, vitamina_d_ug: 0.3, vitamina_e_mg: 0.3, vitamina_k_ug: 2.0,
        vitamina_b6_mg: 0.08, vitamina_b12_ug: 2.2, tiamina_mg: 0.04, riboflavina_mg: 0.33, niacina_mg: 0.2, folato_ug: 7,
        calcio_mg: 1100, hierro_mg: 0.6, magnesio_mg: 40, fosforo_mg: 690, potasio_mg: 110, sodio_mg: 1400, zinc_mg: 4.0, cobre_mg: 0.03, selenio_ug: 20,
        saturados_g: 16.5, monoinsaturados_g: 8.0, poliinsaturados_g: 1.0, colesterol_mg: 100,
    },
    {
        nombre: 'Queso manchego curado',
        categoria: 'Lácteos',
        calorias: 467, proteinas: 31.5, carbohidratos: 0.5, grasas: 38, fibra: 0, azucares: 0.5,
        vitamina_a_ug: 350, vitamina_c_mg: 0, vitamina_d_ug: 0.5, vitamina_e_mg: 0.5, vitamina_k_ug: 2.0,
        vitamina_b6_mg: 0.08, vitamina_b12_ug: 2.0, tiamina_mg: 0.04, riboflavina_mg: 0.35, niacina_mg: 0.2, folato_ug: 6,
        calcio_mg: 800, hierro_mg: 0.8, magnesio_mg: 30, fosforo_mg: 550, potasio_mg: 90, sodio_mg: 1050, zinc_mg: 3.5, cobre_mg: 0.04, selenio_ug: 15,
        saturados_g: 24.0, monoinsaturados_g: 10.5, poliinsaturados_g: 1.0, colesterol_mg: 110,
    },
    // ═══════════════════════════════════════════════════════════
    // VERDURAS Y HORTALIZAS
    // ═══════════════════════════════════════════════════════════
    {
        nombre: 'Espinacas (crudas)',
        categoria: 'Verduras',
        calorias: 23, proteinas: 2.9, carbohidratos: 3.6, grasas: 0.4, fibra: 2.2, azucares: 0.4,
        vitamina_a_ug: 470, vitamina_c_mg: 28, vitamina_d_ug: 0, vitamina_e_mg: 2.0, vitamina_k_ug: 480,
        vitamina_b6_mg: 0.2, vitamina_b12_ug: 0, tiamina_mg: 0.08, riboflavina_mg: 0.19, niacina_mg: 0.7, folato_ug: 194,
        calcio_mg: 100, hierro_mg: 2.7, magnesio_mg: 79, fosforo_mg: 49, potasio_mg: 558, sodio_mg: 79, zinc_mg: 0.5, cobre_mg: 0.13, selenio_ug: 1,
        saturados_g: 0.07, monoinsaturados_g: 0.01, poliinsaturados_g: 0.17, colesterol_mg: 0,
    },
    {
        nombre: 'Brócoli',
        categoria: 'Verduras',
        calorias: 34, proteinas: 2.8, carbohidratos: 7, grasas: 0.4, fibra: 2.6, azucares: 1.7,
        vitamina_a_ug: 31, vitamina_c_mg: 89, vitamina_d_ug: 0, vitamina_e_mg: 0.8, vitamina_k_ug: 102,
        vitamina_b6_mg: 0.18, vitamina_b12_ug: 0, tiamina_mg: 0.07, riboflavina_mg: 0.12, niacina_mg: 0.6, folato_ug: 63,
        calcio_mg: 48, hierro_mg: 0.7, magnesio_mg: 21, fosforo_mg: 65, potasio_mg: 316, sodio_mg: 32, zinc_mg: 0.4, cobre_mg: 0.05, selenio_ug: 2.5,
        saturados_g: 0.06, monoinsaturados_g: 0.03, poliinsaturados_g: 0.18, colesterol_mg: 0,
    },
    {
        nombre: 'Zanahoria',
        categoria: 'Verduras',
        calorias: 41, proteinas: 0.9, carbohidratos: 9.6, grasas: 0.2, fibra: 2.8, azucares: 4.7,
        vitamina_a_ug: 835, vitamina_c_mg: 5.9, vitamina_d_ug: 0, vitamina_e_mg: 0.66, vitamina_k_ug: 13,
        vitamina_b6_mg: 0.14, vitamina_b12_ug: 0, tiamina_mg: 0.07, riboflavina_mg: 0.06, niacina_mg: 0.9, folato_ug: 19,
        calcio_mg: 33, hierro_mg: 0.3, magnesio_mg: 12, fosforo_mg: 35, potasio_mg: 320, sodio_mg: 68, zinc_mg: 0.2, cobre_mg: 0.05, selenio_ug: 0.7,
        saturados_g: 0.04, monoinsaturados_g: 0.01, poliinsaturados_g: 0.12, colesterol_mg: 0,
    },
    {
        nombre: 'Tomate',
        categoria: 'Verduras',
        calorias: 18, proteinas: 0.9, carbohidratos: 3.9, grasas: 0.2, fibra: 1.2, azucares: 2.6,
        vitamina_a_ug: 42, vitamina_c_mg: 14, vitamina_d_ug: 0, vitamina_e_mg: 0.54, vitamina_k_ug: 7.9,
        vitamina_b6_mg: 0.08, vitamina_b12_ug: 0, tiamina_mg: 0.04, riboflavina_mg: 0.02, niacina_mg: 0.6, folato_ug: 15,
        calcio_mg: 10, hierro_mg: 0.3, magnesio_mg: 11, fosforo_mg: 24, potasio_mg: 237, sodio_mg: 5, zinc_mg: 0.2, cobre_mg: 0.06, selenio_ug: 0,
        saturados_g: 0.03, monoinsaturados_g: 0.03, poliinsaturados_g: 0.09, colesterol_mg: 0,
    },
    {
        nombre: 'Pimiento rojo',
        categoria: 'Verduras',
        calorias: 31, proteinas: 1, carbohidratos: 6, grasas: 0.3, fibra: 2.1, azucares: 4.2,
        vitamina_a_ug: 157, vitamina_c_mg: 128, vitamina_d_ug: 0, vitamina_e_mg: 0.8, vitamina_k_ug: 5.0,
        vitamina_b6_mg: 0.25, vitamina_b12_ug: 0, tiamina_mg: 0.05, riboflavina_mg: 0.09, niacina_mg: 1.0, folato_ug: 46,
        calcio_mg: 8, hierro_mg: 0.5, magnesio_mg: 12, fosforo_mg: 24, potasio_mg: 210, sodio_mg: 3, zinc_mg: 0.2, cobre_mg: 0.02, selenio_ug: 0.3,
        saturados_g: 0.04, monoinsaturados_g: 0.01, poliinsaturados_g: 0.16, colesterol_mg: 0,
    },
    {
        nombre: 'Lechuga',
        categoria: 'Verduras',
        calorias: 15, proteinas: 1.4, carbohidratos: 2.9, grasas: 0.2, fibra: 1.3, azucares: 0.8,
        vitamina_a_ug: 25, vitamina_c_mg: 3, vitamina_d_ug: 0, vitamina_e_mg: 0.18, vitamina_k_ug: 126,
        vitamina_b6_mg: 0.09, vitamina_b12_ug: 0, tiamina_mg: 0.07, riboflavina_mg: 0.08, niacina_mg: 0.4, folato_ug: 38,
        calcio_mg: 36, hierro_mg: 0.9, magnesio_mg: 13, fosforo_mg: 29, potasio_mg: 194, sodio_mg: 28, zinc_mg: 0.2, cobre_mg: 0.03, selenio_ug: 0.6,
        saturados_g: 0.03, monoinsaturados_g: 0.01, poliinsaturados_g: 0.09, colesterol_mg: 0,
    },
    {
        nombre: 'Acelgas',
        categoria: 'Verduras',
        calorias: 19, proteinas: 1.8, carbohidratos: 3.7, grasas: 0.2, fibra: 1.6, azucares: 1.1,
        vitamina_a_ug: 306, vitamina_c_mg: 18, vitamina_d_ug: 0, vitamina_e_mg: 1.9, vitamina_k_ug: 830,
        vitamina_b6_mg: 0.11, vitamina_b12_ug: 0, tiamina_mg: 0.04, riboflavina_mg: 0.12, niacina_mg: 0.4, folato_ug: 14,
        calcio_mg: 50, hierro_mg: 1.8, magnesio_mg: 81, fosforo_mg: 41, potasio_mg: 380, sodio_mg: 180, zinc_mg: 0.4, cobre_mg: 0.08, selenio_ug: 0.9,
        saturados_g: 0.03, monoinsaturados_g: 0.01, poliinsaturados_g: 0.08, colesterol_mg: 0,
    },
    {
        nombre: 'Calabacín',
        categoria: 'Verduras',
        calorias: 17, proteinas: 1.2, carbohidratos: 3.1, grasas: 0.3, fibra: 1.0, azucares: 2.5,
        vitamina_a_ug: 10, vitamina_c_mg: 22, vitamina_d_ug: 0, vitamina_e_mg: 0.12, vitamina_k_ug: 4.3,
        vitamina_b6_mg: 0.16, vitamina_b12_ug: 0, tiamina_mg: 0.04, riboflavina_mg: 0.06, niacina_mg: 0.5, folato_ug: 24,
        calcio_mg: 16, hierro_mg: 0.4, magnesio_mg: 18, fosforo_mg: 38, potasio_mg: 260, sodio_mg: 8, zinc_mg: 0.3, cobre_mg: 0.04, selenio_ug: 0.2,
        saturados_g: 0.06, monoinsaturados_g: 0.02, poliinsaturados_g: 0.12, colesterol_mg: 0,
    },
    {
        nombre: 'Berenjena',
        categoria: 'Verduras',
        calorias: 25, proteinas: 1, carbohidratos: 5.9, grasas: 0.2, fibra: 3.0, azucares: 3.5,
        vitamina_a_ug: 1, vitamina_c_mg: 2.2, vitamina_d_ug: 0, vitamina_e_mg: 0.3, vitamina_k_ug: 3.5,
        vitamina_b6_mg: 0.08, vitamina_b12_ug: 0, tiamina_mg: 0.04, riboflavina_mg: 0.04, niacina_mg: 0.6, folato_ug: 22,
        calcio_mg: 9, hierro_mg: 0.4, magnesio_mg: 14, fosforo_mg: 24, potasio_mg: 230, sodio_mg: 2, zinc_mg: 0.2, cobre_mg: 0.06, selenio_ug: 0.2,
        saturados_g: 0.03, monoinsaturados_g: 0.01, poliinsaturados_g: 0.08, colesterol_mg: 0,
    },
    {
        nombre: 'Coliflor',
        categoria: 'Verduras',
        calorias: 25, proteinas: 1.9, carbohidratos: 5, grasas: 0.3, fibra: 2.0, azucares: 2.0,
        vitamina_a_ug: 1, vitamina_c_mg: 48, vitamina_d_ug: 0, vitamina_e_mg: 0.08, vitamina_k_ug: 15.5,
        vitamina_b6_mg: 0.2, vitamina_b12_ug: 0, tiamina_mg: 0.05, riboflavina_mg: 0.06, niacina_mg: 0.5, folato_ug: 57,
        calcio_mg: 23, hierro_mg: 0.4, magnesio_mg: 15, fosforo_mg: 45, potasio_mg: 300, sodio_mg: 30, zinc_mg: 0.3, cobre_mg: 0.04, selenio_ug: 1.5,
        saturados_g: 0.07, monoinsaturados_g: 0.02, poliinsaturados_g: 0.13, colesterol_mg: 0,
    },
    {
        nombre: 'Cebolla',
        categoria: 'Verduras',
        calorias: 40, proteinas: 1.1, carbohidratos: 9.3, grasas: 0.1, fibra: 1.7, azucares: 4.7,
        vitamina_a_ug: 1, vitamina_c_mg: 7.4, vitamina_d_ug: 0, vitamina_e_mg: 0.02, vitamina_k_ug: 0.4,
        vitamina_b6_mg: 0.12, vitamina_b12_ug: 0, tiamina_mg: 0.05, riboflavina_mg: 0.03, niacina_mg: 0.2, folato_ug: 19,
        calcio_mg: 24, hierro_mg: 0.2, magnesio_mg: 10, fosforo_mg: 33, potasio_mg: 146, sodio_mg: 4, zinc_mg: 0.2, cobre_mg: 0.02, selenio_ug: 0.5,
        saturados_g: 0.02, monoinsaturados_g: 0.01, poliinsaturados_g: 0.05, colesterol_mg: 0,
    },
    {
        nombre: 'Pepino',
        categoria: 'Verduras',
        calorias: 15, proteinas: 0.7, carbohidratos: 3.6, grasas: 0.1, fibra: 0.5, azucares: 1.7,
        vitamina_a_ug: 5, vitamina_c_mg: 3, vitamina_d_ug: 0, vitamina_e_mg: 0.03, vitamina_k_ug: 16,
        vitamina_b6_mg: 0.04, vitamina_b12_ug: 0, tiamina_mg: 0.03, riboflavina_mg: 0.03, niacina_mg: 0.1, folato_ug: 7,
        calcio_mg: 14, hierro_mg: 0.2, magnesio_mg: 13, fosforo_mg: 24, potasio_mg: 147, sodio_mg: 2, zinc_mg: 0.2, cobre_mg: 0.03, selenio_ug: 0.1,
        saturados_g: 0.01, monoinsaturados_g: 0, poliinsaturados_g: 0.03, colesterol_mg: 0,
    },
    {
        nombre: 'Judías verdes',
        categoria: 'Verduras',
        calorias: 31, proteinas: 1.8, carbohidratos: 7, grasas: 0.2, fibra: 3.2, azucares: 3.3,
        vitamina_a_ug: 35, vitamina_c_mg: 16, vitamina_d_ug: 0, vitamina_e_mg: 0.4, vitamina_k_ug: 43,
        vitamina_b6_mg: 0.14, vitamina_b12_ug: 0, tiamina_mg: 0.08, riboflavina_mg: 0.1, niacina_mg: 0.7, folato_ug: 33,
        calcio_mg: 37, hierro_mg: 1.0, magnesio_mg: 25, fosforo_mg: 38, potasio_mg: 210, sodio_mg: 6, zinc_mg: 0.2, cobre_mg: 0.04, selenio_ug: 0.6,
        saturados_g: 0.05, monoinsaturados_g: 0.01, poliinsaturados_g: 0.09, colesterol_mg: 0,
    },
    // ═══════════════════════════════════════════════════════════
    // FRUTAS
    // ═══════════════════════════════════════════════════════════
    {
        nombre: 'Manzana (con piel)',
        categoria: 'Frutas',
        calorias: 52, proteinas: 0.3, carbohidratos: 14, grasas: 0.2, fibra: 2.4, azucares: 10.4,
        vitamina_a_ug: 3, vitamina_c_mg: 4.6, vitamina_d_ug: 0, vitamina_e_mg: 0.18, vitamina_k_ug: 2.2,
        vitamina_b6_mg: 0.04, vitamina_b12_ug: 0, tiamina_mg: 0.02, riboflavina_mg: 0.03, niacina_mg: 0.1, folato_ug: 3,
        calcio_mg: 6, hierro_mg: 0.1, magnesio_mg: 5, fosforo_mg: 11, potasio_mg: 107, sodio_mg: 1, zinc_mg: 0.04, cobre_mg: 0.03, selenio_ug: 0,
        saturados_g: 0.03, monoinsaturados_g: 0.01, poliinsaturados_g: 0.06, colesterol_mg: 0,
    },
    {
        nombre: 'Plátano',
        categoria: 'Frutas',
        calorias: 89, proteinas: 1.1, carbohidratos: 23, grasas: 0.3, fibra: 2.6, azucares: 12.2,
        vitamina_a_ug: 3, vitamina_c_mg: 8.7, vitamina_d_ug: 0, vitamina_e_mg: 0.1, vitamina_k_ug: 0.5,
        vitamina_b6_mg: 0.37, vitamina_b12_ug: 0, tiamina_mg: 0.03, riboflavina_mg: 0.07, niacina_mg: 0.7, folato_ug: 20,
        calcio_mg: 5, hierro_mg: 0.3, magnesio_mg: 27, fosforo_mg: 22, potasio_mg: 358, sodio_mg: 1, zinc_mg: 0.15, cobre_mg: 0.08, selenio_ug: 1.0,
        saturados_g: 0.11, monoinsaturados_g: 0.03, poliinsaturados_g: 0.07, colesterol_mg: 0,
    },
    {
        nombre: 'Naranja',
        categoria: 'Frutas',
        calorias: 47, proteinas: 0.9, carbohidratos: 12, grasas: 0.1, fibra: 2.4, azucares: 9.4,
        vitamina_a_ug: 11, vitamina_c_mg: 53, vitamina_d_ug: 0, vitamina_e_mg: 0.18, vitamina_k_ug: 0,
        vitamina_b6_mg: 0.06, vitamina_b12_ug: 0, tiamina_mg: 0.09, riboflavina_mg: 0.04, niacina_mg: 0.3, folato_ug: 30,
        calcio_mg: 40, hierro_mg: 0.1, magnesio_mg: 10, fosforo_mg: 14, potasio_mg: 181, sodio_mg: 0, zinc_mg: 0.07, cobre_mg: 0.03, selenio_ug: 0.5,
        saturados_g: 0.01, monoinsaturados_g: 0.02, poliinsaturados_g: 0.02, colesterol_mg: 0,
    },
    {
        nombre: 'Fresas',
        categoria: 'Frutas',
        calorias: 32, proteinas: 0.7, carbohidratos: 8, grasas: 0.3, fibra: 2.0, azucares: 4.9,
        vitamina_a_ug: 1, vitamina_c_mg: 59, vitamina_d_ug: 0, vitamina_e_mg: 0.29, vitamina_k_ug: 2.2,
        vitamina_b6_mg: 0.05, vitamina_b12_ug: 0, tiamina_mg: 0.02, riboflavina_mg: 0.02, niacina_mg: 0.4, folato_ug: 24,
        calcio_mg: 16, hierro_mg: 0.4, magnesio_mg: 13, fosforo_mg: 24, potasio_mg: 155, sodio_mg: 1, zinc_mg: 0.14, cobre_mg: 0.05, selenio_ug: 0.4,
        saturados_g: 0.02, monoinsaturados_g: 0.04, poliinsaturados_g: 0.16, colesterol_mg: 0,
    },
    {
        nombre: 'Uvas',
        categoria: 'Frutas',
        calorias: 69, proteinas: 0.7, carbohidratos: 18, grasas: 0.2, fibra: 0.9, azucares: 15.5,
        vitamina_a_ug: 3, vitamina_c_mg: 3.2, vitamina_d_ug: 0, vitamina_e_mg: 0.19, vitamina_k_ug: 14.6,
        vitamina_b6_mg: 0.09, vitamina_b12_ug: 0, tiamina_mg: 0.07, riboflavina_mg: 0.07, niacina_mg: 0.2, folato_ug: 2,
        calcio_mg: 10, hierro_mg: 0.4, magnesio_mg: 7, fosforo_mg: 20, potasio_mg: 190, sodio_mg: 2, zinc_mg: 0.07, cobre_mg: 0.13, selenio_ug: 0.1,
        saturados_g: 0.06, monoinsaturados_g: 0.01, poliinsaturados_g: 0.05, colesterol_mg: 0,
    },
    {
        nombre: 'Kiwi',
        categoria: 'Frutas',
        calorias: 61, proteinas: 1.1, carbohidratos: 15, grasas: 0.5, fibra: 3.0, azucares: 9.0,
        vitamina_a_ug: 4, vitamina_c_mg: 93, vitamina_d_ug: 0, vitamina_e_mg: 1.5, vitamina_k_ug: 40,
        vitamina_b6_mg: 0.06, vitamina_b12_ug: 0, tiamina_mg: 0.03, riboflavina_mg: 0.03, niacina_mg: 0.3, folato_ug: 25,
        calcio_mg: 34, hierro_mg: 0.3, magnesio_mg: 17, fosforo_mg: 34, potasio_mg: 312, sodio_mg: 3, zinc_mg: 0.14, cobre_mg: 0.13, selenio_ug: 0.2,
        saturados_g: 0.03, monoinsaturados_g: 0.07, poliinsaturados_g: 0.29, colesterol_mg: 0,
    },
    {
        nombre: 'Aguacate',
        categoria: 'Frutas',
        calorias: 160, proteinas: 2, carbohidratos: 8.5, grasas: 14.7, fibra: 6.7, azucares: 0.7,
        vitamina_a_ug: 7, vitamina_c_mg: 10, vitamina_d_ug: 0, vitamina_e_mg: 2.1, vitamina_k_ug: 21,
        vitamina_b6_mg: 0.26, vitamina_b12_ug: 0, tiamina_mg: 0.07, riboflavina_mg: 0.13, niacina_mg: 1.7, folato_ug: 81,
        calcio_mg: 12, hierro_mg: 0.6, magnesio_mg: 29, fosforo_mg: 52, potasio_mg: 485, sodio_mg: 7, zinc_mg: 0.6, cobre_mg: 0.19, selenio_ug: 0.4,
        saturados_g: 2.1, monoinsaturados_g: 9.8, poliinsaturados_g: 1.8, colesterol_mg: 0,
    },
    {
        nombre: 'Arándanos',
        categoria: 'Frutas',
        calorias: 57, proteinas: 0.7, carbohidratos: 14, grasas: 0.3, fibra: 2.4, azucares: 9.9,
        vitamina_a_ug: 3, vitamina_c_mg: 9.7, vitamina_d_ug: 0, vitamina_e_mg: 0.57, vitamina_k_ug: 19,
        vitamina_b6_mg: 0.05, vitamina_b12_ug: 0, tiamina_mg: 0.04, riboflavina_mg: 0.04, niacina_mg: 0.4, folato_ug: 6,
        calcio_mg: 6, hierro_mg: 0.3, magnesio_mg: 6, fosforo_mg: 12, potasio_mg: 77, sodio_mg: 1, zinc_mg: 0.16, cobre_mg: 0.06, selenio_ug: 0.1,
        saturados_g: 0.03, monoinsaturados_g: 0.05, poliinsaturados_g: 0.15, colesterol_mg: 0,
    },
    {
        nombre: 'Piña',
        categoria: 'Frutas',
        calorias: 50, proteinas: 0.5, carbohidratos: 13, grasas: 0.1, fibra: 1.4, azucares: 9.9,
        vitamina_a_ug: 3, vitamina_c_mg: 47.8, vitamina_d_ug: 0, vitamina_e_mg: 0.02, vitamina_k_ug: 0.7,
        vitamina_b6_mg: 0.11, vitamina_b12_ug: 0, tiamina_mg: 0.08, riboflavina_mg: 0.03, niacina_mg: 0.5, folato_ug: 18,
        calcio_mg: 13, hierro_mg: 0.3, magnesio_mg: 12, fosforo_mg: 8, potasio_mg: 109, sodio_mg: 1, zinc_mg: 0.12, cobre_mg: 0.11, selenio_ug: 0.1,
        saturados_g: 0.01, monoinsaturados_g: 0.01, poliinsaturados_g: 0.04, colesterol_mg: 0,
    },
    {
        nombre: 'Mango',
        categoria: 'Frutas',
        calorias: 60, proteinas: 0.8, carbohidratos: 15, grasas: 0.4, fibra: 1.6, azucares: 13.7,
        vitamina_a_ug: 54, vitamina_c_mg: 36, vitamina_d_ug: 0, vitamina_e_mg: 0.9, vitamina_k_ug: 4.2,
        vitamina_b6_mg: 0.12, vitamina_b12_ug: 0, tiamina_mg: 0.03, riboflavina_mg: 0.04, niacina_mg: 0.7, folato_ug: 43,
        calcio_mg: 11, hierro_mg: 0.2, magnesio_mg: 10, fosforo_mg: 14, potasio_mg: 168, sodio_mg: 1, zinc_mg: 0.09, cobre_mg: 0.11, selenio_ug: 0.6,
        saturados_g: 0.09, monoinsaturados_g: 0.14, poliinsaturados_g: 0.07, colesterol_mg: 0,
    },
    // ═══════════════════════════════════════════════════════════
    // CEREALES Y DERIVADOS
    // ═══════════════════════════════════════════════════════════
    {
        nombre: 'Avena (copos)',
        categoria: 'Cereales',
        calorias: 389, proteinas: 16.9, carbohidratos: 66, grasas: 6.9, fibra: 10.6, azucares: 1.0,
        vitamina_a_ug: 0, vitamina_c_mg: 0, vitamina_d_ug: 0, vitamina_e_mg: 0.7, vitamina_k_ug: 2.0,
        vitamina_b6_mg: 0.1, vitamina_b12_ug: 0, tiamina_mg: 0.46, riboflavina_mg: 0.16, niacina_mg: 0.9, folato_ug: 32,
        calcio_mg: 54, hierro_mg: 4.7, magnesio_mg: 177, fosforo_mg: 523, potasio_mg: 429, sodio_mg: 4, zinc_mg: 3.6, cobre_mg: 0.4, selenio_ug: 28,
        saturados_g: 1.2, monoinsaturados_g: 2.2, poliinsaturados_g: 2.5, colesterol_mg: 0,
    },
    {
        nombre: 'Arroz blanco (cocido)',
        categoria: 'Cereales',
        calorias: 130, proteinas: 2.7, carbohidratos: 28, grasas: 0.3, fibra: 0.4, azucares: 0,
        vitamina_a_ug: 0, vitamina_c_mg: 0, vitamina_d_ug: 0, vitamina_e_mg: 0.04, vitamina_k_ug: 0,
        vitamina_b6_mg: 0.09, vitamina_b12_ug: 0, tiamina_mg: 0.02, riboflavina_mg: 0.01, niacina_mg: 0.4, folato_ug: 3,
        calcio_mg: 5, hierro_mg: 0.2, magnesio_mg: 12, fosforo_mg: 38, potasio_mg: 35, sodio_mg: 1, zinc_mg: 0.5, cobre_mg: 0.05, selenio_ug: 7,
        saturados_g: 0.08, monoinsaturados_g: 0.09, poliinsaturados_g: 0.08, colesterol_mg: 0,
    },
    {
        nombre: 'Arroz integral (cocido)',
        categoria: 'Cereales',
        calorias: 111, proteinas: 2.6, carbohidratos: 23, grasas: 0.9, fibra: 1.8, azucares: 0.4,
        vitamina_a_ug: 0, vitamina_c_mg: 0, vitamina_d_ug: 0, vitamina_e_mg: 0.2, vitamina_k_ug: 0.3,
        vitamina_b6_mg: 0.12, vitamina_b12_ug: 0, tiamina_mg: 0.08, riboflavina_mg: 0.03, niacina_mg: 1.5, folato_ug: 4,
        calcio_mg: 7, hierro_mg: 0.6, magnesio_mg: 39, fosforo_mg: 100, potasio_mg: 77, sodio_mg: 2, zinc_mg: 0.6, cobre_mg: 0.08, selenio_ug: 10,
        saturados_g: 0.2, monoinsaturados_g: 0.3, poliinsaturados_g: 0.3, colesterol_mg: 0,
    },
    {
        nombre: 'Pasta integral (cocida)',
        categoria: 'Cereales',
        calorias: 124, proteinas: 5.3, carbohidratos: 26, grasas: 0.5, fibra: 3.0, azucares: 0.6,
        vitamina_a_ug: 0, vitamina_c_mg: 0, vitamina_d_ug: 0, vitamina_e_mg: 0.06, vitamina_k_ug: 0.1,
        vitamina_b6_mg: 0.07, vitamina_b12_ug: 0, tiamina_mg: 0.09, riboflavina_mg: 0.04, niacina_mg: 1.3, folato_ug: 9,
        calcio_mg: 10, hierro_mg: 1.0, magnesio_mg: 32, fosforo_mg: 95, potasio_mg: 90, sodio_mg: 3, zinc_mg: 0.7, cobre_mg: 0.11, selenio_ug: 25,
        saturados_g: 0.1, monoinsaturados_g: 0.1, poliinsaturados_g: 0.2, colesterol_mg: 0,
    },
    {
        nombre: 'Pasta (spaghetti, cocida)',
        categoria: 'Cereales',
        calorias: 131, proteinas: 5, carbohidratos: 25, grasas: 1.1, fibra: 1.8, azucares: 0.6,
        vitamina_a_ug: 0, vitamina_c_mg: 0, vitamina_d_ug: 0, vitamina_e_mg: 0.06, vitamina_k_ug: 0,
        vitamina_b6_mg: 0.05, vitamina_b12_ug: 0, tiamina_mg: 0.09, riboflavina_mg: 0.04, niacina_mg: 1.5, folato_ug: 7,
        calcio_mg: 9, hierro_mg: 0.6, magnesio_mg: 18, fosforo_mg: 60, potasio_mg: 58, sodio_mg: 2, zinc_mg: 0.5, cobre_mg: 0.07, selenio_ug: 22,
        saturados_g: 0.2, monoinsaturados_g: 0.1, poliinsaturados_g: 0.4, colesterol_mg: 0,
    },
    {
        nombre: 'Pan blanco',
        categoria: 'Cereales',
        calorias: 265, proteinas: 9, carbohidratos: 49, grasas: 3.2, fibra: 2.7, azucares: 5.0,
        vitamina_a_ug: 0, vitamina_c_mg: 0, vitamina_d_ug: 0, vitamina_e_mg: 0.2, vitamina_k_ug: 0.5,
        vitamina_b6_mg: 0.08, vitamina_b12_ug: 0, tiamina_mg: 0.36, riboflavina_mg: 0.25, niacina_mg: 4.3, folato_ug: 50,
        calcio_mg: 100, hierro_mg: 2.5, magnesio_mg: 25, fosforo_mg: 90, potasio_mg: 100, sodio_mg: 540, zinc_mg: 0.8, cobre_mg: 0.1, selenio_ug: 20,
        saturados_g: 0.7, monoinsaturados_g: 0.6, poliinsaturados_g: 1.3, colesterol_mg: 0,
    },
    {
        nombre: 'Pan integral',
        categoria: 'Cereales',
        calorias: 242, proteinas: 9.6, carbohidratos: 46, grasas: 3.6, fibra: 7.0, azucares: 4.0,
        vitamina_a_ug: 0, vitamina_c_mg: 0, vitamina_d_ug: 0, vitamina_e_mg: 0.4, vitamina_k_ug: 1.5,
        vitamina_b6_mg: 0.13, vitamina_b12_ug: 0, tiamina_mg: 0.25, riboflavina_mg: 0.13, niacina_mg: 3.6, folato_ug: 45,
        calcio_mg: 70, hierro_mg: 2.8, magnesio_mg: 65, fosforo_mg: 200, potasio_mg: 220, sodio_mg: 480, zinc_mg: 1.3, cobre_mg: 0.2, selenio_ug: 25,
        saturados_g: 0.6, monoinsaturados_g: 0.6, poliinsaturados_g: 1.4, colesterol_mg: 0,
    },
    {
        nombre: 'Quinoa (cocida)',
        categoria: 'Cereales',
        calorias: 120, proteinas: 4.4, carbohidratos: 21, grasas: 1.9, fibra: 2.8, azucares: 0.9,
        vitamina_a_ug: 1, vitamina_c_mg: 0, vitamina_d_ug: 0, vitamina_e_mg: 0.6, vitamina_k_ug: 0,
        vitamina_b6_mg: 0.12, vitamina_b12_ug: 0, tiamina_mg: 0.11, riboflavina_mg: 0.11, niacina_mg: 0.4, folato_ug: 42,
        calcio_mg: 17, hierro_mg: 1.5, magnesio_mg: 64, fosforo_mg: 150, potasio_mg: 170, sodio_mg: 7, zinc_mg: 1.1, cobre_mg: 0.2, selenio_ug: 2.8,
        saturados_g: 0.2, monoinsaturados_g: 0.5, poliinsaturados_g: 0.9, colesterol_mg: 0,
    },
    // ═══════════════════════════════════════════════════════════
    // LEGUMBRES
    // ═══════════════════════════════════════════════════════════
    {
        nombre: 'Lentejas (cocidas)',
        categoria: 'Legumbres',
        calorias: 116, proteinas: 9, carbohidratos: 20, grasas: 0.4, fibra: 7.9, azucares: 1.8,
        vitamina_a_ug: 2, vitamina_c_mg: 1.5, vitamina_d_ug: 0, vitamina_e_mg: 0.1, vitamina_k_ug: 1.7,
        vitamina_b6_mg: 0.18, vitamina_b12_ug: 0, tiamina_mg: 0.17, riboflavina_mg: 0.07, niacina_mg: 0.6, folato_ug: 180,
        calcio_mg: 19, hierro_mg: 3.3, magnesio_mg: 36, fosforo_mg: 180, potasio_mg: 270, sodio_mg: 2, zinc_mg: 1.3, cobre_mg: 0.3, selenio_ug: 2.8,
        saturados_g: 0.07, monoinsaturados_g: 0.08, poliinsaturados_g: 0.16, colesterol_mg: 0,
    },
    {
        nombre: 'Garbanzos (cocidos)',
        categoria: 'Legumbres',
        calorias: 139, proteinas: 8.9, carbohidratos: 23, grasas: 2.6, fibra: 7.6, azucares: 4.0,
        vitamina_a_ug: 2, vitamina_c_mg: 1.3, vitamina_d_ug: 0, vitamina_e_mg: 0.3, vitamina_k_ug: 4.0,
        vitamina_b6_mg: 0.14, vitamina_b12_ug: 0, tiamina_mg: 0.12, riboflavina_mg: 0.06, niacina_mg: 0.5, folato_ug: 172,
        calcio_mg: 49, hierro_mg: 2.9, magnesio_mg: 48, fosforo_mg: 160, potasio_mg: 290, sodio_mg: 7, zinc_mg: 1.5, cobre_mg: 0.35, selenio_ug: 3.7,
        saturados_g: 0.3, monoinsaturados_g: 0.5, poliinsaturados_g: 1.0, colesterol_mg: 0,
    },
    {
        nombre: 'Judías blancas (cocidas)',
        categoria: 'Legumbres',
        calorias: 127, proteinas: 8.7, carbohidratos: 23, grasas: 0.5, fibra: 7.4, azucares: 0.4,
        vitamina_a_ug: 0, vitamina_c_mg: 0.5, vitamina_d_ug: 0, vitamina_e_mg: 0.2, vitamina_k_ug: 3.5,
        vitamina_b6_mg: 0.12, vitamina_b12_ug: 0, tiamina_mg: 0.14, riboflavina_mg: 0.06, niacina_mg: 0.5, folato_ug: 81,
        calcio_mg: 50, hierro_mg: 2.1, magnesio_mg: 30, fosforo_mg: 120, potasio_mg: 330, sodio_mg: 2, zinc_mg: 1.0, cobre_mg: 0.17, selenio_ug: 1.5,
        saturados_g: 0.1, monoinsaturados_g: 0.05, poliinsaturados_g: 0.2, colesterol_mg: 0,
    },
    // ═══════════════════════════════════════════════════════════
    // FRUTOS SECOS Y SEMILLAS
    // ═══════════════════════════════════════════════════════════
    {
        nombre: 'Almendras',
        categoria: 'Frutos Secos',
        calorias: 579, proteinas: 21.2, carbohidratos: 21.6, grasas: 49.9, fibra: 12.5, azucares: 4.4,
        vitamina_a_ug: 1, vitamina_c_mg: 0, vitamina_d_ug: 0, vitamina_e_mg: 25.6, vitamina_k_ug: 0,
        vitamina_b6_mg: 0.13, vitamina_b12_ug: 0, tiamina_mg: 0.21, riboflavina_mg: 1.01, niacina_mg: 3.5, folato_ug: 50,
        calcio_mg: 264, hierro_mg: 3.7, magnesio_mg: 268, fosforo_mg: 484, potasio_mg: 705, sodio_mg: 1, zinc_mg: 3.1, cobre_mg: 1.0, selenio_ug: 4,
        saturados_g: 3.8, monoinsaturados_g: 31.6, poliinsaturados_g: 12.3, colesterol_mg: 0,
    },
    {
        nombre: 'Nueces',
        categoria: 'Frutos Secos',
        calorias: 654, proteinas: 15.2, carbohidratos: 13.7, grasas: 65.2, fibra: 6.7, azucares: 2.6,
        vitamina_a_ug: 2, vitamina_c_mg: 1.3, vitamina_d_ug: 0, vitamina_e_mg: 0.7, vitamina_k_ug: 2.7,
        vitamina_b6_mg: 0.54, vitamina_b12_ug: 0, tiamina_mg: 0.34, riboflavina_mg: 0.15, niacina_mg: 1.1, folato_ug: 98,
        calcio_mg: 98, hierro_mg: 2.9, magnesio_mg: 158, fosforo_mg: 346, potasio_mg: 441, sodio_mg: 2, zinc_mg: 3.1, cobre_mg: 1.6, selenio_ug: 5,
        saturados_g: 6.1, monoinsaturados_g: 8.9, poliinsaturados_g: 47.2, colesterol_mg: 0,
    },
    {
        nombre: 'Cacahuetes (naturales)',
        categoria: 'Frutos Secos',
        calorias: 567, proteinas: 25.8, carbohidratos: 16.1, grasas: 49.2, fibra: 8.5, azucares: 4.7,
        vitamina_a_ug: 0, vitamina_c_mg: 0, vitamina_d_ug: 0, vitamina_e_mg: 8.3, vitamina_k_ug: 0,
        vitamina_b6_mg: 0.35, vitamina_b12_ug: 0, tiamina_mg: 0.64, riboflavina_mg: 0.14, niacina_mg: 12.1, folato_ug: 145,
        calcio_mg: 92, hierro_mg: 4.6, magnesio_mg: 168, fosforo_mg: 376, potasio_mg: 705, sodio_mg: 18, zinc_mg: 3.3, cobre_mg: 1.1, selenio_ug: 7,
        saturados_g: 6.8, monoinsaturados_g: 24.4, poliinsaturados_g: 15.6, colesterol_mg: 0,
    },
    {
        nombre: 'Semillas de chía',
        categoria: 'Semillas',
        calorias: 486, proteinas: 16.5, carbohidratos: 42.1, grasas: 30.7, fibra: 34.4, azucares: 0,
        vitamina_a_ug: 0, vitamina_c_mg: 0, vitamina_d_ug: 0, vitamina_e_mg: 0.5, vitamina_k_ug: 0,
        vitamina_b6_mg: 0.1, vitamina_b12_ug: 0, tiamina_mg: 0.62, riboflavina_mg: 0.17, niacina_mg: 8.8, folato_ug: 49,
        calcio_mg: 631, hierro_mg: 7.7, magnesio_mg: 335, fosforo_mg: 860, potasio_mg: 407, sodio_mg: 16, zinc_mg: 4.6, cobre_mg: 0.9, selenio_ug: 55,
        saturados_g: 3.3, monoinsaturados_g: 2.3, poliinsaturados_g: 23.7, colesterol_mg: 0,
    },
    // ═══════════════════════════════════════════════════════════
    // ACEITES Y GRASAS
    // ═══════════════════════════════════════════════════════════
    {
        nombre: 'Aceite de oliva virgen extra',
        categoria: 'Aceites y Grasas',
        calorias: 884, proteinas: 0, carbohidratos: 0, grasas: 100, fibra: 0, azucares: 0,
        vitamina_a_ug: 0, vitamina_c_mg: 0, vitamina_d_ug: 0, vitamina_e_mg: 14.4, vitamina_k_ug: 60,
        vitamina_b6_mg: 0, vitamina_b12_ug: 0, tiamina_mg: 0, riboflavina_mg: 0, niacina_mg: 0, folato_ug: 0,
        calcio_mg: 1, hierro_mg: 0.6, magnesio_mg: 0, fosforo_mg: 0, potasio_mg: 1, sodio_mg: 2, zinc_mg: 0, cobre_mg: 0, selenio_ug: 0,
        saturados_g: 14.0, monoinsaturados_g: 73.0, poliinsaturados_g: 10.0, colesterol_mg: 0,
    },
    {
        nombre: 'Mantequilla',
        categoria: 'Aceites y Grasas',
        calorias: 717, proteinas: 0.9, carbohidratos: 0.1, grasas: 81, fibra: 0, azucares: 0.1,
        vitamina_a_ug: 684, vitamina_c_mg: 0, vitamina_d_ug: 1.5, vitamina_e_mg: 2.3, vitamina_k_ug: 7,
        vitamina_b6_mg: 0, vitamina_b12_ug: 0.2, tiamina_mg: 0.01, riboflavina_mg: 0.04, niacina_mg: 0.04, folato_ug: 3,
        calcio_mg: 24, hierro_mg: 0.1, magnesio_mg: 2, fosforo_mg: 26, potasio_mg: 24, sodio_mg: 11, zinc_mg: 0.1, cobre_mg: 0, selenio_ug: 1,
        saturados_g: 52.0, monoinsaturados_g: 21.0, poliinsaturados_g: 3.0, colesterol_mg: 215,
    },
    {
        nombre: 'Crema de cacahuete (natural)',
        categoria: 'Aceites y Grasas',
        calorias: 598, proteinas: 22.5, carbohidratos: 20, grasas: 51.2, fibra: 5.0, azucares: 9.0,
        vitamina_a_ug: 0, vitamina_c_mg: 0, vitamina_d_ug: 0, vitamina_e_mg: 9.1, vitamina_k_ug: 0.3,
        vitamina_b6_mg: 0.45, vitamina_b12_ug: 0, tiamina_mg: 0.15, riboflavina_mg: 0.19, niacina_mg: 13.1, folato_ug: 87,
        calcio_mg: 43, hierro_mg: 1.7, magnesio_mg: 179, fosforo_mg: 340, potasio_mg: 649, sodio_mg: 15, zinc_mg: 2.5, cobre_mg: 0.5, selenio_ug: 6,
        saturados_g: 10.0, monoinsaturados_g: 25.0, poliinsaturados_g: 12.0, colesterol_mg: 0,
    },
    // ═══════════════════════════════════════════════════════════
    // BEBIDAS
    // ═══════════════════════════════════════════════════════════
    {
        nombre: 'Leche de almendras (sin azúcar)',
        categoria: 'Bebidas',
        calorias: 17, proteinas: 0.6, carbohidratos: 0.3, grasas: 1.4, fibra: 0.3, azucares: 0.2,
        vitamina_a_ug: 0, vitamina_c_mg: 0, vitamina_d_ug: 0, vitamina_e_mg: 3.6, vitamina_k_ug: 0,
        vitamina_b6_mg: 0, vitamina_b12_ug: 0, tiamina_mg: 0, riboflavina_mg: 0, niacina_mg: 0, folato_ug: 1,
        calcio_mg: 0, hierro_mg: 0.2, magnesio_mg: 7, fosforo_mg: 8, potasio_mg: 55, sodio_mg: 70, zinc_mg: 0.1, cobre_mg: 0.02, selenio_ug: 0.2,
        saturados_g: 0.1, monoinsaturados_g: 0.8, poliinsaturados_g: 0.3, colesterol_mg: 0,
    },
    // ═══════════════════════════════════════════════════════════
    // CONDIMENTOS Y SALSAS
    // ═══════════════════════════════════════════════════════════
    {
        nombre: 'Hummus',
        categoria: 'Condimentos',
        calorias: 166, proteinas: 7.9, carbohidratos: 14.3, grasas: 9.6, fibra: 6.0, azucares: 0.4,
        vitamina_a_ug: 3, vitamina_c_mg: 1.2, vitamina_d_ug: 0, vitamina_e_mg: 0.5, vitamina_k_ug: 4.0,
        vitamina_b6_mg: 0.06, vitamina_b12_ug: 0, tiamina_mg: 0.08, riboflavina_mg: 0.03, niacina_mg: 0.4, folato_ug: 40,
        calcio_mg: 38, hierro_mg: 1.2, magnesio_mg: 35, fosforo_mg: 110, potasio_mg: 150, sodio_mg: 200, zinc_mg: 0.7, cobre_mg: 0.15, selenio_ug: 2,
        saturados_g: 1.4, monoinsaturados_g: 4.5, poliinsaturados_g: 2.9, colesterol_mg: 0,
    },
    {
        nombre: 'Miel',
        categoria: 'Condimentos',
        calorias: 304, proteinas: 0.3, carbohidratos: 82, grasas: 0, fibra: 0.2, azucares: 82,
        vitamina_a_ug: 0, vitamina_c_mg: 0.5, vitamina_d_ug: 0, vitamina_e_mg: 0, vitamina_k_ug: 0,
        vitamina_b6_mg: 0.02, vitamina_b12_ug: 0, tiamina_mg: 0, riboflavina_mg: 0.04, niacina_mg: 0.1, folato_ug: 2,
        calcio_mg: 6, hierro_mg: 0.4, magnesio_mg: 2, fosforo_mg: 4, potasio_mg: 52, sodio_mg: 4, zinc_mg: 0.2, cobre_mg: 0.04, selenio_ug: 0.8,
        saturados_g: 0, monoinsaturados_g: 0, poliinsaturados_g: 0, colesterol_mg: 0,
    },
]

// ── Helper ─────────────────────────────────────────────────
const CAMPOS = [
    'nombre', 'categoria', 'calorias', 'proteinas', 'carbohidratos', 'grasas', 'fibra', 'azucares',
    'vitamina_a_ug', 'vitamina_c_mg', 'vitamina_d_ug', 'vitamina_e_mg', 'vitamina_k_ug',
    'vitamina_b6_mg', 'vitamina_b12_ug', 'tiamina_mg', 'riboflavina_mg', 'niacina_mg', 'folato_ug',
    'calcio_mg', 'hierro_mg', 'magnesio_mg', 'fosforo_mg', 'potasio_mg', 'sodio_mg', 'zinc_mg', 'cobre_mg', 'selenio_ug',
    'saturados_g', 'monoinsaturados_g', 'poliinsaturados_g', 'colesterol_mg',
]

// ── Main ────────────────────────────────────────────────────
async function main() {
    console.log('🍽️  Poblando/actualizando alimentos con datos BEDCA completos...\n')

    let creados = 0
    let actualizados = 0
    let saltados = 0

    for (const alimento of ALIMENTOS_BEDCA) {
        // Buscar por nombre exacto
        const { data: existentes } = await supabase
            .from('alimentos')
            .select('id, fuente')
            .eq('nombre', alimento.nombre)

        const existente = existentes?.[0]

        const payload = { ...alimento, fuente: 'bedca', micros_actualizados_en: new Date().toISOString() }

        if (existente) {
            // Ya existe → actualizar
            const { error } = await supabase
                .from('alimentos')
                .update(payload)
                .eq('id', existente.id)

            if (error) {
                console.error(`  ❌ ${alimento.nombre}: ${error.message}`)
            } else {
                actualizados++
            }
        } else {
            // No existe → crear
            const { error } = await supabase
                .from('alimentos')
                .insert(payload)

            if (error) {
                console.error(`  ❌ ${alimento.nombre}: ${error.message}`)
            } else {
                creados++
                process.stdout.write('.')
            }
        }
    }

    console.log('\n')
    console.log('═══════════════════════════════════════════')
    console.log('✅ COMPLETADO')
    console.log(`   Creados:      ${creados}`)
    console.log(`   Actualizados: ${actualizados}`)
    console.log(`   Total BEDCA:  ${ALIMENTOS_BEDCA.length}`)
    console.log('═══════════════════════════════════════════')
}

main().catch(e => {
    console.error('💥 Fatal:', e.message)
    process.exit(1)
})
