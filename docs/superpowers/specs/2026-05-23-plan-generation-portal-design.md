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

### 5. Ajuste de gramajes automático

**Para cada receta asignada a un slot:**

```typescript
function calcularFactorGramaje(
  receta: Receta,
  targetKcal: number
): number {
  const factor = targetKcal / receta.kcal
  // Si el factor es extremo, no escalar — usar segunda opción
  if (factor > 1.6 || factor < 0.55) return 1.0 // señal de usar alternativa
  return Math.round(factor * 100) / 100
}

// Al crear comida_alimentos:
const factorAjuste = calcularFactorGramaje(receta, comida.kcal_target)
for (const ing of receta.receta_ingredientes) {
  await supabase.from('comida_alimentos').insert({
    comida_id: comidaCreada.id,
    alimento_id: ing.alimento_id,
    cantidad_gramos: Math.round(ing.cantidad_gramos * factorAjuste),
    receta_id: receta.id,
    factor_ajuste: factorAjuste,
  })
}
```

**Nueva columna en `comida_alimentos`:** `factor_ajuste float` — para que el portal pueda mostrar "Plan ajustado a tu objetivo" si `factor_ajuste != 1`.

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

## Archivos afectados

| Archivo | Tipo de cambio |
|---|---|
| `app/api/generar-plan-inicial/route.ts` | Refactor principal — contexto, pre-filtrado, validación |
| `app/onboarding/page.tsx` | +4 campos nuevos |
| `components/onboarding/StepRealFood.tsx` | +`come_fuera_dias`, `alimentos_base` |
| `components/onboarding/StepActivity.tsx` | +`horario_comidas` |
| `components/onboarding/StepGoal.tsx` | +`objetivo_deportivo` |
| `lib/nutricion-peri-entreno.ts` | Nueva función `calcularAjustesPeriEntreno()` |
| `app/api/recetas/alternativas/route.ts` | **Nuevo endpoint** |
| `components/PortalCliente/MiPlan.tsx` | Drawer alternativas por comida |
| Migración SQL | 3 ALTER TABLE (onboarding, comidas, comida_alimentos) |

---

## Criterios de aceptación

- [ ] Un plan generado para un cliente con intolerancias no contiene ninguna receta que las vulnere
- [ ] Todas las `comida_alimentos` insertadas tienen `alimento_id != NULL`
- [ ] El portal del cliente muestra el plan con alimentos y cantidades tras aprobar
- [ ] Cada comida muestra al menos 2 alternativas macroequivalentes (±20% kcal, ±25% proteína)
- [ ] Para un cliente deportista con `hora_entreno` definida, el slot previo refleja el ajuste peri-entreno en notas
- [ ] Para un cliente en fase `tapering`, el plan no reduce carbohidratos (alert si lo intenta)
- [ ] `npm run build` sin errores tras todos los cambios
