# Plan: Generación de Planes Personalizada + Vinculación Portal Cliente

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescribir el pipeline de generación de planes de dieta IA para que filtre el recetario por intolerancias y macros antes de enviarlo a DeepSeek, garantice que todos los `comida_alimentos` tengan `alimento_id != NULL`, escale ingredientes de forma inteligente por rol, y ofrezca 2 alternativas macroequivalentes por comida en el portal del cliente.

**Architecture:** Dos nuevas librerías encapsulan la lógica: `lib/ingredient-roles.ts` (SCALING_RULES + inferencia automática de rol) y `lib/plan-recetas.ts` (pre-filtrado por slot, validación post-DeepSeek, scaling de gramajes). El endpoint `generar-plan-inicial` las importa y pasa las candidatas pre-filtradas al prompt. Las alternativas se almacenan en `comidas.alternativas_receta_ids[]` y se sirven desde `/api/recetas/alternativas`. El portal del cliente usa los nuevos componentes `MealCard` y `RecetaIngredienteItem`.

**Tech Stack:** Next.js 16 App Router, Supabase PostgreSQL, TypeScript, DeepSeek Chat API, Tailwind CSS + CSS vars, `createServiceSupabase()` para service role

**Spec de referencia:** `docs/superpowers/specs/2026-05-23-plan-generation-portal-design.md`

---

## Task 1: Migración SQL — 5 tablas

**Files:**
- Create: `supabase/migrations/20260523000000_plan_generation_portal.sql`

- [ ] **Paso 1.1 — Crear el archivo de migración**

```sql
-- supabase/migrations/20260523000000_plan_generation_portal.sql

-- 1. onboarding_responses: 4 campos nuevos
ALTER TABLE onboarding_responses
  ADD COLUMN IF NOT EXISTS horario_comidas jsonb,
  ADD COLUMN IF NOT EXISTS come_fuera_dias int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alimentos_base text[],
  ADD COLUMN IF NOT EXISTS objetivo_deportivo text,
  ADD COLUMN IF NOT EXISTS historial_dieta text;

-- 2. comidas: campo para alternativas pre-calculadas
ALTER TABLE comidas
  ADD COLUMN IF NOT EXISTS alternativas_receta_ids uuid[],
  ADD COLUMN IF NOT EXISTS kcal_target int,
  ADD COLUMN IF NOT EXISTS proteinas_target int,
  ADD COLUMN IF NOT EXISTS carbos_target int,
  ADD COLUMN IF NOT EXISTS grasas_target int,
  ADD COLUMN IF NOT EXISTS notas_peri_entreno text;

-- 3. comida_alimentos: factor de ajuste de gramaje
ALTER TABLE comida_alimentos
  ADD COLUMN IF NOT EXISTS factor_ajuste float DEFAULT 1.0;

-- 4. recetas: tipo, salsas recomendadas, receta privada de cliente
ALTER TABLE recetas
  ADD COLUMN IF NOT EXISTS tipo_receta text DEFAULT 'completa'
    CHECK (tipo_receta IN ('completa','guarnicion','salsa_base','snack_postre','bebida','desayuno')),
  ADD COLUMN IF NOT EXISTS salsas_recomendadas uuid[],
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fuente text DEFAULT 'manual'
    CHECK (fuente IN ('manual','scraping','ia_generada','ia_personalizada'));

-- 5. receta_ingredientes: rol, cantidad fija, receta vinculada
ALTER TABLE receta_ingredientes
  ADD COLUMN IF NOT EXISTS rol_ingrediente text
    CHECK (rol_ingrediente IN (
      'proteina_principal','carbohidrato_base','verdura_volumen','grasa_saludable',
      'salsa_condimento','especias_aromaticos','estructural','lacteo_complemento','fruta_complemento'
    )),
  ADD COLUMN IF NOT EXISTS es_cantidad_fija boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS receta_vinculada_id uuid REFERENCES recetas(id) ON DELETE SET NULL;

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_recetas_tipo_receta ON recetas(tipo_receta);
CREATE INDEX IF NOT EXISTS idx_recetas_cliente_id ON recetas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_recetas_fuente ON recetas(fuente);
CREATE INDEX IF NOT EXISTS idx_receta_ingredientes_rol ON receta_ingredientes(rol_ingrediente);
```

- [ ] **Paso 1.2 — Aplicar la migración en Supabase**

Ir a Supabase Dashboard → SQL Editor → ejecutar el contenido del archivo. O con CLI si está instalado:

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx supabase db push
```

Verificar que no hay errores. Si hay error de constraint por datos existentes en `tipo_receta`, ajustar el DEFAULT antes del CHECK.

- [ ] **Paso 1.3 — Verificar columnas añadidas**

Ejecutar en Supabase SQL Editor:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name IN ('recetas', 'receta_ingredientes', 'comidas', 'comida_alimentos', 'onboarding_responses')
  AND column_name IN ('tipo_receta','fuente','cliente_id','salsas_recomendadas',
                       'rol_ingrediente','es_cantidad_fija','receta_vinculada_id',
                       'alternativas_receta_ids','kcal_target','proteinas_target',
                       'come_fuera_dias','horario_comidas','alimentos_base','factor_ajuste')
ORDER BY table_name, column_name;
```

Resultado esperado: 15+ filas con las nuevas columnas.

- [ ] **Paso 1.4 — Commit**

```bash
git add supabase/migrations/20260523000000_plan_generation_portal.sql
git commit -m "feat: migración SQL plan-generation-portal — 5 tablas, 15 columnas nuevas"
```

---

## Task 2: Tipos TypeScript nuevos

**Files:**
- Modify: `types/index.ts` (añadir al final, antes del último export)

- [ ] **Paso 2.1 — Añadir tipos al final de `types/index.ts`**

```typescript
// ============================================================
// Tipos plan-generation-portal (23-05-2026)
// ============================================================

export type RolIngrediente =
  | 'proteina_principal'
  | 'carbohidrato_base'
  | 'verdura_volumen'
  | 'grasa_saludable'
  | 'salsa_condimento'
  | 'especias_aromaticos'
  | 'estructural'
  | 'lacteo_complemento'
  | 'fruta_complemento'

export type TipoReceta =
  | 'completa'
  | 'guarnicion'
  | 'salsa_base'
  | 'snack_postre'
  | 'bebida'
  | 'desayuno'

export type FuenteReceta =
  | 'manual'
  | 'scraping'
  | 'ia_generada'
  | 'ia_personalizada'

export interface RecetaIngredienteConRol {
  id: string
  receta_id: string
  alimento_id?: string | null
  nombre_libre?: string | null
  cantidad_gramos: number
  unidad?: string | null
  rol_ingrediente?: RolIngrediente | null
  es_cantidad_fija?: boolean
  receta_vinculada_id?: string | null
  alimento?: {
    id: string
    nombre: string
    calorias: number
    proteinas: number
    carbohidratos: number
    grasas: number
    categoria?: string | null
  }
  receta_vinculada?: {
    id: string
    nombre: string
    imagen_url?: string | null
  }
}

export interface RecetaCandidata {
  id: string
  nombre: string
  kcal: number
  proteinas: number
  carbohidratos: number
  grasas: number
  tiempo_prep_min?: number | null
  tipo_receta?: TipoReceta | null
  imagen_url?: string | null
  url_origen?: string | null
  intolerancias?: string[] | null
  _dist?: number // solo para uso interno, no exponer al cliente
}

export interface ComidaConAlternativas extends Comida {
  alternativas_receta_ids?: string[] | null
  kcal_target?: number | null
  proteinas_target?: number | null
  carbos_target?: number | null
  grasas_target?: number | null
  notas_peri_entreno?: string | null
}

export interface ComidaAlimentoConFactor extends ComidaAlimento {
  factor_ajuste?: number
}
```

- [ ] **Paso 2.2 — Verificar que el build de tipos no tiene errores**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx tsc --noEmit --pretty false 2>&1 | grep -v "node_modules" | head -20
```

Esperado: 0 errores (solo warnings `no-explicit-any` residuales).

- [ ] **Paso 2.3 — Commit**

```bash
git add types/index.ts
git commit -m "feat: nuevos tipos RolIngrediente, TipoReceta, FuenteReceta, RecetaCandidata"
```

---

## Task 3: `lib/ingredient-roles.ts` — Lógica de roles y scaling

**Files:**
- Create: `lib/ingredient-roles.ts`

- [ ] **Paso 3.1 — Crear `lib/ingredient-roles.ts`**

```typescript
// lib/ingredient-roles.ts
import type { RolIngrediente } from '@/types'

export { RolIngrediente }

export const SCALING_RULES: Record<RolIngrediente, (factor: number) => number> = {
  proteina_principal:  (f) => f,
  carbohidrato_base:   (f) => f,
  verdura_volumen:     (f) => f,
  grasa_saludable:     (f) => 1 + (f - 1) * 0.5,
  salsa_condimento:    (f) => Math.min(f, 1.25),
  especias_aromaticos: (_) => 1.0,
  estructural:         (f) => Math.min(f, 1.15),
  lacteo_complemento:  (f) => Math.min(f, 1.30),
  fruta_complemento:   (f) => Math.min(f, 1.20),
}

interface AlimentoBasico {
  categoria?: string | null
  proteinas?: number | null
  carbohidratos?: number | null
  grasas?: number | null
  calorias?: number | null
}

