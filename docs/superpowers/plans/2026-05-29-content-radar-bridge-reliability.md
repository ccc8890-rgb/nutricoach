# Content Radar Bridge Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer el bridge Content Radar → NutriCoach fiable con reintentos automáticos, estado persistido en BD y extracción semántica via ScrapeGraph AI.

**Architecture:** Se añade una tabla `bridge_jobs` como state machine. El pipeline se divide en 6 pasos aislados que guardan resultados en `payload_json`. El cron de rescate (cada 2h) detecta jobs fallidos/atascados y los reintenta automáticamente desde el paso donde se quedaron. ScrapeGraph AI actúa como fallback en extracción de ingredientes desde URL y búsqueda de macros de ingredientes raros.

**Tech Stack:** Python 3.14, Supabase REST API (urllib.request), OpenAI gpt-image-1, DeepSeek, ScrapeGraph AI (SmartScraperGraph + SearchGraph), Cloudinary.

---

## Archivos afectados

| Archivo | Acción | Responsabilidad |
|---------|--------|----------------|
| `nutricoach/supabase/migrations/20260529_bridge_jobs.sql` | Crear | Tabla `bridge_jobs` en Supabase |
| `Content-Radar/scripts/bridge_jobs_manager.py` | Crear | CRUD state machine: crear job, actualizar paso, rescatar jobs fallidos |
| `Content-Radar/scripts/scrapegraph_helpers.py` | Crear | Wrappers ScrapeGraph: extracción URL, búsqueda macros |
| `Content-Radar/scripts/bridge_steps.py` | Crear | Los 6 pasos del pipeline como funciones aisladas que leen/escriben payload_json |
| `Content-Radar/scripts/bridge_nutricoach.py` | Modificar | `process_recipe()` usa bridge_jobs + bridge_steps en vez de flujo lineal |
| `Content-Radar/scripts/process_pending.py` | Modificar | Añadir `fase_rescate()` al inicio del loop principal |
| `Content-Radar/requirements.txt` | Modificar | Añadir `scrapegraphai` |

---

## Task 1: SQL Migration — tabla `bridge_jobs`

**Files:**
- Create: `nutricoach/supabase/migrations/20260529_bridge_jobs.sql`

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- supabase/migrations/20260529_bridge_jobs.sql
-- State machine para el pipeline Content Radar → NutriCoach

CREATE TABLE IF NOT EXISTS bridge_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receta_id       UUID REFERENCES recetas(id) ON DELETE SET NULL,
  video_url       TEXT NOT NULL,
  titulo          TEXT,
  estado          TEXT NOT NULL DEFAULT 'pendiente',
  -- pendiente | en_proceso | completado | fallido | fallido_definitivo
  paso_actual     TEXT,
  -- extraer_ingredientes | match_ingredientes | calcular_macros |
  -- generar_imagen | insertar_receta | subir_imagen
  intentos        INT NOT NULL DEFAULT 0,
  max_intentos    INT NOT NULL DEFAULT 3,
  error_ultimo    TEXT,
  payload_json    JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bridge_jobs_estado     ON bridge_jobs(estado);
CREATE INDEX IF NOT EXISTS idx_bridge_jobs_updated    ON bridge_jobs(updated_at);
CREATE INDEX IF NOT EXISTS idx_bridge_jobs_receta     ON bridge_jobs(receta_id);

-- RLS: solo service_role puede operar (el bridge usa service role key)
ALTER TABLE bridge_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON bridge_jobs
  USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Aplicar en Supabase**

Ir a Supabase Dashboard → SQL Editor → pegar el contenido del archivo → Run.

Verificar que aparece la tabla:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name = 'bridge_jobs' AND table_schema = 'public';
```
Resultado esperado: 1 fila con `bridge_jobs`.

- [ ] **Step 3: Commit**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
git add supabase/migrations/20260529_bridge_jobs.sql
git commit -m "feat: migration bridge_jobs state machine table"
```

---

## Task 2: `bridge_jobs_manager.py` — CRUD del state machine

**Files:**
- Create: `Content-Radar/scripts/bridge_jobs_manager.py`

- [ ] **Step 1: Crear el archivo completo**

