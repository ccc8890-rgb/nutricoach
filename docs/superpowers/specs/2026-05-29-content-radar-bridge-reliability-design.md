# Spec: Content Radar Bridge — Fiabilidad con State Machine + ScrapeGraph AI

**Fecha:** 29-05-2026  
**Área:** Content Radar → NutriCoach pipeline  
**Estado:** Aprobado por Carlos

---

## Problema

El bridge `bridge_nutricoach.py` es un proceso lineal sin memoria. Si falla en el paso 5 de 6 (ej: Cloudinary), los pasos anteriores quedan en producción a medias — receta insertada sin imagen, o ingredientes huérfanos — y no hay notificación ni reintento automático. Carlos solo lo descubre cuando ve la receta mal en la app.

**Pain points confirmados:**
- No idempotencia: un fallo mid-pipeline deja estado sucio en BD
- No reintentos: hay que relanzar manualmente
- Imagen opcional sin marcado: si OpenAI falla, la receta entra sin imagen sin indicarlo
- Matches hardcodeados (`_MATCHES_FORZADOS`): escalan mal, requieren tocar código
- Sin panel de errores: no hay visibilidad de qué falló y cuándo

---

## Solución: State Machine + Pasos Atómicos + ScrapeGraph

### Enfoque elegido

**State machine en BD** (`bridge_jobs`) combinado con lógica atómica pre-INSERT. Los pasos costosos (extracción, macros, imagen) ocurren antes de tocar producción. Solo cuando todo está listo se hace el INSERT. El cron de rescate detecta jobs atascados y los reintenta automáticamente.

---

## Modelo de datos

```sql
CREATE TABLE bridge_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receta_id       UUID REFERENCES recetas(id) ON DELETE SET NULL,
  video_url       TEXT NOT NULL,
  titulo          TEXT,
  estado          TEXT NOT NULL DEFAULT 'pendiente',
  paso_actual     TEXT,
  intentos        INT DEFAULT 0,
  max_intentos    INT DEFAULT 3,
  error_ultimo    TEXT,
  payload_json    JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bridge_jobs_estado ON bridge_jobs(estado);
CREATE INDEX idx_bridge_jobs_updated ON bridge_jobs(updated_at);
```

**Estados posibles:** `pendiente` → `en_proceso` → `completado` | `fallido` | `fallido_definitivo`

**`payload_json`** almacena resultados intermedios por paso para evitar reprocesar lo que ya funcionó:
```json
{
  "ingredientes_raw": [...],
  "ingredientes_matched": [...],
  "macros": {"kcal": 450, "proteinas": 32, ...},
  "imagen_base64": "...",
  "receta_id": "uuid-generado-en-paso-5"
}
```

---

## Pipeline de pasos

```
pendiente
   ↓
[PASO 1] extraer_ingredientes()     → payload: ingredientes_raw[]
   ↓
[PASO 2] match_ingredientes()       → payload: ingredientes_matched[]
   ↓
[PASO 3] calcular_macros()          → payload: {kcal, proteinas, carbos, grasas}
   ↓
[PASO 4] generar_imagen()           → payload: imagen_base64
   ↓
[PASO 5] insertar_receta()          → BD producción: receta + receta_ingredientes
   ↓
[PASO 6] subir_imagen()             → Cloudinary → actualiza receta.imagen_url
   ↓
completado ✓
```

**Regla crítica:** pasos 1-4 son pre-INSERT. Nada toca producción hasta que el paso 5 tiene todos los datos. Si el paso 4 falla 3 veces → `fallido_definitivo`, sin estado sucio en `recetas`.

**Pasos 5-6 separados** para que un fallo de Cloudinary no deje la receta sin `imagen_url` — el job reintenta solo desde el paso 6.

---

## Reintentos automáticos

El cron existente (cada 2h) añade una **fase de rescate** antes de procesar nuevos vídeos:

```python
def fase_rescate():
    # Jobs atascados: en_proceso > 30 min (cuelgue sin excepción)
    jobs_atascados = supabase.table('bridge_jobs')\
        .eq('estado', 'en_proceso')\
        .lt('updated_at', hace_30_min).execute()

    # Jobs fallidos con intentos restantes
    jobs_reintentables = supabase.table('bridge_jobs')\
        .eq('estado', 'fallido')\
        .filter('intentos', 'lt', supabase.raw('max_intentos')).execute()

    for job in jobs_atascados.data + jobs_reintentables.data:
        limpiar_si_necesario(job)
        marcar_pendiente(job)
        ejecutar_desde_paso_actual(job)
```