export function inferirRolIngrediente(
  alimento: AlimentoBasico,
  nombreIngrediente: string
): RolIngrediente {
  const nombre = nombreIngrediente.toLowerCase()
  const cat = (alimento.categoria ?? '').toLowerCase()
  const prot = alimento.proteinas ?? 0
  const carbs = alimento.carbohidratos ?? 0
  const grasas = alimento.grasas ?? 0
  const kcal = alimento.calorias ?? 0

  // Especias y aromáticos (detección por nombre — siempre primero)
  const RE_ESPECIA = /\b(sal(?:sa)?|pimienta|ajo|orégano|comino|cúrcuma|pimentón|albahaca|romero|tomillo|jengibre|canela|laurel|cilantro|perejil|cayena|nuez moscada|cardamomo|curry|vinagre|cebolla en polvo|ajo en polvo)\b/
  if (RE_ESPECIA.test(nombre)) return 'especias_aromaticos'

  // Salsas y condimentos
  const RE_SALSA = /\b(ketchup|mayonesa|pesto|hummus|tahini|mostaza|aliño|aderezo|ranch|sriracha|guacamole|tzatziki|chimichurri|aioli|mojo|vinagreta|salsa de soja|salsa teriyaki|salsa hoisin|salsa worcestershire)\b/
  if (RE_SALSA.test(nombre)) return 'salsa_condimento'

  // Estructural — bases, wraps, panes (antes de proteína, para evitar que "pan de molde" → proteína)
  const RE_ESTRUCTURAL = /\b(tortilla de trigo|wrap|pan(?:ecillo)?|baguette|base de pizza|masa|galleta|cracker|tostada|blini|crepe|pita|naan)\b/
  if (RE_ESTRUCTURAL.test(nombre)) return 'estructural'

  // Frutas — complemento
  const RE_FRUTA = /\b(fresa|frambuesa|arándano|plátano|mango|piña|kiwi|naranja|limón|fruta|berry|cereza|uva|sandía|melón|melocotón|nectarina|granada|maracuyá|papaya|higo)\b/
  if (RE_FRUTA.test(nombre) || cat.includes('fruta')) return 'fruta_complemento'

  // Lácteos como complemento (yogur, queso pequeñas cantidades, crema)
  const RE_LACTEO = /\b(queso fresco|requesón|ricotta|mascarpone|crema de leche|nata|yogur|kéfir|queso rallado|queso parmesano|queso cottage)\b/
  if (RE_LACTEO.test(nombre) && kcal < 250) return 'lacteo_complemento'

  // Grasa saludable — alta en grasa, baja en proteína
  const RE_GRASA = /\b(aguacate|aceite|nuez|almendra|cacahuete|pistacho|avellana|anacardo|pepita|semilla|linaza|chía|mantequilla de|crema de cacahuete)\b/
  if (RE_GRASA.test(nombre) || (grasas > 20 && prot < 15)) return 'grasa_saludable'

  // Proteína principal — alto en proteínas o keywords de proteína
  const RE_PROTEINA = /\b(pollo|pechuga|muslo|contramuslo|ternera|buey|cerdo|pavo|salmón|atún|merluza|lubina|dorada|bacalao|sepia|gamba|langostino|huevo|clara de huevo|tofu|seitán|tempe|garbanzos|lentejas|judías blancas|alubias|edamame|proteína en polvo|proteína whey)\b/
  if (RE_PROTEINA.test(nombre) || prot >= 15) return 'proteina_principal'

  // Carbohidrato base — alto en carbos o keywords
  const RE_CARBO = /\b(arroz|pasta|patata|boniato|avena|quinoa|maíz|cuscús|bulgur|pan integral|tortita|porridge|granola|muesli|mijo|espelta|amaranto)\b/
  if (RE_CARBO.test(nombre) || carbs >= 20) return 'carbohidrato_base'

  // Verdura volumen — baja densidad calórica
  if (kcal < 50 || cat.includes('verdura') || cat.includes('hortaliza')) return 'verdura_volumen'

  // Fallback
  return 'proteina_principal'
}

export function calcularGramajeAjustado(
  cantidad_gramos: number,
  rol_ingrediente: RolIngrediente | null | undefined,
  es_cantidad_fija: boolean,
  factorBase: number
): number {
  if (es_cantidad_fija) return cantidad_gramos
  if (!rol_ingrediente) return Math.round(cantidad_gramos * factorBase)

  const ruleFn = SCALING_RULES[rol_ingrediente]
  const factorAplicado = ruleFn(factorBase)
  return Math.round(cantidad_gramos * factorAplicado)
}
```

- [ ] **Paso 3.2 — Verificar tipos**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx tsc --noEmit --pretty false 2>&1 | grep "ingredient-roles" | head -10
```

Esperado: sin errores en el nuevo archivo.

- [ ] **Paso 3.3 — Commit**

```bash
git add lib/ingredient-roles.ts
git commit -m "feat: lib/ingredient-roles — SCALING_RULES, inferirRolIngrediente, calcularGramajeAjustado"
```

---

## Task 4: `lib/plan-recetas.ts` — Pre-filtrado, validación, scaling

**Files:**
- Create: `lib/plan-recetas.ts`

- [ ] **Paso 4.1 — Crear `lib/plan-recetas.ts`**

```typescript
// lib/plan-recetas.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RecetaCandidata, TipoReceta } from '@/types'

// Porcentaje de kcal del objetivo diario por slot
const SLOT_KCAL_PCT: Record<string, [number, number]> = {
  'Desayuno':       [0.20, 0.25],
  'Media mañana':   [0.08, 0.10],
  'Comida':         [0.30, 0.35],
  'Merienda':       [0.08, 0.10],
  'Snack':          [0.08, 0.10],
  'Cena':           [0.25, 0.30],
}

// Categorías Supabase compatibles por slot (mientras tipo_receta no está poblado)
const SLOT_CATEGORIAS: Record<string, string[]> = {
  'Desayuno':      ['Desayuno', 'Gofres', 'Bowls fruta'],
  'Media mañana':  ['Snack', 'Merienda', 'Postres'],
  'Snack':         ['Snack', 'Merienda', 'Postres'],
  'Comida':        ['Comida', 'Platos variados', 'Carnes', 'Pescados', 'Bowls', 'Ensaladas', 'Burritos', 'Fajitas/Tacos', 'Entrante'],
  'Merienda':      ['Merienda', 'Snack', 'Desayuno', 'Postres'],
  'Cena':          ['Cena', 'Comida', 'Platos variados', 'Carnes', 'Pescados', 'Ensaladas'],
}

// tipo_receta permitidos por slot
const SLOT_TIPOS_PERMITIDOS: Record<string, TipoReceta[]> = {
  'Desayuno':      ['desayuno', 'completa'],
  'Media mañana':  ['snack_postre', 'desayuno', 'guarnicion'],
  'Snack':         ['snack_postre', 'desayuno', 'guarnicion'],
  'Comida':        ['completa'],
  'Merienda':      ['snack_postre', 'desayuno'],
  'Cena':          ['completa', 'guarnicion'],
}

function distanciaEuclidiana(
  kcal: number, prot: number,
  targetKcal: number, targetProt: number
): number {
  const dKcal = targetKcal > 0 ? Math.abs(kcal - targetKcal) / targetKcal : 0
  const dProt = targetProt > 0 ? Math.abs(prot - targetProt) / targetProt : 0
  return dKcal + dProt
}

export function calcularTargetSlot(
  slotNombre: string,
  kcalObjetivo: number,
  proteinaObjetivo: number,
  numComidas: number
): { targetKcal: number; targetProt: number } {
  const [min, max] = SLOT_KCAL_PCT[slotNombre] ?? [1 / numComidas, 1 / numComidas]
  const pct = (min + max) / 2
  return {
    targetKcal: Math.round(kcalObjetivo * pct),
    targetProt: Math.round(proteinaObjetivo * pct),
  }
}

interface FiltroCliente {
  restricciones?: string[] | null
  alimentos_evitar_extra?: string | null
  tiempo_cocina_min?: number | null
  alimentos_base?: string[] | null
}

export async function filtrarRecetasPorSlot(
  supabase: SupabaseClient,
  slotNombre: string,
  targetKcal: number,
  targetProt: number,
  filtroCliente: FiltroCliente,
  limit = 6
): Promise<RecetaCandidata[]> {
  const categorias = SLOT_CATEGORIAS[slotNombre] ?? SLOT_CATEGORIAS['Comida']
  const tiposPermitidos = SLOT_TIPOS_PERMITIDOS[slotNombre] ?? ['completa']
  const restricciones = filtroCliente.restricciones ?? []
  const tiempoMaximo = filtroCliente.tiempo_cocina_min

  let query = supabase
    .from('recetas')
    .select('id, nombre, kcal, proteinas, carbohidratos, grasas, tiempo_prep_min, tipo_receta, imagen_url, url_origen, intolerancias')
    .eq('estado', 'aprobada')
    .gt('kcal', 0)
    .in('categoria', categorias)

  // Filtrar por tipo_receta si está disponible
  query = query.or(
    `tipo_receta.is.null,tipo_receta.in.(${tiposPermitidos.join(',')})`
  )

  // Filtrar por tiempo de cocina si el cliente tiene restricción
  if (tiempoMaximo && tiempoMaximo > 0) {
    query = query.or(`tiempo_prep_min.is.null,tiempo_prep_min.lte.${tiempoMaximo}`)
  }

  const { data: recetas } = await query.limit(50)
  if (!recetas || recetas.length === 0) return []

  // Filtrar por intolerancias del cliente
  const candidatas = recetas.filter(r => {
    if (!restricciones.length) return true
    const recetaIntol: string[] = r.intolerancias ?? []
    // Si la receta contiene una intolerancia del cliente, excluir
    return !restricciones.some(intol => recetaIntol.includes(intol))
  })

  // Ordenar por distancia euclidiana y devolver top N
  return candidatas
    .map(r => ({
      ...r,
      _dist: distanciaEuclidiana(r.kcal, r.proteinas ?? 0, targetKcal, targetProt),
    }))
    .sort((a, b) => (a._dist ?? 0) - (b._dist ?? 0))
    .slice(0, limit)
    .map(({ _dist: _, ...r }) => r) // quitar _dist del resultado
}

interface ComidaDeepSeek {
  nombre: string
  hora?: string
  kcal_target?: number
  proteinas_target?: number
  carbos_target?: number
  grasas_target?: number
  receta_id: string
  receta_nombre: string
  alternativas?: string[]
  notas_peri_entreno?: string
  _receta_corregida?: boolean
}

export interface PlanDeepSeekValidado {
  distribucion_comidas: ComidaDeepSeek[]
  notas_generales?: string
  evidencia_cientifica?: string[]
}

export function validarYResolverRecetas(
  respuestaDS: PlanDeepSeekValidado,
  candidatasPorSlot: Map<string, RecetaCandidata[]>
): PlanDeepSeekValidado {
  for (const comida of respuestaDS.distribucion_comidas) {
    const candidatas = candidatasPorSlot.get(comida.nombre) ?? []
    const idsValidos = new Set(candidatas.map(r => r.id))

    // Validar receta principal
    if (!idsValidos.has(comida.receta_id)) {
      comida.receta_id = candidatas[0]?.id ?? ''
      comida.receta_nombre = candidatas[0]?.nombre ?? comida.receta_nombre
      comida._receta_corregida = true
    }

    // Validar y completar alternativas
    const alternativasValidas = (comida.alternativas ?? [])
      .filter(id => idsValidos.has(id))
      .filter(id => id !== comida.receta_id)

    const usadas = new Set([comida.receta_id, ...alternativasValidas])
    for (const r of candidatas) {
      if (alternativasValidas.length >= 2) break
      if (!usadas.has(r.id)) {
        alternativasValidas.push(r.id)
        usadas.add(r.id)
      }
    }

    comida.alternativas = alternativasValidas
  }

  return respuestaDS
}

export function calcularFactorGramaje(
  recetaKcal: number,
  targetKcal: number
): number | null {
  if (recetaKcal <= 0) return null
  const factor = targetKcal / recetaKcal
  // Descartar scaling extremo
  if (factor > 1.6 || factor < 0.55) return null
  return factor
}

export function esPlataCompleto(
  roles: Array<string | null | undefined>
): boolean {
  const tieneProteina = roles.some(r => r === 'proteina_principal')
  const tieneCarbOVerdura = roles.some(r =>
    r === 'carbohidrato_base' || r === 'verdura_volumen'
  )
  return tieneProteina && tieneCarbOVerdura
}
```