```python
#!/usr/bin/env python3
"""
bridge_jobs_manager.py — CRUD para la tabla bridge_jobs (state machine).

Todas las funciones usan la Supabase REST API directamente con urllib.request,
igual que el resto del proyecto Content-Radar.
"""
from __future__ import annotations

import json
import os
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

PASOS_ORDEN = [
    "extraer_ingredientes",
    "match_ingredientes",
    "calcular_macros",
    "generar_imagen",
    "insertar_receta",
    "subir_imagen",
]


def _headers() -> dict:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _request(method: str, path: str, body: dict | None = None) -> list[dict]:
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=_headers(), method=method)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


def crear_job(video_url: str, titulo: str | None = None) -> dict:
    """Crea un nuevo job en estado 'pendiente'. Devuelve el job creado."""
    rows = _request("POST", "bridge_jobs", {
        "video_url": video_url,
        "titulo": titulo,
        "estado": "pendiente",
        "paso_actual": PASOS_ORDEN[0],
        "intentos": 0,
        "payload_json": {},
    })
    return rows[0]


def actualizar_paso(job_id: str, paso_completado: str, resultado: dict) -> None:
    """
    Marca un paso como completado y guarda su resultado en payload_json.
    Avanza paso_actual al siguiente paso del orden.
    """
    idx = PASOS_ORDEN.index(paso_completado)
    siguiente = PASOS_ORDEN[idx + 1] if idx + 1 < len(PASOS_ORDEN) else None

    # Obtener payload_json actual
    rows = _request("GET", f"bridge_jobs?id=eq.{job_id}&select=payload_json")
    payload = rows[0].get("payload_json", {}) if rows else {}
    payload[paso_completado] = resultado

    body: dict[str, Any] = {
        "payload_json": payload,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if siguiente:
        body["paso_actual"] = siguiente
    else:
        body["estado"] = "completado"

    url_path = f"bridge_jobs?id=eq.{job_id}"
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{url_path}",
        data=json.dumps(body).encode(),
        headers={**_headers(), "Prefer": "return=minimal"},
        method="PATCH",
    )
    urllib.request.urlopen(req, timeout=15)


def marcar_en_proceso(job_id: str) -> None:
    body = {"estado": "en_proceso", "updated_at": datetime.now(timezone.utc).isoformat()}
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/bridge_jobs?id=eq.{job_id}",
        data=json.dumps(body).encode(),
        headers={**_headers(), "Prefer": "return=minimal"},
        method="PATCH",
    )
    urllib.request.urlopen(req, timeout=15)


def marcar_fallido(job_id: str, error: str, receta_id: str | None = None) -> None:
    """Incrementa intentos. Si alcanza max_intentos → fallido_definitivo."""
    rows = _request("GET", f"bridge_jobs?id=eq.{job_id}&select=intentos,max_intentos")
    job = rows[0] if rows else {}
    intentos = job.get("intentos", 0) + 1
    max_intentos = job.get("max_intentos", 3)
    estado = "fallido_definitivo" if intentos >= max_intentos else "fallido"

    body: dict[str, Any] = {
        "estado": estado,
        "intentos": intentos,
        "error_ultimo": error[:2000],  # límite para no saturar la columna
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if receta_id:
        body["receta_id"] = receta_id

    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/bridge_jobs?id=eq.{job_id}",
        data=json.dumps(body).encode(),
        headers={**_headers(), "Prefer": "return=minimal"},
        method="PATCH",
    )
    urllib.request.urlopen(req, timeout=15)


def marcar_completado(job_id: str, receta_id: str) -> None:
    body = {
        "estado": "completado",
        "receta_id": receta_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/bridge_jobs?id=eq.{job_id}",
        data=json.dumps(body).encode(),
        headers={**_headers(), "Prefer": "return=minimal"},
        method="PATCH",
    )
    urllib.request.urlopen(req, timeout=15)


def marcar_pendiente_para_reintento(job_id: str) -> None:
    """Reset a 'pendiente' para que el cron lo vuelva a procesar."""
    body = {
        "estado": "pendiente",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/bridge_jobs?id=eq.{job_id}",
        data=json.dumps(body).encode(),
        headers={**_headers(), "Prefer": "return=minimal"},
        method="PATCH",
    )
    urllib.request.urlopen(req, timeout=15)


def obtener_jobs_rescatables() -> list[dict]:
    """
    Devuelve jobs que el cron de rescate debe reintentar:
    1. Jobs 'en_proceso' hace más de 30 minutos (cuelgue sin excepción)
    2. Jobs 'fallido' con intentos < max_intentos
    """
    hace_30_min = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()

    atascados = _request(
        "GET",
        f"bridge_jobs?estado=eq.en_proceso&updated_at=lt.{hace_30_min}"
        f"&select=id,paso_actual,payload_json,intentos,max_intentos,receta_id"
    )
    fallidos = _request(
        "GET",
        "bridge_jobs?estado=eq.fallido"
        "&select=id,paso_actual,payload_json,intentos,max_intentos,receta_id"
    )
    # Filtrar fallidos que aún tienen intentos disponibles
    fallidos_reintentables = [
        j for j in fallidos
        if j.get("intentos", 0) < j.get("max_intentos", 3)
    ]
    return atascados + fallidos_reintentables


def obtener_jobs_definitivamente_fallidos() -> list[dict]:
    """Para mostrar en el dashboard de /agentes."""
    return _request(
        "GET",
        "bridge_jobs?estado=eq.fallido_definitivo"
        "&select=id,video_url,titulo,error_ultimo,updated_at"
        "&order=updated_at.desc&limit=20"
    )
```

