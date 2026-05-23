# Spec: Generación de planes personalizada + vinculación portal cliente

**Fecha:** 23-05-2026  
**Estado:** Aprobada  
**Autor:** Carlos Casanova + Claude  
**Tipo:** Feature crítica — Sub-proyecto 1

---

## Problema

El sistema actual genera planes de dieta y entrenamiento que:

1. **Son demasiado genéricos** — el prompt de DeepSeek no usa bien los datos del onboarding (alimentos habituales, horarios, nivel de cocina, timing de entrenos).
2. **No filtran el recetario por el cliente** — las recetas se pasan a DeepSeek sin filtrar por intolerancias ni por rango de macros del slot. DeepSeek puede elegir recetas que no encajan o inventar IDs que no existen.
3. **El portal del cliente muestra nada** — cuando DeepSeek devuelve un `receta_id` inválido o inexistente, `comida_alimentos` se guarda con `alimento_id = NULL`. El portal carga las comidas pero cada una tiene 0 alimentos → pantalla vacía sin error visible.
4. **Sin alternativas por comida** — el cliente no puede sustituir un plato que no le apetece sin romper el plan nutricionalmente.
5. **Sin integración con periodización ni timing de entreno** — los clientes deportistas reciben el mismo tipo de plan que cualquier otro cliente, ignorando cuándo entrenan, qué fase deportiva tienen y qué necesitan antes/después de cada sesión.

---

## Alcance

Este sub-proyecto cubre exclusivamente:

- Fix del pipeline `generar-plan-inicial` → `comida_alimentos` → portal cliente
- Mejora del onboarding para capturar datos que faltan
- Motor de 3 alternativas macroequivalentes por comida
- Integración timing de entreno + periodización en la generación del plan
- Motor de variantes de receta (escala gramajes desde la receta base)

**Fuera de alcance (Sub-proyecto 2):**
- Scraping de nuevas recetas desde portales externos
- Generación masiva de recetas nuevas con IA
- Mejoras visuales del portal (UI/UX)

---

## Diseño

### 1. Onboarding — nuevos campos

**Objetivo:** capturar los datos que faltan para que el plan sea realmente personalizado.

**Campos nuevos** (añadir a los steps existentes, no crear pasos nuevos):

| Campo BD | Step | Tipo | Para qué |
|---|---|---|---|
| `horario_comidas` | StepActivity | `jsonb` — array de `{nombre, hora}` | Calcular timing peri-entreno por slot |
| `come_fuera_dias` | StepRealFood | `int` (0-7) | Priorizar recetas portables si ≥3 días |
| `alimentos_base` | StepRealFood | `text[]` — chips multiselect | Ingredientes siempre disponibles en casa |
| `objetivo_deportivo` | StepGoal (si deportista) | `text` libre | Competición próxima, deporte específico |

**Campos existentes que el prompt no usa del todo:**
- `dia_tipico` → usar íntegro como "alimentación base a mantener/adaptar"
- `alimentos_evitar_extra` → añadir al filtro de recetas (junto a `restricciones`)
- `suplementos` → informar a DeepSeek para no duplicar nutrientes
- `tiempo_cocina_min` → filtrar recetas por `tiempo_prep_min`
- `historial_dieta` (StepDietHistory ya existe pero no se guarda) → guardar y usar

**Migración SQL:**
```sql
ALTER TABLE onboarding_responses 
  ADD COLUMN horario_comidas jsonb,
  ADD COLUMN come_fuera_dias int DEFAULT 0,
  ADD COLUMN alimentos_base text[],
  ADD COLUMN objetivo_deportivo text;

-- historial_dieta ya existe o añadir:
ALTER TABLE onboarding_responses
  ADD COLUMN IF NOT EXISTS historial_dieta text;
```

---

### 2. Pre-filtrado del recetario por slot y cliente

**Objetivo:** DeepSeek solo ve recetas que pueden encajar, filtradas antes de llegar al prompt.

