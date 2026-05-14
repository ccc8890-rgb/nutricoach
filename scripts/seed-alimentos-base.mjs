/**
 * Seed masivo de alimentos base genéricos para mejorar el matching de ingredientes
 * 
 * USO: node scripts/seed-alimentos-base.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const envPath = resolve(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

// ============================================================
// ALIMENTOS BASE — todos los alimentos genéricos que deberían
// existir para que el matching funcione correctamente
// ============================================================

const ALIMENTOS = [
    // ===== CARNES =====
    { nombre: 'Pollo', categoria: 'Carnes', calorias: 215, proteinas: 18.6, carbohidratos: 0, grasas: 15.1, fibra: 0, custom: false },
    { nombre: 'Pechuga de pollo', categoria: 'Carnes', calorias: 165, proteinas: 31, carbohidratos: 0, grasas: 3.6, fibra: 0, custom: false },
    { nombre: 'Pollo entero (crudo)', categoria: 'Carnes', calorias: 215, proteinas: 18.6, carbohidratos: 0, grasas: 15.1, fibra: 0, custom: false },
    { nombre: 'Alas de pollo (crudas)', categoria: 'Carnes', calorias: 203, proteinas: 17.5, carbohidratos: 0, grasas: 14.2, fibra: 0, custom: false },
    { nombre: 'Muslo de pollo', categoria: 'Carnes', calorias: 209, proteinas: 17.4, carbohidratos: 0, grasas: 15.2, fibra: 0, custom: false },
    { nombre: 'Contramuslo de pollo', categoria: 'Carnes', calorias: 177, proteinas: 18.5, carbohidratos: 0, grasas: 11.2, fibra: 0, custom: false },
    { nombre: 'Pollo picado', categoria: 'Carnes', calorias: 185, proteinas: 20, carbohidratos: 0, grasas: 11.5, fibra: 0, custom: false },
    { nombre: 'Ternera', categoria: 'Carnes', calorias: 200, proteinas: 20, carbohidratos: 0, grasas: 12, fibra: 0, custom: false },
    { nombre: 'Ternera picada', categoria: 'Carnes', calorias: 215, proteinas: 18, carbohidratos: 0, grasas: 15, fibra: 0, custom: false },
    { nombre: 'Ternera picada (5% grasa)', categoria: 'Carnes', calorias: 145, proteinas: 22, carbohidratos: 0, grasas: 5, fibra: 0, custom: false },
    { nombre: 'Solomillo de ternera', categoria: 'Carnes', calorias: 160, proteinas: 24, carbohidratos: 0, grasas: 6.5, fibra: 0, custom: false },
    { nombre: 'Cerdo', categoria: 'Carnes', calorias: 242, proteinas: 16, carbohidratos: 0, grasas: 19.5, fibra: 0, custom: false },
    { nombre: 'Lomo de cerdo', categoria: 'Carnes', calorias: 155, proteinas: 23, carbohidratos: 0, grasas: 6.5, fibra: 0, custom: false },
    { nombre: 'Solomillo de cerdo', categoria: 'Carnes', calorias: 155, proteinas: 23, carbohidratos: 0, grasas: 6.5, fibra: 0, custom: false },
    { nombre: 'Costillas de cerdo', categoria: 'Carnes', calorias: 277, proteinas: 17, carbohidratos: 0, grasas: 23, fibra: 0, custom: false },
    { nombre: 'Carne picada de cerdo', categoria: 'Carnes', calorias: 220, proteinas: 17, carbohidratos: 0, grasas: 17, fibra: 0, custom: false },
    { nombre: 'Carne picada', categoria: 'Carnes', calorias: 215, proteinas: 18, carbohidratos: 0, grasas: 15, fibra: 0, custom: false },
    { nombre: 'Cordero', categoria: 'Carnes', calorias: 250, proteinas: 17, carbohidratos: 0, grasas: 20, fibra: 0, custom: false },
    { nombre: 'Cordero (pierna)', categoria: 'Carnes', calorias: 205, proteinas: 18, carbohidratos: 0, grasas: 14.5, fibra: 0, custom: false },
    { nombre: 'Conejo', categoria: 'Carnes', calorias: 136, proteinas: 20, carbohidratos: 0, grasas: 5.6, fibra: 0, custom: false },
    { nombre: 'Pavo', categoria: 'Carnes', calorias: 135, proteinas: 22, carbohidratos: 0, grasas: 4.5, fibra: 0, custom: false },
    { nombre: 'Pechuga de pavo', categoria: 'Carnes', calorias: 105, proteinas: 24, carbohidratos: 0, grasas: 0.7, fibra: 0, custom: false },
    { nombre: 'Pavo picado', categoria: 'Carnes', calorias: 140, proteinas: 20, carbohidratos: 0, grasas: 6.5, fibra: 0, custom: false },
    { nombre: 'Huevo', categoria: 'Carnes', calorias: 155, proteinas: 13, carbohidratos: 1.1, grasas: 11, fibra: 0, custom: false },
    { nombre: 'Huevo M', categoria: 'Carnes', calorias: 155, proteinas: 13, carbohidratos: 1.1, grasas: 11, fibra: 0, custom: false },
    { nombre: 'Huevo L', categoria: 'Carnes', calorias: 155, proteinas: 13, carbohidratos: 1.1, grasas: 11, fibra: 0, custom: false },
    { nombre: 'Clara de huevo', categoria: 'Carnes', calorias: 52, proteinas: 11, carbohidratos: 0.7, grasas: 0.2, fibra: 0, custom: false },
    { nombre: 'Huevo duro', categoria: 'Carnes', calorias: 155, proteinas: 13, carbohidratos: 1.1, grasas: 11, fibra: 0, custom: false },

    // ===== PESCADOS =====
    { nombre: 'Salmón', categoria: 'Pescados', calorias: 208, proteinas: 20.4, carbohidratos: 0, grasas: 13.4, fibra: 0, custom: false },
    { nombre: 'Salmón ahumado', categoria: 'Pescados', calorias: 199, proteinas: 18.5, carbohidratos: 0, grasas: 14, fibra: 0, custom: false },
    { nombre: 'Merluza', categoria: 'Pescados', calorias: 82, proteinas: 18, carbohidratos: 0, grasas: 0.7, fibra: 0, custom: false },
    { nombre: 'Merluza (fresca)', categoria: 'Pescados', calorias: 82, proteinas: 18, carbohidratos: 0, grasas: 0.7, fibra: 0, custom: false },
    { nombre: 'Atún', categoria: 'Pescados', calorias: 130, proteinas: 26, carbohidratos: 0, grasas: 2.8, fibra: 0, custom: false },
    { nombre: 'Atún (fresco)', categoria: 'Pescados', calorias: 130, proteinas: 26, carbohidratos: 0, grasas: 2.8, fibra: 0, custom: false },
    { nombre: 'Atún en lata (escurrido)', categoria: 'Pescados', calorias: 190, proteinas: 29, carbohidratos: 0, grasas: 8, fibra: 0, custom: false },
    { nombre: 'Pescado blanco', categoria: 'Pescados', calorias: 85, proteinas: 18, carbohidratos: 0, grasas: 0.8, fibra: 0, custom: false },
    { nombre: 'Pescado azul', categoria: 'Pescados', calorias: 200, proteinas: 20, carbohidratos: 0, grasas: 13, fibra: 0, custom: false },
    { nombre: 'Dorada', categoria: 'Pescados', calorias: 96, proteinas: 19.5, carbohidratos: 0, grasas: 1.8, fibra: 0, custom: false },
    { nombre: 'Lubina', categoria: 'Pescados', calorias: 97, proteinas: 18.7, carbohidratos: 0, grasas: 2, fibra: 0, custom: false },
    { nombre: 'Trucha', categoria: 'Pescados', calorias: 148, proteinas: 20.8, carbohidratos: 0, grasas: 6.6, fibra: 0, custom: false },
    { nombre: 'Caballa', categoria: 'Pescados', calorias: 205, proteinas: 18.7, carbohidratos: 0, grasas: 13.9, fibra: 0, custom: false },
    { nombre: 'Boquerones', categoria: 'Pescados', calorias: 131, proteinas: 18.2, carbohidratos: 0, grasas: 6.1, fibra: 0, custom: false },
    { nombre: 'Pulpo', categoria: 'Pescados', calorias: 82, proteinas: 14.9, carbohidratos: 2.2, grasas: 1.8, fibra: 0, custom: false },
    { nombre: 'Pulpo (cocido)', categoria: 'Pescados', calorias: 82, proteinas: 14.9, carbohidratos: 2.2, grasas: 1.8, fibra: 0, custom: false },
    { nombre: 'Calamares', categoria: 'Pescados', calorias: 78, proteinas: 15.6, carbohidratos: 1.5, grasas: 1.2, fibra: 0, custom: false },
    { nombre: 'Gambas', categoria: 'Pescados', calorias: 90, proteinas: 18, carbohidratos: 0, grasas: 1.5, fibra: 0, custom: false },
    { nombre: 'Langostinos', categoria: 'Pescados', calorias: 95, proteinas: 18, carbohidratos: 0, grasas: 1.8, fibra: 0, custom: false },
    { nombre: 'Mejillones', categoria: 'Pescados', calorias: 86, proteinas: 11.9, carbohidratos: 3.7, grasas: 2.2, fibra: 0, custom: false },
    { nombre: 'Almejas', categoria: 'Pescados', calorias: 73, proteinas: 12.8, carbohidratos: 2.8, grasas: 1, fibra: 0, custom: false },

    // ===== LÁCTEOS =====
    { nombre: 'Leche', categoria: 'Lácteos', calorias: 66, proteinas: 3.3, carbohidratos: 5, grasas: 3.6, fibra: 0, custom: false },
    { nombre: 'Leche entera', categoria: 'Lácteos', calorias: 66, proteinas: 3.3, carbohidratos: 5, grasas: 3.6, fibra: 0, custom: false },
    { nombre: 'Leche semidesnatada', categoria: 'Lácteos', calorias: 48, proteinas: 3.3, carbohidratos: 4.8, grasas: 1.6, fibra: 0, custom: false },
    { nombre: 'Leche desnatada', categoria: 'Lácteos', calorias: 34, proteinas: 3.4, carbohidratos: 5, grasas: 0.1, fibra: 0, custom: false },
    { nombre: 'Leche de almendras', categoria: 'Lácteos', calorias: 25, proteinas: 0.5, carbohidratos: 4, grasas: 1, fibra: 0, custom: false },
    { nombre: 'Leche de avena', categoria: 'Lácteos', calorias: 45, proteinas: 0.7, carbohidratos: 7, grasas: 1.5, fibra: 0, custom: false },
    { nombre: 'Yogur natural', categoria: 'Lácteos', calorias: 61, proteinas: 3.5, carbohidratos: 4.7, grasas: 3.3, fibra: 0, custom: false },
    { nombre: 'Yogur natural desnatado', categoria: 'Lácteos', calorias: 36, proteinas: 3.5, carbohidratos: 5, grasas: 0.2, fibra: 0, custom: false },
    { nombre: 'Yogur griego natural', categoria: 'Lácteos', calorias: 97, proteinas: 9, carbohidratos: 4, grasas: 5, fibra: 0, custom: false },
    { nombre: 'Yogur griego natural (0%)', categoria: 'Lácteos', calorias: 59, proteinas: 10, carbohidratos: 4, grasas: 0.3, fibra: 0, custom: false },
    { nombre: 'Queso fresco', categoria: 'Lácteos', calorias: 174, proteinas: 11, carbohidratos: 3, grasas: 13, fibra: 0, custom: false },
    { nombre: 'Queso feta', categoria: 'Lácteos', calorias: 264, proteinas: 14, carbohidratos: 4, grasas: 21, fibra: 0, custom: false },
    { nombre: 'Queso mozzarella', categoria: 'Lácteos', calorias: 280, proteinas: 22, carbohidratos: 3, grasas: 20, fibra: 0, custom: false },
    { nombre: 'Queso parmesano', categoria: 'Lácteos', calorias: 431, proteinas: 38, carbohidratos: 4, grasas: 29, fibra: 0, custom: false },
    { nombre: 'Queso rallado', categoria: 'Lácteos', calorias: 350, proteinas: 25, carbohidratos: 3, grasas: 27, fibra: 0, custom: false },
    { nombre: 'Requesón', categoria: 'Lácteos', calorias: 80, proteinas: 9, carbohidratos: 4, grasas: 3, fibra: 0, custom: false },
    { nombre: 'Nata líquida', categoria: 'Lácteos', calorias: 196, proteinas: 2.8, carbohidratos: 3, grasas: 19, fibra: 0, custom: false },
    { nombre: 'Nata para montar', categoria: 'Lácteos', calorias: 337, proteinas: 2.5, carbohidratos: 3, grasas: 35, fibra: 0, custom: false },
    { nombre: 'Mantequilla', categoria: 'Lácteos', calorias: 717, proteinas: 0.9, carbohidratos: 0.1, grasas: 81, fibra: 0, custom: false },
    { nombre: 'Crema agria', categoria: 'Lácteos', calorias: 198, proteinas: 2.5, carbohidratos: 4, grasas: 19, fibra: 0, custom: false },

    // ===== CEREALES =====
    { nombre: 'Arroz', categoria: 'Cereales', calorias: 358, proteinas: 7.1, carbohidratos: 79, grasas: 0.7, fibra: 1.4, custom: false },
    { nombre: 'Arroz blanco', categoria: 'Cereales', calorias: 358, proteinas: 7.1, carbohidratos: 79, grasas: 0.7, fibra: 1.4, custom: false },
    { nombre: 'Arroz integral', categoria: 'Cereales', calorias: 350, proteinas: 7.5, carbohidratos: 75, grasas: 1.9, fibra: 3.5, custom: false },
    { nombre: 'Arroz basmati', categoria: 'Cereales', calorias: 350, proteinas: 8, carbohidratos: 77, grasas: 0.6, fibra: 1.5, custom: false },
    { nombre: 'Arroz salvaje', categoria: 'Cereales', calorias: 357, proteinas: 14.7, carbohidratos: 73, grasas: 1.1, fibra: 6.2, custom: false },
    { nombre: 'Pasta', categoria: 'Cereales', calorias: 350, proteinas: 12, carbohidratos: 72, grasas: 1.5, fibra: 3, custom: false },
    { nombre: 'Pasta integral', categoria: 'Cereales', calorias: 340, proteinas: 13, carbohidratos: 68, grasas: 2.5, fibra: 8, custom: false },
    { nombre: 'Spaghetti', categoria: 'Cereales', calorias: 350, proteinas: 12, carbohidratos: 72, grasas: 1.5, fibra: 3, custom: false },
    { nombre: 'Macarrones', categoria: 'Cereales', calorias: 350, proteinas: 12, carbohidratos: 72, grasas: 1.5, fibra: 3, custom: false },
    { nombre: 'Fideos', categoria: 'Cereales', calorias: 350, proteinas: 12, carbohidratos: 72, grasas: 1.5, fibra: 3, custom: false },
    { nombre: 'Pan', categoria: 'Cereales', calorias: 265, proteinas: 9, carbohidratos: 49, grasas: 3.2, fibra: 2.7, custom: false },
    { nombre: 'Pan integral', categoria: 'Cereales', calorias: 247, proteinas: 10, carbohidratos: 44, grasas: 3.3, fibra: 7, custom: false },
    { nombre: 'Pan de molde', categoria: 'Cereales', calorias: 265, proteinas: 9, carbohidratos: 49, grasas: 3.2, fibra: 2.7, custom: false },
    { nombre: 'Pan de molde integral', categoria: 'Cereales', calorias: 247, proteinas: 10, carbohidratos: 44, grasas: 3.3, fibra: 7, custom: false },
    { nombre: 'Pan de molde blanco', categoria: 'Cereales', calorias: 265, proteinas: 9, carbohidratos: 49, grasas: 3.2, fibra: 2.7, custom: false },
    { nombre: 'Pan rallado', categoria: 'Cereales', calorias: 395, proteinas: 13, carbohidratos: 75, grasas: 5.3, fibra: 4, custom: false },
    { nombre: 'Avena', categoria: 'Cereales', calorias: 389, proteinas: 16.9, carbohidratos: 66, grasas: 6.9, fibra: 10.6, custom: false },
    { nombre: 'Avena en copos', categoria: 'Cereales', calorias: 389, proteinas: 16.9, carbohidratos: 66, grasas: 6.9, fibra: 10.6, custom: false },
    { nombre: 'Harina de avena', categoria: 'Cereales', calorias: 389, proteinas: 16.9, carbohidratos: 66, grasas: 6.9, fibra: 10.6, custom: false },
    { nombre: 'Harina de trigo', categoria: 'Cereales', calorias: 364, proteinas: 10, carbohidratos: 76, grasas: 1, fibra: 3, custom: false },
    { nombre: 'Harina integral', categoria: 'Cereales', calorias: 340, proteinas: 13, carbohidratos: 70, grasas: 2.5, fibra: 10, custom: false },
    { nombre: 'Harina de almendra', categoria: 'Cereales', calorias: 580, proteinas: 21, carbohidratos: 20, grasas: 49, fibra: 10, custom: false },
    { nombre: 'Harina de coco', categoria: 'Cereales', calorias: 380, proteinas: 15, carbohidratos: 55, grasas: 12, fibra: 35, custom: false },
    { nombre: 'Cuscús', categoria: 'Cereales', calorias: 340, proteinas: 12, carbohidratos: 70, grasas: 0.5, fibra: 5, custom: false },
    { nombre: 'Quinoa', categoria: 'Cereales', calorias: 368, proteinas: 14, carbohidratos: 64, grasas: 6, fibra: 7, custom: false },
    { nombre: 'Cebada', categoria: 'Cereales', calorias: 354, proteinas: 12.5, carbohidratos: 73.5, grasas: 2.3, fibra: 17.3, custom: false },
    { nombre: 'Centeno', categoria: 'Cereales', calorias: 338, proteinas: 10.3, carbohidratos: 75.9, grasas: 1.6, fibra: 15.1, custom: false },
    { nombre: 'Cereales de desayuno (integrales)', categoria: 'Cereales', calorias: 370, proteinas: 10, carbohidratos: 75, grasas: 5, fibra: 8, custom: false },

    // ===== VERDURAS =====
    { nombre: 'Tomate', categoria: 'Verduras', calorias: 18, proteinas: 0.9, carbohidratos: 3.9, grasas: 0.2, fibra: 1.2, custom: false },
    { nombre: 'Tomate triturado', categoria: 'Verduras', calorias: 24, proteinas: 1.2, carbohidratos: 4.5, grasas: 0.2, fibra: 1.4, custom: false },
    { nombre: 'Tomate frito', categoria: 'Verduras', calorias: 50, proteinas: 1.5, carbohidratos: 7, grasas: 2, fibra: 1.5, custom: false },
    { nombre: 'Cebolla', categoria: 'Verduras', calorias: 40, proteinas: 1.1, carbohidratos: 9.3, grasas: 0.1, fibra: 1.7, custom: false },
    { nombre: 'Cebolla morada', categoria: 'Verduras', calorias: 40, proteinas: 1.1, carbohidratos: 9.3, grasas: 0.1, fibra: 1.7, custom: false },
    { nombre: 'Cebolla roja', categoria: 'Verduras', calorias: 40, proteinas: 1.1, carbohidratos: 9.3, grasas: 0.1, fibra: 1.7, custom: false },
    { nombre: 'Cebolla blanca', categoria: 'Verduras', calorias: 40, proteinas: 1.1, carbohidratos: 9.3, grasas: 0.1, fibra: 1.7, custom: false },
    { nombre: 'Cebolleta', categoria: 'Verduras', calorias: 32, proteinas: 1, carbohidratos: 7, grasas: 0.2, fibra: 1.5, custom: false },
    { nombre: 'Ajo', categoria: 'Verduras', calorias: 149, proteinas: 6.4, carbohidratos: 33, grasas: 0.5, fibra: 2.1, custom: false },
    { nombre: 'Ajo en polvo', categoria: 'Verduras', calorias: 330, proteinas: 16.5, carbohidratos: 73, grasas: 0.7, fibra: 4, custom: false },
    { nombre: 'Zanahoria', categoria: 'Verduras', calorias: 41, proteinas: 0.9, carbohidratos: 9.6, grasas: 0.2, fibra: 2.8, custom: false },
    { nombre: 'Patata', categoria: 'Verduras', calorias: 77, proteinas: 2, carbohidratos: 17.5, grasas: 0.1, fibra: 2.2, custom: false },
    { nombre: 'Patata (cocida)', categoria: 'Verduras', calorias: 77, proteinas: 2, carbohidratos: 17.5, grasas: 0.1, fibra: 2.2, custom: false },
    { nombre: 'Boniato', categoria: 'Verduras', calorias: 86, proteinas: 1.6, carbohidratos: 20, grasas: 0.1, fibra: 3, custom: false },
    { nombre: 'Pimiento', categoria: 'Verduras', calorias: 20, proteinas: 0.9, carbohidratos: 4.6, grasas: 0.2, fibra: 1.7, custom: false },
    { nombre: 'Pimiento rojo', categoria: 'Verduras', calorias: 31, proteinas: 1, carbohidratos: 6, grasas: 0.3, fibra: 2.1, custom: false },
    { nombre: 'Pimiento verde', categoria: 'Verduras', calorias: 20, proteinas: 0.9, carbohidratos: 4.6, grasas: 0.2, fibra: 1.7, custom: false },
    { nombre: 'Calabacín', categoria: 'Verduras', calorias: 17, proteinas: 1.2, carbohidratos: 3.1, grasas: 0.3, fibra: 1, custom: false },
    { nombre: 'Berenjena', categoria: 'Verduras', calorias: 25, proteinas: 1, carbohidratos: 5.9, grasas: 0.2, fibra: 3, custom: false },
    { nombre: 'Calabaza', categoria: 'Verduras', calorias: 26, proteinas: 1, carbohidratos: 6.5, grasas: 0.1, fibra: 0.5, custom: false },
    { nombre: 'Judías verdes', categoria: 'Verduras', calorias: 31, proteinas: 1.8, carbohidratos: 7, grasas: 0.1, fibra: 3.2, custom: false },
    { nombre: 'Espinacas', categoria: 'Verduras', calorias: 23, proteinas: 2.9, carbohidratos: 3.6, grasas: 0.4, fibra: 2.2, custom: false },
    { nombre: 'Lechuga', categoria: 'Verduras', calorias: 15, proteinas: 1.4, carbohidratos: 2.9, grasas: 0.2, fibra: 1.3, custom: false },
    { nombre: 'Lechuga romana', categoria: 'Verduras', calorias: 17, proteinas: 1, carbohidratos: 3.3, grasas: 0.3, fibra: 2.1, custom: false },
    { nombre: 'Brócoli', categoria: 'Verduras', calorias: 34, proteinas: 2.8, carbohidratos: 7, grasas: 0.4, fibra: 2.6, custom: false },
    { nombre: 'Coliflor', categoria: 'Verduras', calorias: 25, proteinas: 1.9, carbohidratos: 5, grasas: 0.3, fibra: 2, custom: false },
    { nombre: 'Repollo', categoria: 'Verduras', calorias: 25, proteinas: 1.3, carbohidratos: 5.8, grasas: 0.1, fibra: 2.5, custom: false },
    { nombre: 'Col', categoria: 'Verduras', calorias: 25, proteinas: 1.3, carbohidratos: 5.8, grasas: 0.1, fibra: 2.5, custom: false },
    { nombre: 'Col lombarda', categoria: 'Verduras', calorias: 27, proteinas: 1.4, carbohidratos: 5.8, grasas: 0.2, fibra: 2, custom: false },
    { nombre: 'Coles de Bruselas', categoria: 'Verduras', calorias: 43, proteinas: 3.4, carbohidratos: 9, grasas: 0.3, fibra: 3.8, custom: false },
    { nombre: 'Pepino', categoria: 'Verduras', calorias: 15, proteinas: 0.7, carbohidratos: 3.6, grasas: 0.1, fibra: 0.5, custom: false },
    { nombre: 'Remolacha', categoria: 'Verduras', calorias: 43, proteinas: 1.6, carbohidratos: 9.6, grasas: 0.2, fibra: 2.8, custom: false },
    { nombre: 'Apio', categoria: 'Verduras', calorias: 16, proteinas: 0.7, carbohidratos: 3, grasas: 0.2, fibra: 1.6, custom: false },
    { nombre: 'Rábano', categoria: 'Verduras', calorias: 16, proteinas: 0.7, carbohidratos: 3.4, grasas: 0.1, fibra: 1.6, custom: false },
    { nombre: 'Alcachofa', categoria: 'Verduras', calorias: 53, proteinas: 3.3, carbohidratos: 11, grasas: 0.2, fibra: 5.4, custom: false },
    { nombre: 'Espárragos', categoria: 'Verduras', calorias: 20, proteinas: 2.2, carbohidratos: 3.9, grasas: 0.1, fibra: 2.1, custom: false },
    { nombre: 'Espárragos verdes', categoria: 'Verduras', calorias: 20, proteinas: 2.2, carbohidratos: 3.9, grasas: 0.1, fibra: 2.1, custom: false },
    { nombre: 'Canónigos', categoria: 'Verduras', calorias: 23, proteinas: 2, carbohidratos: 3.6, grasas: 0.4, fibra: 1.6, custom: false },
    { nombre: 'Rúcula', categoria: 'Verduras', calorias: 25, proteinas: 2.6, carbohidratos: 3.7, grasas: 0.7, fibra: 1.6, custom: false },
    { nombre: 'Endibias', categoria: 'Verduras', calorias: 15, proteinas: 1, carbohidratos: 1.6, grasas: 0.1, fibra: 1.5, custom: false },
    { nombre: 'Hinojo', categoria: 'Verduras', calorias: 31, proteinas: 1.2, carbohidratos: 7.3, grasas: 0.2, fibra: 3.1, custom: false },
    { nombre: 'Nabos', categoria: 'Verduras', calorias: 28, proteinas: 0.9, carbohidratos: 6.4, grasas: 0.1, fibra: 1.8, custom: false },

    // ===== FRUTAS =====
    { nombre: 'Manzana', categoria: 'Frutas', calorias: 52, proteinas: 0.3, carbohidratos: 14, grasas: 0.2, fibra: 2.4, custom: false },
    { nombre: 'Plátano', categoria: 'Frutas', calorias: 89, proteinas: 1.1, carbohidratos: 23, grasas: 0.3, fibra: 2.6, custom: false },
    { nombre: 'Naranja', categoria: 'Frutas', calorias: 47, proteinas: 0.9, carbohidratos: 12, grasas: 0.1, fibra: 2.4, custom: false },
    { nombre: 'Fresa', categoria: 'Frutas', calorias: 32, proteinas: 0.7, carbohidratos: 8, grasas: 0.3, fibra: 2, custom: false },
    { nombre: 'Fresas', categoria: 'Frutas', calorias: 32, proteinas: 0.7, carbohidratos: 8, grasas: 0.3, fibra: 2, custom: false },
    { nombre: 'Limón', categoria: 'Frutas', calorias: 29, proteinas: 1.1, carbohidratos: 9.3, grasas: 0.3, fibra: 2.8, custom: false },
    { nombre: 'Pera', categoria: 'Frutas', calorias: 57, proteinas: 0.4, carbohidratos: 15, grasas: 0.1, fibra: 3.1, custom: false },
    { nombre: 'Kiwi', categoria: 'Frutas', calorias: 61, proteinas: 1.1, carbohidratos: 15, grasas: 0.5, fibra: 3, custom: false },
    { nombre: 'Uvas', categoria: 'Frutas', calorias: 69, proteinas: 0.7, carbohidratos: 18.1, grasas: 0.2, fibra: 0.9, custom: false },
    { nombre: 'Melón', categoria: 'Frutas', calorias: 34, proteinas: 0.8, carbohidratos: 8.2, grasas: 0.2, fibra: 0.9, custom: false },
    { nombre: 'Sandía', categoria: 'Frutas', calorias: 30, proteinas: 0.6, carbohidratos: 8, grasas: 0.2, fibra: 0.4, custom: false },
    { nombre: 'Piña', categoria: 'Frutas', calorias: 50, proteinas: 0.5, carbohidratos: 13, grasas: 0.1, fibra: 1.4, custom: false },
    { nombre: 'Mango', categoria: 'Frutas', calorias: 60, proteinas: 0.8, carbohidratos: 15, grasas: 0.4, fibra: 1.6, custom: false },
    { nombre: 'Aguacate', categoria: 'Frutas', calorias: 160, proteinas: 2, carbohidratos: 8.5, grasas: 15, fibra: 6.7, custom: false },
    { nombre: 'Cerezas', categoria: 'Frutas', calorias: 50, proteinas: 1, carbohidratos: 12.2, grasas: 0.3, fibra: 1.6, custom: false },
    { nombre: 'Higos', categoria: 'Frutas', calorias: 74, proteinas: 0.8, carbohidratos: 19.2, grasas: 0.3, fibra: 2.9, custom: false },
    { nombre: 'Ciruelas', categoria: 'Frutas', calorias: 46, proteinas: 0.7, carbohidratos: 11.4, grasas: 0.3, fibra: 1.4, custom: false },
    { nombre: 'Albaricoque', categoria: 'Frutas', calorias: 48, proteinas: 1.4, carbohidratos: 11.1, grasas: 0.4, fibra: 2, custom: false },
    { nombre: 'Melocotón', categoria: 'Frutas', calorias: 39, proteinas: 0.9, carbohidratos: 9.5, grasas: 0.3, fibra: 1.5, custom: false },
    { nombre: 'Pomelo', categoria: 'Frutas', calorias: 42, proteinas: 0.8, carbohidratos: 10.7, grasas: 0.1, fibra: 1.6, custom: false },
    { nombre: 'Papaya', categoria: 'Frutas', calorias: 43, proteinas: 0.5, carbohidratos: 11, grasas: 0.3, fibra: 1.7, custom: false },
    { nombre: 'Granada', category: 'Frutas', calorias: 83, proteinas: 1.7, carbohidratos: 18.7, grasas: 1.2, fibra: 4, custom: false },
    { nombre: 'Arándanos', categoria: 'Frutas', calorias: 57, proteinas: 0.7, carbohidratos: 14.5, grasas: 0.3, fibra: 2.4, custom: false },
    { nombre: 'Frambuesas', categoria: 'Frutas', calorias: 52, proteinas: 1.2, carbohidratos: 12, grasas: 0.7, fibra: 6.5, custom: false },
    { nombre: 'Moras', categoria: 'Frutas', calorias: 43, proteinas: 1.4, carbohidratos: 10, grasas: 0.5, fibra: 5.3, custom: false },
    { nombre: 'Coco', categoria: 'Frutas', calorias: 354, proteinas: 3.3, carbohidratos: 15, grasas: 33, fibra: 9, custom: false },
    { nombre: 'Coco rallado', categoria: 'Frutas', calorias: 660, proteinas: 6.9, carbohidratos: 23.7, grasas: 64.5, fibra: 16.3, custom: false },

    // ===== LEGUMBRES =====
    { nombre: 'Lentejas', categoria: 'Legumbres', calorias: 353, proteinas: 25, carbohidratos: 60, grasas: 1.1, fibra: 31, custom: false },
    { nombre: 'Lentejas cocidas', categoria: 'Legumbres', calorias: 116, proteinas: 9, carbohidratos: 20, grasas: 0.4, fibra: 8, custom: false },
    { nombre: 'Garbanzos', categoria: 'Legumbres', calorias: 364, proteinas: 19, carbohidratos: 61, grasas: 6, fibra: 17, custom: false },
    { nombre: 'Garbanzos cocidos', categoria: 'Legumbres', calorias: 139, proteinas: 8.9, carbohidratos: 23, grasas: 2.6, fibra: 7.6, custom: false },
    { nombre: 'Alubias', categoria: 'Legumbres', calorias: 347, proteinas: 21, carbohidratos: 64, grasas: 1.2, fibra: 25, custom: false },
    { nombre: 'Judías pintas', categoria: 'Legumbres', calorias: 347, proteinas: 21, carbohidratos: 64, grasas: 1.2, fibra: 25, custom: false },
    { nombre: 'Judías blancas', categoria: 'Legumbres', calorias: 347, proteinas: 21, carbohidratos: 64, grasas: 1.2, fibra: 25, custom: false },
    { nombre: 'Soja texturizada', categoria: 'Legumbres', calorias: 320, proteinas: 50, carbohidratos: 30, grasas: 2, fibra: 18, custom: false },
    { nombre: 'Tofu', categoria: 'Legumbres', calorias: 76, proteinas: 8, carbohidratos: 2, grasas: 4.8, fibra: 0.3, custom: false },
    { nombre: 'Edamame', categoria: 'Legumbres', calorias: 122, proteinas: 12, carbohidratos: 9, grasas: 5, fibra: 5, custom: false },

    // ===== FRUTOS SECOS Y SEMILLAS =====
    { nombre: 'Almendras', categoria: 'Frutos secos', calorias: 579, proteinas: 21, carbohidratos: 22, grasas: 50, fibra: 12.5, custom: false },
    { nombre: 'Nueces', categoria: 'Frutos secos', calorias: 654, proteinas: 15, carbohidratos: 14, grasas: 65, fibra: 6.7, custom: false },
    { nombre: 'Anacardos', categoria: 'Frutos secos', calorias: 553, proteinas: 18.2, carbohidratos: 30.2, grasas: 43.9, fibra: 3.3, custom: false },
    { nombre: 'Pistachos', categoria: 'Frutos secos', calorias: 560, proteinas: 20.2, carbohidratos: 27.2, grasas: 45.3, fibra: 10.6, custom: false },
    { nombre: 'Avellanas', categoria: 'Frutos secos', calorias: 628, proteinas: 15, carbohidratos: 17, grasas: 61, fibra: 9.7, custom: false },
    { nombre: 'Piñones', categoria: 'Frutos secos', calorias: 673, proteinas: 13.7, carbohidratos: 13.1, grasas: 68.4, fibra: 3.7, custom: false },
    { nombre: 'Cacahuetes', categoria: 'Frutos secos', calorias: 567, proteinas: 26, carbohidratos: 16, grasas: 49, fibra: 9, custom: false },
    { nombre: 'Mantequilla de cacahuete', categoria: 'Frutos secos', calorias: 588, proteinas: 25, carbohidratos: 20, grasas: 50, fibra: 6, custom: false },
    { nombre: 'Crema de cacahuete (natural)', categoria: 'Frutos secos', calorias: 588, proteinas: 25, carbohidratos: 20, grasas: 50, fibra: 6, custom: false },
    { nombre: 'Crema de avellana', categoria: 'Frutos secos', calorias: 544, proteinas: 6, carbohidratos: 47, grasas: 35, fibra: 4, custom: false },
    { nombre: 'Semillas de sésamo', categoria: 'Semillas', calorias: 573, proteinas: 17.7, carbohidratos: 23.5, grasas: 49.7, fibra: 11.8, custom: false },
    { nombre: 'Semillas de chía', categoria: 'Semillas', calorias: 486, proteinas: 16, carbohidratos: 42, grasas: 31, fibra: 34, custom: false },
    { nombre: 'Semillas de lino', categoria: 'Semillas', calorias: 534, proteinas: 18.3, carbohidratos: 28.9, grasas: 42.2, fibra: 27.3, custom: false },
    { nombre: 'Semillas de calabaza', categoria: 'Semillas', calorias: 559, proteinas: 30.2, carbohidratos: 10.7, grasas: 49.1, fibra: 6, custom: false },
    { nombre: 'Pipas de girasol', categoria: 'Semillas', calorias: 584, proteinas: 20, carbohidratos: 20, grasas: 51, fibra: 9, custom: false },

    // ===== ACEITES Y GRASAS =====
    { nombre: 'Aceite de oliva', categoria: 'Grasas', calorias: 884, proteinas: 0, carbohidratos: 0, grasas: 100, fibra: 0, custom: false },
    { nombre: 'Aceite de oliva virgen extra', categoria: 'Grasas', calorias: 884, proteinas: 0, carbohidratos: 0, grasas: 100, fibra: 0, custom: false },
    { nombre: 'Aceite de oliva 0,4º', categoria: 'Grasas', calorias: 884, proteinas: 0, carbohidratos: 0, grasas: 100, fibra: 0, custom: false },
    { nombre: 'Aceite de coco', categoria: 'Grasas', calorias: 862, proteinas: 0, carbohidratos: 0, grasas: 100, fibra: 0, custom: false },
    { nombre: 'Aceite de girasol', categoria: 'Grasas', calorias: 884, proteinas: 0, carbohidratos: 0, grasas: 100, fibra: 0, custom: false },
    { nombre: 'Aceite de sésamo', categoria: 'Grasas', calorias: 884, proteinas: 0, carbohidratos: 0, grasas: 100, fibra: 0, custom: false },

    // ===== SALSAS Y CONDIMENTOS =====
    { nombre: 'Vinagre', categoria: 'Condimentos', calorias: 18, proteinas: 0, carbohidratos: 0.9, grasas: 0, fibra: 0, custom: false },
    { nombre: 'Vinagre de manzana', categoria: 'Condimentos', calorias: 22, proteinas: 0, carbohidratos: 0.9, grasas: 0, fibra: 0, custom: false },
    { nombre: 'Vinagre balsámico', categoria: 'Condimentos', calorias: 88, proteinas: 0.5, carbohidratos: 17, grasas: 0, fibra: 0, custom: false },
    { nombre: 'Salsa de soja', categoria: 'Condimentos', calorias: 53, proteinas: 8, carbohidratos: 4.7, grasas: 0.4, fibra: 0, custom: false },
    { nombre: 'Mostaza', categoria: 'Condimentos', calorias: 67, proteinas: 3.7, carbohidratos: 4.8, grasas: 3.3, fibra: 1.5, custom: false },
    { nombre: 'Mostaza clásica', categoria: 'Condimentos', calorias: 67, proteinas: 3.7, carbohidratos: 4.8, grasas: 3.3, fibra: 1.5, custom: false },
    { nombre: 'Kétchup', categoria: 'Condimentos', calorias: 101, proteinas: 1.1, carbohidratos: 23.4, grasas: 0.1, fibra: 0.4, custom: false },
    { nombre: 'Mayonesa', categoria: 'Condimentos', calorias: 724, proteinas: 1.1, carbohidratos: 1.3, grasas: 79, fibra: 0, custom: false },
    { nombre: 'Miel', categoria: 'Condimentos', calorias: 304, proteinas: 0.3, carbohidratos: 82, grasas: 0, fibra: 0.2, custom: false },
    { nombre: 'Sirope de arce', categoria: 'Condimentos', calorias: 260, proteinas: 0, carbohidratos: 67, grasas: 0, fibra: 0, custom: false },
    { nombre: 'Salsa pesto', categoria: 'Condimentos', calorias: 480, proteinas: 8, carbohidratos: 8, grasas: 47, fibra: 2, custom: false },
    { nombre: 'Salsa barbacoa', categoria: 'Condimentos', calorias: 110, proteinas: 0.5, carbohidratos: 25, grasas: 1, fibra: 0.5, custom: false },
    { nombre: 'Salsa de tomate', categoria: 'Condimentos', calorias: 35, proteinas: 1.5, carbohidratos: 7, grasas: 0.1, fibra: 1.5, custom: false },

    // ===== SUPLEMENTOS / PROTEÍNA =====
    { nombre: 'Proteína whey (polvo)', categoria: 'Suplementos', calorias: 375, proteinas: 80, carbohidratos: 10, grasas: 3, fibra: 0, custom: false },
    { nombre: 'Proteína vegetal (polvo)', categoria: 'Suplementos', calorias: 370, proteinas: 70, carbohidratos: 15, grasas: 5, fibra: 3, custom: false },

    // ===== OTROS =====
    { nombre: 'Agua', categoria: 'Bebidas', calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0, custom: false },
    { nombre: 'Caldo de pollo (brick)', categoria: 'Bebidas', calorias: 15, proteinas: 1.5, carbohidratos: 1.5, grasas: 0.3, fibra: 0, custom: false },
    { nombre: 'Caldo de verduras (brick)', categoria: 'Bebidas', calorias: 10, proteinas: 0.5, carbohidratos: 1.5, grasas: 0.2, fibra: 0, custom: false },
    { nombre: 'Levadura nutricional', categoria: 'Condimentos', calorias: 350, proteinas: 50, carbohidratos: 35, grasas: 5, fibra: 5, custom: false },
    { nombre: 'Glutamato monosódico', categoria: 'Condimentos', calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0, custom: false },
    { nombre: 'Sal', categoria: 'Condimentos', calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0, custom: false },
    { nombre: 'Pimienta negra', categoria: 'Especias', calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0, custom: false },
    { nombre: 'Orégano', categoria: 'Especias', calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0, custom: false },
    { nombre: 'Gelatina neutra', categoria: 'Postres', calorias: 335, proteinas: 85, carbohidratos: 0, grasas: 0, fibra: 0, custom: false },
    { nombre: 'Miso blanco', categoria: 'Condimentos', calorias: 200, proteinas: 12, carbohidratos: 26, grasas: 6, fibra: 3, custom: false },
]

async function main() {
    console.log(`📦 Insertando ${ALIMENTOS.length} alimentos base...\n`)

    const BATCH_SIZE = 20
    let inserted = 0
    let skipped = 0
    let errors = 0

    for (let i = 0; i < ALIMENTOS.length; i += BATCH_SIZE) {
        const batch = ALIMENTOS.slice(i, i + BATCH_SIZE)

        const nombres = batch.map(a => a.nombre)
        const { data: existing } = await supabase
            .from('alimentos')
            .select('nombre')
            .in('nombre', nombres)

        const existingNames = new Set(existing?.map(e => e.nombre) || [])
        const toInsert = batch.filter(a => !existingNames.has(a.nombre))
        const alreadyExist = batch.filter(a => existingNames.has(a.nombre))

        skipped += alreadyExist.length

        if (toInsert.length === 0) {
            console.log(`  Lote ${Math.floor(i / BATCH_SIZE) + 1}: todos ya existen (${alreadyExist.length})`)
            continue
        }

        const { error } = await supabase
            .from('alimentos')
            .insert(toInsert)
            .select('id, nombre')

        if (error) {
            if (error.code === '23505' || error.message?.includes('duplicate')) {
                skipped += toInsert.length
                console.log(`  Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${toInsert.length} duplicados`)
            } else {
                errors++
                console.error(`  ❌ Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message?.substring(0, 100)}`)
            }
        } else {
            inserted += toInsert.length
            console.log(`  ✅ Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${toInsert.length} insertados`)
        }
    }

    console.log(`\n📊 Resultado:`)
    console.log(`  ✅ Insertados: ${inserted}`)
    console.log(`  ⏭️  Ya existían: ${skipped}`)
    if (errors > 0) console.log(`  ❌ Errores: ${errors}`)
    console.log(`\n✨ Seed masivo completado!`)
}

main().catch(console.error)