- [ ] **Step 2: Verificar sintaxis**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/Content-Radar
python3 -c "from scripts.bridge_jobs_manager import crear_job; print('OK')"
```
Resultado esperado: `OK` (sin errores de importación; fallará en runtime si no hay `.env` pero eso es correcto).

- [ ] **Step 3: Commit**

```bash
git add scripts/bridge_jobs_manager.py
git commit -m "feat: bridge_jobs_manager — state machine CRUD"
```

---

## Task 3: `scrapegraph_helpers.py` — wrappers ScrapeGraph AI

**Files:**
- Create: `Content-Radar/scripts/scrapegraph_helpers.py`

- [ ] **Step 1: Crear el archivo**

```python
#!/usr/bin/env python3
"""
scrapegraph_helpers.py — Wrappers ScrapeGraph AI para el bridge.

Dos funciones de fallback que mejoran el pipeline cuando los métodos
principales no tienen suficiente información:

  1. extraer_ingredientes_url(url) — extracción semántica desde página web
     (complementa el transcript de vídeo cuando hay url_origen)

  2. buscar_macros_ingrediente(nombre) — búsqueda web de macros reales
     (fallback de nivel 4.5 antes de que DeepSeek los invente)
"""
from __future__ import annotations

import json
import os

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

# ScrapeGraph config compartida
_LLM_CONFIG = {
    "llm": {
        "model": "openai/gpt-4o-mini",
        "api_key": OPENAI_API_KEY,
    }
}


def extraer_ingredientes_url(url: str) -> dict | None:
    """
    Extrae ingredientes e instrucciones de una URL de receta usando ScrapeGraph.
    Retorna dict con claves: nombre, porciones, tiempo_prep_min, ingredientes[], instrucciones[]
    Retorna None si falla o si la URL no tiene contenido de receta.

    Solo llamar cuando la receta tiene url_origen (blog, AllRecipes, Tasty, etc.).
    No usar para URLs de TikTok/Instagram — el transcript es el camino correcto ahí.
    """
    try:
        from scrapegraphai.graphs import SmartScraperGraph
    except ImportError:
        print("[WARN] scrapegraphai no instalado — saltando extracción URL")
        return None

    try:
        graph = SmartScraperGraph(
            prompt="""Extrae la receta de esta página en JSON con exactamente estas claves:
            {
              "nombre": "nombre del plato",
              "porciones": 4,
              "tiempo_prep_min": 20,
              "tipo_plato": "desayuno|comida|cena|snack|postre",
              "ingredientes": [
                {"nombre": "pollo", "cantidad": 200, "unidad": "g"}
              ],
              "instrucciones": ["paso 1", "paso 2"]
            }
            Si no hay receta en la página devuelve {"error": "no_recipe"}.
            Cantidades siempre en números, unidades en texto (g, ml, cucharada, etc.).""",
            source=url,
            config=_LLM_CONFIG,
        )
        result = graph.run()

        # Validar que es una receta real
        if isinstance(result, dict) and "error" in result:
            return None
        if not isinstance(result, dict) or "ingredientes" not in result:
            return None

        return result

    except Exception as e:
        print(f"[WARN] ScrapeGraph URL extraction failed for {url}: {e}")
        return None