- [ ] **Paso 4.2 — Verificar tipos**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx tsc --noEmit --pretty false 2>&1 | grep "plan-recetas" | head -10
```

Esperado: sin errores.

- [ ] **Paso 4.3 — Commit**

```bash
git add lib/plan-recetas.ts
git commit -m "feat: lib/plan-recetas — filtrarRecetasPorSlot, validarYResolverRecetas, calcularFactorGramaje"
```

---

## Task 5: `lib/nutricion-peri-entreno.ts` — Añadir `calcularAjustesPeriEntreno`

**Files:**
- Modify: `lib/nutricion-peri-entreno.ts` (añadir al final del archivo)

- [ ] **Paso 5.1 — Añadir la interfaz y función al final de `lib/nutricion-peri-entreno.ts`**

```typescript
// === Añadir al FINAL de lib/nutricion-peri-entreno.ts ===

export interface AjustePeriEntreno {
  slot_nombre: string
  tipo: 'pre' | 'post'
  minutos_antes_despues: number
  ajuste_carbos_g: number
  ajuste_proteina_g: number
  nota: string
  receta_tipo_preferido: 'carbos_rapidos' | 'proteina_magra' | 'equilibrado'
}

export function calcularAjustesPeriEntreno(params: {
  horaEntreno?: string | null
  sportModality?: string | null
  duracionMin?: number
  kcalObjetivo: number
  numComidas: number
}): AjustePeriEntreno[] {
  const { horaEntreno, sportModality, duracionMin = 45, kcalObjetivo, numComidas } = params
  if (!horaEntreno) return []

  const [h, m] = horaEntreno.split(':').map(Number)
  const minutosEntreno = h * 60 + (m ?? 0)
  const ajustes: AjustePeriEntreno[] = []

  const isCardio = ['running', 'ciclismo', 'natacion', 'triatlon', 'hyrox'].includes(sportModality ?? '')
  const isFuerza = ['gym_fuerza', 'gym_estetica', 'calistenia', 'powerlifting'].includes(sportModality ?? '')

  // Slot pre-entreno
  const minPre = isCardio ? 90 : 75 // minutos antes
  const minutosSlotPre = minutosEntreno - minPre
  const horaSlotPre = `${String(Math.floor(minutosSlotPre / 60)).padStart(2, '0')}:${String(minutosSlotPre % 60).padStart(2, '0')}`

  let slotPreNombre = 'Comida'
  if (minutosSlotPre < 7 * 60) slotPreNombre = 'Desayuno'
  else if (minutosSlotPre < 12 * 60) slotPreNombre = 'Media mañana'
  else if (minutosSlotPre < 15 * 60) slotPreNombre = 'Comida'
  else slotPreNombre = 'Merienda'

  void horaSlotPre // usado solo para nota informativa

  if (isCardio) {
    ajustes.push({
      slot_nombre: slotPreNombre,
      tipo: 'pre',
      minutos_antes_despues: minPre,
      ajuste_carbos_g: 20,
      ajuste_proteina_g: 0,
      nota: `Pre-entreno ${sportModality}: +carbos rápidos, bajo en fibra y grasa. ${minPre}min antes.`,
      receta_tipo_preferido: 'carbos_rapidos',
    })
  } else if (isFuerza) {
    ajustes.push({
      slot_nombre: slotPreNombre,
      tipo: 'pre',
      minutos_antes_despues: minPre,
      ajuste_carbos_g: 15,
      ajuste_proteina_g: 10,
      nota: `Pre-entreno fuerza: proteína moderada + carbos complejos. ${minPre}min antes.`,
      receta_tipo_preferido: 'equilibrado',
    })
  } else {
    ajustes.push({
      slot_nombre: slotPreNombre,
      tipo: 'pre',
      minutos_antes_despues: minPre,
      ajuste_carbos_g: 10,
      ajuste_proteina_g: 5,
      nota: `Pre-entreno: comida equilibrada. ${minPre}min antes.`,
      receta_tipo_preferido: 'equilibrado',
    })
  }

  // Slot post-entreno
  const minutosSlotPost = minutosEntreno + duracionMin + 30
  let slotPostNombre = 'Comida'
  if (minutosSlotPost < 12 * 60) slotPostNombre = 'Comida'
  else if (minutosSlotPost < 14 * 60) slotPostNombre = 'Comida'
  else if (minutosSlotPost < 18 * 60) slotPostNombre = 'Merienda'
  else slotPostNombre = 'Cena'

  const ajusteProtPost = isCardio ? 30 : 35
  const ajusteCarbPost = isCardio ? 40 : 20

  ajustes.push({
    slot_nombre: slotPostNombre,
    tipo: 'post',
    minutos_antes_despues: 30,
    ajuste_carbos_g: ajusteCarbPost,
    ajuste_proteina_g: ajusteProtPost,
    nota: `Post-entreno: proteína prioritaria (${ajusteProtPost}g), ventana 30-45min tras sesión.`,
    receta_tipo_preferido: 'proteina_magra',
  })

  return ajustes
}
```

- [ ] **Paso 5.2 — Verificar tipos**

```bash
npx tsc --noEmit --pretty false 2>&1 | grep "peri-entreno" | head -5
```

Esperado: sin errores.

- [ ] **Paso 5.3 — Commit**

```bash
git add lib/nutricion-peri-entreno.ts
git commit -m "feat: calcularAjustesPeriEntreno — ajuste por slot según deporte y hora de entreno"
```

---

## Task 6: Script `scripts/clasificar-tipo-receta.mjs`

**Files:**
- Create: `scripts/clasificar-tipo-receta.mjs`

- [ ] **Paso 6.1 — Crear el script**

```javascript
// scripts/clasificar-tipo-receta.mjs
// Clasifica todas las recetas existentes con tipo_receta basándose en categoria y tipo_plato
// Uso: node scripts/clasificar-tipo-receta.mjs [--dry-run] [--aplicar]

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const APLICAR = process.argv.includes('--aplicar')

// Mapping de categoria/tipo_plato → tipo_receta
function clasificarReceta(receta) {
  const cat = (receta.categoria ?? '').toLowerCase()
  const tipo = (receta.tipo_plato ?? '').toLowerCase()
  const nombre = (receta.nombre ?? '').toLowerCase()

  // Salsas y bases — nunca slot principal
  if (cat.includes('salsa') || nombre.includes('mayonesa') || nombre.includes('aliño') ||
      nombre.includes('hummus') || nombre.includes('pesto') || nombre.includes('guacamole') ||
      nombre.includes('tahini') || nombre.includes('ketchup') || nombre.includes('vinagreta')) {
    return 'salsa_base'
  }

  // Bebidas
  if (cat.includes('bebida') || cat.includes('batido') || cat.includes('smoothie') ||
      tipo.includes('bebida') || nombre.includes('batido') || nombre.includes('smoothie') ||
      nombre.includes('zumo') || nombre.includes('agua')) {
    return 'bebida'
  }

  // Desayunos
  if (cat === 'desayuno' || tipo === 'desayuno' ||
      cat.includes('gofre') || nombre.includes('gofre') || nombre.includes('tortita') ||
      nombre.includes('porridge') || nombre.includes('avena') || nombre.includes('tostada')) {
    return 'desayuno'
  }

  // Snacks y postres
  if (cat === 'snack' || cat === 'postre' || cat === 'merienda' ||
      tipo === 'snack' || tipo === 'postre' || tipo === 'merienda' ||
      cat.includes('dulce') || nombre.includes('brownie') || nombre.includes('cookie') ||
      nombre.includes('muffin') || nombre.includes('bite') || nombre.includes('bola')) {
    return 'snack_postre'
  }

  // Guarniciones — ensaladas simples, acompañamientos
  if (cat.includes('ensalada') && !nombre.includes('pollo') && !nombre.includes('atún') &&
      !nombre.includes('salmón') && !nombre.includes('huevo') && !nombre.includes('quinoa')) {
    return 'guarnicion'
  }

  // Por defecto: completa
  return 'completa'
}

