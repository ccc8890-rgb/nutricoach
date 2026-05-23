# Recetario Inteligente — Capa 1: Infraestructura + Filtrado Profesional

**Fecha:** 2026-05-23  
**Estado:** Aprobado por Carlos

---

## Contexto y motivación

El sistema actual de generación de planes usa `filtrarRecetasPorSlot` en `lib/plan-recetas.ts` que solo filtra por categoría, tipo_plato, intolerancias y tiempo_prep. Ignora completamente:

- `score_calidad` (calculado por `lib/recetas/profesional.ts`, ya en BD pero no usado)
- `apta_cliente` / `tipo_uso` / `contexto_uso` (campos ya calculados)
- Recetas usadas recientemente por el mismo cliente (no hay historial)
- Preferencias explícitas o implícitas del cliente

El resultado: el plan IA asigna recetas aleatoriamente dentro del rango de macros, sin considerar calidad ni adecuación al cliente.

---

## Objetivo de Capa 1

Construir la **infraestructura mínima** que convierte el recetario en un sistema de recomendación:

1. Registrar qué receta se asignó a cada comida en el plan
2. Registrar interacciones básicas (like, dislike, swap)
3. Ordenar las recetas por score de relevancia en vez de random
4. Excluir recetas usadas en las últimas 2 semanas para el mismo cliente

No se construye UI de discovery ni algoritmo TikTok — eso es Capa 2+. Capa 1 es solo infraestructura + señal de calidad en la generación.

---

## Visión a largo plazo (Capas 2-4, roadmap futuro)

### Capa 2 — Portal de interacción del cliente
- Botones 👍/👎 por receta en `MiPlan.tsx`
- Lista de favoritos del cliente
- "Discovery queue": 3 recetas nuevas/semana desbloqueadas según perfil
- `receta_interacciones_cliente` como fuente de verdad

### Capa 3 — Motor TikTok-like
- `perfil_gustos_cliente`: vector de preferencias por categoría, textura, tiempo_prep, temporada
- Score de afinidad = weighted(interacciones recientes, categorías favoritas, ingredientes repetidos)
- Auto-progresión: recetas se "desbloquean" según score de afinidad supera umbral
- A/B testing por cliente: variante A (más variedad) vs B (más consistencia)

### Capa 4 — Feedback multicanal
- Formulario semanal (2 preguntas): "¿qué receta te gustó más esta semana?" + "¿algo que quieras probar?"
- Chat coach→sistema: coach añade notas de preferencias del cliente
- NLP básico sobre mensajes del check-in para extraer señales de gusto/disgusto
- Auto-actualización del perfil de gustos con decay temporal (señales antiguas pesan menos)

**Principio rector**: Cada capa construye sobre la anterior. Capa 1 crea los datos que Capa 2 consume, que Capa 3 aprende, que Capa 4 enriquece.

---

## Diseño técnico — Capa 1

### 1. Cambios SQL

#### 1a. `comidas.receta_id`
```sql
ALTER TABLE comidas 
  ADD COLUMN IF NOT EXISTS receta_id uuid REFERENCES recetas(id) ON DELETE SET NULL;

COMMENT ON COLUMN comidas.receta_id IS 
  'Receta asignada a esta comida en el plan. NULL si es comida de alimentos sueltos.';
```

#### 1b. Tabla `receta_interacciones_cliente`
```sql
CREATE TABLE receta_interacciones_cliente (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id   uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  receta_id    uuid NOT NULL REFERENCES recetas(id) ON DELETE CASCADE,
  tipo         text NOT NULL CHECK (tipo IN (
                 'asignada_plan',    -- generación IA asignó esta receta
                 'swap_elegida',     -- cliente eligió esta receta como swap
                 'swap_rechazada',   -- cliente rechazó/ignoró esta receta como swap
                 'like',             -- cliente dio 👍
                 'dislike',          -- cliente dio 👎
                 'favorita'          -- cliente añadió a favoritos
               )),
  plan_id      uuid REFERENCES planes_nutricion(id) ON DELETE SET NULL,
  comida_slot  text,                -- 'desayuno', 'comida', 'cena', etc.
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX ON receta_interacciones_cliente(cliente_id, receta_id);
CREATE INDEX ON receta_interacciones_cliente(cliente_id, tipo, created_at DESC);

-- RLS
ALTER TABLE receta_interacciones_cliente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_full" ON receta_interacciones_cliente
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM clientes c
      WHERE c.id = receta_interacciones_cliente.cliente_id
        AND c.coach_id = auth.uid()
    )
  );
```