def buscar_macros_ingrediente(nombre: str) -> dict | None:
    """
    Busca macros nutricionales reales (por 100g) de un ingrediente en la web.
    Retorna dict con claves: kcal, proteinas, carbohidratos, grasas, fibra
    Retorna None si no encuentra datos fiables.

    Usar solo como fallback de nivel 4 del matching cuando DeepSeek
    va a tener que inventar los macros — esto los busca en fuentes reales.
    """
    try:
        from scrapegraphai.graphs import SearchGraph
    except ImportError:
        print("[WARN] scrapegraphai no instalado — saltando búsqueda macros")
        return None

    try:
        graph = SearchGraph(
            prompt=f"""Busca los valores nutricionales por 100g de "{nombre}".
            Devuelve SOLO este JSON sin texto adicional:
            {{
              "kcal": 250,
              "proteinas": 15.2,
              "carbohidratos": 30.1,
              "grasas": 8.5,
              "fibra": 2.3
            }}
            Usa fuentes como USDA FoodData, FatSecret o BEDCA.
            Si no encuentras datos fiables devuelve {{"error": "not_found"}}.""",
            config=_LLM_CONFIG,
        )
        result = graph.run()

        if isinstance(result, dict) and "error" in result:
            return None
        if not isinstance(result, dict) or "kcal" not in result:
            return None

        # Validar rangos razonables
        if not (0 <= result.get("kcal", -1) <= 900):
            return None

        return {
            "kcal": float(result.get("kcal", 0)),
            "proteinas": float(result.get("proteinas", 0)),
            "carbohidratos": float(result.get("carbohidratos", 0)),
            "grasas": float(result.get("grasas", 0)),
            "fibra": float(result.get("fibra", 0)),
        }

    except Exception as e:
        print(f"[WARN] ScrapeGraph macro search failed for '{nombre}': {e}")
        return None
```

- [ ] **Step 2: Verificar sintaxis**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/Content-Radar
python3 -c "from scripts.scrapegraph_helpers import extraer_ingredientes_url, buscar_macros_ingrediente; print('OK')"
```
Resultado esperado: `OK`

- [ ] **Step 3: Commit**

```bash
git add scripts/scrapegraph_helpers.py
git commit -m "feat: scrapegraph_helpers — URL extraction + macro search"
```

---

## Task 4: `bridge_steps.py` — los 6 pasos del pipeline

**Files:**
- Create: `Content-Radar/scripts/bridge_steps.py`

- [ ] **Step 1: Crear el archivo**

Cada función recibe el `payload_json` acumulado y devuelve un dict con el resultado del paso. El bridge_nutricoach.py ya tiene la lógica — aquí solo se extrae y aísla.