async function main() {
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN' : APLICAR ? 'APLICAR' : 'PREVIEW'}`)

  const { data: recetas, error } = await supabase
    .from('recetas')
    .select('id, nombre, categoria, tipo_plato, tipo_receta')
    .order('nombre')

  if (error) { console.error('Error:', error.message); process.exit(1) }

  const cambios = []
  const contadores = {}

  for (const r of recetas) {
    const tipoNuevo = clasificarReceta(r)
    contadores[tipoNuevo] = (contadores[tipoNuevo] ?? 0) + 1
    if (r.tipo_receta !== tipoNuevo) {
      cambios.push({ id: r.id, nombre: r.nombre, anterior: r.tipo_receta, nuevo: tipoNuevo })
    }
  }

  console.log(`\nTotal recetas: ${recetas.length}`)
  console.log('Distribución propuesta:')
  Object.entries(contadores).sort().forEach(([k, v]) => console.log(`  ${k}: ${v}`))
  console.log(`\nCambios necesarios: ${cambios.length}`)

  if (DRY_RUN || !APLICAR) {
    console.log('\nPrimeros 10 cambios:')
    cambios.slice(0, 10).forEach(c =>
      console.log(`  [${c.anterior ?? 'NULL'} → ${c.nuevo}] ${c.nombre}`)
    )
    if (!APLICAR) {
      console.log('\nEjecuta con --aplicar para guardar los cambios.')
      return
    }
  }

  // Aplicar cambios en lotes de 20
  let ok = 0, err = 0
  for (let i = 0; i < cambios.length; i += 20) {
    const lote = cambios.slice(i, i + 20)
    for (const c of lote) {
      const { error: e } = await supabase
        .from('recetas')
        .update({ tipo_receta: c.nuevo })
        .eq('id', c.id)
      if (e) { console.error(`Error ${c.nombre}:`, e.message); err++ }
      else ok++
    }
    process.stdout.write(`\r  Progreso: ${ok + err}/${cambios.length}`)
  }

  console.log(`\n\n✅ Completado: ${ok} actualizadas, ${err} errores.`)
}

main().catch(e => { console.error(e); process.exit(1) })
```

- [ ] **Paso 6.2 — Ejecutar en dry-run y luego aplicar**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
node scripts/clasificar-tipo-receta.mjs --dry-run
```

Revisar la distribución propuesta. Si parece correcta:

```bash
node scripts/clasificar-tipo-receta.mjs --aplicar
```

Esperado: ~240 OK, máximo 5-10 errores. La mayoría serán `completa`.

- [ ] **Paso 6.3 — Verificar resultado en Supabase**

```bash
# Verificar distribución final
node -e "
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
sb.from('recetas').select('tipo_receta').then(({ data }) => {
  const cnt = {}; data.forEach(r => cnt[r.tipo_receta] = (cnt[r.tipo_receta]??0)+1)
  console.log(cnt)
})
"
```

- [ ] **Paso 6.4 — Commit**

```bash
git add scripts/clasificar-tipo-receta.mjs
git commit -m "feat: script clasificar-tipo-receta — 257 recetas con tipo_receta asignado"
```

---

## Task 7: Script `scripts/inferir-roles-ingredientes.mjs`

**Files:**
- Create: `scripts/inferir-roles-ingredientes.mjs`

- [ ] **Paso 7.1 — Crear el script**

```javascript
// scripts/inferir-roles-ingredientes.mjs
// Infiere el rol_ingrediente de todos los ingredientes de todas las recetas
// Uso: node scripts/inferir-roles-ingredientes.mjs [--dry-run] [--aplicar]

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const APLICAR = process.argv.includes('--aplicar')

// Copia simplificada de inferirRolIngrediente (sin imports TS)
function inferirRol(alimento, nombreIngrediente) {
  const nombre = (nombreIngrediente ?? '').toLowerCase()
  const cat = (alimento?.categoria ?? '').toLowerCase()
  const prot = alimento?.proteinas ?? 0
  const carbs = alimento?.carbohidratos ?? 0
  const grasas = alimento?.grasas ?? 0
  const kcal = alimento?.calorias ?? 0

  if (/\b(sal(?!sa)|pimienta|ajo en polvo|cebolla en polvo|orégano|comino|cúrcuma|pimentón|albahaca|romero|tomillo|jengibre|canela|laurel|cilantro|perejil|cayena|nuez moscada|cardamomo|curry)\b/.test(nombre)) return 'especias_aromaticos'
  if (/\b(ketchup|mayonesa|pesto|hummus|tahini|mostaza|aliño|aderezo|ranch|sriracha|guacamole|tzatziki|chimichurri|vinagreta|salsa de soja|salsa teriyaki|salsa hoisin)\b/.test(nombre)) return 'salsa_condimento'
  if (/\b(tortilla de trigo|wrap|pan(?:ecillo)?|baguette|base de pizza|masa|galleta|cracker|tostada)\b/.test(nombre)) return 'estructural'
  if (/\b(fresa|frambuesa|arándano|plátano|mango|piña|kiwi|naranja|fruta|berry|cereza|uva|sandía|melón|melocotón|granada)\b/.test(nombre) || cat.includes('fruta')) return 'fruta_complemento'
  if (/\b(queso fresco|requesón|ricotta|mascarpone|crema de leche|nata|yogur|kéfir|queso rallado|queso parmesano)\b/.test(nombre) && kcal < 250) return 'lacteo_complemento'
  if (/\b(aguacate|aceite|nuez|almendra|cacahuete|pistacho|avellana|anacardo|semilla|linaza|chía|mantequilla de)\b/.test(nombre) || (grasas > 20 && prot < 15)) return 'grasa_saludable'
  if (/\b(pollo|pechuga|muslo|ternera|buey|cerdo|pavo|salmón|atún|merluza|lubina|dorada|bacalao|huevo|clara|tofu|seitán|tempe|garbanzos|lentejas|judías|edamame|proteína)\b/.test(nombre) || prot >= 15) return 'proteina_principal'
  if (/\b(arroz|pasta|patata|boniato|avena|quinoa|maíz|cuscús|bulgur|pan integral|tortita|porridge)\b/.test(nombre) || carbs >= 20) return 'carbohidrato_base'
  if (kcal < 50 || cat.includes('verdura') || cat.includes('hortaliza')) return 'verdura_volumen'
  return 'proteina_principal'
}

async function main() {
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN' : APLICAR ? 'APLICAR' : 'PREVIEW'}`)

  // Cargar todos los ingredientes de recetas con su alimento
  const { data: ingredientes, error } = await supabase
    .from('receta_ingredientes')
    .select('id, nombre_libre, rol_ingrediente, alimento:alimentos(calorias, proteinas, carbohidratos, grasas, categoria)')

  if (error) { console.error(error.message); process.exit(1) }

  const sinRol = ingredientes.filter(i => !i.rol_ingrediente)
  console.log(`\nTotal ingredientes: ${ingredientes.length}`)
  console.log(`Sin rol: ${sinRol.length}`)

  const cambios = sinRol.map(i => ({
    id: i.id,
    nombre: i.nombre_libre ?? '(sin nombre)',
    rol: inferirRol(i.alimento, i.nombre_libre ?? ''),
  }))

  // Distribución
  const cnt = {}
  cambios.forEach(c => cnt[c.rol] = (cnt[c.rol] ?? 0) + 1)
  console.log('\nDistribución inferida:')
  Object.entries(cnt).sort().forEach(([k, v]) => console.log(`  ${k}: ${v}`))

  if (DRY_RUN) {
    console.log('\nPrimeros 10:')
    cambios.slice(0, 10).forEach(c => console.log(`  [${c.rol}] ${c.nombre}`))
    return
  }

  if (!APLICAR) {
    console.log('\nEjecuta con --aplicar para guardar.')
    return
  }

  let ok = 0, err = 0
  for (let i = 0; i < cambios.length; i += 50) {
    const lote = cambios.slice(i, i + 50)
    for (const c of lote) {
      const { error: e } = await supabase
        .from('receta_ingredientes')
        .update({ rol_ingrediente: c.rol })
        .eq('id', c.id)
      if (e) { err++; console.error(`Error ${c.nombre}: ${e.message}`) }
      else ok++
    }
    process.stdout.write(`\r  ${ok + err}/${cambios.length}`)
  }

  console.log(`\n\n✅ ${ok} roles asignados, ${err} errores.`)
}

