/**
 * Ejecuta la migración SQL de auto-match ingredientes en Supabase
 * usando la service_role_key via endpoint /sql
 *
 * USO: node scripts/ejecutar-migracion-auto-match.mjs
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

// Leer .env.local
const envPath = resolve(projectRoot, '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)
  if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim()
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

console.log('🧩 Migración: Auto-match ingredientes')
console.log('='.repeat(50))
console.log('📌 Supabase URL:', SUPABASE_URL)

// Leer SQL de migración
const sqlFile = resolve(projectRoot, 'supabase/migrations/20260524000000_auto_match_ingredientes.sql')
const sql = readFileSync(sqlFile, 'utf-8')
console.log(`📄 SQL: ${sql.length} caracteres`)
console.log('')

// Dividir en bloques semánticos para mejor feedback
const blocks = [
  {
    desc: 'ADD COLUMN last_matched_at',
    sql: `ALTER TABLE public.receta_ingredientes ADD COLUMN IF NOT EXISTS last_matched_at timestamptz;`
  },
  {
    desc: 'CREATE FUNCTION match_ingrediente_por_nombre',
    sql: `
CREATE OR REPLACE FUNCTION public.match_ingrediente_por_nombre(
  p_nombre_libre text,
  OUT alimento_id uuid,
  OUT confianza text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_norm text;
BEGIN
  alimento_id := NULL;
  confianza := 'no_match';

  IF p_nombre_libre IS NULL OR length(trim(p_nombre_libre)) < 2 THEN
    RETURN;
  END IF;

  v_norm := lower(trim(p_nombre_libre));

  -- 1. Match exacto (sin acentos)
  SELECT a.id INTO alimento_id
  FROM public.alimentos a
  WHERE lower(trim(a.nombre)) = v_norm
     OR lower(trim(a.nombre)) = replace(v_norm, 'á', 'a')
     OR lower(trim(a.nombre)) = replace(v_norm, 'é', 'e')
     OR lower(trim(a.nombre)) = replace(v_norm, 'í', 'i')
     OR lower(trim(a.nombre)) = replace(v_norm, 'ó', 'o')
     OR lower(trim(a.nombre)) = replace(v_norm, 'ú', 'u')
  LIMIT 1;

  IF FOUND THEN
    confianza := 'exacta';
    RETURN;
  END IF;

  -- 2. Contiene bidireccional
  SELECT a.id INTO alimento_id
  FROM public.alimentos a
  WHERE lower(trim(a.nombre)) LIKE '%' || v_norm || '%'
     OR v_norm LIKE '%' || lower(trim(a.nombre)) || '%'
  LIMIT 1;

  IF FOUND THEN
    confianza := 'parcial';
    RETURN;
  END IF;

  -- 3. Primera palabra clave (la más larga > 3 chars)
  WITH palabras AS (
    SELECT unnest(string_to_array(v_norm, ' ')) AS palabra
  ),
  larga AS (
    SELECT palabra FROM palabras WHERE length(palabra) > 3 ORDER BY length(palabra) DESC LIMIT 1
  )
  SELECT a.id INTO alimento_id
  FROM public.alimentos a, larga
  WHERE lower(trim(a.nombre)) LIKE '%' || larga.palabra || '%'
  LIMIT 1;

  IF FOUND THEN
    confianza := 'fuzzy';
    RETURN;
  END IF;
END;
$$;
    `.trim()
  },
  {
    desc: 'CREATE FUNCTION try_match_ingrediente (trigger)',
    sql: `
CREATE OR REPLACE FUNCTION public.try_match_ingrediente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_alimento_id uuid;
  v_confianza text;
BEGIN
  IF NEW.alimento_id IS NULL THEN
    SELECT match_ingrediente_por_nombre(NEW.nombre_libre) INTO v_alimento_id, v_confianza;

    IF v_alimento_id IS NOT NULL THEN
      NEW.alimento_id := v_alimento_id;
      NEW.last_matched_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
    `.trim()
  },
  {
    desc: 'CREATE TRIGGER trg_try_match_ingrediente',
    sql: `
DROP TRIGGER IF EXISTS trg_try_match_ingrediente ON public.receta_ingredientes;
CREATE TRIGGER trg_try_match_ingrediente
  BEFORE INSERT ON public.receta_ingredientes
  FOR EACH ROW
  EXECUTE FUNCTION public.try_match_ingrediente();
    `.trim()
  },
  {
    desc: 'CREATE OR REPLACE FUNCTION calcular_macros_receta (mejorada)',
    sql: `
CREATE OR REPLACE FUNCTION public.calcular_macros_receta(p_receta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_kcal         numeric := 0;
  total_proteinas    numeric := 0;
  total_carbohidratos numeric := 0;
  total_grasas       numeric := 0;
  total_fibra        numeric := 0;
  peso_total         numeric := 0;
  v_porciones        numeric;
BEGIN
  SELECT COALESCE(porciones, 1) INTO v_porciones
  FROM public.recetas
  WHERE id = p_receta_id;

  SELECT
    COALESCE(SUM(a.calorias       / 100.0 * ri.cantidad_gramos), 0),
    COALESCE(SUM(a.proteinas      / 100.0 * ri.cantidad_gramos), 0),
    COALESCE(SUM(a.carbohidratos  / 100.0 * ri.cantidad_gramos), 0),
    COALESCE(SUM(a.grasas         / 100.0 * ri.cantidad_gramos), 0),
    COALESCE(SUM(a.fibra          / 100.0 * ri.cantidad_gramos), 0),
    COALESCE(SUM(ri.cantidad_gramos), 0)
  INTO
    total_kcal, total_proteinas, total_carbohidratos,
    total_grasas, total_fibra, peso_total
  FROM public.receta_ingredientes ri
  LEFT JOIN public.alimentos a ON a.id = ri.alimento_id
  WHERE ri.receta_id = p_receta_id;

  UPDATE public.recetas
  SET
    kcal                = CASE WHEN v_porciones > 0 THEN ROUND((total_kcal / v_porciones)::numeric, 2) ELSE 0 END,
    proteinas           = CASE WHEN v_porciones > 0 THEN ROUND((total_proteinas / v_porciones)::numeric, 2) ELSE 0 END,
    carbohidratos       = CASE WHEN v_porciones > 0 THEN ROUND((total_carbohidratos / v_porciones)::numeric, 2) ELSE 0 END,
    grasas              = CASE WHEN v_porciones > 0 THEN ROUND((total_grasas / v_porciones)::numeric, 2) ELSE 0 END,
    fibra               = CASE WHEN v_porciones > 0 THEN ROUND((total_fibra / v_porciones)::numeric, 2) ELSE 0 END,
    kcal_100g           = CASE WHEN peso_total > 0 THEN ROUND(((total_kcal / peso_total) * 100)::numeric, 2) ELSE NULL END,
    proteinas_100g      = CASE WHEN peso_total > 0 THEN ROUND(((total_proteinas / peso_total) * 100)::numeric, 2) ELSE NULL END,
    carbohidratos_100g  = CASE WHEN peso_total > 0 THEN ROUND(((total_carbohidratos / peso_total) * 100)::numeric, 2) ELSE NULL END,
    grasas_100g         = CASE WHEN peso_total > 0 THEN ROUND(((total_grasas / peso_total) * 100)::numeric, 2) ELSE NULL END,
    fibra_100g          = CASE WHEN peso_total > 0 THEN ROUND(((total_fibra / peso_total) * 100)::numeric, 2) ELSE NULL END,
    peso_total_g        = peso_total,
    updated_at          = now()
  WHERE id = p_receta_id;
END;
$$;
    `.trim()
  }
]

async function ejecutarBloque(block, descripcion) {
  try {
    const response = await fetch(`${SUPABASE_URL}/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ query: block }),
    })

    const text = await response.text()

    if (response.ok) {
      console.log(`  ✅ ${descripcion}`)
      return true
    } else {
      // Si es "already exists", lo damos por bueno
      if (text.includes('already exists') || text.includes('duplicate')) {
        console.log(`  ⚠️ ${descripcion} (ya existe)`)
        return true
      }
      console.log(`  ❌ ${descripcion}: ${text.substring(0, 200)}`)
      return false
    }
  } catch (err) {
    console.log(`  ❌ ${descripcion}: ${err.message}`)
    return false
  }
}

async function main() {
  let ok = 0
  let fail = 0

  for (const { desc, sql: blockSql } of blocks) {
    const result = await ejecutarBloque(blockSql, desc)
    if (result) ok++
    else fail++
  }

  console.log('')
  console.log('='.repeat(50))
  console.log(`📊 Resultado: ${ok} OK, ${fail} errores`)

  if (fail > 0) {
    console.log('⚠️  Algunos bloques fallaron. Revisa manualmente.')
    process.exit(1)
  } else {
    console.log('✅ Migración completada correctamente')
    console.log('')
    console.log('📌 Columnas añadidas:')
    console.log('   - receta_ingredientes.last_matched_at')
    console.log('')
    console.log('📌 Funciones creadas/actualizadas:')
    console.log('   - match_ingrediente_por_nombre(text) → (uuid, text)')
    console.log('   - try_match_ingrediente() → trigger')
    console.log('   - calcular_macros_receta(uuid) → mejorada con ROUND')
    console.log('')
    console.log('📌 Trigger creado:')
    console.log('   - trg_try_match_ingrediente (BEFORE INSERT ON receta_ingredientes)')
  }
}

main().catch(err => {
  console.error('Error fatal:', err)
  process.exit(1)
})
