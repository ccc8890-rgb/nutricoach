# 🎯 ESTRATEGIA MVP NUTRICOACH — Documentación Completa

**Última actualización:** 26-04-2026  
**Responsable:** Carlos Casanova (coach nutricional)  
**Estado:** En preparación para Fase 0  
**Próxima revisión:** Cuando Fase 0 esté 100% lista

---

## 📌 ÍNDICE RÁPIDO

1. [Visión y objetivos](#visión-y-objetivos)
2. [Decisiones arquitectónicas](#decisiones-arquitectónicas)
3. [Roadmap de 8 semanas](#roadmap-de-8-semanas)
4. [Estado actual de la app](#estado-actual-de-la-app)
5. [Fases detalladas con specs](#fases-detalladas-con-specs)
6. [Schema Supabase completo](#schema-supabase-completo)
7. [API endpoints a implementar](#api-endpoints-a-implementar)
8. [UI components a crear](#ui-components-a-crear)
9. [Instrucciones para DeepSeek](#instrucciones-para-deepseek)
10. [Preferencias de Carlos](#preferencias-de-carlos)

---

## 🎯 VISIÓN Y OBJETIVOS

### Objetivo Principal
Reemplazar **Harbiz** ($50/mes para 10 clientes) con **NutriCoach**: app propia que permite a Carlos generar dietas automáticamente con IA, con control manual total.

### Problema que resuelve
- **Harbiz:** Costos altos, funcionalidades limitadas, no adaptable
- **NutriCoach:** Económico (<€1/mes), generación IA, escalable, control total

### Alcance MVP (8 semanas)
- Coach crea cuestionarios personalizados
- Cliente anónimo rellena formulario
- IA (DeepSeek V3) genera dieta inicial automáticamente
- Coach revisa, ajusta manualmente (como Harbiz), aprueba
- Cliente descarga dieta en PDF

### No incluye (Fases futuras)
- ❌ Regeneración automática de dietas según progreso
- ❌ Feedback loop (IA aprende de cambios de Coach)
- ❌ Seguimiento de progreso del cliente (peso, medidas)
- ❌ Chat con cliente
- ❌ Predicciones o analytics avanzado

---

## 🏗️ DECISIONES ARQUITECTÓNICAS

### 1. **BD: Supabase (no Notion)**
- **Por qué:** Queries complejas, relaciones (cliente → dieta → comidas → alimentos), RLS (seguridad por usuario)
- **Ventaja:** Free tier suficiente, Auth integrado, Postgres power
- **Nota:** Notion es segundo cerebro personal de Carlos, no BD de app

### 2. **IA: DeepSeek V3 (no Claude)**
- **Por qué:** Precio 50x más barato ($0.27/M input vs $3), suficiente potencia para adaptación de recetas
- **Costos:** ~€0.02/mes con 10 clientes, escalable a 100+ sin problema
- **Prompt template:** Usa plantillas + recetas de BD, no hardcoded

### 3. **Versionado inicial: NO**
- **MVP (semanas 1-8):** Sin tracking de cambios, sin histórico de versiones
- **Futuro (Fase 2D después):** Agregar versionado cuando sea necesario

### 4. **Estética: Tailwind (actual)**
- **MVP:** Usar estilos actuales de la app
- **Futuro:** Completar PLAN_ESTETICO.md después de Fase 3
- **Razón:** Funcionalidad > diseño en v1

### 5. **Auth: Supabase Auth (coach solo)**
- **Cuestionarios:** Link público anónimo (sin login)
- **Coach:** Login con email
- **Cliente:** Link anónimo para ver dieta (sin auth)

### 6. **Flujo de generación: Trigger manual (no webhook)**
- **MVP:** Coach clica botón "Generar dieta con IA"
- **Futuro:** Webhook automático cuando respuesta llega

---

## 📅 ROADMAP DE 8 SEMANAS

```
SEMANA 1-2: FASE 0 (Setup)
  └─ Plantillas en Supabase
  └─ Recetas (BEDCA + Carlos) en Supabase
  └─ Schema final listo

SEMANA 3-4: FASE 1 (Questionnaires)
  └─ UI Coach: Crear cuestionarios
  └─ UI Cliente: Rellenar anónimo
  └─ BD: respuestas_clientes

SEMANA 5: FASE 2A (IA genera)
  └─ DeepSeek integration
  └─ API: POST /generar-dieta-ia
  └─ Prompt bien diseñado

SEMANA 6: FASE 2B (Coach revisa)
  └─ Dashboard: "Respuestas de clientes"
  └─ UI: Ver respuesta → Generar dieta
  └─ Notificaciones cuando llega respuesta

SEMANA 7: FASE 2C (Control manual)
  └─ UI Edición de dieta (EXISTE YA, solo documentar)
  └─ Cambiar recetas/macros como Harbiz

SEMANA 8: FASE 3 (Cliente)
  └─ Portal cliente anónimo
  └─ Ver dieta + descargar PDF
  └─ Link único por dieta

RESULTADO: App funcionando con 2-3 clientes reales
```

---

## 🔍 ESTADO ACTUAL DE LA APP

### ✅ YA EXISTE
- Next.js 14 + App Router
- Supabase auth (coach login)
- Tabla: `profiles`, `clientes`, `planes_nutricion`, `comidas`, `comida_alimentos`, `alimentos`
- UI: Dashboard coach, gestor de clientes, editor de dietas
- Funcionalidad: Búsqueda alimentos, cálculo de macros en tiempo real
- PDF: Descarga de dieta como PDF (ruta `/api/dietas/[id]/pdf`)
- Utils: TMB, TDEE, cálculo de macros (en `lib/utils.ts`)
- **✅ Módulo de plantillas de entrenamiento COMPLETO (26/04/2026):**
  - 21 plantillas (gimnasio, cardio, HYROX, running, ciclismo, triatlón)
  - 200+ ejercicios con referencias bibliográficas
  - Progresión semana a semana en JSONB
  - RPE/RIR por ejercicio
  - Notas de individualización por plantilla
  - UI selector con visualización de progresión
  - API seed + GET funcionales
- **✅ Módulo de cuestionarios COMPLETO:**
  - Tablas: `cuestionarios`, `respuestas_clientes`, `plantillas_dietas`
  - CuestionarioCreador (coach), FormularioCliente (anónimo)
  - RespuestasClientes (dashboard coach)
  - API: POST/GET `/api/cuestionarios`, POST `/api/respuestas`, PUT `/api/respuestas/[id]/estado`
  - Integración DeepSeek V3 para generación de dietas por IA

### ❌ FALTA CREAR / PENDIENTE
- UI: Portal cliente anónimo `/cliente/[codigo]`
- Script: Importación de recetas (CSV → Supabase) — estructura preparada
- PLAN_ESTETICO.md — Carlos debe completar decisiones visuales
- Design system (colores, tipografía, componentes Tailwind)
- Plan estético → implementación UI

### 🔧 CONFIGURACIÓN ACTUAL
- Supabase URL: `https://hopeqzwzmlrpktoeygxz.supabase.co`
- Auth: Coach login con email
- RLS: Habilitado (Coach ve solo sus datos)
- Hosting: Vercel (gratuito)
- Node version: 18+
- Next.js: 14 (App Router)

---

## 📋 FASES DETALLADAS CON SPECS

### FASE 0: SETUP (Semanas 1-2)

#### 0.1 Recolectar datos de Carlos
**QUÉ NECESITA CARLOS:**
- [ ] Exportar recetas desde Notion como CSV (estructura: Nombre, Categoría, Tipo de Plato, Kcal, Proteína, Carbos, Grasas, Ingredientes, Intolerancias, Pasos, URL)
- [ ] Confirmar plantillas base (ver opciones abajo)

**PLANTILLAS BASE GENERADAS (v5 — Enfoque sostenible con suelo calórico):**

```
FILOSOFÍA v5 — SOSTENIBLE > AGRESIVO
Basado en: Israetel/RP (suelos calóricos), Aragon (1.6-1.8g/kg proteína),
Morton et al. (2018) → 1.6g/kg meseta suficiente, Trexler/Henselmans
(grasas mín 25-30% para salud hormonal)

PRINCIPIOS CLAVE:
  • Proteína: 1.6-1.8 g/kg (suficiente para población general)
    — Morton et al. 2018: 1.6g/kg es meseta para hipertrofia en no-élite
    — Aragon & Schoenfeld 2023: población general no necesita >1.8g/kg
  • Grasas: mínimo 25-30% de kcal totales para salud hormonal
    — Trexler 2020: <20% grasa compromete testosterona y saciedad
    — Henselmans: mínimo 0.8-1.0 g/kg en déficit sostenible
  • Carbohidratos: el resto, generosos para adherencia
    — Más carbos = mejor adherencia en población general (Israetel/RP)
  • Suelo calórico mínimo: MUJERES >1.600 kcal | HOMBRES >2.000 kcal
    — Por debajo: riesgo de adaptación metabólica severa (Israetel 2022)
    — NIH/DGA 2020-2025: <1.500 kcal no cubre micronutrientes
  • Rango proteico: 105-150g/día (según peso).
    Suficiente y no intimidante para nuevos clientes.
  • Grasas: mínimo 55-70g/día (25-30%) para ciclo menstrual y saciedad.

PÉRDIDA DE PESO (Déficit suave-moderado — Nunca <1.600 kcal mujeres / <2.000 kcal hombres)

Plantilla 1: "Pérdida suave (1.600 kcal)"
- Perfil: mujer pequeña/ligera (~58-60kg) que empieza
- Kcal: 1.600 | Proteína: 105g (26%) | Carbos: 171g (43%) | Grasas: 55g (31%)
- Prot: 1.7g/kg | Grasas min 25-30% para salud hormonal femenina

Plantilla 2: "Pérdida moderada (1.900 kcal)"
- Perfil: mujer activa u hombre ligero (~68-72kg)
- Kcal: 1.900 | Proteína: 120g (25%) | Carbos: 216g (45%) | Grasas: 62g (29%)
- Carbohidratos generosos para mantener energía sin restricción percibida

Plantilla 3: "Pérdida activa (2.200 kcal)"
- Perfil: hombre activo que entrena y busca pérdida de grasa (~75-80kg)
- Kcal: 2.200 | Proteína: 135g (25%) | Carbos: 269g (49%) | Grasas: 65g (27%)
- Carbohidratos altos para rendimiento en entrenos y buena adherencia

GANANCIA DE MASA (Superávit moderado — Ganancia limpia)

Plantilla 4: "Ganancia moderada (2.600 kcal)"
- Perfil: persona que entrena fuerza (~80-85kg)
- Kcal: 2.600 | Proteína: 140g (22%) | Carbos: 364g (56%) | Grasas: 65g (23%)
- Carbohidratos altos para maximizar rendimiento y recuperación

Plantilla 5: "Ganancia activa (2.900 kcal)"
- Perfil: hardgainer o persona grande (~85-90kg) con alta demanda energética
- Kcal: 2.900 | Proteína: 150g (21%) | Carbos: 418g (58%) | Grasas: 70g (22%)
- Alta densidad de carbohidratos para rendimiento máximo

RECOMPOSICIÓN CORPORAL (Déficit ligero — Nicho principal ~80% de clientes)

Plantilla 6: "Recomposición (2.000 kcal)"
- Perfil: principiante o persona que retoma actividad (~72-78kg)
- Kcal: 2.000 | Proteína: 135g (27%) | Carbos: 235g (47%) | Grasas: 58g (26%)
- Proteína ligeramente elevada (1.8g/kg) para optimizar balance nitrogenado en déficit ligero

Plantilla 7: "Recomposición activa (2.300 kcal)"
- Perfil: persona que entrena regularmente (~78-82kg)
- Kcal: 2.300 | Proteína: 140g (24%) | Carbos: 296g (51%) | Grasas: 62g (24%)
- Carbohidratos dominantes para rendimiento en entrenos y adherencia
```

#### 0.2 Preparar Supabase
**QUÉ HACER:**
- [ ] Crear tabla `plantillas_dietas` (schema abajo)
- [ ] Insertar 7 plantillas (con valores de macros de arriba)
- [ ] Importar recetas desde CSV → tabla `recetas`
- [ ] Verificar que no hay duplicados
- [ ] RLS: plantillas visibles para coach_id = user.id

#### 0.3 Documentación
**ENTREGABLE:**
- [ ] README.md con cómo correr la app (npm install, npm run dev, variables de entorno)
- [ ] Script de importación de recetas (CSV → Supabase)

---

### FASE 1: QUESTIONNAIRES (Semanas 3-4)

#### 1.1 Crear UI Coach: Diseñador de cuestionarios

**RUTA:** `/cuestionarios` (nueva)

**COMPONENTE: `CuestionarioCreador.tsx`**

```typescript
// Pantalla para coach crear cuestionario
// Form con:
// - Nombre del cuestionario
// - Descripción (opcional)
// - Botón "+ Añadir pregunta"
// - List de preguntas (drag-drop reorder)
// - Por cada pregunta:
//   * Texto de la pregunta
//   * Tipo: "texto_libre" | "multiple_choice" | "escala" | "numero"
//   * Para multiple_choice: campos para opciones
//   * ¿Obligatoria?
// - Botón "Guardar cuestionario"
// - Genera código público único automáticamente
// - Copia link para compartir: /cuestionario/[codigo]
```

**FUNCIONALIDADES:**
- [x] Crear cuestionario nuevo
- [x] Editar existentes
- [x] Ver lista de cuestionarios (con # respuestas)
- [x] Duplicar cuestionario
- [x] Desactivar cuestionario
- [x] Copiar link público

#### 1.2 Crear UI Cliente: Formulario anónimo

**RUTA:** `/cuestionario/[codigo]` (nueva, sin login)

**COMPONENTE: `FormularioCliente.tsx`**

```typescript
// Pantalla pública (sin auth) donde cliente rellena
// - Encabezado: nombre del cuestionario + descripción
// - Form dinámica según tipo de pregunta:
//   * texto_libre: input text
//   * multiple_choice: radio buttons O select
//   * escala: slider 1-10
//   * numero: input type="number"
// - Validación: preguntas obligatorias
// - Botón "Enviar respuestas"
// - Confirmación: "Gracias, tu coach lo revisará pronto"
```

**FUNCIONALIDADES:**
- [x] Mostrar preguntas dinámicamente
- [x] Validar campos obligatorios
- [x] Enviar respuestas sin login
- [x] Mostrar confirmación

#### 1.3 Crear BD: Tablas de cuestionarios

**VER SCHEMA ABAJO**

**TABLAS NUEVAS:**
- `cuestionarios` (coach crea)
- `respuestas_clientes` (cliente envía)

#### 1.4 Crear API: Guardar respuestas

**ENDPOINT: `POST /api/respuestas`**

```typescript
// Input: { cuestionario_id, cliente_nombre, cliente_email, respuestas: {} }
// Output: { id, status: "guardada" }
// Validación: cuestionario existe, respuestas no vacías
// Efecto: Inserta en tabla respuestas_clientes
// Notificación: Email a coach (para v1.1)
```

#### 1.5 Crear Dashboard Coach: Ver respuestas

**RUTA:** `/respuestas` (nueva)

**COMPONENTE: `RespuestasClientes.tsx`**

```typescript
// Tabla con:
// - Nombre cliente
// - Email cliente
// - Cuestionario respondido
// - Fecha
// - Estado: "nueva" | "procesando" | "dieta_lista"
// - Acciones: Ver respuestas | Generar dieta | Ver dieta generada
```

---

### FASE 2A: IA GENERA DIETA (Semana 5)

#### 2A.1 Integración DeepSeek V3

**API ENDPOINT: `POST /api/generar-dieta-ia`**

```typescript
// Input: { respuesta_cliente_id }
// 
// Proceso:
// 1. Fetch respuesta_clientes + sus respuestas parseadas
// 2. Fetch plantillas_dietas (todas las disponibles)
// 3. Fetch recetas (todas, agrupadas por categoría)
// 4. Armar PROMPT para DeepSeek
// 5. Llamar DeepSeek V3 API
// 6. Parsear respuesta JSON
// 7. Crear estructura de dieta
// 8. Insertar en planes_nutricion + comidas + comida_alimentos
// 9. Actualizar respuestas_clientes.estado = "dieta_lista"
// 10. Return: { plan_id, status: "generada" }
```

#### 2A.2 Prompt Template para DeepSeek

```
Eres experto en nutrición deportiva y creación de planes personalizados.

CLIENTE:
- Objetivo: [objetivo de respuestas]
- Edad: [edad]
- Sexo: [sexo]
- Peso actual: [peso]
- Altura: [altura]
- Restricciones dietéticas: [restricciones]
- Preferencias: [preferencias]
- Disponibilidad de cocina: [disponibilidad]

PLANTILLAS DISPONIBLES (estructura y macros):
[JSON de todas las plantillas]

RECETAS DISPONIBLES (por categoría):
[Recetas agrupadas por: Desayuno, Almuerzo, Comida, Merienda, Cena, Snack]
Cada receta: { id, nombre, kcal_por_porcion, proteinas, carbos, grasas, porciones }

TAREA:
1. Analiza el objetivo del cliente
2. Elige la plantilla MÁS SIMILAR a su objetivo y datos
3. Usando SOLO recetas de la lista disponible:
   a. Elige 2-3 recetas por comida
   b. Ajusta porciones para que macros cumplan exactamente
   c. Respeta restricciones dietéticas del cliente
4. Genera dieta completa para un día

RESTRICCIÓN IMPORTANTE:
- Solo USA recetas que están en RECETAS DISPONIBLES
- NO inventes recetas
- Cumple macros exactamente (±5%)
- Elige comidas variadas (no repetidas en el día)

RESPONDE EN ESTE FORMATO JSON (VÁLIDO):
{
  "plantilla_id_elegida": "uuid",
  "razon_plantilla": "Por qué elegiste esta plantilla",
  "comidas": [
    {
      "nombre": "Desayuno",
      "orden": 1,
      "alimentos": [
        {
          "receta_id": "uuid",
          "receta_nombre": "Tostadas con aguacate",
          "cantidad_porciones": 1.5,
          "cantidad_gramos": 150
        }
      ]
    }
  ],
  "macros_totales": {
    "kcal": 1800,
    "proteinas": 135,
    "carbohidratos": 180,
    "grasas": 60
  },
  "notas": "Comentarios sobre por qué esta dieta es buena para este cliente"
}

RESPONDE SOLO JSON, SIN EXPLICACIONES PREVIAS.
```

#### 2A.3 Manejo de errores
- Si respuesta no valida: return error 400
- Si DeepSeek falla: return error 500, log error
- Si JSON inválido: return error 400, log JSON recibido
- Validación: macros ±10% del objetivo

---

### FASE 2B: COACH REVISA Y APRUEBA (Semana 6)

#### 2B.1 Dashboard: Ver respuestas y generar

**RUTA:** `/respuestas` (mejorada)

**COMPONENTE: `RespuestasClientes.tsx` (v2)**

```typescript
// Cuando coach clica "Ver respuesta":
// - Muestra respuestas en tabla legible
// - Botón "Generar dieta con IA"
// - Si ya existe: muestra dieta generada

// Cuando dieta está lista:
// - Muestra resumen: cliente, objetivo, kcal, macros
// - Botones: [Aceptar] [Rechazar] [Editar]
```

#### 2B.2 Estado de respuesta
```
"nueva" → Coach no ha visto aún
"procesando" → IA está generando dieta
"dieta_lista" → Dieta generada, pendiente aprobación
"dieta_aprobada" → Coach aprobó, cliente puede verla
"dieta_rechazada" → Coach rechazó, puede generar de nuevo
```

---

### FASE 2C: CONTROL MANUAL (Semana 7)

**YA EXISTE:**
- Ruta: `/dietas/[id]`
- Funcionalidad: buscar alimentos, cambiar recetas, editar cantidades, ver macros en tiempo real
- Guardar dieta

**SOLO DOCUMENTAR** cómo funciona para que Carlos entienda dónde está.

---

### FASE 3: PORTAL CLIENTE (Semana 8)

#### 3.1 Link público anónimo

**RUTA:** `/cliente/[codigo-unico]` (nueva, sin login)

**COMPONENTE: `PortalCliente.tsx`**

```typescript
// Pantalla pública (sin auth)
// - Encabezado: "Tu plan personalizado"
// - Resumen: Objetivo, kcal, macros
// - Tabla: comidas + alimentos
// - Botón: "Descargar PDF"
// - Info: "Plan creado por [Coach name]"
```

#### 3.2 Generar código único

Cuando coach aprueba dieta:
- Generar código único (uuid corto o string aleatorio)
- Guardar en tabla `planes_nutricion.codigo_publico`
- Generar link: `https://app.nutricoach.com/cliente/[codigo]`
- Coach copia link y envía a cliente

#### 3.3 PDF download

- Ruta: `/api/dietas/[id]/pdf`
- YA EXISTE (implementado anteriormente)
- Descarga como: `Plan-[ClienteName]-[Date].pdf`

---

## 💾 SCHEMA SUPABASE COMPLETO

### Tabla: `plantillas_dietas` (NUEVA)

```sql
CREATE TABLE plantillas_dietas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Información básica
  nombre TEXT NOT NULL, -- ej: "Pérdida 1.600 kcal"
  descripcion TEXT,
  objetivo TEXT NOT NULL, -- "pérdida" | "ganancia" | "recomposición"
  
  -- Macros objetivo
  kcal_objetivo INTEGER NOT NULL,
  proteinas_objetivo INTEGER NOT NULL,
  carbohidratos_objetivo INTEGER NOT NULL,
  grasas_objetivo INTEGER NOT NULL,
  
  -- Estructura (JSON)
  estructura JSONB, -- { "desayuno": {...}, "comida": {...}, ... }
  recetas_sugeridas JSONB, -- [{ comida: "Desayuno", receta_ids: [...] }]
  
  -- Metadatos
  tags TEXT[] DEFAULT '{}',
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT plantilla_macros_positivos CHECK (
    kcal_objetivo > 0 AND proteinas_objetivo > 0
  )
);

-- RLS: Coach solo ve sus plantillas
ALTER TABLE plantillas_dietas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach ve sus plantillas"
  ON plantillas_dietas FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "Coach crea sus plantillas"
  ON plantillas_dietas FOR INSERT
  WITH CHECK (coach_id = auth.uid());
```

### Tabla: `cuestionarios` (NUEVA)

```sql
CREATE TABLE cuestionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Información básica
  nombre TEXT NOT NULL,
  descripcion TEXT,
  
  -- Preguntas (JSON array)
  preguntas JSONB NOT NULL, -- [{ id, texto, tipo, opciones, obligatoria }, ...]
  
  -- Código público para link compartible
  codigo_publico TEXT NOT NULL UNIQUE,
  
  -- Control
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- RLS: Cuestionarios públicos por código, solo coach propietario edita
ALTER TABLE cuestionarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cuestionario público por código"
  ON cuestionarios FOR SELECT
  USING (true); -- Todos pueden verlo si conocen el código

CREATE POLICY "Coach edita sus cuestionarios"
  ON cuestionarios FOR UPDATE
  USING (coach_id = auth.uid());
```

### Tabla: `respuestas_clientes` (NUEVA)

```sql
CREATE TABLE respuestas_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cuestionario_id UUID NOT NULL REFERENCES cuestionarios(id) ON DELETE CASCADE,
  
  -- Información cliente
  cliente_nombre TEXT NOT NULL,
  cliente_email TEXT,
  
  -- Respuestas (JSON)
  respuestas JSONB NOT NULL, -- { "pregunta_id": valor, ... }
  
  -- Trazabilidad IA
  plantilla_sugerida_id UUID REFERENCES plantillas_dietas(id),
  
  -- Estados
  estado TEXT DEFAULT 'nueva', -- "nueva" | "procesando" | "dieta_lista" | "aprobada" | "rechazada"
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- RLS: Coach ve respuestas de sus cuestionarios
ALTER TABLE respuestas_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach ve respuestas de sus cuestionarios"
  ON respuestas_clientes FOR SELECT
  USING (
    cuestionario_id IN (
      SELECT id FROM cuestionarios WHERE coach_id = auth.uid()
    )
  );
```

### Tabla: `recetas` (EXISTENTE, revisar schema)

```sql
CREATE TABLE recetas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID REFERENCES auth.users(id),
  
  -- Información básica
  nombre TEXT NOT NULL,
  categoria TEXT, -- "Desayuno", "Almuerzo", "Comida", "Merienda", "Cena", "Snack"
  tipo_plato TEXT,
  dificultad TEXT,
  tiempo_minutos INTEGER,
  porciones INTEGER,
  
  -- Macros (por porción)
  kcal_por_porcion NUMERIC,
  proteinas_por_porcion NUMERIC,
  carbohidratos_por_porcion NUMERIC,
  grasas_por_porcion NUMERIC,
  fibra_por_porcion NUMERIC DEFAULT 0,
  
  -- Detalles
  ingredientes TEXT[],
  intolerancias TEXT[],
  pasos TEXT,
  url_origen TEXT,
  foto_url TEXT,
  
  -- Control
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- RLS: Coach solo ve sus recetas + recetas globales
ALTER TABLE recetas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver recetas propias y globales"
  ON recetas FOR SELECT
  USING (coach_id = auth.uid() OR coach_id IS NULL);
```

### Tabla: `planes_nutricion` (EXISTENTE, agregar campo)

```sql
ALTER TABLE planes_nutricion ADD COLUMN IF NOT EXISTS codigo_publico TEXT UNIQUE;

-- Este código se genera cuando coach aprueba dieta
-- Cliente accede a: /cliente/[codigo_publico]
```

---

## 🔌 API ENDPOINTS A IMPLEMENTAR

### 1. POST `/api/cuestionarios`
**Crear cuestionario**
```
Input:  { nombre, descripcion?, preguntas: Array }
Output: { id, codigo_publico }
Auth:   Requiere user (coach)
```

### 2. GET `/api/cuestionarios`
**Listar cuestionarios del coach**
```
Output: [{ id, nombre, preguntas.length, respuestas.count, activo }]
Auth:   Requiere user (coach)
```

### 3. PUT `/api/cuestionarios/[id]`
**Editar cuestionario**
```
Input:  { nombre?, descripcion?, preguntas?, activo? }
Output: { success }
Auth:   Requiere user (coach)
```

### 4. POST `/api/respuestas`
**Cliente envía respuestas**
```
Input:  { codigo_publico, cliente_nombre, cliente_email, respuestas: {} }
Output: { id, status: "guardada" }
Auth:   Público (sin login)
```

### 5. GET `/api/respuestas`
**Coach ve respuestas de sus cuestionarios**
```
Output: [{ id, cliente_nombre, cuestionario, estado, created_at }]
Auth:   Requiere user (coach)
```

### 6. POST `/api/generar-dieta-ia`
**IA genera dieta**
```
Input:  { respuesta_cliente_id }
Process:
  1. Fetch respuesta + parsear
  2. Fetch plantillas + recetas
  3. Llamar DeepSeek
  4. Parsear JSON
  5. Crear plan_nutricion + comidas
Output: { plan_id, macros }
Auth:   Requiere user (coach)
```

### 7. PUT `/api/respuestas/[id]/estado`
**Coach actualiza estado**
```
Input:  { estado: "aprobada" | "rechazada" }
Output: { success }
Auth:   Requiere user (coach)
```

### 8. GET `/api/plantillas`
**Listar plantillas del coach**
```
Output: [{ id, nombre, kcal_objetivo, objetivo }]
Auth:   Requiere user (coach)
```

---

## 🎨 UI COMPONENTS A CREAR

### 1. `components/CuestionarioCreador.tsx`
- Form para crear/editar cuestionarios
- Drag-drop de preguntas
- Diferentes tipos de pregunta

### 2. `components/FormularioCliente.tsx`
- Formulario anónimo
- Renderiza dinámicamente según preguntas
- Validación

### 3. `components/RespuestasClientes.tsx`
- Tabla de respuestas recibidas
- Ver respuesta
- Ver dieta generada
- Aprobar/rechazar

### 4. `components/PortalCliente.tsx`
- Página pública para cliente
- Muestra dieta
- Botón descargar PDF

---

## 🤖 INSTRUCCIONES PARA DEEPSEEK

### SI CLAUDE SE QUEDA SIN TOKENS:

**CONTEXTO ACTUAL:**
- MVP de 8 semanas en Fase 0 (setup de plantillas + recetas)
- Objetivo: Reemplazar Harbiz con coach auto-generador de dietas
- Stack: Next.js 14 + Supabase + DeepSeek V3

**QUÉ HACER SI CLAUDE NO ESTÁ:**

1. **LEE PRIMERO:**
   - Este documento (ESTRATEGIA_MVP_COMPLETA.md)
   - CLAUDE.md del proyecto
   - config_delegation_rules.md (en memoria)

2. **CONTINÚA CON LA FASE EN CURSO:**
   - Si en Fase 0: Termina importación de recetas + crear plantillas
   - Si en Fase 1: Implementa cuestionarios (UI + API)
   - Si en Fase 2A: Integra DeepSeek (API + prompt)

3. **ANTES DE CUALQUIER CAMBIO:**
   - Verifica con Carlos que entiende qué vas a hacer
   - No hagas cambios arquitectónicos sin preguntar
   - Si hay ambigüedad, pregunta (no asumas)

4. **CAMBIOS NO PERMITIDOS:**
   - ❌ Cambiar stack (Next.js → otra cosa)
   - ❌ Cambiar DB principal (Supabase → otra cosa)
   - ❌ Eliminar funcionalidad existente sin preguntar
   - ❌ Hacer cambios estéticos sin PLAN_ESTETICO.md completado

5. **CAMBIOS PERMITIDOS (sin preguntar):**
   - ✅ Implementar fases según roadmap
   - ✅ Agregar validaciones
   - ✅ Mejorar rendimiento
   - ✅ Bugs fixes
   - ✅ Testing

6. **SI DEBES PAUSAR:**
   - Documenta dónde estás
   - Qué falta por hacer
   - Qué errores encontraste
   - Qué Carlos debe confirmar cuando Claude vuelva

---

## 🎯 PREFERENCIAS DE CARLOS

### Operacionales
- **Control manual:** Tú cambias recetas como Harbiz, sin IA automática (por ahora)
- **Testing real:** Usar con 2-3 clientes reales para ver qué falla
- **Feedback iterativo:** Carlos da feedback después de cada fase
- **Escalabilidad:** Sistema debe soportar agregar IA automática sin cambios estructurales

### Tecnológicas
- **Lenguaje:** Spanish (castellano) siempre en UI + documentación
- **Móvil:** Acceso iOS importante (Carlos usa mucho móvil)
- **Formato fechas:** DD-MM-YYYY
- **Idioma código:** Inglés es OK, comentarios en español si necesario

### No negocia
- ✅ Supabase como BD (decidido)
- ✅ DeepSeek V3 como IA (decidido)
- ✅ MVP en 8 semanas (objetivo)
- ✅ Funcionalidad > Estética en v1 (prioridad)
- ✅ Control manual en v1 (estrategia)

### Puede cambiar
- ❓ Plantillas (genera 7 genéricas, Carlos ajusta)
- ❓ Orden de fases (si hay blockers técnicos, avisar)
- ❓ Estética (deja para v1.1)

---

## 🧪 TESTING POR FASE

### Fase 0
- [ ] CSV de recetas importado sin duplicados
- [ ] Plantillas en BD con macros correctos
- [ ] App compila sin errores

### Fase 1
- [ ] Coach crea cuestionario
- [ ] Link público funciona
- [ ] Cliente rellena formulario
- [ ] Respuestas se guardan correctamente
- [ ] Coach ve respuestas en dashboard

### Fase 2A
- [ ] Endpoint POST `/api/generar-dieta-ia` funciona
- [ ] DeepSeek recibe prompt correcto
- [ ] JSON parseado correctamente
- [ ] Dieta creada en BD con macros correctos
- [ ] Validar macros ±10% del objetivo

### Fase 2B
- [ ] Coach ve dieta generada en UI
- [ ] Botones Aceptar/Rechazar funcionan
- [ ] Estado se actualiza correctamente

### Fase 2C
- [ ] Editar receta existente
- [ ] Cambiar cantidades
- [ ] Macros se recalculan
- [ ] Guardado sin errores

### Fase 3
- [ ] Cliente accede con link público
- [ ] Ve dieta correctamente
- [ ] Descarga PDF sin errores

---

## 📞 CONTACTO Y ESCALACIONES

**Si bloqueador técnico:**
- DeepSeek: Intenta resolver, documenta, espera Claude

**Si confusión en specs:**
- DeepSeek: Pregunta a Carlos claramente (no asumas)

**Si cambio de prioridades:**
- Carlos comunica nuevas prioridades
- DeepSeek ajusta roadmap

---

## 📝 CHANGELOG

| Fecha | Versión | Cambios |
|-------|---------|---------|
| 26-04-2026 | 1.0 | Documento inicial. Estrategia MVP completa, specs Fase 0-3. |
| 26-04-2026 | 1.1 (v5) | Plantillas actualizadas a v5: enfoque sostenible, suelo calórico (mujeres >1.600, hombres >2.000), proteína 1.6-1.8g/kg (Morton/Aragon), grasas min 25-30% (Trexler/Henselmans). Seed SQL + TypeScript script + API endpoint creados. |

---

**Documento crítico: Leer COMPLETO antes de continuar trabajo.**  
**Última revisión: 26-04-2026**