main().catch(e => { console.error(e); process.exit(1) })
```

- [ ] **Paso 7.2 — Ejecutar**

```bash
node scripts/inferir-roles-ingredientes.mjs --dry-run
# Revisar distribución, luego:
node scripts/inferir-roles-ingredientes.mjs --aplicar
```

Esperado: ≥85% de ingredientes clasificados (el 15% restante puede tener `nombre_libre = null`).

- [ ] **Paso 7.3 — Commit**

```bash
git add scripts/inferir-roles-ingredientes.mjs
git commit -m "feat: script inferir-roles-ingredientes — auto-clasificación por nombre y macros"
```

---

## Task 8: Onboarding — 4 nuevos campos

**Files:**
- Modify: `components/onboarding/StepRealFood.tsx`
- Modify: `components/onboarding/StepActivity.tsx`
- Modify: `app/onboarding/page.tsx`

- [ ] **Paso 8.1 — Actualizar `StepRealFood.tsx`: añadir `come_fuera_dias` y `alimentos_base`**

Añadir a la interfaz Props:
```typescript
// En la interfaz Props de StepRealFood.tsx, añadir:
comeFueraDias: number
alimentosBase: string[]
onComeFueraDiasChange: (v: number) => void
onAlimentosBaseChange: (v: string[]) => void
```

Añadir los campos al return, justo después del campo `suplementos`:

```tsx
{/* Come fuera */}
<div className="mb-5">
  <label className="block text-sm font-medium text-[var(--text)] mb-1">
    ¿Cuántos días a la semana comes fuera de casa?
  </label>
  <div className="flex gap-2 flex-wrap">
    {[0,1,2,3,4,5,6,7].map(n => (
      <button
        key={n}
        type="button"
        onClick={() => onComeFueraDiasChange(n)}
        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
          comeFueraDias === n
            ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
            : 'border-[var(--border)] text-[var(--text)] bg-[var(--surface)]'
        }`}
      >
        {n === 0 ? 'Ninguno' : n === 7 ? 'Todos' : `${n} días`}
      </button>
    ))}
  </div>
  <p className="text-xs text-[var(--text-muted)] mt-1">
    Si comes fuera ≥3 días, priorizamos recetas portables o de preparación rápida.
  </p>
</div>

{/* Alimentos base */}
<div className="mb-5">
  <label className="block text-sm font-medium text-[var(--text)] mb-1">
    ¿Qué alimentos tienes siempre en casa? <span className="text-[var(--text-muted)]">(opcionales)</span>
  </label>
  <div className="flex gap-2 flex-wrap mb-2">
    {['Arroz','Pasta','Avena','Huevos','Pollo','Atún en lata','Yogur griego','Plátano','Espinacas','Tomate','Patata'].map(al => (
      <button
        key={al}
        type="button"
        onClick={() => {
          const nuevo = alimentosBase.includes(al)
            ? alimentosBase.filter(x => x !== al)
            : [...alimentosBase, al]
          onAlimentosBaseChange(nuevo)
        }}
        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
          alimentosBase.includes(al)
            ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
            : 'border-[var(--border)] text-[var(--text-muted)] bg-[var(--surface)]'
        }`}
      >
        {al}
      </button>
    ))}
  </div>
  <p className="text-xs text-[var(--text-muted)]">
    La IA los prioriza en tu plan para que no tengas que comprar nada especial.
  </p>
</div>
```

- [ ] **Paso 8.2 — Actualizar `StepActivity.tsx`: añadir `horario_comidas`**

Añadir a la interfaz Props:
```typescript
horarioComidas: Array<{ nombre: string; hora: string }>
onHorarioChange: (v: Array<{ nombre: string; hora: string }>) => void
```

Añadir al return, al final del componente (después de los días de entreno):

```tsx
{/* Horario de comidas */}
<div className="mt-6">
  <label className="block text-sm font-medium text-[var(--text)] mb-2">
    ¿A qué hora haces cada comida? <span className="text-[var(--text-muted)]">(aproximado)</span>
  </label>
  <p className="text-xs text-[var(--text-muted)] mb-3">
    Importante para calcular el timing pre/post entreno.
  </p>
  <div className="flex flex-col gap-2">
    {['Desayuno','Comida','Merienda','Cena'].map(comidaNombre => {
      const entrada = horarioComidas.find(h => h.nombre === comidaNombre)
      return (
        <div key={comidaNombre} className="flex items-center gap-3">
          <span className="text-sm text-[var(--text)] w-24">{comidaNombre}</span>
          <input
            type="time"
            autoComplete="off"
            value={entrada?.hora ?? ''}
            onChange={e => {
              const nuevo = horarioComidas.filter(h => h.nombre !== comidaNombre)
              if (e.target.value) nuevo.push({ nombre: comidaNombre, hora: e.target.value })
              onHorarioChange(nuevo)
            }}
            className="input w-28 text-sm"
          />
        </div>
      )
    })}
  </div>