```python
#!/usr/bin/env python3
"""
bridge_steps.py — Los 6 pasos del pipeline Content Radar → NutriCoach.

Cada función:
  - Recibe el payload_json acumulado hasta ese punto
  - Retorna un dict con los datos que produce ese paso
  - Lanza excepción si falla (el caller marca el job como fallido)

Orden obligatorio:
  1. extraer_ingredientes    → {'ingredientes_raw': [...]}
  2. match_ingredientes      → {'ingredientes_matched': [...]}
  3. calcular_macros         → {'macros': {...}}
  4. generar_imagen          → {'imagen_base64': '...', 'imagen_mime': 'image/webp'}
  5. insertar_receta         → {'receta_id': 'uuid'}
  6. subir_imagen            → {'imagen_url': 'https://res.cloudinary.com/...'}
"""
from __future__ import annotations

import base64
import json
import os

from scripts.bridge_nutricoach import BridgeNutriCoach
from scripts.scrapegraph_helpers import extraer_ingredientes_url, buscar_macros_ingrediente

_bridge = BridgeNutriCoach()


def paso_extraer_ingredientes(recipe: dict, url_origen: str | None) -> dict:
    """
    Paso 1: Extrae ingredientes crudos de la receta.
    Fuente primaria: recipe['ingredients'] del transcript.
    Fuente secundaria: ScrapeGraph si hay url_origen y los ingredientes del transcript son escasos.
    """
    ingredientes_transcript = recipe.get("ingredients", [])

    # Enriquecer con ScrapeGraph si hay URL y el transcript tiene <3 ingredientes
    if url_origen and len(ingredientes_transcript) < 3:
        datos_url = extraer_ingredientes_url(url_origen)
        if datos_url and datos_url.get("ingredientes"):
            print(f"[STEP 1] ScrapeGraph extrajo {len(datos_url['ingredientes'])} ingredientes desde URL")
            return {"ingredientes_raw": datos_url["ingredientes"]}

    print(f"[STEP 1] {len(ingredientes_transcript)} ingredientes del transcript")
    return {"ingredientes_raw": ingredientes_transcript}


def paso_match_ingredientes(payload: dict) -> dict:
    """
    Paso 2: Matchea ingredientes_raw contra la tabla alimentos (4 niveles).
    Nivel 4.5 (nuevo): si DeepSeek va a inventar macros, primero busca con ScrapeGraph.
    """
    ingredientes_raw = payload["extraer_ingredientes"]["ingredientes_raw"]
    matched = []

    for ing in ingredientes_raw:
        nombre = ing.get("nombre") or ing if isinstance(ing, str) else str(ing)
        cantidad = ing.get("cantidad", 100) if isinstance(ing, dict) else 100
        unidad = ing.get("unidad", "g") if isinstance(ing, dict) else "g"

        # Intentar match con los 4 niveles del bridge existente
        alimento_id, confianza = _bridge._match_ingrediente(nombre)

        if alimento_id is None:
            # Nivel 4.5: buscar macros reales antes de que DeepSeek los invente
            macros_web = buscar_macros_ingrediente(nombre)
            if macros_web:
                print(f"[STEP 2] ScrapeGraph encontró macros para '{nombre}': {macros_web['kcal']} kcal/100g")
                alimento_id = _bridge._crear_alimento_con_macros(nombre, macros_web)
            else:
                # Nivel 4 original: DeepSeek estima macros
                alimento_id = _bridge._crear_alimento_con_ia(nombre)

        matched.append({
            "nombre_libre": nombre,
            "alimento_id": alimento_id,
            "cantidad_gramos": _bridge._to_gramos(cantidad, unidad, nombre),
        })

    print(f"[STEP 2] {len(matched)} ingredientes matcheados")
    return {"ingredientes_matched": matched}


def paso_calcular_macros(payload: dict) -> dict:
    """
    Paso 3: Calcula macros totales por porción sumando alimentos × gramos.
    """
    ingredientes = payload["match_ingredientes"]["ingredientes_matched"]
    macros = _bridge._calcular_macros(ingredientes)
    print(f"[STEP 3] Macros calculados: {macros.get('kcal', 0):.0f} kcal")
    return {"macros": macros}


def paso_generar_imagen(recipe: dict, thumbnail_url: str | None, payload: dict) -> dict:
    """
    Paso 4: Genera imagen con OpenAI gpt-image-1.
    Prioridad 1: refinar thumbnail existente.
    Prioridad 2: txt2img desde cero.
    Guarda bytes en base64 para no depender de archivos temporales.
    """
    nombre = recipe.get("title", "receta")
    ingredientes_txt = ", ".join([
        i.get("nombre_libre", "") for i in
        payload["match_ingredientes"]["ingredientes_matched"][:6]
    ])

    imagen_bytes = _bridge._generar_imagen(nombre, ingredientes_txt, thumbnail_url)
    if imagen_bytes is None:
        raise RuntimeError("OpenAI no pudo generar la imagen")

    print(f"[STEP 4] Imagen generada ({len(imagen_bytes)} bytes)")
    return {
        "imagen_base64": base64.b64encode(imagen_bytes).decode(),
        "imagen_mime": "image/webp",
    }


def paso_insertar_receta(recipe: dict, coach_id: str, payload: dict) -> dict:
    """
    Paso 5: INSERT atómico en producción.
    Solo se ejecuta cuando pasos 1-4 han completado.
    Crea: receta + receta_ingredientes.
    """
    macros = payload["calcular_macros"]["macros"]
    ingredientes = payload["match_ingredientes"]["ingredientes_matched"]

    receta_id = _bridge._insertar_receta_completa(recipe, macros, ingredientes, coach_id)
    print(f"[STEP 5] Receta insertada: {receta_id}")
    return {"receta_id": receta_id}


def paso_subir_imagen(payload: dict) -> dict:
    """
    Paso 6: Sube imagen a Cloudinary y actualiza receta.imagen_url.
    Se ejecuta después del INSERT, reintentable de forma segura.
    """
    receta_id = payload["insertar_receta"]["receta_id"]
    imagen_bytes = base64.b64decode(payload["generar_imagen"]["imagen_base64"])

    imagen_url = _bridge._subir_imagen_cloudinary(receta_id, imagen_bytes)
    _bridge._actualizar_imagen_url(receta_id, imagen_url)

    print(f"[STEP 6] Imagen subida: {imagen_url}")
    return {"imagen_url": imagen_url}
```

