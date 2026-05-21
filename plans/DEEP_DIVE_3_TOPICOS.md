# 🧠 Deep-Dive: Los 3 Pilares para Decidir

> Documento de análisis para que puedas decidir QUÉ implementar y CÓMO.
> Basado en el código actual de NutriCoach + investigación de competidores.

---

## Índice

1. [🧬 Knowledge Base como Obsidian/NotebookLM científico](#1-conocimiento-base-como-obsidiannotebooklm-científico)
2. [📊 TDEE Dinámico — El Corazón de MacroFactor](#2-tdee-dinámico--el-corazón-de-macrofactor)
3. [💪 Taxonomía Muscular con UUIDs — La Base de Datos de wger](#3-taxonomía-muscular-con-uuids--la-base-de-datos-de-wger)
4. [📐 Comparativa visual de los 3 sistemas](#4-comparativa-visual-de-los-3-sistemas)

---

## 1. 🧬 Conocimiento Base como Obsidian/NotebookLM científico

### Situación actual (lo que tenemos AHORA)

Tienes **DOS sistemas de conocimiento científico** que coexisten pero NO están conectados:

#### Sistema A: Hardcoded en TypeScript (18 protocolos)

[`lib/knowledge-base.ts`](lib/knowledge-base.ts:1) — 474 líneas con 18 `ProtocoloCientifico` escritos a mano:

```typescript
export interface ProtocoloCientifico {
  id: string
  titulo: string
  tags: string[]
  resumen: string      // Texto largo con explicación + referencias
  referencias: string[]
}
```

Ejemplo real del protocolo `perdida_grasa`:

```
La evidencia actual (Slater et al., 2023; Helms et al., 2014) respalda...
El déficit calórico debe ser de 300-500 kcal/día...
La proteína debe mantenerse en 2.2-2.4 g/kg para preservar masa magra...
```

**Flujo actual:** En [`app/api/generar-plan-inicial/route.ts:3`](app/api/generar-plan-inicial/route.ts:3) se importa:

```typescript
import { seleccionarProtocolos, formatearEvidenciaParaPrompt } from '@/lib/knowledge-base'
```

Esto se usa en `construirPrompt()` en [`lib/deepseek.ts:66`](lib/deepseek.ts:66) para inyectar evidencia científica directamente en el prompt de DeepSeek.

**¿Cómo se seleccionan?** Por tags matching con el perfil del cliente:
- `detectarTags(perfil)` → normaliza el onboarding a un `Set<string>` de tags
- `seleccionarProtocolos(perfil, limite=5)` → hace scoring por coincidencia de tags, devuelve top 5
- `formatearEvidenciaParaPrompt(protocolos)` → formatea como markdown para inyectar

#### Sistema B: Supabase knowledge_base (tabla SQL)

Archivo [`supabase_knowledge_base.sql`](supabase_knowledge_base.sql:6):

```sql
CREATE TABLE public.knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  disciplina text,       -- nutricion, hyrox, running, fuerza...
  categoria text,        -- periodizacion, proteina, patologia...
  tipo text,             -- estudio, meta_analisis, guia_clinica...
  titulo text,
  resumen text,
  contenido_completo text,
  puntos_clave text[],   -- Array de strings
  tags text[],
  condiciones text[],    -- diabetes_t2, hta, menopausia...
  nivel_evidencia text,  -- meta_analisis, rct, opinion_experto...
  verificado boolean,
  busqueda tsvector      -- Búsqueda全文 en español
);
```

Se consulta desde [`lib/knowledge.ts:12`](lib/knowledge.ts:12):

```typescript
export async function fetchKnowledgeContext(
  supabase: SupabaseClient,
  opts: { disciplinas: string[]; condiciones?: string[]; limite?: number }
): Promise<string>
```

**Problema:** Esta función existe pero NO se está usando en el pipeline actual de generación de planes. Solo el Sistema A (hardcoded) está activo.

### La visión Obsidian/NotebookLM

Tu intuición es correcta: la visión es tener un **sistema de conocimiento vivo** que:

1. **Ingiere papers nuevos automáticamente** (PubMed RSS, DOI, feeds)
2. **DeepSeek los lee, resume y evalúa** (nivel de evidencia, población aplicable)
3. **Los almacena en Supabase** con metadatos estructurados
4. **Los selecciona dinámicamente** según el perfil de cada cliente
5. **Los inyecta en el prompt** de generación de planes
6. **Aprende de los resultados** (qué papers generan mejores outcomes)

```
                    ┌─────────────────────┐
                    │   PubMed RSS feed    │
                    │   DOI manual         │
                    │   Scraping journals  │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   DeepSeek Reader   │
                    │  - Lee el abstract  │
                    │  - Extrae:          │
                    │    • Población      │
                    │    • Intervención   │
                    │    • Resultados     │
                    │    • Nivel evidencia│
                    │    • Tags clave     │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Evaluador de      │
                    │   Relevancia        │
                    │  - ¿Aplica a        │
                    │    nuestros         │
                    │    clientes?        │
                    │  - ¿Contradice      │
                    │    conocimiento     │
                    │    existente?       │
                    └──────────┬──────────┘
                               │ sí
                    ┌──────────▼──────────┐
                    │   Supabase          │
                    │   knowledge_base    │
                    │   + verificado=true │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Selección por     │
                    │   perfil cliente    │
                    │  - objetivo         │
                    │  - condiciones      │
                    │  - deporte          │
                    │  - restricciones    │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Inyección en      │
                    │   prompt DeepSeek   │
                    │  "Basándote en      │
                    │   estos 5 estudios  │
                    │   recientes..."     │
                    └─────────────────────┘
```

### ¿Qué implica implementarlo?

| Componente | Estado actual | Lo que habría que hacer |
|------------|--------------|------------------------|
| **Ingesta de papers** | ❌ No existe | Script que: (a) lee feed RSS PubMed con query de nutrición/entreno, (b) por cada paper nuevo llama a DeepSeek para resumir, (c) inserta en `knowledge_base` |
| **Unificación sistemas A+B** | ⚠️ Existen 2 sistemas separados | Refactorizar `lib/knowledge-base.ts` para que también consulte Supabase, no solo los 18 hardcoded. O migrar los 18 a Supabase y eliminar el archivo. |
| **Pipeline de evaluación** | ❌ No existe | DeepSeek debe evaluar: nivel de evidencia, población diana, si contradice conocimiento existente, relevancia para nuestros clientes. |
| **Selección dinámica** | ⚠️ Parcial (solo tags) | Mejorar: añadir peso por actualidad, por nivel de evidencia, por resultados previos con clientes similares. |
| **Bucle de aprendizaje** | ❌ No existe | Tracking de qué papers se usaron en cada plan, y correlación con resultados (checkins, progreso). |
| **Interfaz coach** | ❌ No existe | Panel tipo "biblioteca" donde puedas ver/editar/validar papers, ver qué se usó con cada cliente. |

### ¿Qué valor aporta?

- **Hoy:** 18 protocolos escritos a mano, estáticos, que hay que mantener manualmente.
- **Con el sistema vivo:** Cientos de papers, actualizados semanalmente, seleccionados por IA para cada cliente, con trazabilidad de resultados.

**Ejemplo concreto:** Sale un nuevo meta-análisis sobre proteína en mujeres post-menopáusicas. El sistema:
1. Lo detecta en PubMed
2. DeepSeek lo resume y etiqueta `poblacion: ['mujeres', 'post-menopausia'], condiciones: ['menopausia']`
3. Cuando una cliente con perfil `{ sexo: 'mujer', edad: 54, condiciones: ['menopausia'] }` genera un plan
4. El sistema selecciona ese paper automáticamente
5. DeepSeek genera el plan citando la nueva evidencia

---

## 2. 📊 TDEE Dinámico — El Corazón de MacroFactor

### Situación actual

En [`app/api/generar-plan-inicial/route.ts:43`](app/api/generar-plan-inicial/route.ts:43):

```typescript
function calcularTDEE(peso, altura, edad, sexo, actividad): number {
  const tmb = sexo === 'mujer'
    ? 10 * peso + 6.25 * altura - 5 * edad - 161  // Mifflin-St Jeor mujer
    : 10 * peso + 6.25 * altura - 5 * edad + 5     // Mifflin-St Jeor hombre
  const factor = ACTIVIDAD_FACTOR[actividad] ?? 1.55
  return Math.round(tmb * factor)
}
```

**Esto es una FÓRMULA ESTÁTICA.** Le estimas el gasto energético al cliente una vez y te quedas con ese número para siempre. El cliente te dice "soy activo" y le pones 1.725. Pero:

- ¿Y si sobreestima su actividad?
- ¿Y si su peso cambia?
- ¿Y si su NEAT (actividad no asociada al ejercicio) varía?
- ¿Y si está en déficit y su metabolismo se adapta?

### Cómo funciona el TDEE dinámico de MacroFactor

MacroFactor resuelve esto con un **algoritmo de kalman filter / regresión lineal sobre datos reales**.

#### El principio básico

```
TDEE_real = calorías_consumidas + delta_almacenadas

Donde:
  - calorías_consumidas = media de kcal registradas en los últimos 7 días
  - delta_almacenadas = cambio de peso semanal × 7700 kcal/kg (energía del tejido adiposo)
```

#### Fórmula expandida

```
TDEE_real_semanal = (Σ kcal_diarias_7dias / 7) + (Δ_peso_semanal × 7700 / 7)

Ejemplo numérico:
  - Media kcal registradas: 2,100 kcal/día
  - Peso lunes: 78.5 kg
  - Peso lunes siguiente: 77.9 kg
  - Δ_peso: -0.6 kg/semana (≈ -85.7 g/día)
  - 85.7 g × 7.7 kcal/g = 660 kcal/día de déficit real
  - TDEE_real = 2,100 + 660 = 2,760 kcal/día
```

#### El algoritmo real de MacroFactor (simplificado)

```typescript
interface DatosPesoDiario {
  fecha: string
  peso_kg: number
  calorias_registradas: number
}

interface ResultadoTDEE {
  tdee_estimado: number      // kcal/día
  tendencia_peso: number      // kg/semana
  confianza: number           // 0-1 (baja cuando hay pocos datos)
  recomendacion: {
    accion: 'mantener' | 'subir' | 'bajar'
    nuevas_kcal_objetivo: number
    ajuste_semanal_max: number  // Ej: ±100 kcal/semana máximo
  }
}

function calcularTDEEdinamico(
  historialPeso: DatosPesoDiario[],  // Mínimo 7 días
  objetivo: string                    // perder_grasa | ganar_musculo | mantener
): ResultadoTDEE {

  // 1. Suavizado del peso corporal (rolling average 7 días)
  const pesoSuavizado = suavizarMediaMovil(historialPeso.map(d => d.peso_kg), 7)

  // 2. Regresión lineal sobre peso suavizado → tendencia real
  const tendencia = regresionLineal(pesoSuavizado) // pendiente en kg/día

  // 3. Cálculo del TDEE real
  const kcalMedia = mediaUltimos7Dias(historialPeso.map(d => d.calorias_registradas))
  const tdeeReal = Math.round(kcalMedia + (tendencia * 7700))

  // 4. Cálculo de la tasa de pérdida/ganancia real
  const tasaSemanal = tendencia * 7 // kg/semana

  // 5. Comparación con la tasa objetivo (según objetivo)
  const tasaObjetivo = OBJETIVO_TASA[objetivo] // p.ej. -0.5 kg/sem para perder_grasa
  const desviacion = tasaSemanal - tasaObjetivo

  // 6. Ajuste calórico con límite de seguridad
  const ajusteKcal = Math.round(desviacion * 7700 / 7) // kcal/día para corregir
  const ajusteAcotado = clamp(ajusteKcal, -100, 100) // Máximo ±100 kcal/semana

  return {
    tdee_estimado: tdeeReal,
    tendencia_peso: tasaSemanal,
    confianza: calcularConfianza(historialPeso.length),
    recomendacion: {
      accion: desviacion > 0.1 ? 'subir' : desviacion < -0.1 ? 'bajar' : 'mantener',
      nuevas_kcal_objetivo: tdeeReal + ajusteAcotado,
      ajuste_semanal_max: 100
    }
  }
}
```

#### Adherence-Aware Adjustments

MacroFactor tiene un truco más: **ajusta según la adherencia del cliente**.

```
Si el cliente registra comida ≥80% de los días:
  → Confianza alta → ajuste completo

Si el cliente registra comida 50-80% de los días:
  → Confianza media → ajuste parcial (50% del ajuste calculado)

Si el cliente registra comida <50% de los días:
  → Confianza baja → NO ajustar, pedir más datos
```

### Estado actual en NutriCoach vs implementación TDEE

| Aspecto | Hoy (NutriCoach) | Con TDEE dinámico |
|---------|------------------|-------------------|
| **Cálculo** | Mifflin-St Jeor estático (1 vez) | Kalman filter sobre datos reales (cada checkin) |
| **Precisión** | ±300-500 kcal (error típico de fórmulas) | ±50-100 kcal (con 2+ semanas de datos) |
| **Adaptación** | Manual (el coach ajusta a ojo) | Automática (±100 kcal/semana máx) |
| **Datos necesarios** | Peso + altura + actividad auto-reportada | Peso diario + kcal registradas (food logging) |
| **Food logging** | ❌ No existe | Necesario implementarlo |
| **Checkins** | ✅ Sí existen | Alimentaríamos el modelo con checkins de peso |
| **Báscula integrada** | ❌ No | Con el tiempo, integrar API de básculas WiFi |

### ¿Qué habría que implementar?

1. **Food diary** (el más gordo) — Que el cliente pueda registrar lo que come cada día. Sin esto, no hay TDEE dinámico porque no sabemos las kcal consumidas.
   - FatSecret API o nuestra propia interfaz
   - Barcode scanner + Open Food Facts

2. **Motor de TDEE dinámico** — El algoritmo de kalman filter + regresión + ajuste automático
   - Nuevo archivo: `lib/tdee-dinamico.ts`

3. **Integración con checkins** — Ya tienes checkins con peso. Habría que añadir kcal medias de los últimos 7 días.

4. **Dashboard de visualización** — Gráfica de TDEE real vs estimado, tendencia de peso, etc.

### Ejemplo real

**Cliente: Pedro, 85 kg, objetivo perder grasa**

**Semana 1 (estimación inicial):**
- Mifflin-St Jeor: TDEE = 2,650 kcal
- Déficit: -400 kcal → objetivo 2,250 kcal

**Semana 3 (primer ajuste dinámico):**
- Media kcal registradas: 2,180 kcal/día
- Peso: 85.0 → 84.3 kg (-0.7 kg)
- TDEE real: 2,180 + (0.7 × 7700 / 7) = 2,180 + 770 = 2,950 kcal
- **¡El TDEE real es 300 kcal más alto de lo estimado!** → Subimos objetivo a 2,450 kcal

**Semana 5:**
- Media kcal: 2,320 kcal/día
- Peso: 84.3 → 83.8 kg (-0.5 kg)
- TDEE real: 2,320 + (0.5 × 7700 / 7) = 2,320 + 550 = 2,870 kcal
- Tasa ideal: -0.5 kg/semana → **mantenemos calorías** porque está perfecto

**Sin TDEE dinámico,** Pedro habría estado comiendo 2,250 kcal todo el tiempo, perdiendo peso más rápido de lo deseado (con posible pérdida muscular) y sintiéndose cada vez más cansado.

---

## 3. 💪 Taxonomía Muscular con UUIDs — La Base de Datos de wger

### Situación actual

Tienes un archivo [`seed_ejercicios.sql`](seed_ejercicios.sql:1) con 385 líneas y ~150 ejercicios. La estructura actual es:

```sql
insert into public.ejercicios (nombre, grupo_muscular, tipo, descripcion) values
  ('Press banca plano', 'Pecho', 'fuerza', 'Ejercicio compuesto para pecho...'),
  ...
```

**Problemas de esta estructura:**
1. `grupo_muscular` es un **string** (texto libre): 'Pecho', 'Espalda', 'Hombros', 'Piernas'
2. Un ejercicio solo puede tener **un** grupo muscular principal
3. No hay forma de saber **qué músculos secundarios** trabaja
4. No hay **equipamiento** asociado
5. No hay **variaciones** (press banca plano vs inclinado vs declinado como entidades relacionadas)
6. No hay **UUIDs** → no puedes referenciar ejercicios de forma portable
7. No hay **categorías** (fuerza, hipertrofia, cardio, etc.) como entidad estructurada

### Cómo lo hace wger

wger (referencia: 331 snippets, benchmark 73.1) modela los ejercicios como una **ontología muscular completa**:

```typescript
// Ejercicio base
interface Exercise {
  uuid: string                    // UUID único, portable entre instancias
  name: string                    
  description: string
  category: number                // FK a ExerciseCategory
  muscles: number[]              // FK a Muscle → músculos primarios
  muscles_secondary: number[]    // FK a Muscle → músculos secundarios
  equipment: number[]            // FK a Equipment
  variations: number[]           // IDs de ejercicios variantes
}

// Músculos (ontología completa)
interface Muscle {
  id: number
  name: string
  name_en: string                // Nombres bilingües
  is_front: boolean              // ¿Es frontal o posterior?
  image_url_front: string        // URL de imagen de anatomía (frontal)
  image_url_back: string         // URL de imagen de anatomía (posterior)
}

// Categorías de ejercicio
interface ExerciseCategory {
  id: number
  name: string                   // "Strength", "Cardio", "Stretching", etc.
}

// Equipamiento
interface Equipment {
  id: number
  name: string                   // "Barbell", "Dumbbell", "Kettlebell", "Body weight", etc.
}

// Log de trabajo real
interface WorkoutLog {
  id: number
  exercise: number               // FK a Exercise
  workout: number                // FK a Workout (sesión)
  reps: number
  weight: number
  rir: number                    // Reps in reserve
  estimated_1rm: number          // Estimado con fórmula de Epley
}

// Fórmula Epley para 1RM estimado
function epley1RM(peso: number, reps: number): number {
  return peso * (1 + reps / 30)
}
```

### ¿Por qué esto es tan potente?

Con esta taxonomía puedes hacer cosas que **hoy no puedes**:

#### 1. Calcular volumen semanal por grupo muscular

```typescript
function calcularVolumenSemanal(
  logs: WorkoutLog[],
  ejercicios: Map<string, Exercise>
): Map<string, number> {
  // Agrupar por músculo primario
  // Sumar: reps × peso × series para cada músculo
  // Detectar: ¿está pectoral recibiendo suficiente volumen?
}

// Ejemplo de output:
// {
//   'Pectoral mayor': 14400,  // kg de volumen semanal
//   'Dorsal ancho': 10800,
//   'Cuádriceps': 9600,
//   ...
// }
```

#### 2. Detectar desbalances musculares

```typescript
function detectarDesbalances(
  volumenMuscular: Map<string, number>
): string[] {
  const ratioPushPull = volumenMuscular.get('Pecho') / volumenMuscular.get('Espalda')
  if (ratioPushPull > 1.5) return ['Exceso de empuje vs tirón. Añadir más remo.']
  
  const ratioCuadricepsFemoral = 
    volumenMuscular.get('Cuádriceps') / volumenMuscular.get('Isquiotibiales')
  if (ratioCuadricepsFemoral > 2) return ['Desequilibrio cuádriceps/isquio. Riesgo de lesión LCA.']
}
```

#### 3. Sugerir ejercicios para músculos infra-entrenados

```typescript
function sugerirEjercicios(
  volumenActual: Map<string, number>,
  volumenObjetivo: Map<string, number>,
  ejerciciosDisponibles: Exercise[]
): Exercise[] {
  const musculosCarentes = [...volumenObjetivo.entries()]
    .filter(([musculo, objetivo]) => (volumenActual.get(musculo) ?? 0) < objetivo * 0.8)
    .map(([musculo]) => musculo)
  
  return ejerciciosDisponibles
    .filter(ej => ej.muscles.some(m => musculosCarentes.includes(m)))
    .slice(0, 3)
}
```

#### 4. Estimar 1RM automáticamente

Con la fórmula de Epley:
```
1RM = peso × (1 + reps / 30)

Ejemplo: Press banca 80 kg × 8 reps
1RM = 80 × (1 + 8/30) = 80 × 1.267 = 101 kg
```

Cada vez que un cliente registra un entreno, actualizas su 1RM estimado. Esto permite:
- Programar cargas relativas (% del 1RM) automáticamente
- Detectar estancamiento (mismo 1RM durante 3+ semanas)
- Sugerir deload cuando se acumula fatiga (caída del 1RM estimado)

### Lo que la taxonomía UUID aporta como PLUS

wger asigna un **UUID a cada ejercicio**. Esto significa:

1. **Portabilidad:** El ejercicio 'Press banca plano' tiene el mismo UUID en todas las instancias de wger del mundo
2. **Interoperabilidad:** Puedes compartir rutinas entre apps
3. **Versionado:** Puedes tener el mismo ejercicio con distintas versiones (actualización de metadata)
4. **Seed universal:** Puedes mergear datasets de ejercicios de distintas fuentes sin conflictos

### Estado actual vs implementación

| Aspecto | Hoy (seed_ejercicios.sql) | Con taxonomía UUID |
|---------|---------------------------|-------------------|
| **Modelo** | 1 campo `grupo_muscular` como string | Múltiples músculos primarios + secundarios con FK |
| **UUID** | ❌ No | ✅ Cada ejercicio tiene UUID |
| **Equipamiento** | ❌ No | ✅ Barra, mancuerna, polea, peso corporal, etc. |
| **Variaciones** | ❌ No (nombres similares pero no relacionados) | ✅ Array de IDs de variantes |
| **Categorías** | ❌ No (solo tipo: 'fuerza') | ✅ Strength, Cardio, Stretching, HIIT, etc. |
| **Imágenes anatomía** | ❌ No | ✅ Imágenes frontal/posterior por músculo |
| **1RM estimado** | ❌ No | ✅ Automático con Epley |
| **Volumen por músculo** | ❌ No | ✅ Cálculo semanal automático |
| **Detección desbalances** | ❌ No | ✅ Ratio push/pull, cuádriceps/isquio, etc. |
| **Log de entreno** | ⚠️ Básico | ✅ reps + peso + rir + estimated_1rm |

### ¿Qué implica implementarlo?

1. **Migrar `seed_ejercicios.sql`** a nuevo schema con:
   - `ejercicios` con `uuid, name, category_id, equipment_ids[], description`
   - `musculos` con `id, name, name_en, is_front`
   - `ejercicio_musculos` tabla puente con `ejercicio_id, musculo_id, es_primario`
   - `ejercicio_variaciones` tabla puente con `ejercicio_id, variacion_id`

2. **Script de migración** que transforme los ~150 ejercicios actuales al nuevo schema, asignando UUIDs y mapeando músculos.

3. **Actualizar `RegistrarEntrenoModal.tsx`** para que capture reps + peso + rir.

4. **Nuevo motor:** `lib/analisis-volumen.ts` con:
   - Cálculo de volumen semanal por músculo
   - Detección de desbalances
   - Sugerencia de ejercicios correctivos
   - Estimación de 1RM

5. **Integración con IA:** Que DeepSeek pueda usar los datos de volumen/desbalances para ajustar la siguiente semana de entreno.

---

## 4. 📐 Comparativa visual de los 3 sistemas

### Mapa de dependencias

```
                    ┌─────────────────────────────────┐
                    │         TDEE DINÁMICO           │
                    │                                 │
                    │  Necesita:                      │
                    │  └── Food Diary (registro        │
                    │      de alimentos diario)        │
                    │  └── Checkins de peso            │
                    │      (ya existen)                │
                    │  └── Algoritmo kalman filter     │
                    │      (nuevo)                     │
                    │                                 │
                    │  Output: Ajuste calórico         │
                    │  semanal automático              │
                    └──────────────┬──────────────────┘
                                   │
                                   ▼
┌─────────────────────┐    ┌─────────────────────────────────┐
│  KNOWLEDGE BASE     │───▶│         DEEPSEEK V3            │
│  (viva + dinámica)  │    │                                 │
│                     │    │  Recibe:                       │
│  - Papers nuevos    │    │  └── Evidencia científica       │
│  - Selección por    │    │      (knowledge base)           │
│    perfil           │    │  └── TDEE real del cliente      │
│  - Inyección en     │    │      (tdee dinámico)            │
│    prompt           │    │  └── Volumen muscular semanal   │
│                     │    │      (taxonomía UUID)           │
│                     │    │                                 │
│                     │    │  Genera: Plan hiper-            │
│                     │    │  personalizado + científico     │
└─────────────────────┘    └─────────────────────────────────┘
                                   ▲
                                   │
                    ┌─────────────────────────────────┐
                    │  TAXONOMÍA MUSCULAR UUID        │
                    │                                 │
                    │  Necesita:                      │
                    │  └── Migrar seed_ejercicios.sql  │
                    │  └── Nuevo schema con            │
                    │      músculos y equipamiento     │
                    │  └── Log de entreno mejorado     │
                    │      (reps + peso + rir)         │
                    │                                 │
                    │  Output: Volumen semanal por     │
                    │  músculo + detección             │
                    │  desbalances                     │
                    └─────────────────────────────────┘
```

### Prioridad recomendada para decidir

```
                    ┌─────────────────────────────┐
                    │   MÁS IMPACTO  ←→  MÁS      │
                    │                  ESFUERZO   │
                    ├─────────────────────────────┤
                    │  1. Knowledge Base viva     │
                    │     (impacto: alto)         │
                    │     (esfuerzo: medio)       │
                    │                             │
                    │  2. Taxonomía muscular UUID │
                    │     (impacto: medio-alto)   │
                    │     (esfuerzo: medio)       │
                    │                             │
                    │  3. TDEE dinámico           │
                    │     (impacto: muy alto)     │
                    │     (esfuerzo: alto*)       │
                    │                             │
                    │  * Requiere food diary      │
                    │    que no existe            │
                    └─────────────────────────────┘
```

### Mi recomendación

Basado en tu interés explícito y el estado actual del proyecto:

1. **Knowledge Base viva → HACER AHORA.** Es donde mejor relación impacto/esfuerzo tienes. Ya tienes los 2 sistemas base, solo falta conectarlos y añadir el pipeline de ingesta. Es literalmente "hacer que los papers que ya tienes empiecen a fluir solos".

2. **Taxonomía muscular UUID → HACER DESPUÉS.** Te permitirá convertir el entreno de "aquí tienes una rutina" a "ajusto el volumen por músculo según tu progreso". Es un salto cualitativo enorme en personalización.

3. **TDEE dinámico → REQUIERE REFLEXIÓN.** Es el más potente pero requiere food logging, que es un feature grande. Mi sugerencia: implementar primero un MVP simple (ajuste basado solo en peso en checkins, sin food diary) y luego escalar. Pero si quieres hacerlo bien desde el principio, necesitas food diary + barcode scanner.

---

**¿Qué opinas? ¿Te ayudo a decidir por dónde empezamos?**