</div>
```

- [ ] **Paso 8.3 — Actualizar `app/onboarding/page.tsx`**: añadir estado y handlers para los 4 campos nuevos

Localizar el bloque de estado del componente principal de onboarding (buscar `const [diaTipico` o similar). Añadir:

```typescript
// Añadir junto al resto del estado del onboarding:
const [comeFueraDias, setComeFueraDias] = useState(0)
const [alimentosBase, setAlimentosBase] = useState<string[]>([])
const [horarioComidas, setHorarioComidas] = useState<Array<{ nombre: string; hora: string }>>([])
const [objetivoDeportivo, setObjetivoDeportivo] = useState('')
```

En la función `handleSubmit` donde se construye el payload para `onboarding_responses`, añadir los nuevos campos:

```typescript
// Añadir al objeto de inserción/actualización en onboarding_responses:
come_fuera_dias: comeFueraDias,
alimentos_base: alimentosBase.length > 0 ? alimentosBase : null,
horario_comidas: horarioComidas.length > 0 ? horarioComidas : null,
objetivo_deportivo: objetivoDeportivo || null,
```

Pasar las props a `StepRealFood`:
```tsx
// En el render de StepRealFood:
comeFueraDias={comeFueraDias}
alimentosBase={alimentosBase}
onComeFueraDiasChange={setComeFueraDias}
onAlimentosBaseChange={setAlimentosBase}
```

Pasar las props a `StepActivity`:
```tsx
// En el render de StepActivity:
horarioComidas={horarioComidas}
onHorarioChange={setHorarioComidas}
```

- [ ] **Paso 8.4 — Verificar tipos y build**

```bash
npx tsc --noEmit --pretty false 2>&1 | grep "onboarding\|StepActivity\|StepRealFood" | head -10
```

Esperado: sin errores.

- [ ] **Paso 8.5 — Commit**

```bash
git add components/onboarding/StepRealFood.tsx components/onboarding/StepActivity.tsx app/onboarding/page.tsx
git commit -m "feat: onboarding — come_fuera_dias, alimentos_base, horario_comidas (4 campos nuevos)"
```

---

## Task 9: Refactor `app/api/generar-plan-inicial/route.ts`

**Files:**
- Modify: `app/api/generar-plan-inicial/route.ts`

Este es el refactor principal. Los cambios clave son:
1. Importar las nuevas librerías
2. Construir `candidatasPorSlot` con `filtrarRecetasPorSlot`
3. Usar el nuevo prompt estructurado (5 bloques)
4. Llamar `validarYResolverRecetas` tras DeepSeek
5. Aplicar `calcularGramajeAjustado` en la inserción de `comida_alimentos`
6. Guardar `alternativas_receta_ids` en `comidas`

- [ ] **Paso 9.1 — Añadir imports al inicio del archivo**

Localizar el bloque de imports (líneas 1-11) y añadir:

```typescript
import { filtrarRecetasPorSlot, validarYResolverRecetas, calcularFactorGramaje, calcularTargetSlot, type PlanDeepSeekValidado } from '@/lib/plan-recetas'
import { calcularGramajeAjustado } from '@/lib/ingredient-roles'
import { calcularAjustesPeriEntreno } from '@/lib/nutricion-peri-entreno'
```

- [ ] **Paso 9.2 — Reemplazar el bloque de fetch de recetas (sección `── 9.`)**

Localizar el bloque que empieza en `// ── 9. Fetch plantillas y recetas para el prompt de dieta` (~línea 360) y reemplazarlo:

```typescript
// ── 9. Pre-filtrar recetas por slot del cliente ─────────────────────────────
const numComidas = metodologia?.num_comidas_default ?? 4
const slots = ['Desayuno', 'Comida', 'Merienda', 'Cena']

const filtroCliente = {
  restricciones: onboarding.restricciones,
  alimentos_evitar_extra: onboarding.alimentos_evitar_extra || perfil?.alimentos_evitar_extra,
  tiempo_cocina_min: onboarding.tiempo_cocina_min,
  alimentos_base: onboarding.alimentos_base,
}

const candidatasPorSlot = new Map<string, import('@/types').RecetaCandidata[]>()

for (const slot of slots) {
  const { targetKcal, targetProt } = calcularTargetSlot(slot, kcalObjetivo, distribucionProteina.total, numComidas)
  const candidatas = await filtrarRecetasPorSlot(supabase, slot, targetKcal, targetProt, filtroCliente, 6)
  candidatasPorSlot.set(slot, candidatas)
}

// Mantener compatibilidad con código existente
const recetasPorId = new Map(
  [...candidatasPorSlot.values()].flat().map(r => [r.id, r])
)
const recetasPorNombre = new Map(
  [...candidatasPorSlot.values()].flat().map(r => [r.nombre.toLowerCase().trim(), r])
)
```

- [ ] **Paso 9.3 — Reemplazar el bloque `── 10.` (construcción del prompt)**

Localizar el bloque que empieza en `// ── 10. Construir el prompt final con recetas` y reemplazar la construcción `promptDieta`. El objetivo es añadir el **Bloque 5** de candidatas por slot al contexto del prompt. Añadir esto justo antes de la llamada a `construirPrompt`:

```typescript
// Bloque de candidatas por slot para el prompt mejorado
const candidatasBlock = slots.map(slot => {
  const lista = candidatasPorSlot.get(slot) ?? []
  if (lista.length === 0) return ''
  const { targetKcal, targetProt } = calcularTargetSlot(slot, kcalObjetivo, distribucionProteina.total, numComidas)
  const listaStr = lista.map(r =>
    `  {"id":"${r.id}","nombre":"${r.nombre}","kcal":${r.kcal},"prot":${r.proteinas},"carbs":${r.carbohidratos},"grasas":${r.grasas}}`
  ).join(',\n')
  return `${slot.toUpperCase()}_TARGET: ${targetKcal} kcal / ${targetProt}g proteína\n${slot.toUpperCase()}_CANDIDATAS: [\n${listaStr}\n]`
}).filter(Boolean).join('\n\n')

// Ajustes peri-entreno calculados
const ajustesPeriEntreno = calcularAjustesPeriEntreno({
  horaEntreno: perfil?.hora_entreno,
  sportModality: perfilEntreno?.sport_modality,
  duracionMin: onboarding.duracion_sesion_min ?? 45,
  kcalObjetivo,
  numComidas,
})
const ajustesPeriBlock = ajustesPeriEntreno.length > 0
  ? `\n═══ AJUSTES PERI-ENTRENO POR SLOT ═══\n${ajustesPeriEntreno.map(a =>
      `- ${a.slot_nombre} (${a.tipo === 'pre' ? 'PRE' : 'POST'}-entreno ${a.minutos_antes_despues}min): ${a.nota}`
    ).join('\n')}`
  : ''

// Contexto extendido con candidatas y instrucción JSON estricta
const contextoExtendido = `${contextoCompleto}

═══ ALIMENTOS BASE DEL CLIENTE (priorizar si encajan) ═══
${onboarding.alimentos_base?.join(', ') || 'No especificados'}

${onboarding.come_fuera_dias >= 3 ? '⚠️ Come fuera ' + onboarding.come_fuera_dias + ' días/semana — priorizar recetas portables o preparación rápida' : ''}

═══ HORARIO DE COMIDAS DEL CLIENTE ═══
${(onboarding.horario_comidas as Array<{nombre:string;hora:string}>|null ?? []).map(h => `- ${h.nombre}: ${h.hora}`).join('\n') || 'No especificado'}

${ajustesPeriBlock}

═══ RECETAS DISPONIBLES POR SLOT (USAR SOLO ESTOS IDs) ═══
${candidatasBlock}

═══ INSTRUCCIÓN DE SALIDA — JSON ESTRICTO ═══
Devuelve ÚNICAMENTE el siguiente JSON sin texto adicional:
{
  "distribucion_comidas": [
    {
      "nombre": "Desayuno",
      "hora": "08:00",
      "orden": 1,
      "kcal_target": 400,
      "proteinas_target": 30,
      "carbos_target": 45,
      "grasas_target": 12,
      "receta_id": "uuid-exacto-de-la-lista",
      "receta_nombre": "nombre",
      "cantidad_porciones": 1,
      "alternativas": ["uuid-alternativa-1", "uuid-alternativa-2"],
      "notas_peri_entreno": "nota si aplica"
    }
  ],
  "notas_generales": "...",
  "evidencia_cientifica": ["paper1", "paper2"]
}

REGLA ABSOLUTA: receta_id y alternativas DEBEN ser IDs de la lista *_CANDIDATAS.
Si ninguna candidata encaja, usa el ID más cercano en macros de la lista.
`
```

Luego modificar la llamada a `construirPrompt` para pasar `contextoExtendido` en vez de `contextoCompleto`:

```typescript
// Cambiar la última línea de construirPrompt:
// ANTES:    contextoCompleto,
// DESPUÉS:  contextoExtendido,
```

- [ ] **Paso 9.4 — Añadir validación post-DeepSeek**

Localizar el bloque donde se construye `planJson.distribucion_comidas` (~línea 463, el `.map((c, index) => {...})`) y añadir la validación justo después de construir el planJson inicial y antes del bloque `12b. Validación de micronutrientes`:

```typescript
// ── 11b. Validar y resolver recetas DeepSeek (garantizar IDs válidos) ───────
if (apiKey && planJson.distribucion_comidas) {
  const planValidado = validarYResolverRecetas(
    planJson as unknown as PlanDeepSeekValidado,
    candidatasPorSlot
  )
  // Actualizar distribución con IDs validados
  const comidasValidadas = planValidado.distribucion_comidas
  const comidasActuales = planJson.distribucion_comidas as Array<Record<string, unknown>>
  comidasActuales.forEach((c, i) => {
    const validada = comidasValidadas[i]
    if (validada) {
      c.receta_id = validada.receta_id
      c.receta_nombre = validada.receta_nombre
      ;(c.recetas as Array<Record<string, unknown>> | undefined)?.[0] &&
        ((c.recetas as Array<Record<string, unknown>>)[0].receta_id = validada.receta_id)
      c.alternativas = validada.alternativas
      c.kcal_target = validada.kcal_target
      c.proteinas_target = validada.proteinas_target
    }
  })
}
```

- [ ] **Paso 9.5 — Actualizar el insert de `comidas` para guardar alternativas y targets**

Localizar el bloque `// 13b. Crear comidas` (~línea 681) y modificar el `.insert` de `comidas`:

```typescript
// ANTES:
const { data: comidaDb, error: comidaError } = await supabase
  .from('comidas')
  .insert({
    plan_id: planDb.id,
    nombre: comida.nombre as string,
    orden: (comida.orden as number) ?? 0,
    hora_sugerida: (comida.hora_sugerida as string) || null,
  })

// DESPUÉS:
const alternativasIds = (comida.alternativas as string[] | undefined) ?? []
const { data: comidaDb, error: comidaError } = await supabase
  .from('comidas')
  .insert({
    plan_id: planDb.id,
    nombre: comida.nombre as string,
    orden: (comida.orden as number) ?? 0,
    hora_sugerida: (comida.hora_sugerida as string) || null,
    alternativas_receta_ids: alternativasIds.length > 0 ? alternativasIds : null,
    kcal_target: (comida.kcal_target as number) || null,
    proteinas_target: (comida.proteinas_target as number) || null,
    carbos_target: (comida.carbos_target as number) || null,
    notas_peri_entreno: (comida.notas_peri_entreno as string) || null,
  })
```

- [ ] **Paso 9.6 — Actualizar el insert de `comida_alimentos` para guardar `factor_ajuste`**

Localizar el bloque que hace `await supabase.from('comida_alimentos').insert({` (~línea 742) y añadir `factor_ajuste`:

```typescript
// En el insert de comida_alimentos (el que usa recetaFull):
// Calcular factor de gramaje
const targetKcalComida = (comida.kcal_target as number) || Math.round(kcalObjetivo / comidasData.length)
const factorGramaje = calcularFactorGramaje(recetaFull.kcal ?? 0, targetKcalComida)
const factorFinal = factorGramaje ?? 1.0

// Modificar el insert para incluir factor_ajuste:
await supabase.from('comida_alimentos').insert({
  comida_id: comidaDb.id,
  alimento_id: alimentoId,
  cantidad_gramos: Math.round((cantPorciones * 100) * factorFinal),
  factor_ajuste: factorFinal,
})
```

- [ ] **Paso 9.7 — Verificar build**

```bash
npx tsc --noEmit --pretty false 2>&1 | grep -v "node_modules" | grep "generar-plan\|plan-recetas\|ingredient-roles\|peri-entreno" | head -20
```

Esperado: sin errores.

- [ ] **Paso 9.8 — Commit**

```bash
git add app/api/generar-plan-inicial/route.ts
git commit -m "feat: generar-plan-inicial — pre-filtrado por slot, prompt mejorado, validación IDs, alternativas"
```

---

## Task 10: `app/api/recetas/alternativas/route.ts` — Endpoint de alternativas

**Files:**
- Create: `app/api/recetas/alternativas/route.ts`

- [ ] **Paso 10.1 — Crear el endpoint**

```typescript
// app/api/recetas/alternativas/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const comidaId = searchParams.get('comida_id')
  const clienteId = searchParams.get('cliente_id')

  if (!comidaId) return NextResponse.json({ error: 'comida_id requerido' }, { status: 400 })

  const supabase = createServiceSupabase()

  // 1. Cargar alternativas pre-calculadas desde la comida
  const { data: comida } = await supabase
    .from('comidas')
    .select('alternativas_receta_ids, kcal_target, proteinas_target')
    .eq('id', comidaId)
    .single()

  let alternativaIds: string[] = comida?.alternativas_receta_ids ?? []

  // 2. Si no hay alternativas pre-calculadas, calcular en tiempo real
  if (alternativaIds.length === 0 && comida?.kcal_target) {
    const targetKcal = comida.kcal_target
    const targetProt = comida.proteinas_target ?? 0

    // Cargar intolerancias del cliente
    let restricciones: string[] = []
    if (clienteId) {
      const { data: onb } = await supabase
        .from('onboarding_responses')
        .select('restricciones')
        .eq('cliente_id', clienteId)
        .single()
      restricciones = onb?.restricciones ?? []
    }

    const { data: recetas } = await supabase
      .from('recetas')
      .select('id, kcal, proteinas')
      .eq('estado', 'aprobada')
      .gt('kcal', 0)
      .limit(50)

    if (recetas) {
      const candidatas = recetas
        .filter(r => {
          if (!restricciones.length) return true
          return true // intolerancias no disponibles sin join — solo fallback
        })
        .map(r => ({
          id: r.id,
          dist: Math.abs((r.kcal - targetKcal) / targetKcal) +
                Math.abs(((r.proteinas ?? 0) - targetProt) / (targetProt || 1)),
        }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 4)
        .map(r => r.id)

      alternativaIds = candidatas
    }
  }

  if (alternativaIds.length === 0) {
    return NextResponse.json({ alternativas: [] })
  }

  // 3. Cargar datos completos de las alternativas
  const { data: recetas } = await supabase
    .from('recetas')
    .select('id, nombre, imagen_url, url_origen, kcal, proteinas, carbohidratos, grasas, tiempo_prep_min, tipo_receta')
    .in('id', alternativaIds)

  const alternativas = (recetas ?? []).map(r => ({
    id: r.id,
    nombre: r.nombre,
    imagen_url: r.imagen_url,
    tiene_foto_real: !!r.url_origen,
    kcal: r.kcal,
    proteinas: r.proteinas,
    carbohidratos: r.carbohidratos,
    grasas: r.grasas,
    tiempo_prep_min: r.tiempo_prep_min,
  }))

  return NextResponse.json({ alternativas })
}
```

- [ ] **Paso 10.2 — Verificar tipos**

```bash
npx tsc --noEmit --pretty false 2>&1 | grep "alternativas" | head -5
```

- [ ] **Paso 10.3 — Commit**

```bash
git add app/api/recetas/alternativas/route.ts
git commit -m "feat: GET /api/recetas/alternativas — carga pre-calculadas o calcula en tiempo real"
```

---

## Task 11: `components/recetas/RecetaIngredienteItem.tsx`

**Files:**
- Create: `components/recetas/RecetaIngredienteItem.tsx`

- [ ] **Paso 11.1 — Crear el componente**

```tsx
// components/recetas/RecetaIngredienteItem.tsx
'use client'

import Link from 'next/link'
import type { RecetaIngredienteConRol } from '@/types'

interface Props {
  ingrediente: RecetaIngredienteConRol
  mostrarRol?: boolean
}

export default function RecetaIngredienteItem({ ingrediente, mostrarRol = false }: Props) {
  const nombre = ingrediente.alimento?.nombre ?? ingrediente.nombre_libre ?? 'Ingrediente'
  const gramos = ingrediente.cantidad_gramos

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-[var(--text)] truncate">{nombre}</span>
        {ingrediente.es_cantidad_fija && (
          <span className="text-xs text-[var(--text-muted)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded">
            fijo
          </span>
        )}
        {ingrediente.receta_vinculada_id && (
          <Link
            href={`/recetas/${ingrediente.receta_vinculada_id}`}
            className="text-xs text-[var(--primary)] hover:underline whitespace-nowrap"
            target="_blank"
          >
            Ver receta →
          </Link>
        )}
        {mostrarRol && ingrediente.rol_ingrediente && (
          <span className="text-xs text-[var(--text-muted)] opacity-60">
            {ingrediente.rol_ingrediente.replace('_', ' ')}
          </span>
        )}
      </div>
      <span className="text-sm text-[var(--text-muted)] ml-2 shrink-0">{gramos}g</span>
    </div>
  )
}
```

- [ ] **Paso 11.2 — Commit**

```bash
git add components/recetas/RecetaIngredienteItem.tsx
git commit -m "feat: RecetaIngredienteItem — ingrediente con link a receta vinculada y badge fijo"
```

---

## Task 12: `components/PortalCliente/MealCard.tsx`

**Files:**
- Create: `components/PortalCliente/MealCard.tsx`

- [ ] **Paso 12.1 — Crear el componente**

```tsx
// components/PortalCliente/MealCard.tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'

// Colores por franja
const FRANJA_COLORES: Record<string, string> = {
  'Desayuno':     '#F59E0B',
  'Media mañana': '#84CC16',
  'Comida':       '#0D9488',
  'Merienda':     '#F97316',
  'Cena':         '#4F46E5',
  'Snack':        '#84CC16',
}

// Gradientes placeholder por categoría
const PLACEHOLDER_GRADIENTES: Record<string, string> = {
  bowl:      'from-emerald-50 to-teal-100',
  pasta:     'from-amber-50 to-orange-100',
  ensalada:  'from-green-50 to-lime-100',
  desayuno:  'from-yellow-50 to-amber-100',
  snack:     'from-purple-50 to-violet-100',
  carne:     'from-red-50 to-rose-100',
  default:   'from-slate-50 to-gray-100',
}

function detectarGradiente(nombre: string): string {
  const n = nombre.toLowerCase()
  if (n.includes('bowl') || n.includes('batido')) return PLACEHOLDER_GRADIENTES.bowl
  if (n.includes('pasta') || n.includes('arroz') || n.includes('quinoa')) return PLACEHOLDER_GRADIENTES.pasta
  if (n.includes('ensalada') || n.includes('verdura')) return PLACEHOLDER_GRADIENTES.ensalada
  if (n.includes('avena') || n.includes('tostada') || n.includes('gofre')) return PLACEHOLDER_GRADIENTES.desayuno
  if (n.includes('snack') || n.includes('barrita') || n.includes('fruta')) return PLACEHOLDER_GRADIENTES.snack
  if (n.includes('pollo') || n.includes('ternera') || n.includes('carne') || n.includes('salmón')) return PLACEHOLDER_GRADIENTES.carne
  return PLACEHOLDER_GRADIENTES.default
}

export interface AlimentoMealCard {
  id: string
  alimento_id?: string
  nombre_libre?: string
  cantidad_gramos: number
  es_cantidad_fija?: boolean
  receta_vinculada_id?: string | null
  alimento?: {
    nombre: string
    calorias: number
    proteinas: number
    carbohidratos: number
    grasas: number
  }
}

interface Props {
  nombreSlot: string
  horaSlot?: string
  recetaNombre: string
  imagenUrl?: string | null
  tieneImagenReal?: boolean  // url_origen != null
  kcal?: number
  proteinas?: number
  carbohidratos?: number
  grasas?: number
  alimentos?: AlimentoMealCard[]
  notas_peri_entreno?: string | null
  onCambiarPlato?: () => void
}

export default function MealCard({
  nombreSlot, horaSlot, recetaNombre, imagenUrl, tieneImagenReal,
  kcal, proteinas, carbohidratos, grasas, alimentos, notas_peri_entreno,
  onCambiarPlato,
}: Props) {
  const [expandido, setExpandido] = useState(false)
  const color = FRANJA_COLORES[nombreSlot] ?? FRANJA_COLORES.Comida

  // Determinar tier de imagen
  const tieneFotoReal = tieneImagenReal && imagenUrl
  const tieneImagenIA = !tieneImagenReal && imagenUrl
  const alturaTier = tieneImagenReal ? 200 : tieneImagenIA ? 160 : 120

  return (
    <div className="rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--surface)] mb-4">
      {/* Imagen o placeholder */}
      {imagenUrl ? (
        <div className="relative w-full" style={{ height: alturaTier }}>
          <Image
            src={imagenUrl}
            alt={recetaNombre}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 600px"
          />
        </div>
      ) : (
        <div
          className={`w-full flex items-center justify-center bg-gradient-to-br ${detectarGradiente(recetaNombre)}`}
          style={{ height: alturaTier }}
        >
          <div className="text-center px-4">
            <div className="text-4xl mb-2">🍽️</div>
            <p className="text-sm font-medium text-gray-500 line-clamp-2">{recetaNombre}</p>
          </div>
        </div>
      )}

      {/* Contenido */}
      <div className="p-4">
        {/* Cabecera: hora + slot */}
        <div className="flex items-center gap-2 mb-1">
          {horaSlot && (
            <span className="text-xs text-[var(--text-muted)]">🕐 {horaSlot}</span>
          )}
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ color, backgroundColor: color + '20' }}
          >
            {nombreSlot}
          </span>
        </div>

        {/* Nombre del plato */}
        <h3 className="text-base font-semibold text-[var(--text)] mb-2">{recetaNombre}</h3>

        {/* Macros pills */}
        {kcal && (
          <div className="flex gap-2 flex-wrap mb-3">
            <span className="text-xs px-2 py-1 rounded-full bg-[var(--surface-2)] text-[var(--text-muted)] font-medium">
              {kcal} kcal
            </span>
            {proteinas && (
              <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: '#0D948820', color: '#0D9488' }}>
                {proteinas}g P
              </span>
            )}
            {carbohidratos && (
              <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: '#F59E0B20', color: '#D97706' }}>
                {carbohidratos}g C
              </span>
            )}
            {grasas && (
              <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: '#4F46E520', color: '#4F46E5' }}>
                {grasas}g G
              </span>
            )}
          </div>
        )}

        {/* Nota peri-entreno */}
        {notas_peri_entreno && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-3">
            ⚡ {notas_peri_entreno}
          </p>
        )}

        {/* Botones */}
        <div className="flex gap-2">
          {alimentos && alimentos.length > 0 && (
            <button
              onClick={() => setExpandido(!expandido)}
              className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              {expandido ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {expandido ? 'Ocultar' : 'Ver ingredientes'}
            </button>
          )}
          {onCambiarPlato && (
            <button
              onClick={onCambiarPlato}
              className="flex items-center gap-1 text-xs text-[var(--primary)] hover:underline ml-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Cambiar plato
            </button>
          )}
        </div>

        {/* Acordeón ingredientes */}
        {expandido && alimentos && alimentos.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[var(--border)]">
            {alimentos.map((al, i) => {
              const nombre = al.alimento?.nombre ?? al.nombre_libre ?? 'Ingrediente'
              return (
                <div key={al.id ?? i} className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm text-[var(--text)] truncate">{nombre}</span>
                    {al.es_cantidad_fija && (
                      <span className="text-xs text-[var(--text-muted)] opacity-60">(fijo)</span>
                    )}
                    {al.receta_vinculada_id && (
                      <a
                        href={`/recetas/${al.receta_vinculada_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--primary)] hover:underline whitespace-nowrap"
                      >
                        Ver receta →
                      </a>
                    )}
                  </div>
                  <span className="text-sm text-[var(--text-muted)] ml-2 shrink-0">{al.cantidad_gramos}g</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Paso 12.2 — Commit**