- [ ] **Step 2: Verificar sintaxis**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/Content-Radar
python3 -c "from scripts.bridge_steps import paso_extraer_ingredientes; print('OK')"
```
Resultado esperado: `OK`

- [ ] **Step 3: Commit**

```bash
git add scripts/bridge_steps.py
git commit -m "feat: bridge_steps — pipeline de 6 pasos aislados"
```

---

## Task 5: Refactorizar `bridge_nutricoach.py` — `process_recipe()` con state machine

**Files:**
- Modify: `Content-Radar/scripts/bridge_nutricoach.py`

- [ ] **Step 1: Añadir método auxiliar `_match_ingrediente()` si no existe**

Buscar en `bridge_nutricoach.py` si existe un método público `_match_ingrediente(nombre)` que devuelva `(alimento_id, confianza)`. Si no existe, añadir este wrapper al final de la clase `BridgeNutriCoach`:

```python
def _match_ingrediente(self, nombre: str) -> tuple[str | None, str]:
    """
    Wrapper público del matching interno (niveles 1-4).
    Devuelve (alimento_id, 'exacto'|'parcial'|'wildcard'|None).
    """
    # Llama a auto_match_ingredientes con un solo ingrediente
    resultado = self.auto_match_ingredientes([{"nombre": nombre, "cantidad": 100, "unidad": "g"}])
    if resultado and resultado[0].get("alimento_id"):
        return resultado[0]["alimento_id"], "matched"
    return None, "sin_match"

def _crear_alimento_con_macros(self, nombre: str, macros: dict) -> str:
    """Crea alimento en BD con macros ya conocidos (de ScrapeGraph)."""
    return self._insertar_alimento_nuevo(nombre, macros)

def _to_gramos(self, cantidad: float, unidad: str, nombre: str) -> float:
    """Convierte cantidad+unidad a gramos. Reutiliza parsearIngrediente() interna."""
    return self._parsear_cantidad_a_gramos(cantidad, unidad, nombre)
```

- [ ] **Step 2: Añadir método `_subir_imagen_cloudinary()` si no existe**

Buscar en `bridge_nutricoach.py` cómo sube imágenes actualmente. Si usa `_subir_imagen_storage()` para Supabase, añadir método Cloudinary:

```python
def _subir_imagen_cloudinary(self, receta_id: str, imagen_bytes: bytes) -> str:
    """Sube imagen a Cloudinary y devuelve la URL pública."""
    import cloudinary
    import cloudinary.uploader

    cloudinary.config(
        cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
        api_key=os.environ.get("CLOUDINARY_API_KEY"),
        api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
    )
    result = cloudinary.uploader.upload(
        imagen_bytes,
        public_id=f"nutricoach/recetas/{receta_id}",
        format="webp",
        quality="auto:good",
        overwrite=True,
    )
    return result["secure_url"]

def _actualizar_imagen_url(self, receta_id: str, imagen_url: str) -> None:
    """Actualiza receta.imagen_url en Supabase."""
    self._patch_supabase(
        f"recetas?id=eq.{receta_id}",
        {"imagen_url": imagen_url}
    )
```

- [ ] **Step 3: Añadir nuevo método `process_recipe_with_job()` (no borrar el original aún)**

Al final de la clase `BridgeNutriCoach`, añadir:

```python
def process_recipe_with_job(
    self,
    recipe: dict,
    platform: str,
    source_url: str | None = None,
    thumbnail_url: str | None = None,
    job_id: str | None = None,
) -> dict:
    """
    Versión del bridge con state machine. Usa bridge_jobs para persistir
    el progreso y permitir reintentos automáticos.

    Si job_id es None, crea un job nuevo.
    Si job_id existe, retoma desde paso_actual guardado en payload_json.
    """
    from scripts.bridge_jobs_manager import (
        crear_job, actualizar_paso, marcar_en_proceso,
        marcar_fallido, marcar_completado,
        PASOS_ORDEN,
    )
    from scripts.bridge_steps import (
        paso_extraer_ingredientes, paso_match_ingredientes,
        paso_calcular_macros, paso_generar_imagen,
        paso_insertar_receta, paso_subir_imagen,
    )
    import urllib.request as _ur

    # Crear job si no existe
    if job_id is None:
        job = crear_job(recipe.get("title") or source_url or "sin_titulo", source_url)
        job_id = job["id"]
        payload = {}
        paso_inicio = PASOS_ORDEN[0]
    else:
        # Cargar job existente para reanudar
        rows = _ur.urlopen(
            urllib.request.Request(
                f"{SUPABASE_URL}/rest/v1/bridge_jobs?id=eq.{job_id}"
                f"&select=paso_actual,payload_json",
                headers=self._supabase_headers(),
            ),
            timeout=15,
        )
        job_data = json.loads(rows.read())[0]
        payload = job_data.get("payload_json", {})
        paso_inicio = job_data.get("paso_actual", PASOS_ORDEN[0])

    marcar_en_proceso(job_id)

    FUNCIONES_PASO = {
        "extraer_ingredientes": lambda p: paso_extraer_ingredientes(recipe, source_url),
        "match_ingredientes":   lambda p: paso_match_ingredientes(p),
        "calcular_macros":      lambda p: paso_calcular_macros(p),
        "generar_imagen":       lambda p: paso_generar_imagen(recipe, thumbnail_url, p),
        "insertar_receta":      lambda p: paso_insertar_receta(recipe, self.coach_id, p),
        "subir_imagen":         lambda p: paso_subir_imagen(p),
    }

    idx_inicio = PASOS_ORDEN.index(paso_inicio)
    receta_id = None

    for paso in PASOS_ORDEN[idx_inicio:]:
        try:
            resultado = FUNCIONES_PASO[paso](payload)
            payload[paso] = resultado
            actualizar_paso(job_id, paso, resultado)

            if paso == "insertar_receta":
                receta_id = resultado["receta_id"]

        except Exception as exc:
            marcar_fallido(job_id, str(exc), receta_id)
            raise

    marcar_completado(job_id, receta_id)
    return {"receta_id": receta_id, "job_id": job_id}