### 2. `lib/plan-recetas.ts` — `filtrarRecetasPorSlot` v2

**Cambios**:
- Nuevo parámetro `clienteId?: string`
- Filtro duro: `score_calidad >= 70` (o no nulo)
- Filtro duro: excluir recetas con interacción `dislike` del cliente
- Filtro blando: excluir recetas `asignada_plan` en últimas 2 semanas (si hay suficientes alternativas)
- Ordenación por `sort_score`:

```
sort_score = 
  (score_calidad / 100) × 0.40
  + objective_match       × 0.35
  + (1 - euclidean_dist)  × 0.25
```

Donde:
- `score_calidad`: campo BD en `recetas`, rango 0-100
- `objective_match`: 1.0 si `apta_cliente` del objetivo, 0.5 si 'general', 0.0 si no aplica
- `euclidean_dist`: `|kcal-target|/target + |prot-target|/(target||1)` — normalizado 0-1

**Mapeo objetivo → apta_cliente aceptada**:
```ts
const OBJETIVO_APTA: Record<string, string[]> = {
  perder_grasa:   ['perdida_grasa', 'general'],
  ganar_musculo:  ['ganancia_muscular', 'atleta', 'general'],
  rendimiento:    ['atleta', 'ganancia_muscular', 'general'],
  salud_general:  ['general', 'clinica'],
  mantener:       ['mantenimiento', 'general'],
}
```

**Fallback**: si después de filtrar quedan <3 recetas, relajar filtro de recientes. Si quedan <2, ignorar `score_calidad` también.

### 3. `app/api/generar-plan-inicial/route.ts`

- Pasar `clienteId` a `filtrarRecetasPorSlot`
- Al persistir cada comida: guardar `receta_id` en la fila `comidas`
- Después de persistir: insertar fila en `receta_interacciones_cliente` con `tipo='asignada_plan'`

### 4. Script `scripts/batch-audit-profesional.ts`

- Lee recetas con `score_calidad IS NULL AND estado='aprobada'`
- Llama `auditarRecetaProfesional(srv, recetaId)` por cada una
- Progreso en consola: "N/63 auditadas"

---

## Archivos afectados

| Archivo | Acción |
|---------|--------|
| `supabase/migrations/YYYYMMDD_recetario_capa1.sql` | Crear — SQL migration |
| `lib/plan-recetas.ts` | Modificar — `filtrarRecetasPorSlot` v2 |
| `app/api/generar-plan-inicial/route.ts` | Modificar — pasar clienteId + guardar receta_id + log interacción |
| `scripts/batch-audit-profesional.ts` | Crear — auditar 63 recetas sin score |
| `types/index.ts` | Modificar — añadir `RecetaInteraccionCliente` type |

---

## Lo que NO está en Capa 1

- UI de 👍/👎 en portal cliente → Capa 2
- Lista de favoritos → Capa 2
- Discovery queue → Capa 2
- Formularios de feedback → Capa 4
- Perfil de gustos vectorizado → Capa 3

---

## Criterios de éxito

1. Cada `comida` generada por IA tiene `receta_id` no nulo (si hay receta asignada)
2. `receta_interacciones_cliente` recibe fila `asignada_plan` por cada comida con receta
3. Planes generados tienen 0 recetas repetidas para el mismo cliente en últimas 2 semanas
4. Planes generados priorizan recetas con `score_calidad >= 70`
5. 63 recetas sin score auditadas (script batch)

---

## Consideraciones de calidad y estética

El diseño visual del portal cliente debe evolucionar hacia **app top de mercado** con los skills de diseño (`impeccable`, `taste`, `emil`). Aunque Capa 1 no toca la UI del portal, las siguientes entregas deben aplicar:

- **Entrega de dieta diaria**: card tipo feed con foto de la receta, macros pill, tiempo prep, dificultad. Sin listas planas.
- **Vista semanal**: calendario visual tipo Notion calendar, con color por tipo de comida.
- **Plan de entrenamiento**: card por sesión con foto del ejercicio principal, RPE, estimación de tiempo.
- **Microinteracciones**: transiciones suaves al swapear receta, feedback visual inmediato al like.

Estos son requisitos para Capa 2 del recetario y para el sprint estético general del portal.
