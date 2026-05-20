# 🥗 NutriCoach — Human Lab

Plataforma de coaching nutricional y deportivo con IA. Next.js + Supabase + DeepSeek.

## Stack

- **Frontend:** Next.js 16 (App Router), React, Tailwind CSS
- **Backend:** Next.js API Routes (serverless), Supabase (PostgreSQL + Auth + Storage)
- **IA:** DeepSeek V3 (deepseek-chat) — generación de dietas, informes, ajuste de macros, refinamiento de recetas
- **Scraping:** Playwright + API HTTP (multi-supermercado)

## APIs

### `/api/conocimiento/scrape` — Knowledge Base Scraper (IA)

Scrapea artículos científicos o URLs y los estructura para la base de conocimiento del coach usando DeepSeek.

**POST** `/api/conocimiento/scrape`

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `url` | string | opcional | URL de un artículo web para scrapear |
| `doi` | string | opcional | DOI de un paper (ej: `10.1000/xyz123`). Consulta Semantic Scholar |
| `texto` | string | opcional | Texto libre pegado manualmente |

Debe proporcionarse **al menos uno** de los tres campos.

**Respuesta (200):**
```json
{
  "titulo": "Título del estudio",
  "resumen": "Resumen en 3-5 frases con conclusiones accionables",
  "puntos_clave": ["Punto 1", "Punto 2"],
  "fuente": "Autor/es, Año. Revista",
  "disciplina": "nutricion|hyrox|running|ciclismo|triatlon|hibrido|fuerza|recuperacion|general",
  "categoria": "periodizacion|intensidad|volumen|fuerza|...",
  "tipo": "estudio|meta_analisis|revision|guia_clinica|protocolo|metodologia|referencia|nota_propia",
  "nivel_evidencia": "meta_analisis|rct|revision_sistematica|estudio_observacional|opinion_experto|practica_clinica",
  "tags": ["tag1", "tag2"],
  "poblacion": ["atletas", "principiantes"],
  "condiciones": ["hyrox", "diabetes"],
  "fuente_tipo": "scrapeado|doi|ia_generado",
  "url_origen": "https://..." | null,
  "doi": "10.1000/..." | null,
  "contenido_completo": "texto extraído (primeros 20k chars)"
}
```

**Requiere autenticación** (cookie de sesión de coach).

**Inputs soportados:**
- **URL**: scrapea el HTML, limpia scripts/styles, extrae texto (primeros 8000 chars)
- **DOI**: consulta la API de Semantic Scholar para obtener título, autores, abstract y año
- **Texto**: procesa texto pegado directamente

**Ejemplo de uso:**
```bash
curl -X POST http://localhost:3000/api/conocimiento/scrape \
  -H "Content-Type: application/json" \
  -d '{"doi": "10.1249/MSS.0000000000001234"}'
```

### `/api/generar-dieta-ia` — Generación de dieta con DeepSeek

Genera un plan nutricional personalizado. Internamente consulta `knowledge_base` para añadir contexto científico al prompt.

### `/api/scrape-receta` — Scraper de recetas

Extrae recetas de blogs/cocina desde URL (JSON-LD), las parsea y crea en BD con ingredientes vinculados a `alimentos`.

## Knowledge Base Científica

114 fichas con evidencia científica en disciplinas:
- Nutrición deportiva (proteína, hidratación, carbohidratos, suplementación)
- HYROX (periodización, estaciones, zona 2, recuperación)
- Running (entrenamiento polarizado 80/20, zonas FC, progresión)
- Fuerza (frecuencia, RPE/RIR, autorregulación)
- Recuperación (HRV, sueño)

Cada ficha incluye: disciplina, categoría, resumen, puntos clave, nivel de evidencia, tags y referencias.

Las API de IA (`/api/generar-dieta-ia`, `/api/entrenos/generar-ia`) consultan `fetchKnowledgeContext()` para inyectar automáticamente las fichas relevantes en el prompt de DeepSeek.

## Scrapers de Supermercados

| Supermercado | Productos | Método | Estado |
|---|---|---|---|
| Mercadona | ~2,895 | API HTTP | ✅ |
| Consum | ~4,765 | API interna | ✅ |
| Lidl | ~429 | Playwright batch | ✅ |
| Día | ~130 | HTTP SSR | ✅ (reparado 20-05) |
| Hipercor | ~308 | Puppeteer-extra+stealth | ✅ (reparado 20-05) |
| El Corte Inglés | ~308 | Puppeteer-extra+stealth | ✅ (reparado 20-05, vía Hipercor) |
| Alcampo | ~38 | API Ocado | ✅ |
| Carrefour | ~20 | Playwright | ✅ |
| Eroski | ~11 | Playwright | ✅ |
| Bonpreu | ~21 | Playwright | ✅ |
| Esclat | ~21 | Playwright | ✅ |
| Aldi | 0 | — | ❌ |

## Desarrollo

```bash
# Instalar dependencias
npm install

# Variables de entorno (crear .env.local)
# NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY, DEEPSEEK_API_KEY

# Servidor dev
npm run dev

# Build verificación
npx next build
```

## Estructura del Proyecto

```
app/
├── api/
│   ├── conocimiento/scrape/     ← KB Scraper (este doc)
│   ├── generar-dieta-ia/        ← DeepSeek genera dieta
│   ├── scrape-receta/           ← Scraper recetas web
│   └── ...
├── recetas/                     ← CRUD recetas
├── dietas/                      ← Planes nutricionales
├── clientes/                    ← Gestión clientes
├── entrenos/                    ← Planes de entreno
└── login/                       ← Auth coach
components/
├── PortalCliente/               ← Portal público cliente
├── training/                    ← Training Pro
└── premium/                     ← Componentes premium
lib/
├── deepseek.ts                  ← Cliente DeepSeek (4 funciones)
├── knowledge.ts                 ← fetchKnowledgeContext()
└── scraping/                    ← Motores de scraping
scripts/                         ← Utilidades CLI
supabase_schema.sql              ← Schema completo BD
```

## Auth

- **Coach:** Login con email/contraseña via Supabase Auth
- **Clientes:** Acceso por código público (sin auth) generado al aprobar dieta
- **Onboarding autónomo:** Clientes se registran con código de invitación