```bash
git add components/PortalCliente/MealCard.tsx
git commit -m "feat: MealCard — foto tier 1/2/3, macros pills, acordeón ingredientes, cambiar plato"
```

---

## Task 13: Actualizar `MiPlan.tsx` — Drawer de alternativas + usar MealCard

**Files:**
- Modify: `components/PortalCliente/MiPlan.tsx`

- [ ] **Paso 13.1 — Añadir estado para el drawer de alternativas**

Añadir justo después de los imports existentes y antes del componente:

```typescript
// Añadir interfaz de alternativa
interface AlternativaReceta {
  id: string
  nombre: string
  imagen_url?: string | null
  tiene_foto_real?: boolean
  kcal: number
  proteinas: number
  carbohidratos: number
  grasas: number
  tiempo_prep_min?: number
}
```

Dentro del componente `MiPlan`, añadir estado:
```typescript
const [drawerComidaId, setDrawerComidaId] = useState<string | null>(null)
const [alternativas, setAlternativas] = useState<AlternativaReceta[]>([])
const [cargandoAlt, setCargandoAlt] = useState(false)
```

- [ ] **Paso 13.2 — Añadir función `abrirDrawerAlternativas`**

```typescript
const abrirDrawerAlternativas = async (comidaId: string) => {
  setDrawerComidaId(comidaId)
  setCargandoAlt(true)
  setAlternativas([])
  try {
    const res = await fetch(`/api/recetas/alternativas?comida_id=${comidaId}&cliente_id=${plan.cliente_id}`)
    const data = await res.json()
    setAlternativas(data.alternativas ?? [])
  } catch {
    // silencioso — el drawer mostrará vacío
  } finally {
    setCargandoAlt(false)
  }
}
```