**Algoritmo `filtrarRecetasPorSlot(clienteId, slotNombre, targetKcal, targetProt)`:**

```
1. Cargar restricciones del cliente:
   - onboarding.restricciones (intolerancias)
   - onboarding.alimentos_evitar_extra
   - onboarding.tiempo_cocina_min → filtrar recetas.tiempo_prep_min

2. Filtrar recetario:
   - estado = 'aprobada'
   - kcal > 0
   - NOT intolerancias del cliente ∩ receta.intolerancias
   - tiempo_prep_min <= onboarding.tiempo_cocina_min (si existe)
   - categoria compatible con slot (Desayuno→Desayuno, Comida→Comida/Platos, etc.)

3. Ordenar por distancia euclidiana:
   dist = |kcal - targetKcal| / targetKcal + |proteinas - targetProt| / targetProt

4. Devolver top 6 por slot
```

**Distribución de kcal por slot (porcentajes sobre kcalObjetivo):**

| Slot | % kcal | Notas |
|---|---|---|
| Desayuno | 20-25% | Ajustar si `horario_entreno` es mañana |
| Media mañana | 8-10% | Solo si el cliente tiene ese hábito |
| Comida | 30-35% | Slot principal |
| Merienda | 8-10% | Solo si hay tiempo/hábito |
| Cena | 25-30% | Reducir si entrena por la noche |

---

### 3. Prompt de DeepSeek reescrito

**Estructura del prompt mejorado:**

```
[BLOQUE 1 — Perfil científico]
TDEE, macros objetivo, objetivo, metodología coach, papers relevantes

[BLOQUE 2 — Perfil personal del cliente]
- Día típico: {dia_tipico}
- Comidas favoritas (INCLUIR SIEMPRE): {comidas_favoritas}
- Alimentos base en casa: {alimentos_base}
- Come fuera {come_fuera_dias} días/semana → priorizar recetas portables
- Nivel cocina: {nivel_cocina} | Tiempo: {tiempo_cocina_min} min/día
- Evitar: {restricciones} + {alimentos_evitar_extra}
- Historial: {historial_dieta} → no repetir si tuvo mala experiencia
- Suplementos: {suplementos} → no duplicar nutrientes

[BLOQUE 3 — Timing de entreno]
- Entrena a las {hora_entreno} ({tipo_entreno})
- Slot pre-entreno ({slot_nombre}, {hora_slot}): carga según deporte
  - Runner/Cardio: +carbos rápidos 1-2h antes, bajo en fibra
  - Fuerza/Gym: proteína moderada + carbos 1.5h antes
  - HIIT/CrossFit: carbos simples 45-60min antes
- Slot post-entreno: proteína prioritaria ({g_proteina_post}g), ventana 30-45min

[BLOQUE 4 — Fase deportiva (si aplica)]
- Fase actual: {fase} (base / construcción / pico / tapering / race_day / recuperación)
- Ajuste de macros para esta fase: {ajuste_fase}

[BLOQUE 5 — Recetas disponibles por slot]
Para cada slot, lista de 6 recetas candidatas con id, nombre, kcal, macros:
DESAYUNO_CANDIDATAS: [{id, nombre, kcal, prot, carbs, grasas}, ...]
COMIDA_CANDIDATAS: [...]
CENA_CANDIDATAS: [...]
SNACK_CANDIDATAS: [...]

[INSTRUCCIÓN DE SALIDA — JSON estricto]
Devuelve EXACTAMENTE este JSON (sin texto extra):
{
  "distribucion_comidas": [
    {
      "nombre": "Desayuno",
      "hora": "08:00",
      "kcal_target": 450,
      "proteinas_target": 35,
      "carbos_target": 50,
      "grasas_target": 15,
      "receta_id": "uuid-exacto-de-la-lista",  // OBLIGATORIO usar ID de la lista
      "receta_nombre": "nombre",
      "alternativas": ["uuid-2", "uuid-3"],    // 2 IDs adicionales de la lista
      "notas_peri_entreno": "45min antes del entreno — carbos prioritarios"
    }
  ],
  "notas_generales": "...",
  "evidencia_cientifica": ["paper1", "paper2"]
}

REGLA ABSOLUTA: receta_id y alternativas DEBEN ser IDs de la lista CANDIDATAS.
Si ninguna candidata encaja, usa "plato_libre": true y describe ingredientes.
```