**Limpieza según paso:**
- Fallo en pasos 1-4 (pre-INSERT): no hay nada que limpiar en producción
- Fallo en paso 6 (post-INSERT): no borrar receta, solo reintentar subida de imagen

**Backoff por intentos:**

| Intento | Comportamiento |
|---------|---------------|
| 1º fallo | Reintenta en siguiente ciclo cron (~2h) |
| 2º fallo | Reintenta tras 2 ciclos (~4h) |
| 3º fallo | `fallido_definitivo` → contador visible en `/agentes` del coach |

---

## Integración ScrapeGraph AI

ScrapeGraph refuerza dos pasos del pipeline donde el sistema actual es más frágil:

### Paso 1 mejorado — Extracción desde URL origen

Cuando la receta tiene `url_origen` (blog, AllRecipes, Tasty, post web de IG), ScrapeGraph extrae ingredientes semánticamente sin selectores CSS que se rompen:

```python
from scrapegraphai.graphs import SmartScraperGraph

def extraer_ingredientes_url(url: str) -> dict:
    graph = SmartScraperGraph(
        prompt="""Extrae la receta completa en JSON:
        - nombre, porciones, tiempo_prep_min
        - ingredientes: [{nombre, cantidad, unidad}]
        - instrucciones: [pasos ordenados]
        - tipo_plato: desayuno/comida/cena/snack/postre""",
        source=url,
        config={"llm": {"model": "openai/gpt-4o-mini", "api_key": OPENAI_KEY}}
    )
    return graph.run()
```

**Activación:** solo si `url_origen` está presente. El transcript de vídeo sigue siendo el camino principal para TikTok/IG sin URL.

### Paso 2 mejorado — Match semántico de ingredientes raros

Cuando los 4 niveles de matching fallan (nivel 4: DeepSeek estima macros), ScrapeGraph busca el ingrediente en la web antes de inventar macros:

```python
from scrapegraphai.graphs import SearchGraph

def buscar_macros_ingrediente(nombre: str) -> dict:
    graph = SearchGraph(
        prompt=f"Macros nutricionales por 100g de '{nombre}': kcal, proteinas, carbohidratos, grasas, fibra. Solo números.",
        config={"llm": {"model": "openai/gpt-4o-mini", "api_key": OPENAI_KEY}}
    )
    return graph.run()
```

**Activación:** solo como fallback de nivel 4 (antes del "inventar con DeepSeek"). Reduce alucinaciones en ingredientes raros (tahini, miso, harissa, mantequilla de almendras, etc.) porque usa datos reales de USDA/FatSecret.

---

## Mapa completo del sistema

```
Vídeo TikTok/IG
      ↓
bridge_jobs (estado: pendiente)
      ↓
PASO 1: transcript → ingredientes
        + ScrapeGraph SmartScraper si hay url_origen  ← NUEVO
      ↓
PASO 2: 4-level match
        + ScrapeGraph SearchGraph si nivel 4 falla    ← NUEVO
      ↓
PASO 3: calcular macros desde ingredientes matcheados
      ↓
PASO 4: generar imagen (OpenAI gpt-image-1)
      ↓
PASO 5: INSERT atómico — receta + receta_ingredientes en producción
      ↓
PASO 6: subir imagen a Cloudinary, actualizar receta.imagen_url
      ↓
completado ✓

─── CRON RESCATE (cada 2h, antes de nuevos vídeos) ───
→ detecta jobs atascados / fallidos con intentos restantes
→ limpia estado parcial si necesario
→ reintenta desde paso_actual
```

---

## Visibilidad de errores

- Jobs `fallido_definitivo` aparecen como contador en `/agentes` (infraestructura ya existe)
- `error_ultimo` guarda el traceback del último fallo para diagnóstico
- `payload_json` permite ver exactamente hasta dónde llegó cada receta

---

## Lo que NO cambia

- El transcript de vídeo como fuente principal (Whisper + LLM)
- La lógica de 4 niveles de matching (solo se añade nivel 4.5 con ScrapeGraph)
- El modelo de imagen (gpt-image-1 con el prompt food blogger establecido)
- Cloudinary como destino de imágenes (ya configurado)
- El cron de 2h (solo se añade la fase de rescate al inicio)

---

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `Content-Radar/scripts/bridge_nutricoach.py` | Refactor en pasos con state machine |
| `Content-Radar/scripts/process_pending.py` | Añadir `fase_rescate()` al inicio del cron |
| `supabase/migrations/YYYYMMDD_bridge_jobs.sql` | Nueva tabla `bridge_jobs` |
| `Content-Radar/scripts/scrapegraph_helpers.py` | Nuevo — funciones ScrapeGraph |
| `Content-Radar/requirements.txt` | Añadir `scrapegraphai` |