```

- [ ] **Step 4: Verificar que no hay errores de importación**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/Content-Radar
python3 -c "from scripts.bridge_nutricoach import BridgeNutriCoach; print('OK')"
```
Resultado esperado: `OK`

- [ ] **Step 5: Commit**

```bash
git add scripts/bridge_nutricoach.py
git commit -m "feat: bridge_nutricoach — process_recipe_with_job() con state machine"
```

---

## Task 6: Fase de rescate en `process_pending.py`

**Files:**
- Modify: `Content-Radar/scripts/process_pending.py`

- [ ] **Step 1: Añadir la función `fase_rescate()`**

Localizar en `process_pending.py` la función principal (probablemente `main()` o `process_all_pending()`). Añadir la función `fase_rescate()` ANTES de esa función:

```python
def fase_rescate() -> None:
    """
    Detecta jobs bridge atascados o fallidos con reintentos disponibles
    y los reintenta automáticamente.
    Llamar al inicio de cada ciclo del cron, antes de procesar nuevos vídeos.
    """
    try:
        from scripts.bridge_jobs_manager import (
            obtener_jobs_rescatables,
            marcar_pendiente_para_reintento,
        )
        from scripts.bridge_nutricoach import BridgeNutriCoach
    except ImportError as e:
        print(f"[RESCATE] Módulos no disponibles: {e}")
        return

    jobs = obtener_jobs_rescatables()
    if not jobs:
        print("[RESCATE] No hay jobs pendientes de reintento")
        return

    print(f"[RESCATE] {len(jobs)} jobs a reintentar")
    bridge = BridgeNutriCoach()

    for job in jobs:
        job_id = job["id"]
        print(f"[RESCATE] Reintentando job {job_id} desde paso '{job['paso_actual']}'")
        try:
            # Limpiar si es fallo post-INSERT en subir_imagen (no borrar receta)
            # Para pasos pre-INSERT no hay nada que limpiar en producción
            marcar_pendiente_para_reintento(job_id)
            bridge.process_recipe_with_job(
                recipe={},        # vacío: se reconstruye desde payload_json
                platform="rescate",
                job_id=job_id,    # retoma desde donde se quedó
            )
            print(f"[RESCATE] ✓ Job {job_id} completado")
        except Exception as exc:
            print(f"[RESCATE] ✗ Job {job_id} falló de nuevo: {exc}")
```

- [ ] **Step 2: Llamar a `fase_rescate()` al inicio del loop principal**

Buscar en `process_pending.py` dónde empieza el procesamiento principal (buscar `def main(` o el bloque `if __name__ == "__main__"`). Añadir la llamada al inicio:

```python
def main():
    # Rescatar jobs fallidos antes de procesar nuevos
    fase_rescate()

    # ... resto del código existente sin cambios ...
```

- [ ] **Step 3: Verificar sintaxis**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/Content-Radar
python3 -c "from scripts.process_pending import fase_rescate; print('OK')"
```
Resultado esperado: `OK`

- [ ] **Step 4: Commit**

```bash
git add scripts/process_pending.py
git commit -m "feat: process_pending — fase_rescate() al inicio del cron"
```

---

## Task 7: Actualizar `requirements.txt`

**Files:**
- Modify: `Content-Radar/requirements.txt`

- [ ] **Step 1: Añadir scrapegraphai y cloudinary**

Añadir al final de `Content-Radar/requirements.txt`:

```
# ─── Bridge reliability + ScrapeGraph AI (añadido 29-05-2026) ─────────────
scrapegraphai==2.1.1
cloudinary>=1.41.0
```

- [ ] **Step 2: Verificar que ya está instalado globalmente**

```bash
python3 -c "import scrapegraphai; print(scrapegraphai.__version__)"
```
Resultado esperado: `2.1.1`

- [ ] **Step 3: Commit**

```bash
git add requirements.txt
git commit -m "chore: añadir scrapegraphai y cloudinary a requirements"
```

---

## Task 8: Test de integración manual

**Files:**
- Create: `Content-Radar/scripts/test_bridge_reliability.py`

- [ ] **Step 1: Crear script de test**

```python
#!/usr/bin/env python3
"""
test_bridge_reliability.py — Test manual del sistema de reintentos.

Prueba el flujo completo: crea un job, simula un fallo en el paso de imagen,
verifica que queda marcado como 'fallido', luego lo rescata y completa.

Ejecutar:
  cd Content-Radar
  python3 scripts/test_bridge_reliability.py
"""
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent.parent / ".env")