---

### 4. Validación post-respuesta DeepSeek

**Antes de insertar en BD, validar:**

```typescript
function validarYResolverRecetas(
  respuestaDS: PlanDeepSeek,
  candidatasPorSlot: Map<string, Receta[]>
): PlanValidado {
  for (const comida of respuestaDS.distribucion_comidas) {
    const candidatas = candidatasPorSlot.get(comida.nombre) ?? []
    const idsValidos = new Set(candidatas.map(r => r.id))

    // Validar receta principal
    if (!idsValidos.has(comida.receta_id)) {
      // Reemplazar por la receta más cercana en macros
      comida.receta_id = candidatas[0]?.id ?? null
      comida._receta_corregida = true
    }

    // Validar alternativas — filtrar las inválidas, completar hasta 3 si faltan
    comida.alternativas = (comida.alternativas ?? [])
      .filter(id => idsValidos.has(id))
      .filter(id => id !== comida.receta_id)
    
    // Si hay menos de 2 alternativas, añadir las siguientes de la lista
    const usadas = new Set([comida.receta_id, ...comida.alternativas])
    for (const r of candidatas) {
      if (comida.alternativas.length >= 2) break
      if (!usadas.has(r.id)) comida.alternativas.push(r.id)
    }
  }
  return respuestaDS
}
```

---

### 5. Sistema inteligente de ajuste de gramajes

El scaling simplista (×factor en todos los ingredientes) destruye la coherencia de las recetas. Una salsa, un condimento o una especia no se duplica cuando subes la proteína. El sistema clasifica cada ingrediente por su **rol nutricional** y aplica reglas distintas.

#### 5a. Clasificación de ingredientes por rol

Nueva columna `receta_ingredientes.rol_ingrediente`:

```sql
ALTER TABLE receta_ingredientes 
  ADD COLUMN rol_ingrediente text CHECK (rol_ingrediente IN (
    'proteina_principal',   -- pollo, atún, huevo, tofu, legumbre principal
    'carbohidrato_base',    -- arroz, pasta, patata, pan, avena
    'verdura_volumen',      -- lechuga, tomate, pepino, espinacas, pimiento
    'grasa_saludable',      -- aguacate, aceite, frutos secos, queso
    'salsa_condimento',     -- salsa de yogur, pesto, hummus, mayonesa, ketchup
    'especias_aromaticos',  -- sal, pimienta, ajo, hierbas, especias
    'estructural',          -- tortilla de wrap, pan de hamburguesa, base de pizza
    'lacteo_complemento',   -- yogur como acompañamiento, queso rallado encima
    'fruta_complemento'     -- frutas en ensalada, topping de porridge
  ));
```

**Auto-clasificación:** al guardar o editar un ingrediente de receta, un helper `inferirRolIngrediente(alimento)` asigna el rol automáticamente basándose en las macros del alimento (`alimentos.proteinas`, `alimentos.carbohidratos`, `alimentos.grasas`, `alimentos.categoria`). El coach puede corregirlo manualmente desde el editor de receta.

#### 5b. Reglas de scaling por rol

```typescript
const SCALING_RULES: Record<RolIngrediente, (factor: number) => number> = {
  proteina_principal:  (f) => f,                          // escala libre
  carbohidrato_base:   (f) => f,                          // escala libre
  verdura_volumen:     (f) => f,                          // escala libre
  grasa_saludable:     (f) => 1 + (f - 1) * 0.5,         // escala amortiguada
  salsa_condimento:    (f) => Math.min(f, 1.25),          // máx +25%
  especias_aromaticos: (_) => 1.0,                        // fijo siempre
  estructural:         (f) => Math.min(f, 1.15),          // máx +15%
  lacteo_complemento:  (f) => Math.min(f, 1.30),          // máx +30%
  fruta_complemento:   (f) => Math.min(f, 1.20),          // máx +20%
}

function calcularGramajeAjustado(
  ing: RecetaIngrediente,
  factorBase: number
): number {
  const ruleFn = SCALING_RULES[ing.rol_ingrediente ?? 'proteina_principal']
  const factorAplicado = ruleFn(factorBase)
  return Math.round(ing.cantidad_gramos * factorAplicado)
}
```