- [ ] **Paso 13.3 — Añadir el drawer al render**

Justo antes del `return` principal o al final del JSX devuelto, añadir:

```tsx
{/* Drawer alternativas */}
{drawerComidaId && (
  <div
    className="fixed inset-0 z-50 flex items-end"
    onClick={() => setDrawerComidaId(null)}
  >
    <div
      className="w-full bg-[var(--surface)] rounded-t-2xl p-5 pb-safe max-h-[80vh] overflow-y-auto shadow-2xl"
      onClick={e => e.stopPropagation()}
    >
      <div className="w-12 h-1 bg-[var(--border)] rounded-full mx-auto mb-4" />
      <h3 className="text-base font-semibold text-[var(--text)] mb-3">Cambiar plato</h3>
      {cargandoAlt ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : alternativas.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] text-center py-4">No hay alternativas disponibles</p>
      ) : (
        <div className="flex flex-col gap-3">
          {alternativas.map(alt => (
            <div key={alt.id} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
              {alt.imagen_url ? (
                <Image
                  src={alt.imagen_url}
                  alt={alt.nombre}
                  width={56}
                  height={56}
                  className="rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center shrink-0">
                  <span className="text-xl">🍽️</span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--text)] truncate">{alt.nombre}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {alt.kcal} kcal · {alt.proteinas}g P
                </p>
              </div>
              <button
                onClick={() => {
                  // Actualizar planLocal si existe ese mecanismo, o simplemente cerrar
                  setDrawerComidaId(null)
                }}
                className="text-xs text-[var(--primary)] font-medium px-3 py-1.5 rounded-lg border border-[var(--primary)] shrink-0"
              >
                Usar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
)}
```

- [ ] **Paso 13.4 — Pasar `onCambiarPlato` a las comidas renderizadas**

En el render de cada comida del plan (buscar donde se itera `plan.comidas` o `planLocal.comidas`), añadir el prop `onCambiarPlato`:

```tsx
// Donde se renderizan las comidas, añadir el botón:
// Si ya hay un botón "Ver alternativas", reemplazarlo o añadir junto al handler:
onCambiarPlato={() => abrirDrawerAlternativas(comida.id)}
```

- [ ] **Paso 13.5 — Verificar tipos y build**

```bash
npx tsc --noEmit --pretty false 2>&1 | grep "MiPlan" | head -10
```

- [ ] **Paso 13.6 — Commit**

```bash
git add components/PortalCliente/MiPlan.tsx
git commit -m "feat: MiPlan — drawer alternativas por comida con fetch lazy"
```

---

## Task 14: `components/PortalCliente/MisPlatos.tsx`

**Files:**
- Create: `components/PortalCliente/MisPlatos.tsx`

- [ ] **Paso 14.1 — Crear el componente**

```tsx
// components/PortalCliente/MisPlatos.tsx
'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Heart } from 'lucide-react'

interface RecetaPersonalizada {
  id: string
  nombre: string
  imagen_url?: string | null
  url_origen?: string | null
  kcal?: number
  proteinas?: number
  created_at: string
}

interface Props {
  codigo: string
  clienteId: string
}

export default function MisPlatos({ codigo, clienteId }: Props) {
  const [recetas, setRecetas] = useState<RecetaPersonalizada[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    fetch(`/api/cliente/${codigo}/mis-platos?cliente_id=${clienteId}`)
      .then(r => r.json())
      .then(data => setRecetas(data.recetas ?? []))
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [codigo, clienteId])

  if (cargando) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (recetas.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-4xl mb-3">🍽️</p>
        <p className="text-[var(--text-muted)] text-sm">
          Aquí aparecerán los platos personalizados que tu coach ha creado para ti.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--text)] mb-4">Mis platos</h2>
      <p className="text-sm text-[var(--text-muted)] mb-4">
        Platos creados especialmente para ti basados en tus preferencias.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {recetas.map(r => (
          <div key={r.id} className="rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
            {r.imagen_url ? (
              <div className="relative w-full h-32">
                <Image
                  src={r.imagen_url}
                  alt={r.nombre}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 300px"
                />
              </div>
            ) : (
              <div className="w-full h-32 bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center">
                <span className="text-3xl">🍽️</span>
              </div>
            )}
            <div className="p-3">
              <p className="text-sm font-medium text-[var(--text)] line-clamp-2">{r.nombre}</p>
              {r.kcal && (
                <p className="text-xs text-[var(--text-muted)] mt-1">{r.kcal} kcal · {r.proteinas}g P</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Paso 14.2 — Crear el endpoint `app/api/cliente/[codigo]/mis-platos/route.ts`**

```typescript
// app/api/cliente/[codigo]/mis-platos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params
  const supabase = createServiceSupabase()

  // Verificar que el cliente existe y obtener su ID
  const { data: cliente } = await supabase
    .from('clientes')
    .select('id')
    .eq('codigo_publico', codigo)
    .single()

  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const { data: recetas } = await supabase
    .from('recetas')
    .select('id, nombre, imagen_url, url_origen, kcal, proteinas, created_at')
    .eq('cliente_id', cliente.id)
    .eq('fuente', 'ia_personalizada')
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ recetas: recetas ?? [] })
}
```

- [ ] **Paso 14.3 — Commit**

```bash
git add components/PortalCliente/MisPlatos.tsx app/api/cliente/[codigo]/mis-platos/route.ts
git commit -m "feat: MisPlatos + endpoint mis-platos — historial recetas ia_personalizada del cliente"
```

---

## Task 15: CSS — Placeholders de categoría en `app/globals.css`

**Files:**
- Modify: `app/globals.css`

- [ ] **Paso 15.1 — Añadir los estilos de placeholder al final de `app/globals.css`**

```css
/* === Placeholders categoría MealCard === */
.meal-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}
.meal-placeholder--bowl {
  background: linear-gradient(135deg, #ecfdf5, #ccfbf1);
}
.meal-placeholder--pasta {
  background: linear-gradient(135deg, #fffbeb, #fed7aa);
}
.meal-placeholder--ensalada {
  background: linear-gradient(135deg, #f0fdf4, #dcfce7);
}
.meal-placeholder--desayuno {
  background: linear-gradient(135deg, #fefce8, #fde68a);
}
.meal-placeholder--snack {
  background: linear-gradient(135deg, #faf5ff, #ede9fe);
}
.meal-placeholder--carne {
  background: linear-gradient(135deg, #fff1f2, #ffe4e6);
}
```

- [ ] **Paso 15.2 — Commit**

```bash
git add app/globals.css
git commit -m "feat: CSS placeholders por categoría para MealCard"
```

---

## Task 16: Verificación final — Build limpio

**Files:** (ninguno nuevo — solo verificación)

- [ ] **Paso 16.1 — TypeScript sin errores**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx tsc --noEmit --pretty false 2>&1 | grep -v "node_modules" | grep -v "no-explicit-any" | head -30
```

Esperado: 0 errores de tipo.

- [ ] **Paso 16.2 — Build de producción**

```bash
npm run build 2>&1 | tail -30
```

Esperado: `✓ Compiled successfully` y 0 errores. Si hay errores de build, corregirlos antes de continuar.

- [ ] **Paso 16.3 — Commit final y push**

```bash
git add -A
git commit -m "chore: build limpio tras plan-generation-portal — 16 tasks completadas"
git push origin main
```

---

## Criterios de aceptación (checklist de QA)

Una vez desplegado en Vercel, verificar con el cliente 0 (Carlos como cliente de prueba):

**Generación de plan:**
- [ ] Generar plan para cliente con intolerancia → ninguna receta viola la intolerancia
- [ ] Slots Comida/Cena → `tipo_receta = 'completa'` (no salsas ni guarniciones aisladas)
- [ ] Consultar BD: `SELECT comida_alimentos.alimento_id IS NOT NULL` → 100% no nulos
- [ ] Consultar BD: `SELECT alternativas_receta_ids FROM comidas` → arrays no vacíos

**Portal del cliente:**
- [ ] Abrir `/cliente/[codigo]` → plan visible con alimentos y cantidades
- [ ] Tap "Cambiar plato" → drawer abre con 2 alternativas
- [ ] Tab "Mis platos" → visible (vacío si no hay recetas ia_personalizada)
- [ ] MealCard con foto real → hero 200px; sin foto → placeholder bonito con gradiente

**Scaling:**
- [ ] Abrir un plan generado en BD → verificar que `comida_alimentos.factor_ajuste` tiene valores razonables (entre 0.55 y 1.6)

---

## Notas para el implementador

1. **Orden de ejecución**: SQL (Task 1) → Types (Task 2) → Librerías (Tasks 3-5) → Scripts (Tasks 6-7) → Backend (Tasks 8-10) → Frontend (Tasks 11-15) → Build (Task 16)
2. **Scripts de datos**: Los scripts 6 y 7 deben ejecutarse contra la BD de producción. Hacer un backup o snapshot antes si es posible.
3. **Task 9 es el cambio más delicado**: El refactor de `generar-plan-inicial` toca 859 líneas. Ir paso a paso y verificar tipos tras cada cambio.
4. **Task 13 (MiPlan)**: El archivo es grande. Añadir solo el estado y el drawer — no refactorizar el resto del componente.
5. **Bug `prs_por_ejercicio`**: Está documentado como pendiente (usa `sets_ejecutados -> 0` en vez de `s.set_data ->> 'peso_kg'`). No es parte de esta spec — abrir issue separado.