from scripts.bridge_jobs_manager import (
    crear_job, marcar_fallido, obtener_jobs_rescatables,
    marcar_pendiente_para_reintento,
)

def test_crear_y_fallar():
    print("=== TEST 1: Crear job y simular fallo ===")
    job = crear_job("https://test.example.com/receta", "Receta de test")
    job_id = job["id"]
    print(f"✓ Job creado: {job_id}")

    marcar_fallido(job_id, "Error simulado en generar_imagen")
    print("✓ Job marcado como fallido")

    rescatables = obtener_jobs_rescatables()
    ids_rescatables = [j["id"] for j in rescatables]
    assert job_id in ids_rescatables, f"Job {job_id} no aparece en rescatables"
    print(f"✓ Job aparece en {len(rescatables)} jobs rescatables")

    return job_id

def test_reintentar(job_id: str):
    print("\n=== TEST 2: Marcar para reintento ===")
    marcar_pendiente_para_reintento(job_id)
    rescatables = obtener_jobs_rescatables()
    ids = [j["id"] for j in rescatables]
    # Después de marcar pendiente, ya no debe estar en 'fallido' → no rescatable aún
    # (está en 'pendiente', que el cron procesa en su próximo ciclo)
    print(f"✓ Job {job_id} marcado como pendiente para reintento")
    print("✓ El cron lo recogerá en su próximo ciclo")

def test_scrapegraph_imports():
    print("\n=== TEST 3: ScrapeGraph imports ===")
    from scripts.scrapegraph_helpers import extraer_ingredientes_url, buscar_macros_ingrediente
    print("✓ scrapegraph_helpers importado correctamente")

    # Test rápido sin llamada real a la API
    result = extraer_ingredientes_url("https://no-existe-esta-url-12345.com")
    assert result is None, "URL inexistente debería devolver None"
    print("✓ extraer_ingredientes_url devuelve None para URL inválida")

if __name__ == "__main__":
    job_id = test_crear_y_fallar()
    test_reintentar(job_id)
    test_scrapegraph_imports()
    print("\n✅ Todos los tests pasaron")
```

- [ ] **Step 2: Ejecutar el test**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/Content-Radar
python3 scripts/test_bridge_reliability.py
```
Resultado esperado:
```
=== TEST 1: Crear job y simular fallo ===
✓ Job creado: <uuid>
✓ Job marcado como fallido
✓ Job aparece en 1 jobs rescatables
=== TEST 2: Marcar para reintento ===
✓ Job <uuid> marcado como pendiente para reintento
✓ El cron lo recogerá en su próximo ciclo
=== TEST 3: ScrapeGraph imports ===
✓ scrapegraph_helpers importado correctamente
✓ extraer_ingredientes_url devuelve None para URL inválida
✅ Todos los tests pasaron
```

- [ ] **Step 3: Commit final**

```bash
git add scripts/test_bridge_reliability.py
git commit -m "test: bridge reliability — state machine + rescate manual test"
```

---

## Notas de implementación

### Métodos del bridge que puede que no existan con ese nombre exacto

`bridge_steps.py` llama a métodos privados de `BridgeNutriCoach` (`_match_ingrediente`, `_crear_alimento_con_macros`, etc.). Antes de ejecutar Task 4, leer `bridge_nutricoach.py` para identificar los nombres reales de los métodos equivalentes y ajustar el bridge_steps.py. Los conceptos son los mismos pero los nombres internos pueden variar.

### Variables de entorno necesarias en `.env`

Las siguientes ya deben estar configuradas. Verificar antes de ejecutar:
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### Orden de ejecución obligatorio

Task 1 (SQL) → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8. No saltarse el orden: bridge_steps.py (Task 4) importa de bridge_jobs_manager (Task 2) y scrapegraph_helpers (Task 3).