**Factor base:** `factor = targetKcal / receta.kcal`. Si `factor > 1.6` o `< 0.55` → descartar receta y usar la siguiente candidata. No forzar scaling extremo.

**Recalcular macros reales** tras el ajuste (no usar los macros de la receta base — sumar desde los ingredientes ajustados × macros/100g del alimento).

#### 5b-bis. Ingredientes con cantidad fija y recetas vinculadas

Algunas recetas contienen salsas o condimentos que tienen **su propia receta** en el recetario. Por ejemplo: una burger de pollo lleva "Mayonesa healthy" — esa mayonesa es una receta completa con pasos e ingredientes propios, y además sus gramos son **absolutamente fijos** (15g siempre, independientemente de cómo escale el resto del plato).

**Nuevas columnas en `receta_ingredientes`:**

```sql
ALTER TABLE receta_ingredientes
  ADD COLUMN es_cantidad_fija boolean DEFAULT false,
  ADD COLUMN receta_vinculada_id uuid REFERENCES recetas(id);
```

- `es_cantidad_fija = true` → el scaling ignora este ingrediente completamente. Ni la regla `salsa_condimento` aplica — los gramos son inmutables. Úsase cuando alterar la cantidad rompería la lógica de la receta (una salsa de topping, un aliño específico, una cucharada de tahini).
- `receta_vinculada_id` → este ingrediente tiene su propia receta en el recetario. El portal muestra un enlace "Ver receta →" al lado del ingrediente.

**Prioridad de scaling** (de mayor a menor):
1. `es_cantidad_fija = true` → gramos fijos, sin excepción
2. `rol_ingrediente = 'especias_aromaticos'` → factor 1.0
3. `SCALING_RULES[rol_ingrediente]` → regla por rol
4. Resto → factor base

**`recetas.salsas_recomendadas`** — lista de IDs de salsas del recetario que Carlos recomienda con este plato (sin ser obligatorias). El cliente las ve como "También puedes añadir":

```sql
ALTER TABLE recetas ADD COLUMN salsas_recomendadas uuid[];
```

**Flujo en el portal del cliente para una receta con salsa vinculada:**

```
Mi Plan — Comida
├── Burger de pollo (450 kcal)
│   ├── Pechuga de pollo picada — 180g  [escala con factor]
│   ├── Pan integral — 1 ud (90g)       [estructural — max +15%]
│   ├── Lechuga, tomate — 60g           [verdura — escala]
│   └── Mayonesa healthy — 15g  🔗 Ver receta →   [fijo, vinculado]
│
└── También puedes añadir:
    └── Ketchup de tomate casero 🔗 Ver receta →
```

**Recetario UI:** las recetas con `tipo_receta = 'salsa_base'` aparecen en una sección separada "Salsas & Bases" dentro del recetario, no mezcladas con platos principales. Carlos las gestiona igual que cualquier receta pero están marcadas visualmente como "no es plato completo".

#### 5c. Clasificación de recetas por tipo

Nueva columna `recetas.tipo_receta`:

```sql
ALTER TABLE recetas 
  ADD COLUMN tipo_receta text DEFAULT 'completa' CHECK (tipo_receta IN (
    'completa',      -- plato principal con proteína + carbohidrato/verdura
    'guarnicion',    -- acompañamiento solo (ensalada simple, patatas asadas)
    'salsa_base',    -- salsa, condimento, aliño — NUNCA slot principal
    'snack_postre',  -- snack, postre, merienda ligera
    'bebida',        -- smoothie, batido, infusión
    'desayuno'       -- desayuno específico (porridge, tostadas, tortitas)
  ));
```

**Auto-clasificación:** script `scripts/clasificar-tipo-receta.mjs` que recorre las 257 recetas y asigna `tipo_receta` basándose en `categoria`, `tipo_plato` y composición de ingredientes. Revisión manual para los casos ambiguos.

**Regla de asignación:** el pre-filtrado por slot solo permite:

| Slot | `tipo_receta` permitidos |
|---|---|
| Desayuno | `desayuno`, `completa` |
| Media mañana / Snack | `snack_postre`, `desayuno`, `guarnicion` |
| Comida | `completa` |
| Merienda | `snack_postre`, `desayuno` |
| Cena | `completa`, `guarnicion` (si acompañada de proteína) |

`salsa_base` y `bebida` **nunca** se asignan como plato principal de un slot.

#### 5d. Validación de coherencia de plato completo

Antes de confirmar una receta para slot `Comida` o `Cena`, verificar:

```typescript
function esPlataCompleto(receta: Receta): boolean {
  const roles = receta.receta_ingredientes.map(i => i.rol_ingrediente)
  const tieneProteina = roles.some(r => r === 'proteina_principal')
  const tieneCarbOVerdura = roles.some(r => 
    r === 'carbohidrato_base' || r === 'verdura_volumen'
  )
  const kcalMinimas = receta.kcal >= 200 // evitar "platos" de 80 kcal
  return tieneProteina && tieneCarbOVerdura && kcalMinimas
}
```

Si no pasa → receta marcada como `tipo_receta = 'guarnicion'` automáticamente y excluida de slots principales.

---

### 6. Motor de 3 alternativas en el portal cliente

**En `MiPlan.tsx` — cada comida muestra:**
- Plato principal (receta asignada por DeepSeek, con gramajes ajustados)
- Botón "Cambiar plato" → drawer con 2 alternativas macroequivalentes
- Al elegir alternativa: `comida.receta_id` se actualiza localmente + registro en `feedback_comidas_generadas`

**API nueva: `GET /api/recetas/alternativas?receta_id=X&comida_id=Y&cliente_id=Z`**

```typescript
// Devuelve las 2 alternativas guardadas en planes_nutricion.comidas.alternativas_receta_ids
// Si no hay → calcula en tiempo real por distancia euclidiana filtrando intolerancias
// Devuelve: id, nombre, imagen_url, kcal, proteinas, tiempo_prep_min
```

**Campo nuevo en tabla `comidas`:**
```sql
ALTER TABLE comidas ADD COLUMN alternativas_receta_ids uuid[];
```

---

### 7. Periodización y timing de entreno en el plan

**`lib/nutricion-peri-entreno.ts` ya existe.** Hay que conectarlo al pipeline de generación.

**Nueva función `calcularAjustesPeriEntreno(onboarding, perfil_entreno, fase_deportiva)`:**

```typescript
interface AjustePeriEntreno {
  slot_nombre: string        // "Comida" / "Merienda"
  tipo: 'pre' | 'post'
  minutos_antes_despues: number
  ajuste_carbos_g: number    // +20 / -10
  ajuste_proteina_g: number  // +10 / 0
  nota: string               // "Carga de carbos 1.5h antes — running"
  receta_tipo_preferido: 'carbos_rapidos' | 'proteina_magra' | 'equilibrado'
}
```

**Reglas por deporte y fase (usando `lib/arbol-decision.ts` ya existente):**

| Deporte | Pre-entreno | Post-entreno |
|---|---|---|
| Running/Cardio | Carbos simples, bajo fibra, bajo grasa | Carbos + proteína rápida |
| Fuerza/Gym | Proteína + carbos complejos | Proteína magra prioritaria |
| CrossFit/HIIT | Carbos simples ligeros | Proteína + carbos reposición |
| Ciclismo | Carbos largos + electrolitos | Recuperación carbos+prot |
| Hyrox | Pre-carga carbos 2h antes | Proteína + antiinflamatorios |

**Ajuste por fase deportiva (ya en BD):**

| Fase | Modificación plan |
|---|---|
| base | Plan estándar |
| construcción | +10% carbos días entreno |
| pico | Peri-entreno prioritario, timing estricto |
| tapering | -volumen, misma densidad nutricional, alert si se reduce CHO |
| race_day | Slot 1 = desayuno pre-competición fijo (protocolo específico) |
| recuperación | +proteína, -déficit, omega-3 y polifenoles en recetas |

---

### 8. Flujo completo corregido (end-to-end)

```
Coach abre revisar-plan del cliente
           ↓
1. PREPARACIÓN (paralelo):
   - Cargar onboarding completo (todos los campos)
   - Cargar perfil_entreno_cliente (hora_entreno, tipo, fase_deportiva)
   - Cargar fase_deportiva_cliente (desde competiciones)
   - Para cada slot: filtrarRecetasPorSlot() → top 6 candidatas

2. CÁLCULO MACROS:
   - TDEE + ajuste objetivo + ajuste fase deportiva
   - Distribución por slot (con ajuste peri-entreno si hay hora_entreno)
   - calcularAjustesPeriEntreno() → modificaciones por slot

3. PROMPT DEEPSEEK:
   - Perfil científico + personal + timing entreno + fase
   - Candidatas por slot (max 6 por slot)
   - JSON estricto requerido

4. VALIDACIÓN:
   - validarYResolverRecetas() → IDs válidos garantizados
   - calcularFactorGramaje() por receta
   - Si factor extremo → cambiar a siguiente candidata

5. PERSISTENCIA (ya existente en generar-plan-inicial):
   - planes_nutricion (con codigo_publico y activo=true)
   - comidas (con kcal_target, proteinas_target, hora, alternativas_receta_ids[])
   - comida_alimentos (con cantidad_gramos ajustada, factor_ajuste)

6. PORTAL CLIENTE:
   - GET /api/cliente/[codigo]/dashboard → plan con comidas + alimentos
   - MiPlan.tsx muestra cada comida con plato principal + botón "Cambiar"
   - Alternativas cargadas lazy desde /api/recetas/alternativas
```

---

### 9. Platos IA personalizados — creación, foto y presentación

Cuando DeepSeek no encuentra una receta adecuada en el recetario y crea un plato a medida del cliente, ese plato se trata como una **receta privada** del cliente:

```sql
-- Columnas nuevas en recetas:
ALTER TABLE recetas
  ADD COLUMN cliente_id uuid REFERENCES clientes(id),  -- NULL = pública
  ADD COLUMN fuente text DEFAULT 'manual' CHECK (fuente IN (
    'manual',           -- creada por Carlos
    'scraping',         -- importada de portal web
    'ia_generada',      -- generación masiva (pipeline actual)
    'ia_personalizada'  -- creada por DeepSeek para un cliente concreto
  ));
```

Las recetas `ia_personalizada` con `cliente_id` definido:
- **No aparecen en el recetario público** de Carlos
- **Sí aparecen en el historial de recetas del cliente** en su portal ("Mis platos")
- Se acumulan como preferencias → `feedback_comidas_generadas` registra si el cliente las repitió o no → DeepSeek las prioriza en generaciones futuras

**Estrategia de foto para platos personalizados:**

```
1. Buscar en recetario receta con misma proteina_principal + mismo tipo_plato
   → si imagen_tipo = 'propia' o foto real (url_origen IS NOT NULL)
   → usar esa imagen_url (siempre foto real, nunca IA)

2. Si no hay match con foto real:
   → Placeholder por categoría (diseño bonito, no foto falsa)
   → 6 placeholders base: bowl, pasta, ensalada, desayuno, snack, carne/pescado
   → Fondo degradado suave del color de la categoría + icono + nombre del plato
```

**Nunca generar una imagen IA nueva para un plato personalizado** — el coste y el riesgo estético no lo justifican.

---

### 10. Presentación visual del plan — diseño del portal cliente

**Principio:** el plan diario del cliente debe sentirse como una app de salud premium, no como una hoja de dieta clínica. La foto es protagonista cuando es real; el diseño sostiene cuando no la hay.

#### Vista diaria (tab "Mi Plan")

Cada comida como **MealCard**:

```
┌─────────────────────────────────────────┐
│  [FOTO — ancho completo, 180px alto]    │  ← Tier 1: foto real → hero
│  [o PLACEHOLDER bonito si no hay foto] │  ← Tier 3: degradado + icono
├─────────────────────────────────────────┤
│  🕗 08:30  Desayuno                     │
│  Bowl de avena con frutas del bosque    │  ← nombre en bold
│                                         │
│  [420 kcal] [38g P] [52g C] [12g G]    │  ← pills de color
│                                         │
│  [Ver ingredientes ∨]  [Cambiar plato →]│
└─────────────────────────────────────────┘
```

- Foto real (Tier 1) → `height: 200px`, bordes redondeados arriba
- Foto IA buena (Tier 2) → `height: 160px`, ligeramente más compacta
- Placeholder (Tier 3) → `height: 120px`, degradado `from-emerald-50 to-teal-100`, icono SVG centrado, nombre del plato en tipografía elegante

**"Ver ingredientes"** → acordeón que muestra la lista de ingredientes con gramajes ajustados. Si algún ingrediente tiene `receta_vinculada_id` → aparece como chip clicable "Mayonesa healthy →".

**"Cambiar plato"** → bottom sheet con 2 alternativas en cards horizontales scrollables.

#### Vista semanal (tab "Semana")

Grid 7 días × franjas:
- Cada celda: foto pequeña (48×48px) + nombre truncado
- Celda vacía (sin comida planificada): borde punteado + "+"
- Día con entreno: badge naranja pequeño en la esquina
- Click en celda → expande la MealCard del día

#### Estrategia de color por franja horaria

| Franja | Color acento |
|---|---|
| Desayuno | Ámbar cálido `#F59E0B` |
| Media mañana | Verde lima `#84CC16` |
| Comida | Teal `#0D9488` (color principal de la app) |
| Merienda | Naranja suave `#F97316` |
| Cena | Índigo oscuro `#4F46E5` |

Los pills de macros y la franja horaria usan este color — da identidad visual sin necesitar fotos para cada comida.

#### "Mis platos" — historial de platos personalizados

Sección nueva en el portal: lista de recetas `ia_personalizada` del cliente, ordenadas por frecuencia de uso. El cliente puede marcarlas como favoritas. Carlos las ve en la ficha del cliente como referencia para generaciones futuras.

---

## Archivos afectados

| Archivo | Tipo de cambio |
|---|---|
| `app/api/generar-plan-inicial/route.ts` | Refactor principal — contexto, pre-filtrado, validación |
| `lib/plan-recetas.ts` | **Nuevo** — `filtrarRecetasPorSlot()`, `validarYResolverRecetas()`, `calcularGramajeAjustado()`, `esPlataCompleto()` |
| `lib/ingredient-roles.ts` | **Nuevo** — `inferirRolIngrediente()`, `SCALING_RULES` |
| `app/onboarding/page.tsx` | +4 campos nuevos |
| `components/onboarding/StepRealFood.tsx` | +`come_fuera_dias`, `alimentos_base` |
| `components/onboarding/StepActivity.tsx` | +`horario_comidas` |
| `components/onboarding/StepGoal.tsx` | +`objetivo_deportivo` |
| `lib/nutricion-peri-entreno.ts` | Nueva función `calcularAjustesPeriEntreno()` |
| `app/api/recetas/alternativas/route.ts` | **Nuevo endpoint** |
| `components/PortalCliente/MiPlan.tsx` | Drawer alternativas por comida |
| `scripts/clasificar-tipo-receta.mjs` | **Nuevo** — clasifica las 257 recetas existentes |
| `scripts/inferir-roles-ingredientes.mjs` | **Nuevo** — auto-clasifica ingredientes de todas las recetas |
| `components/recetas/RecetaIngredienteItem.tsx` | **Nuevo** — item con link "Ver receta →" si tiene `receta_vinculada_id` |
| `app/recetas/[id]/page.tsx` | Sección "Salsas recomendadas" si `salsas_recomendadas` no vacío |
| `components/PortalCliente/MealCard.tsx` | **Nuevo** — card de comida con foto tier 1/2/3, macros pills, acordeón ingredientes |
| `components/PortalCliente/PlanSemanal.tsx` | Refactor — grid 7 días con miniaturas y badges entreno |
| `components/PortalCliente/MisPlatos.tsx` | **Nuevo** — historial recetas `ia_personalizada` del cliente |
| `app/globals.css` | Placeholders por categoría (6 degradados base) |
| Migración SQL | ALTER TABLE: `onboarding_responses` (+4 cols), `comidas` (+`alternativas_receta_ids`), `comida_alimentos` (+`factor_ajuste`), `recetas` (+`tipo_receta`, +`salsas_recomendadas`, +`cliente_id`, +`fuente`), `receta_ingredientes` (+`rol_ingrediente`, +`es_cantidad_fija`, +`receta_vinculada_id`) |

---

## Criterios de aceptación

**Calidad del plan:**
- [ ] Un plan generado para un cliente con intolerancias no contiene ninguna receta que las vulnere
- [ ] Todos los slots `Comida` y `Cena` tienen `tipo_receta = 'completa'` — nunca una salsa o guarnición como plato principal
- [ ] Las `especias_aromaticos` (sal, pimienta, ajo) nunca escalan con el factor base
- [ ] Las `salsa_condimento` no superan ×1.25 de su gramaje original
- [ ] Los macros reales del plan (calculados desde ingredientes ajustados) están dentro del ±10% del target del cliente

**Vinculación portal:**
- [ ] Todas las `comida_alimentos` insertadas tienen `alimento_id != NULL`
- [ ] El portal del cliente muestra el plan con alimentos y cantidades tras aprobar
- [ ] Cada comida muestra al menos 2 alternativas macroequivalentes (±20% kcal, ±25% proteína)

**Deportistas:**
- [ ] Para un cliente con `hora_entreno` definida, el slot previo refleja el ajuste peri-entreno en notas
- [ ] Para un cliente en fase `tapering`, el plan no reduce carbohidratos (alert si lo intenta)
- [ ] El tipo de ajuste peri-entreno varía según `tipo_entreno` (running ≠ gym ≠ crossfit)

**Salsas vinculadas:**
- [ ] Un ingrediente con `es_cantidad_fija = true` nunca cambia de gramaje aunque el factor base sea 1.8
- [ ] Un ingrediente con `receta_vinculada_id` muestra un enlace "Ver receta →" en el portal del cliente
- [ ] Las recetas `tipo_receta = 'salsa_base'` aparecen en sección "Salsas & Bases" separada del recetario, no como platos principales
- [ ] `salsas_recomendadas` de una receta aparecen como sugerencias opcionales en la vista del plan del cliente

**Presentación visual:**
- [ ] Un plan con foto real (Tier 1) muestra la imagen a 200px de alto como hero
- [ ] Un plato `ia_personalizada` nunca usa imagen generada por IA — usa foto de receta similar o placeholder de categoría
- [ ] Los 6 placeholders de categoría son visualmente consistentes y reconocibles
- [ ] La vista semanal muestra miniaturas para todos los slots con foto y placeholder bonito si no hay imagen

**Técnico:**
- [ ] `npm run build` sin errores tras todos los cambios
- [ ] Script `clasificar-tipo-receta.mjs` clasifica las 257 recetas sin revisión manual excepto casos ambiguos
- [ ] Script `inferir-roles-ingredientes.mjs` asigna rol a ≥85% de los ingredientes de todas las recetas
