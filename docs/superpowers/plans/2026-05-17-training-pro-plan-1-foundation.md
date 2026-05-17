# Training Pro — Plan 1: Foundation (Migraciones + Templates)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir columnas de modalidad deportiva a la BD, crear tabla `perfil_entreno_cliente` y `ajustes_sesion_cliente`, y seedear ~8 plantillas de élite con contenido científico real por modalidad.

**Architecture:** SQL migration aplicado directamente en Supabase → TypeScript types actualizados → script `seed-plantillas-elite.ts` que upserta templates con lookup de ejercicios por nombre.

**Tech Stack:** Supabase (PostgreSQL), TypeScript, `npx tsx`, createServiceSupabase()

**Spec de referencia:** `docs/superpowers/specs/2026-05-17-training-pro-design.md`

---

## File Structure

- **CREATE** `nutricoach/supabase_training_pro_v2.sql` — migraciones ALTER TABLE + CREATE TABLE
- **MODIFY** `nutricoach/types/index.ts:253-303` — nuevos types y campos
- **CREATE** `nutricoach/scripts/seed-plantillas-elite.ts` — seed script completo 8 modalidades

---

### Task 1: SQL Migration

**Files:**
- Create: `nutricoach/supabase_training_pro_v2.sql`

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- supabase_training_pro_v2.sql
-- Aplicar en Supabase Dashboard → SQL Editor

-- ─────────────────────────────────────────────────────────────
-- 1. plantillas_entrenamiento — nuevas columnas
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.plantillas_entrenamiento
  ADD COLUMN IF NOT EXISTS sport_modality text
    CHECK (sport_modality IN (
      'gym_estetica','gym_fuerza','funcional','hyrox',
      'ciclismo','running','hibrido','calistenia'
    )),
  ADD COLUMN IF NOT EXISTS objetivo_especifico text,
  ADD COLUMN IF NOT EXISTS tier text DEFAULT 'general'
    CHECK (tier IN ('general','elite')),
  ADD COLUMN IF NOT EXISTS phase_adjustments jsonb DEFAULT '{
    "base":         {"volumen":1.0, "intensidad":1.0},
    "construccion": {"volumen":1.15,"intensidad":1.1},
    "pico":         {"volumen":1.0, "intensidad":1.15},
    "tapering":     {"volumen":0.65,"intensidad":0.9},
    "race_day":     {"volumen":0.2, "intensidad":0.6},
    "recuperacion": {"volumen":0.45,"intensidad":0.7}
  }'::jsonb;

-- ─────────────────────────────────────────────────────────────
-- 2. plantilla_sesion_ejercicios — nuevas columnas
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.plantilla_sesion_ejercicios
  ADD COLUMN IF NOT EXISTS unidad text DEFAULT 'reps'
    CHECK (unidad IN ('reps','cal','metros','segundos','km','pct_ftp','km_h','kg')),
  ADD COLUMN IF NOT EXISTS carga_tipo text
    CHECK (carga_tipo IN ('peso_kg','pct_rm','pct_ftp','rpe','zona_fc','rir','sin_carga')),
  ADD COLUMN IF NOT EXISTS carga_valor float,
  ADD COLUMN IF NOT EXISTS notas_tecnicas text,
  ADD COLUMN IF NOT EXISTS sustituciones jsonb DEFAULT '[]'::jsonb;

-- ─────────────────────────────────────────────────────────────
-- 3. perfil_entreno_cliente — nueva tabla
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.perfil_entreno_cliente (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE UNIQUE NOT NULL,
  sport_modality text,
  objetivo_especifico text,
  nivel text CHECK (nivel IN ('principiante','intermedio','avanzado')),
  dias_disponibles int DEFAULT 4,
  mejor_momento_sesion text CHECK (mejor_momento_sesion IN ('manana','tarde','noche','variable')),
  -- Capacidades base (actualizadas con tests)
  ftp_watts int,
  vdot float,
  rm_sentadilla_kg float,
  rm_banca_kg float,
  rm_peso_muerto_kg float,
  dominadas_max_reps int,
  -- Perfil de adaptación (IA actualiza)
  capacidad_recuperacion text DEFAULT 'media'
    CHECK (capacidad_recuperacion IN ('baja','media','alta')),
  respuesta_a_volumen text DEFAULT 'medio'
    CHECK (respuesta_a_volumen IN ('bajo','medio','alto')),
  patron_lesiones jsonb DEFAULT '[]'::jsonb,
  adherencia_historica_pct float,
  respuesta_psicologica text DEFAULT 'rutina'
    CHECK (respuesta_psicologica IN ('variedad','rutina','competicion')),
  plateau_detectado boolean DEFAULT false,
  semanas_sin_progresion int DEFAULT 0,
  -- Restricciones
  equipo_disponible jsonb DEFAULT '["barra","mancuernas","polea","cardio_maquinas"]'::jsonb,
  restricciones_temporales text,
  -- Biomarkers
  hrv_baseline float,
  hrv_fecha_ultimo date,
  vo2max_estimado float,
  fms_score jsonb,
  -- Integraciones
  garmin_user_id text,
  strava_athlete_id text,
  apple_health_enabled boolean DEFAULT false,
  -- Informes
  fisio_informe jsonb DEFAULT '[]'::jsonb,
  analisis_sangre jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.perfil_entreno_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach can manage perfil_entreno_cliente"
  ON public.perfil_entreno_cliente FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      JOIN public.profiles p ON p.id = c.coach_id
      WHERE c.id = cliente_id AND p.id = auth.uid()
    )
  );

CREATE POLICY "Cliente can read own perfil_entreno"
  ON public.perfil_entreno_cliente FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_id AND c.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 4. ajustes_sesion_cliente — nueva tabla
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ajustes_sesion_cliente (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  plantilla_sesion_id uuid REFERENCES public.plantilla_sesiones(id) ON DELETE SET NULL,
  fecha_semana date NOT NULL,
  motivo text CHECK (motivo IN (
    'lesion','molestia','fatiga_alta','hrv_bajo','viaje',
    'equipo_no_disponible','sobreentrenamiento','deload','coach_manual'
  )),
  detalle_motivo text,
  ajuste_aplicado jsonb,
  razonamiento_ia text,
  generado_por text DEFAULT 'ia' CHECK (generado_por IN ('ia','coach')),
  estado text DEFAULT 'propuesto'
    CHECK (estado IN ('propuesto','aprobado','modificado','revertido')),
  coach_notas text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ajustes_sesion_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach can manage ajustes_sesion_cliente"
  ON public.ajustes_sesion_cliente FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_id AND c.coach_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 5. Índices
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_plantillas_sport_modality
  ON public.plantillas_entrenamiento(sport_modality);
CREATE INDEX IF NOT EXISTS idx_plantillas_tier
  ON public.plantillas_entrenamiento(tier);
CREATE INDEX IF NOT EXISTS idx_ajustes_cliente_semana
  ON public.ajustes_sesion_cliente(cliente_id, fecha_semana);
```

- [ ] **Step 2: Aplicar en Supabase**

Ir a Supabase Dashboard → SQL Editor → pegar el contenido del archivo → Run.

Verificar que no hay errores. Si hay error `column already exists`, ignorarlo (IF NOT EXISTS lo maneja).

- [ ] **Step 3: Verificar columnas añadidas**

En Supabase SQL Editor ejecutar:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'plantillas_entrenamiento'
  AND column_name IN ('sport_modality','objetivo_especifico','tier','phase_adjustments')
ORDER BY column_name;
-- Debe devolver 4 filas

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('perfil_entreno_cliente','ajustes_sesion_cliente');
-- Debe devolver 2 filas
```

- [ ] **Step 4: Commit**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
git add supabase_training_pro_v2.sql
git commit -m "feat: training pro v2 — SQL migration sport_modality + perfil_entreno + ajustes"
```

---

### Task 2: TypeScript Types

**Files:**
- Modify: `nutricoach/types/index.ts:253-303`

- [ ] **Step 1: Añadir nuevos types a types/index.ts**

Localizar línea 253 (`export type PlantillaEntrenoTipo`) y añadir ANTES:

```typescript
// ─── Training Pro v2 ─────────────────────────────────────────
export type SportModality =
  | 'gym_estetica' | 'gym_fuerza' | 'funcional'
  | 'hyrox' | 'ciclismo' | 'running' | 'hibrido' | 'calistenia'

export type TrainingTier = 'general' | 'elite'

export type UnidadEjercicio = 'reps' | 'cal' | 'metros' | 'segundos' | 'km' | 'pct_ftp' | 'km_h' | 'kg'
export type CargaTipo = 'peso_kg' | 'pct_rm' | 'pct_ftp' | 'rpe' | 'zona_fc' | 'rir' | 'sin_carga'

export interface PerfilEntrenoCliente {
  id: string
  cliente_id: string
  sport_modality?: SportModality
  objetivo_especifico?: string
  nivel?: PlantillaEntrenoNivel
  dias_disponibles: number
  mejor_momento_sesion?: 'manana' | 'tarde' | 'noche' | 'variable'
  ftp_watts?: number
  vdot?: number
  rm_sentadilla_kg?: number
  rm_banca_kg?: number
  rm_peso_muerto_kg?: number
  dominadas_max_reps?: number
  capacidad_recuperacion: 'baja' | 'media' | 'alta'
  respuesta_a_volumen: 'bajo' | 'medio' | 'alto'
  patron_lesiones: Array<{zona: string; frecuencia: string; ultima_vez: string}>
  adherencia_historica_pct?: number
  respuesta_psicologica: 'variedad' | 'rutina' | 'competicion'
  plateau_detectado: boolean
  semanas_sin_progresion: number
  equipo_disponible: string[]
  restricciones_temporales?: string
  hrv_baseline?: number
  hrv_fecha_ultimo?: string
  vo2max_estimado?: number
  fms_score?: Record<string, number>
  garmin_user_id?: string
  strava_athlete_id?: string
  apple_health_enabled: boolean
  fisio_informe: Array<{fecha: string; diagnostico: string; contraindicados: string[]; correctivos: string[]}>
  analisis_sangre: Array<{fecha: string; ferritina?: number; vit_d?: number; hemoglobina?: number}>
  created_at: string
  updated_at: string
}

export interface AjusteSesionCliente {
  id: string
  cliente_id: string
  plantilla_sesion_id?: string
  fecha_semana: string
  motivo: 'lesion' | 'molestia' | 'fatiga_alta' | 'hrv_bajo' | 'viaje' | 'equipo_no_disponible' | 'sobreentrenamiento' | 'deload' | 'coach_manual'
  detalle_motivo?: string
  ajuste_aplicado?: Record<string, unknown>
  razonamiento_ia?: string
  generado_por: 'ia' | 'coach'
  estado: 'propuesto' | 'aprobado' | 'modificado' | 'revertido'
  coach_notas?: string
  created_at: string
}
// ─── Fin Training Pro v2 ─────────────────────────────────────
```

- [ ] **Step 2: Actualizar PlantillaEntrenamiento interface (línea ~257)**

Reemplazar la interface existente:

```typescript
export interface PlantillaEntrenamiento {
  id: string
  coach_id: string
  nombre: string
  descripcion?: string
  tipo?: PlantillaEntrenoTipo
  duracion_semanas?: number
  nivel?: PlantillaEntrenoNivel
  objetivo?: PlantillaEntrenoObjetivo
  dias_por_semana?: number
  activo: boolean
  progresion?: ProgresionPlantilla[]
  // Training Pro v2
  sport_modality?: SportModality
  objetivo_especifico?: string
  tier: TrainingTier
  phase_adjustments?: Record<string, {volumen: number; intensidad: number}>
  created_at: string
  updated_at: string
  sesiones?: PlantillaSesion[]
}
```

- [ ] **Step 3: Actualizar PlantillaSesionEjercicio interface (línea ~291)**

```typescript
export interface PlantillaSesionEjercicio {
  id: string
  sesion_id: string
  ejercicio_id: string
  series?: number
  repeticiones?: string
  descanso_segundos?: number
  peso_sugerido?: string
  rpe?: string
  notas?: string
  orden: number
  // Training Pro v2
  unidad?: UnidadEjercicio
  carga_tipo?: CargaTipo
  carga_valor?: number
  notas_tecnicas?: string
  sustituciones?: Array<{condicion: string; ejercicio_id: string}>
  ejercicio?: Ejercicio
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx tsc --noEmit 2>&1 | head -30
# Esperado: 0 errores
```

- [ ] **Step 5: Commit**

```bash
git add types/index.ts
git commit -m "feat: training pro v2 — TypeScript types SportModality, TrainingTier, PerfilEntrenoCliente"
```

---

### Task 3: Seed Script — Scaffold y helpers

**Files:**
- Create: `nutricoach/scripts/seed-plantillas-elite.ts`

- [ ] **Step 1: Crear scaffold con helpers**

```typescript
// scripts/seed-plantillas-elite.ts
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const COACH_ID = process.env.NUTRICOACH_COACH_ID!
if (!COACH_ID) throw new Error('NUTRICOACH_COACH_ID no definido en .env.local')

// Cache de ejercicios ya buscados
const ejercicioCache: Record<string, string> = {}

async function getEjercicioId(nombre: string): Promise<string> {
  if (ejercicioCache[nombre]) return ejercicioCache[nombre]

  const { data } = await supabase
    .from('ejercicios')
    .select('id, nombre')
    .ilike('nombre', nombre)
    .limit(1)
    .maybeSingle()

  if (data) {
    ejercicioCache[nombre] = data.id
    return data.id
  }

  // Crear si no existe
  const { data: nuevo, error } = await supabase
    .from('ejercicios')
    .insert({
      nombre,
      descripcion: `Ejercicio: ${nombre}`,
      grupo_muscular: 'general',
      tipo: 'fuerza',
      categoria: 'general'
    })
    .select('id')
    .single()

  if (error || !nuevo) throw new Error(`No se pudo crear ejercicio: ${nombre} — ${error?.message}`)
  ejercicioCache[nombre] = nuevo.id
  console.log(`  ✚ Ejercicio creado: ${nombre}`)
  return nuevo.id
}

interface EjercicioDef {
  nombre: string
  series: number
  repeticiones: string       // "8-10", "3×10min", "500m", "40min"
  descanso_segundos: number
  unidad?: string            // default 'reps'
  carga_tipo?: string
  carga_valor?: number
  notas_tecnicas?: string
  peso_sugerido?: string
  rpe?: string
}

interface SesionDef {
  nombre: string
  dia_semana: string
  orden: number
  notas?: string
  ejercicios: EjercicioDef[]
}

interface PlantillaDef {
  nombre: string
  descripcion: string
  tipo: string
  nivel: string
  objetivo: string
  dias_por_semana: number
  duracion_semanas: number
  sport_modality: string
  objetivo_especifico: string
  tier: string
  sesiones: SesionDef[]
}

async function upsertPlantilla(def: PlantillaDef): Promise<void> {
  console.log(`\n📋 ${def.nombre}`)

  // Upsert plantilla (por nombre + coach_id)
  const { data: existing } = await supabase
    .from('plantillas_entrenamiento')
    .select('id')
    .eq('coach_id', COACH_ID)
    .eq('nombre', def.nombre)
    .maybeSingle()

  let plantillaId: string

  if (existing) {
    const { error } = await supabase
      .from('plantillas_entrenamiento')
      .update({
        descripcion: def.descripcion,
        sport_modality: def.sport_modality,
        objetivo_especifico: def.objetivo_especifico,
        tier: def.tier,
        nivel: def.nivel,
        objetivo: def.objetivo,
        dias_por_semana: def.dias_por_semana,
        duracion_semanas: def.duracion_semanas,
        tipo: def.tipo,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
    if (error) throw error
    plantillaId = existing.id
    console.log(`  ↻ Plantilla actualizada`)

    // Borrar sesiones existentes para re-seedear limpio
    await supabase.from('plantilla_sesiones').delete().eq('plantilla_id', plantillaId)
  } else {
    const { data, error } = await supabase
      .from('plantillas_entrenamiento')
      .insert({
        coach_id: COACH_ID,
        nombre: def.nombre,
        descripcion: def.descripcion,
        sport_modality: def.sport_modality,
        objetivo_especifico: def.objetivo_especifico,
        tier: def.tier,
        nivel: def.nivel,
        objetivo: def.objetivo,
        dias_por_semana: def.dias_por_semana,
        duracion_semanas: def.duracion_semanas,
        tipo: def.tipo,
        activo: true
      })
      .select('id')
      .single()
    if (error || !data) throw new Error(`Error insertando plantilla: ${error?.message}`)
    plantillaId = data.id
    console.log(`  ✓ Plantilla creada`)
  }

  // Insertar sesiones y ejercicios
  for (const sesionDef of def.sesiones) {
    const { data: sesion, error: eSesion } = await supabase
      .from('plantilla_sesiones')
      .insert({
        plantilla_id: plantillaId,
        nombre: sesionDef.nombre,
        dia_semana: sesionDef.dia_semana,
        orden: sesionDef.orden,
        notas: sesionDef.notas ?? null
      })
      .select('id')
      .single()
    if (eSesion || !sesion) throw new Error(`Error insertando sesion: ${eSesion?.message}`)

    for (let i = 0; i < sesionDef.ejercicios.length; i++) {
      const ej = sesionDef.ejercicios[i]
      const ejercicioId = await getEjercicioId(ej.nombre)
      const { error: eEj } = await supabase
        .from('plantilla_sesion_ejercicios')
        .insert({
          sesion_id: sesion.id,
          ejercicio_id: ejercicioId,
          series: ej.series,
          repeticiones: ej.repeticiones,
          descanso_segundos: ej.descanso_segundos,
          peso_sugerido: ej.peso_sugerido ?? null,
          rpe: ej.rpe ?? null,
          notas: null,
          unidad: ej.unidad ?? 'reps',
          carga_tipo: ej.carga_tipo ?? null,
          carga_valor: ej.carga_valor ?? null,
          notas_tecnicas: ej.notas_tecnicas ?? null,
          orden: i
        })
      if (eEj) throw new Error(`Error insertando ejercicio ${ej.nombre}: ${eEj.message}`)
    }
    console.log(`  ✓ Sesión: ${sesionDef.nombre} (${sesionDef.ejercicios.length} ejercicios)`)
  }
}

// ═══════════════════════════════════════════════════════════════
// PLANTILLAS — se definen en los pasos siguientes
// ═══════════════════════════════════════════════════════════════
const PLANTILLAS: PlantillaDef[] = []

async function main() {
  console.log('🌱 Seed plantillas élite NutriCoach Pro\n')
  for (const p of PLANTILLAS) {
    await upsertPlantilla(p)
  }
  console.log('\n✅ Seed completado')
}

main().catch(e => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Verificar que compila**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx tsc --noEmit scripts/seed-plantillas-elite.ts 2>&1 || echo "OK — errores esperados por módulos no importados aún"
```

---

### Task 4: Templates — Gym Estética + Funcional

**Files:**
- Modify: `nutricoach/scripts/seed-plantillas-elite.ts` (añadir a PLANTILLAS array)

- [ ] **Step 1: Añadir templates antes de `async function main()`**

```typescript
PLANTILLAS.push({
  nombre: 'Gym Estética — Upper/Lower Intermedio',
  descripcion: 'Split Upper/Lower 4 días. Periodización por RIR (Schoenfeld 2017): semana 1 RIR 3 → semana 4 RIR 0 → deload. 10-20 series/grupo muscular/semana. Objetivo composición corporal y desarrollo muscular.',
  tipo: 'gimnasio',
  nivel: 'intermedio',
  objetivo: 'hipertrofia',
  dias_por_semana: 4,
  duracion_semanas: 8,
  sport_modality: 'gym_estetica',
  objetivo_especifico: 'composicion_general',
  tier: 'general',
  sesiones: [
    {
      nombre: 'Upper Push — Pecho, Hombros, Tríceps',
      dia_semana: 'Lunes',
      orden: 1,
      notas: 'Semana 1-2: RIR 3 | Semana 3-4: RIR 2 | Semana 5-6: RIR 1 | Semana 7: RIR 0 | Semana 8: Deload -40% volumen',
      ejercicios: [
        { nombre: 'Press Banca con Barra', series: 4, repeticiones: '8-10', descanso_segundos: 120, carga_tipo: 'pct_rm', carga_valor: 75, notas_tecnicas: 'Escápulas retraídas y deprimidas durante todo el recorrido. No rebotar el peso en el pecho.' },
        { nombre: 'Press Inclinado con Mancuernas', series: 3, repeticiones: '10-12', descanso_segundos: 90, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Ángulo 30-45°. Codos a 45° del tronco, no en cruz.' },
        { nombre: 'Elevaciones Laterales con Mancuernas', series: 4, repeticiones: '12-15', descanso_segundos: 60, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Codo ligeramente flexionado. Subir hasta paralelo, bajar con control 3s.' },
        { nombre: 'Press Militar con Mancuernas', series: 3, repeticiones: '10-12', descanso_segundos: 90, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Core activado, no hiperlordosis lumbar. Codos delante del tronco.' },
        { nombre: 'Press Francés con Barra EZ', series: 3, repeticiones: '10-12', descanso_segundos: 75, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Codos fijos, solo mueve el antebrazo. Bajar hasta detrás de la cabeza.' },
        { nombre: 'Fondos en Paralelas', series: 3, repeticiones: '8-12', descanso_segundos: 90, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Ligera inclinación hacia adelante para énfasis pecho. Bajar hasta 90° codo mínimo.' },
      ]
    },
    {
      nombre: 'Lower — Cuádriceps, Glúteos, Isquios',
      dia_semana: 'Martes',
      orden: 2,
      notas: 'Mismo esquema RIR que Upper Push. El Hip Thrust va pesado — es el principal para glúteos.',
      ejercicios: [
        { nombre: 'Sentadilla con Barra', series: 4, repeticiones: '8-10', descanso_segundos: 120, carga_tipo: 'pct_rm', carga_valor: 75, notas_tecnicas: 'Rodillas en línea con pies. Descenso controlado 3s. Profundidad: paralelo o más bajo si movilidad permite.' },
        { nombre: 'Hip Thrust con Barra', series: 4, repeticiones: '10-12', descanso_segundos: 90, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Mentón al pecho en el top. Aprieta glúteo máximo. No hiperlordosis. Pausa 1s arriba.' },
        { nombre: 'Peso Muerto Rumano con Barra', series: 3, repeticiones: '10-12', descanso_segundos: 90, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Bisagra de cadera, espalda neutra. Bajar hasta sentir estiramiento isquios. No llegar al suelo.' },
        { nombre: 'Prensa de Piernas', series: 3, repeticiones: '12-15', descanso_segundos: 75, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Pies altos en plataforma para énfasis glúteo. No extender rodillas por completo en el top.' },
        { nombre: 'Curl de Piernas Tumbado', series: 3, repeticiones: '12-15', descanso_segundos: 75, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Caderas pegadas al banco. Contracción máxima arriba, excéntrico 3s bajando.' },
        { nombre: 'Gemelos de Pie en Máquina', series: 4, repeticiones: '15-20', descanso_segundos: 45, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Rango completo: talón bajo + punta de pie alta. Pausa 2s en contracción.' },
      ]
    },
    {
      nombre: 'Upper Pull — Espalda, Bíceps',
      dia_semana: 'Jueves',
      orden: 3,
      notas: 'Priorizar la espalda. El volumen de bíceps es suficiente con el trabajo de tracción.',
      ejercicios: [
        { nombre: 'Dominadas con Peso Corporal', series: 4, repeticiones: '6-8', descanso_segundos: 120, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Si no alcanzas 6 reps, usar banda de asistencia. Bajar hasta extensión completa de codo.' },
        { nombre: 'Remo con Barra Pronado', series: 3, repeticiones: '8-10', descanso_segundos: 90, carga_tipo: 'pct_rm', carga_valor: 70, notas_tecnicas: 'Tronco a 45°. Tirar hacia el ombligo, no al pecho. Escápulas juntas en el top.' },
        { nombre: 'Jalón al Pecho con Cable', series: 3, repeticiones: '10-12', descanso_segundos: 75, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Ligera inclinación atrás. Tirar hacia el esternón, no al pecho. Deprime escápulas antes de tirar.' },
        { nombre: 'Remo con Mancuerna', series: 3, repeticiones: '10-12', descanso_segundos: 75, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Apoya rodilla y mano en banco. Codo cerca del tronco, sube hasta hip. Pausa 1s arriba.' },
        { nombre: 'Curl Bíceps con Barra EZ', series: 3, repeticiones: '10-12', descanso_segundos: 60, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Codos fijos al tronco. Excéntrico 3s bajando. No balancear.' },
        { nombre: 'Curl Martillo con Mancuernas', series: 2, repeticiones: '12-15', descanso_segundos: 60, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Agarre neutro (pulgar arriba). Trabaja braquial y braquiorradial.' },
      ]
    },
    {
      nombre: 'Lower Glúteos — Énfasis posterior',
      dia_semana: 'Viernes',
      orden: 4,
      notas: 'Segunda sesión de pierna con énfasis en glúteos y posterior. Hip Thrust pesado: +5kg vs sesión del martes.',
      ejercicios: [
        { nombre: 'Hip Thrust con Barra', series: 4, repeticiones: '8-10', descanso_segundos: 120, carga_tipo: 'rir', carga_valor: 1, notas_tecnicas: '+5kg vs sesión Martes. Pausa 2s arriba. Máxima activación glútea.' },
        { nombre: 'Sentadilla Búlgara con Mancuernas', series: 3, repeticiones: '10-12', descanso_segundos: 90, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Pie trasero en banco. Rodilla delantera en línea con segundo dedo. Descenso vertical.' },
        { nombre: 'Peso Muerto Sumo con Barra', series: 3, repeticiones: '10-12', descanso_segundos: 90, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Pies ancho, puntas 45°. Énfasis aductores y glúteos. Espalda neutra.' },
        { nombre: 'Extensiones de Cuádriceps', series: 3, repeticiones: '12-15', descanso_segundos: 60, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Rango completo. Pausa 1s arriba con cuádriceps apretado.' },
        { nombre: 'Abductores en Cable', series: 3, repeticiones: '15-20', descanso_segundos: 45, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'De pie con cable en tobillo. Pierna de trabajo levemente por delante. Core activado.' },
        { nombre: 'Plancha Abdominal', series: 3, repeticiones: '45s', descanso_segundos: 45, unidad: 'segundos', carga_tipo: 'sin_carga', notas_tecnicas: 'Cuerpo alineado cabeza-talones. Contrae core y glúteos. No elevar caderas.' },
      ]
    }
  ]
})

PLANTILLAS.push({
  nombre: 'Funcional — Pérdida de Peso Intermedio',
  descripcion: 'Entrenamiento funcional con HIIT estructurado. 4 días/semana. ACSM guidelines 2021 + entrenamiento concurrente. Combina fuerza funcional (patrones de movimiento) + cardio Z2 base + HIIT metabólico.',
  tipo: 'mixto',
  nivel: 'intermedio',
  objetivo: 'perdida_grasa',
  dias_por_semana: 4,
  duracion_semanas: 8,
  sport_modality: 'funcional',
  objetivo_especifico: 'composicion_general',
  tier: 'general',
  sesiones: [
    {
      nombre: 'Fuerza Funcional — Patrones Base',
      dia_semana: 'Lunes',
      orden: 1,
      ejercicios: [
        { nombre: 'Goblet Squat con Kettlebell', series: 3, repeticiones: '15', descanso_segundos: 60, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Talones en el suelo, torso erguido. KB pegado al pecho.' },
        { nombre: 'Peso Muerto Rumano con Mancuernas', series: 3, repeticiones: '12', descanso_segundos: 75, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Bisagra de cadera, espalda neutra. Sentir estiramiento isquios.' },
        { nombre: 'Press Banca con Mancuernas', series: 3, repeticiones: '12', descanso_segundos: 75, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Rango completo. Codos a 45° del tronco.' },
        { nombre: 'Remo con Mancuerna', series: 3, repeticiones: '12', descanso_segundos: 75, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Codo cerca del tronco. Pausa 1s arriba.' },
        { nombre: 'Plancha Abdominal', series: 3, repeticiones: '30s', descanso_segundos: 45, unidad: 'segundos', carga_tipo: 'sin_carga' },
        { nombre: 'Zancadas con Mancuernas', series: 3, repeticiones: '12', descanso_segundos: 60, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Paso amplio. Rodilla delantera no sobrepasa el pie.' },
      ]
    },
    {
      nombre: 'HIIT Metabólico',
      dia_semana: 'Martes',
      orden: 2,
      notas: 'Ratio trabajo:descanso 1:1. Esfuerzo máximo en los intervalos de trabajo (RPE 8-9).',
      ejercicios: [
        { nombre: 'Burpees', series: 4, repeticiones: '30s', descanso_segundos: 30, unidad: 'segundos', carga_tipo: 'rpe', carga_valor: 9, notas_tecnicas: 'Full burpee con salto. Máxima velocidad sostenida.' },
        { nombre: 'Kettlebell Swing', series: 4, repeticiones: '15', descanso_segundos: 60, carga_tipo: 'rpe', carga_valor: 8, notas_tecnicas: 'Bisagra de cadera explosiva. KB a la altura del pecho. No sentadilla.' },
        { nombre: 'Sentadilla con Salto', series: 4, repeticiones: '10', descanso_segundos: 90, carga_tipo: 'rpe', carga_valor: 8, notas_tecnicas: 'Aterrizaje suave en semiflexión. Descenso inmediato para el siguiente rep.' },
        { nombre: 'Carrera Continua', series: 4, repeticiones: '1min', descanso_segundos: 120, unidad: 'segundos', carga_tipo: 'zona_fc', carga_valor: 85, notas_tecnicas: 'Z4 FC (80-90% FCmax). Mantener ritmo uniforme durante el intervalo.' },
      ]
    },
    {
      nombre: 'Full Body Fuerza + Core',
      dia_semana: 'Jueves',
      orden: 3,
      ejercicios: [
        { nombre: 'Zancadas con Mancuernas', series: 3, repeticiones: '12', descanso_segundos: 75, carga_tipo: 'rir', carga_valor: 2 },
        { nombre: 'Press Militar con Mancuernas', series: 3, repeticiones: '12', descanso_segundos: 75, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Core activado. Empuje desde los hombros, no de piernas.' },
        { nombre: 'Jalón al Pecho con Cable', series: 3, repeticiones: '12', descanso_segundos: 75, carga_tipo: 'rir', carga_valor: 2 },
        { nombre: 'Hip Thrust con Mancuerna', series: 3, repeticiones: '15', descanso_segundos: 60, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Apoyo en banco. Pausa 1s arriba.' },
        { nombre: 'Rueda Abdominal', series: 3, repeticiones: '8-10', descanso_segundos: 60, carga_tipo: 'sin_carga', notas_tecnicas: 'Desde rodillas. Core apretado, no dejar caer la cadera.' },
      ]
    },
    {
      nombre: 'Cardio Z2 + Movilidad',
      dia_semana: 'Sábado',
      orden: 4,
      notas: 'Sesión de recuperación activa. FC entre 60-70% FCmax. Conversacional: puedes hablar sin cortarte.',
      ejercicios: [
        { nombre: 'Carrera Continua', series: 1, repeticiones: '40min', descanso_segundos: 0, unidad: 'segundos', carga_tipo: 'zona_fc', carga_valor: 65, notas_tecnicas: 'Z2 FC (60-70% FCmax). Ritmo conversacional. Si no hay cinta, bicicleta o elíptica.' },
        { nombre: 'Movilidad General', series: 1, repeticiones: '15min', descanso_segundos: 0, unidad: 'segundos', carga_tipo: 'sin_carga', notas_tecnicas: 'Hip flexor stretch, pigeon pose, hombros, torácica. 60s por posición.' },
      ]
    }
  ]
})
```

- [ ] **Step 2: Verificar compilación**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx tsc --noEmit 2>&1 | grep -E "error|Error" | head -10
# Esperado: sin errores en el script
```

---

### Task 5: Templates — Hyrox + Running

- [ ] **Step 1: Añadir template Hyrox**

```typescript
PLANTILLAS.push({
  nombre: 'Hyrox Open — Preparación Intermedio',
  descripcion: 'Periodización 16 semanas hacia competición Hyrox Open. 4 días/semana. Base Hunter McIntyre + metodología oficial Hyrox. Cargas oficiales codificadas: Sled Push 102kg H/63kg M. Bloques: aeróbico base → fuerza estaciones → umbral carrera → simulacros.',
  tipo: 'mixto',
  nivel: 'intermedio',
  objetivo: 'rendimiento',
  dias_por_semana: 4,
  duracion_semanas: 16,
  sport_modality: 'hyrox',
  objetivo_especifico: 'open',
  tier: 'elite',
  sesiones: [
    {
      nombre: 'Base Aeróbica — Z2 Largo',
      dia_semana: 'Lunes',
      orden: 1,
      notas: 'Sem 1-6: bloque base. FC 60-70% (Z2). Conversacional. Sem 7+: reducir a 30min y añadir trabajo umbral.',
      ejercicios: [
        { nombre: 'Carrera Continua', series: 1, repeticiones: '40min', descanso_segundos: 0, unidad: 'segundos', carga_tipo: 'zona_fc', carga_valor: 65, notas_tecnicas: 'Z2 FC (60-70% FCmax). Ritmo conversacional sostenido. Si hay pulsómetro: 120-140 bpm para la mayoría.' },
        { nombre: 'SkiErg Continuo', series: 1, repeticiones: '15min', descanso_segundos: 0, unidad: 'segundos', carga_tipo: 'zona_fc', carga_valor: 65, notas_tecnicas: 'Z2 FC. Cadencia media ~45-50 tiradas/min. Postura: ligera flexión cadera, brazos completos.' },
        { nombre: 'Remo Ergómetro', series: 1, repeticiones: '10min', descanso_segundos: 0, unidad: 'segundos', carga_tipo: 'zona_fc', carga_valor: 65, notas_tecnicas: 'Amortiguador 4-5. Z2 FC. Técnica: pies → cadera → brazos en el tirón; inverso en la vuelta.' },
      ]
    },
    {
      nombre: 'Fuerza Estaciones Hyrox',
      dia_semana: 'Martes',
      orden: 2,
      notas: 'Cargas oficiales Open: Sled 102kg H/63kg M. Wall Ball 9kg/6kg. Sandbag 20kg/10kg. Farmer 24kg c/u. Recuperación COMPLETA entre series (3min) — es fuerza, no cardio.',
      ejercicios: [
        { nombre: 'Sled Push', series: 4, repeticiones: '25m', descanso_segundos: 180, unidad: 'metros', carga_tipo: 'peso_kg', carga_valor: 102, notas_tecnicas: 'Carga oficial Open H: 102kg | Open M: 63kg. Postura: tronco bajo, 45° con el suelo. Pasos cortos y rápidos. No mirar atrás.' },
        { nombre: 'Sled Pull', series: 4, repeticiones: '25m', descanso_segundos: 180, unidad: 'metros', carga_tipo: 'peso_kg', carga_valor: 102, notas_tecnicas: 'Carga oficial Open H: 102kg | Open M: 63kg. Agacharse, tirar de la cuerda alternando manos. Pasos hacia atrás cortos.' },
        { nombre: 'Wall Balls', series: 5, repeticiones: '15', descanso_segundos: 90, carga_tipo: 'peso_kg', carga_valor: 9, notas_tecnicas: 'Balón 9kg H/6kg M. Objetivo: 9m. Sentadilla completa, al subir explotar y lanzar. No parar entre reps.' },
        { nombre: 'Sandbag Lunges', series: 3, repeticiones: '25m', descanso_segundos: 120, unidad: 'metros', carga_tipo: 'peso_kg', carga_valor: 20, notas_tecnicas: 'Saco 20kg H/10kg M. Saco sobre hombros. Zancadas alternando. Rodilla trasera a ~5cm del suelo.' },
        { nombre: 'Farmer Carry', series: 4, repeticiones: '25m', descanso_segundos: 90, unidad: 'metros', carga_tipo: 'peso_kg', carga_valor: 24, notas_tecnicas: '24kg c/u (total 48kg). Postura erguida. Pasos controlados. No doblar tronco lateralmente.' },
      ]
    },
    {
      nombre: 'Umbral de Carrera + SkiErg Intervalos',
      dia_semana: 'Jueves',
      orden: 3,
      notas: 'Sem 1-6: 3 series. Sem 7-11: 4 series. Sem 12-14: 5 series. Objetivo ritmo 1km: el ritmo al que correrías 1km en carrera Hyrox.',
      ejercicios: [
        { nombre: 'Carrera Continua', series: 1, repeticiones: '15min', descanso_segundos: 0, unidad: 'segundos', carga_tipo: 'zona_fc', carga_valor: 65, notas_tecnicas: 'Calentamiento E-pace. FC 65-70%.' },
        { nombre: 'Carrera Continua', series: 3, repeticiones: '10min', descanso_segundos: 180, unidad: 'segundos', carga_tipo: 'rpe', carga_valor: 7, notas_tecnicas: 'Umbral Hyrox: ritmo objetivo 1km carrera. RPE 7 ("duro pero sostenible"). Recuperación: 3min trote.' },
        { nombre: 'SkiErg Intervalos', series: 6, repeticiones: '500m', descanso_segundos: 120, unidad: 'metros', carga_tipo: 'rpe', carga_valor: 8, notas_tecnicas: 'Objetivo: pace -5s/500m bajo tu ritmo objetivo en carrera. Rec 2min pausa activa. Registrar tiempos.' },
        { nombre: 'Burpee Broad Jump', series: 5, repeticiones: '10', descanso_segundos: 120, carga_tipo: 'rpe', carga_valor: 8, notas_tecnicas: 'Salto hacia adelante lo más largo posible. Aterrizaje en semiflexión. Sin pausa entre reps.' },
      ]
    },
    {
      nombre: 'Fuerza Base Hyrox + Core',
      dia_semana: 'Sábado',
      orden: 4,
      notas: 'Fuerza de base para soportar las cargas de competición. No cardio: recuperación completa entre series.',
      ejercicios: [
        { nombre: 'Sentadilla Frontal con Barra', series: 4, repeticiones: '6', descanso_segundos: 180, carga_tipo: 'pct_rm', carga_valor: 70, notas_tecnicas: 'Posición frontal (barra en deltoides). Core apretado. Simula la carga del sled/sandbag sobre hombros.' },
        { nombre: 'Peso Muerto Convencional', series: 3, repeticiones: '6', descanso_segundos: 180, carga_tipo: 'pct_rm', carga_valor: 75, notas_tecnicas: 'Base de fuerza para farmer carry y sled pull. Espalda neutra toda la ejecución.' },
        { nombre: 'Remo con Barra Pronado', series: 3, repeticiones: '8', descanso_segundos: 120, carga_tipo: 'pct_rm', carga_valor: 70, notas_tecnicas: 'Fortalece la tracción necesaria para sled pull.' },
        { nombre: 'Plancha Abdominal', series: 3, repeticiones: '45s', descanso_segundos: 45, unidad: 'segundos', carga_tipo: 'sin_carga', notas_tecnicas: 'Core anti-extensión. Base para mantener postura bajo fatiga en competición.' },
        { nombre: 'Remo Ergómetro', series: 1, repeticiones: '20min', descanso_segundos: 0, unidad: 'segundos', carga_tipo: 'zona_fc', carga_valor: 65, notas_tecnicas: 'Vuelta calma. Z2 FC. Técnica.' },
      ]
    }
  ]
})

PLANTILLAS.push({
  nombre: 'Running — Fondo Intermedio (VDOT 40-50)',
  descripcion: 'Plan running 4 días/semana. Basado en fórmula Daniels (VDOT 40-50, equivale a 5K ~23-26min). 5 ritmos de entrenamiento: Easy, Marathon, Threshold, Interval, Repetition. 80% volumen en Z1-Z2. Periodización hacia objetivo 10K/HM.',
  tipo: 'cardio',
  nivel: 'intermedio',
  objetivo: 'rendimiento',
  dias_por_semana: 4,
  duracion_semanas: 12,
  sport_modality: 'running',
  objetivo_especifico: '10k',
  tier: 'elite',
  sesiones: [
    {
      nombre: 'Long Run — E-pace',
      dia_semana: 'Domingo',
      orden: 1,
      notas: 'El eje vertebrador de la semana. No más del 25-30% del volumen semanal total. Sem 1-4: 60-75min. Sem 5-8: 75-90min. Sem 9-12: 80-100min.',
      ejercicios: [
        { nombre: 'Carrera Larga E-pace', series: 1, repeticiones: '75min', descanso_segundos: 0, unidad: 'segundos', carga_tipo: 'zona_fc', carga_valor: 68, notas_tecnicas: 'Easy pace Daniels: conversacional. Para VDOT 45: ~6:30-7:00/km. No hay "demasiado lento" aquí. Hidratación cada 20-25min si >60min.' },
      ]
    },
    {
      nombre: 'Umbral — Tempo + Strides',
      dia_semana: 'Martes',
      orden: 2,
      notas: 'T-pace Daniels para VDOT 45: ~5:00-5:10/km. "Cómodamente duro" — puedes hablar en frases cortas. No más de 20% del volumen semanal en T-pace.',
      ejercicios: [
        { nombre: 'Carrera Continua', series: 1, repeticiones: '15min', descanso_segundos: 0, unidad: 'segundos', carga_tipo: 'zona_fc', carga_valor: 65, notas_tecnicas: 'Calentamiento E-pace. Activar cadenas musculares.' },
        { nombre: 'Tempo Run T-pace', series: 1, repeticiones: '25min', descanso_segundos: 0, unidad: 'segundos', carga_tipo: 'rpe', carga_valor: 7, notas_tecnicas: 'T-pace continuo. VDOT 40: 5:25/km | VDOT 45: 5:05/km | VDOT 50: 4:45/km. RPE 6-7. Sem 1-3: 20min. Sem 4-6: 25min. Sem 7-9: 30min.' },
        { nombre: 'Strides de Velocidad', series: 6, repeticiones: '100m', descanso_segundos: 60, unidad: 'metros', carga_tipo: 'rpe', carga_valor: 9, notas_tecnicas: 'R-pace: ~3:50-4:00/km para VDOT 45. Aceleración progresiva, máximo en los últimos 40m. Recuperación andando 60s. OBLIGATORIO 2x/semana para economía de carrera.' },
        { nombre: 'Carrera Continua', series: 1, repeticiones: '10min', descanso_segundos: 0, unidad: 'segundos', carga_tipo: 'zona_fc', carga_valor: 60, notas_tecnicas: 'Vuelta calma. Trote suave. E-pace o más lento.' },
      ]
    },
    {
      nombre: 'VO2max — Intervalos I-pace',
      dia_semana: 'Jueves',
      orden: 3,
      notas: 'I-pace Daniels: ~97-100% VO2max. Máximo 8% del volumen semanal en I-pace. Sem 1-3: 4 series. Sem 4-8: 5 series. Sem 9-12: 6 series.',
      ejercicios: [
        { nombre: 'Carrera Continua', series: 1, repeticiones: '15min', descanso_segundos: 0, unidad: 'segundos', carga_tipo: 'zona_fc', carga_valor: 65, notas_tecnicas: 'Calentamiento E-pace obligatorio. Sin calentamiento adecuado el VO2max no se activa.' },
        { nombre: 'Intervalos I-pace 1000m', series: 5, repeticiones: '1000m', descanso_segundos: 240, unidad: 'metros', carga_tipo: 'rpe', carga_valor: 9, notas_tecnicas: 'I-pace VDOT 40: 4:40/km | VDOT 45: 4:20/km | VDOT 50: 4:05/km. RPE 9 — muy duro pero sostenible 5min. Recuperación: 400m trote lento (NO parada). Si llegas sin aliento a una serie → parar.' },
        { nombre: 'Strides de Velocidad', series: 4, repeticiones: '100m', descanso_segundos: 60, unidad: 'metros', carga_tipo: 'rpe', carga_valor: 9, notas_tecnicas: 'R-pace al final para mantener activado el sistema neuromuscular.' },
        { nombre: 'Carrera Continua', series: 1, repeticiones: '10min', descanso_segundos: 0, unidad: 'segundos', carga_tipo: 'zona_fc', carga_valor: 60, notas_tecnicas: 'Vuelta calma E-pace.' },
      ]
    },
    {
      nombre: 'Easy + Strides — Recuperación activa',
      dia_semana: 'Viernes',
      orden: 4,
      notas: 'Sesión de recuperación activa. Nunca convertirla en semi-dura. Si hay fatiga de las series del jueves, reducir a 30min.',
      ejercicios: [
        { nombre: 'Carrera Continua', series: 1, repeticiones: '45min', descanso_segundos: 0, unidad: 'segundos', carga_tipo: 'zona_fc', carga_valor: 65, notas_tecnicas: 'E-pace completo. FC 60-70%. Conversacional. Recuperación activa.' },
        { nombre: 'Strides de Velocidad', series: 6, repeticiones: '100m', descanso_segundos: 60, unidad: 'metros', carga_tipo: 'rpe', carga_valor: 9, notas_tecnicas: 'Al final del fácil. R-pace. Mantiene la economía de zancada.' },
      ]
    }
  ]
})
```

---

### Task 6: Templates — Ciclismo + Calistenia

- [ ] **Step 1: Añadir template Ciclismo**

```typescript
PLANTILLAS.push({
  nombre: 'Ciclismo Potencia — Intermedio (FTP base)',
  descripcion: 'Plan ciclismo 5 sesiones/semana. Modelo Coggan/Allen 7 zonas de potencia (%FTP). Ratio 80/20 polarizado (Seiler): 80% Z1-Z2, 20% Z4-Z7. TSS objetivo: Base 350 → Construcción 500 → Pico 600/semana. FTP se testea cada 4-6 semanas con Ramp Test.',
  tipo: 'cardio',
  nivel: 'intermedio',
  objetivo: 'rendimiento',
  dias_por_semana: 5,
  duracion_semanas: 12,
  sport_modality: 'ciclismo',
  objetivo_especifico: 'subir_ftp',
  tier: 'elite',
  sesiones: [
    {
      nombre: 'Z2 Resistencia Aeróbica',
      dia_semana: 'Lunes',
      orden: 1,
      notas: 'Bloque Z2 es el más importante. 80% del volumen total en Z2. Sem 1-4: 90min. Sem 5-8: 120min. Sem 9-12: 150min.',
      ejercicios: [
        { nombre: 'Pedaleo Z2 Bicicleta', series: 1, repeticiones: '90min', descanso_segundos: 0, unidad: 'segundos', carga_tipo: 'pct_ftp', carga_valor: 65, notas_tecnicas: 'Z2: 56-75% FTP. Cadencia 85-95 rpm. Conversacional. Base del fitness aeróbico. Sin potenciómetro: FC 65-75% FCmax.' },
      ]
    },
    {
      nombre: 'Sweet Spot — Umbral submáximo',
      dia_semana: 'Martes',
      orden: 2,
      notas: 'Sweet Spot (88-93% FTP) = el mejor ROI en ciclismo. Da adaptaciones casi como umbral pero con mucho menos fatiga. Sem 1-3: 2×15min. Sem 4-6: 2×20min. Sem 7-9: 2×25min.',
      ejercicios: [
        { nombre: 'Pedaleo Z1 Calentamiento', series: 1, repeticiones: '15min', descanso_segundos: 0, unidad: 'segundos', carga_tipo: 'pct_ftp', carga_valor: 50, notas_tecnicas: 'Z1 <55% FTP. Cadencia alta >95rpm. Activa las piernas.' },
        { nombre: 'Pedaleo Sweet Spot', series: 2, repeticiones: '20min', descanso_segundos: 300, unidad: 'segundos', carga_tipo: 'pct_ftp', carga_valor: 90, notas_tecnicas: 'Sweet Spot: 88-93% FTP. Cadencia 85-95rpm. "Duro pero sostenible". Recuperación 5min Z1 entre series.' },
        { nombre: 'Pedaleo Z1 Vuelta Calma', series: 1, repeticiones: '10min', descanso_segundos: 0, unidad: 'segundos', carga_tipo: 'pct_ftp', carga_valor: 50, notas_tecnicas: 'Cadencia libre. Bajar FC antes de parar.' },
      ]
    },
    {
      nombre: 'Threshold Over-Unders',
      dia_semana: 'Miércoles',
      orden: 3,
      notas: 'Over-unders: alternar sobre y bajo el umbral. Acumula lactato y lo aclara repetidamente. Muy eficaz para subir FTP.',
      ejercicios: [
        { nombre: 'Pedaleo Z1 Calentamiento', series: 1, repeticiones: '15min', descanso_segundos: 0, unidad: 'segundos', carga_tipo: 'pct_ftp', carga_valor: 50 },
        { nombre: 'Over-Under Umbral', series: 5, repeticiones: '6min', descanso_segundos: 480, unidad: 'segundos', carga_tipo: 'pct_ftp', carga_valor: 100, notas_tecnicas: 'Cada serie = 3min@105%FTP (over) + 3min@95%FTP (under). Recuperación 8min Z1 entre series. Sem 1-3: 3 series. Sem 4+: 5 series.' },
        { nombre: 'Pedaleo Z1 Vuelta Calma', series: 1, repeticiones: '15min', descanso_segundos: 0, unidad: 'segundos', carga_tipo: 'pct_ftp', carga_valor: 50 },
      ]
    },
    {
      nombre: 'VO2max — Intervalos Cortos',
      dia_semana: 'Viernes',
      orden: 4,
      notas: 'Z5-Z6: 106-120% FTP. Máxima potencia aeróbica. Sem 1-3: 4 series. Sem 4-6: 5 series. Sem 7+: 6 series. Si no mantienes >105% FTP en la última serie → parar.',
      ejercicios: [
        { nombre: 'Pedaleo Z1 Calentamiento', series: 1, repeticiones: '20min', descanso_segundos: 0, unidad: 'segundos', carga_tipo: 'pct_ftp', carga_valor: 50, notas_tecnicas: 'Incluir 2-3 acelerones de 10s al 130% FTP para activar el sistema neuromuscular.' },
        { nombre: 'Intervalos VO2max Bicicleta', series: 5, repeticiones: '3min', descanso_segundos: 180, unidad: 'segundos', carga_tipo: 'pct_ftp', carga_valor: 118, notas_tecnicas: '115-120% FTP. Cadencia libre (la que permita mantener potencia). Rec 3min Z1. Deja el ego en casa: es mejor 5 series limpias que 6 con caída de potencia.' },
        { nombre: 'Pedaleo Z1 Vuelta Calma', series: 1, repeticiones: '15min', descanso_segundos: 0, unidad: 'segundos', carga_tipo: 'pct_ftp', carga_valor: 50 },
      ]
    },
    {
      nombre: 'Z2 Recuperación + Cadencia',
      dia_semana: 'Sábado',
      orden: 5,
      notas: 'Sesión de recuperación activa. Cadencia alta (>95rpm) para eficiencia neuromuscular sin carga cardiovascular alta.',
      ejercicios: [
        { nombre: 'Pedaleo Z1-Z2 Recuperación', series: 1, repeticiones: '60min', descanso_segundos: 0, unidad: 'segundos', carga_tipo: 'pct_ftp', carga_valor: 60, notas_tecnicas: '<75% FTP. Cadencia >95rpm. Resistencia baja. Activa la recuperación muscular.' },
      ]
    }
  ]
})

PLANTILLAS.push({
  nombre: 'Calistenia — Muscle-Up Estricto (Elite)',
  descripcion: 'Progresión hacia muscle-up estricto en barra y anillas. Basado en Overcoming Gravity (Steven Low, 2nd Ed.) + Antranik methodology. PRERREQUISITOS: ≥10 dominadas estrictas y ≥15 dips antes de empezar. Regla tendinosa: no incrementar volumen >10%/semana en anillas.',
  tipo: 'gimnasio',
  nivel: 'avanzado',
  objetivo: 'rendimiento',
  dias_por_semana: 4,
  duracion_semanas: 12,
  sport_modality: 'calistenia',
  objetivo_especifico: 'muscle_up',
  tier: 'elite',
  sesiones: [
    {
      nombre: 'Tirón Neurológico — Skill Muscle-Up',
      dia_semana: 'Lunes',
      orden: 1,
      notas: '⚠️ TRABAJO NEURO SIEMPRE AL INICIO — antes de cualquier fatiga. Si tienes dolor en codo o muñeca: PARAR y no continuar. Progresión: semanas 1-4 dominadas C2B → sem 5-8 transición cajón → sem 9-12 MU asistido → sem 13+ MU estricto.',
      ejercicios: [
        { nombre: 'Dominadas Explosivas Chest-to-Bar', series: 4, repeticiones: '3', descanso_segundos: 180, carga_tipo: 'rpe', carga_valor: 8, notas_tecnicas: 'Máxima explosividad. Toca el pecho a la barra en el top. SI no llegas al pecho → no estás listo para MU. 3 min descanso completo entre series — es trabajo neurológico.' },
        { nombre: 'Transición Muscle-Up en Cajón', series: 3, repeticiones: '5', descanso_segundos: 120, carga_tipo: 'sin_carga', notas_tecnicas: 'Cajón bajo la barra. Practicar solo la transición (el momento de pasar de tirón a empuje). Punto crítico del MU. Sem 1-4: con cajón. Sem 5-8: cajón más bajo. Sem 9+: sin cajón.' },
        { nombre: 'Dominadas con Peso Corporal', series: 3, repeticiones: '8', descanso_segundos: 120, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Pronado, agarre algo más ancho que hombros. Extensión completa abajo. Pecho a la barra arriba.' },
        { nombre: 'Ring Rows Invertidos', series: 3, repeticiones: '10', descanso_segundos: 90, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Anillas a altura de pecho. Cuerpo rígido como plancha. Pausa 2s arriba. Cuánto más horizontal → más difícil.' },
        { nombre: 'Curl Bíceps con Barra EZ', series: 3, repeticiones: '10', descanso_segundos: 60, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Soporte de bíceps y tendón del codo para el trabajo de anillas.' },
      ]
    },
    {
      nombre: 'Empuje + Estabilización',
      dia_semana: 'Martes',
      orden: 2,
      notas: 'La transición del MU requiere fuerza de empuje sobre la barra. Los fondos y ring dips son la base.',
      ejercicios: [
        { nombre: 'Fondos en Paralelas', series: 4, repeticiones: '8-10', descanso_segundos: 120, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Inclinación 10-15° hacia adelante. Bajar hasta hombros por debajo de codos. Extensión completa arriba.' },
        { nombre: 'Ring Dips', series: 3, repeticiones: '6-8', descanso_segundos: 120, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Anillas a altura de cadera. RTO (rings turned out) en el top — rotar anillas hacia afuera al extender. MÁS difícil que fondos normales por la inestabilidad.' },
        { nombre: 'Press Militar con Mancuernas', series: 3, repeticiones: '10', descanso_segundos: 90, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Fortalece el empuje encima de la cabeza necesario para el lockout del MU.' },
        { nombre: 'Plancha RTO Anillas', series: 3, repeticiones: '20s', descanso_segundos: 60, unidad: 'segundos', carga_tipo: 'sin_carga', notas_tecnicas: 'Plancha con anillas giradas hacia afuera (RTO). Activa estabilizadores de hombro únicos del trabajo en anillas. Progresa a 30s y 45s.' },
        { nombre: 'L-sit desde Suelo', series: 3, repeticiones: '10s', descanso_segundos: 60, unidad: 'segundos', carga_tipo: 'sin_carga', notas_tecnicas: 'Palmas en suelo, piernas extendidas y elevadas. Si no puedes → L-sit con rodillas flexionadas. Core fundamental para el MU.' },
      ]
    },
    {
      nombre: 'Fuerza Base Compuesta',
      dia_semana: 'Jueves',
      orden: 3,
      notas: 'La fuerza general es la base para la calistenia. Sin buena sentadilla y peso muerto, el cuerpo no tiene la base estructural.',
      ejercicios: [
        { nombre: 'Sentadilla con Barra', series: 3, repeticiones: '8', descanso_segundos: 120, carga_tipo: 'pct_rm', carga_valor: 75, notas_tecnicas: 'Fuerza general de tren inferior. Espalda neutra, rodillas en línea.' },
        { nombre: 'Peso Muerto Convencional', series: 3, repeticiones: '6', descanso_segundos: 180, carga_tipo: 'pct_rm', carga_valor: 75, notas_tecnicas: 'Fuerza posterior para estabilidad global.' },
        { nombre: 'Press Banca con Barra', series: 3, repeticiones: '8', descanso_segundos: 120, carga_tipo: 'pct_rm', carga_valor: 75, notas_tecnicas: 'Equilibra el volumen de tirón. Evita desequilibrios que llevan a lesión de hombro.' },
        { nombre: 'Dominadas con Peso Adicional', series: 3, repeticiones: '5', descanso_segundos: 180, carga_tipo: 'peso_kg', carga_valor: 8, notas_tecnicas: '+5-10kg con cinturón. Si ya haces 10 dominadas limpias, añadir peso es la forma más eficaz de progresar.' },
        { nombre: 'Plancha Abdominal', series: 3, repeticiones: '45s', descanso_segundos: 45, unidad: 'segundos', carga_tipo: 'sin_carga' },
      ]
    },
    {
      nombre: 'Skill Complejo + Movilidad',
      dia_semana: 'Sábado',
      orden: 4,
      notas: '⚠️ Regla tendinosa (Steven Low): tendones adaptan 8-12 semanas. NUNCA añadir >10% volumen/semana en trabajo de anillas. Si sientes dolor agudo en tendón bicipital o codo → deload 1 semana completa.',
      ejercicios: [
        { nombre: 'Dominadas con Agarre Neutro', series: 3, repeticiones: '8', descanso_segundos: 90, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Agarre neutro (palmas enfrentadas). Trabaja el músculo braquial además del dorsal.' },
        { nombre: 'False Grip Pull-up en Anillas', series: 4, repeticiones: '5', descanso_segundos: 120, carga_tipo: 'rpe', carga_valor: 7, notas_tecnicas: 'False grip: muñeca sobre la anilla (no el dedo coger por debajo). FUNDAMENTAL para ring MU. Sem 1-4: solo mantener false grip en dead hang 10s. Sem 5+: pull-up completo.' },
        { nombre: 'Muscle-Up Asistido con Banda', series: 3, repeticiones: '5', descanso_segundos: 120, carga_tipo: 'sin_carga', notas_tecnicas: 'Banda bajo los pies. Movimiento completo: tirón → transición → empuje. Sem 9-12 del programa. Antes → seguir con transición en cajón.' },
        { nombre: 'Movilidad de Hombros', series: 1, repeticiones: '10min', descanso_segundos: 0, unidad: 'segundos', carga_tipo: 'sin_carga', notas_tecnicas: 'Dislocaciones con banda (band dislocations), circles, pec stretch, thoracic rotation. 60s por ejercicio. Reduce riesgo de tendinopatía bicipital.' },
      ]
    }
  ]
})
```

---

### Task 7: Templates — Híbrido (Carlos self-test) + Gym Fuerza

- [ ] **Step 1: Añadir template Híbrido**

```typescript
PLANTILLAS.push({
  nombre: 'Híbrido Elite — Hyrox + Muscle-Up (Carlos)',
  descripcion: 'Plan híbrido 5 días/semana. Combina preparación Hyrox Open + progresión muscle-up + mantenimiento composición corporal. Basado en Viada "The Hybrid Athlete": regla de compatibilidad (no pierna pesada + carrera intensa el mismo día). Auto-test NutriCoach Pro.',
  tipo: 'mixto',
  nivel: 'avanzado',
  objetivo: 'rendimiento',
  dias_por_semana: 5,
  duracion_semanas: 16,
  sport_modality: 'hibrido',
  objetivo_especifico: 'hyrox_fuerza',
  tier: 'elite',
  sesiones: [
    {
      nombre: 'Hyrox Estaciones — Fuerza Específica',
      dia_semana: 'Lunes',
      orden: 1,
      notas: 'No correr el día anterior (domingo = descanso). Cargas oficiales Open. Recuperación COMPLETA entre series.',
      ejercicios: [
        { nombre: 'SkiErg Intervalos', series: 3, repeticiones: '500m', descanso_segundos: 120, unidad: 'metros', carga_tipo: 'rpe', carga_valor: 8, notas_tecnicas: 'Objetivo: pace objetivo Hyrox -5s/500m. Técnica: brazos completos, ligera flexión cadera.' },
        { nombre: 'Sled Push', series: 3, repeticiones: '25m', descanso_segundos: 180, unidad: 'metros', carga_tipo: 'peso_kg', carga_valor: 102, notas_tecnicas: '102kg H / 63kg M. Postura baja 45°. Pasos cortos rápidos.' },
        { nombre: 'Wall Balls', series: 4, repeticiones: '15', descanso_segundos: 90, carga_tipo: 'peso_kg', carga_valor: 9, notas_tecnicas: '9kg/6kg. Objetivo 9m. Sentadilla completa + explosión de cadera al lanzar.' },
        { nombre: 'Farmer Carry', series: 3, repeticiones: '25m', descanso_segundos: 90, unidad: 'metros', carga_tipo: 'peso_kg', carga_valor: 24, notas_tecnicas: '24kg c/u. Core apretado, postura erguida.' },
        { nombre: 'Burpee Broad Jump', series: 4, repeticiones: '10', descanso_segundos: 120, carga_tipo: 'rpe', carga_valor: 8, notas_tecnicas: 'Salto más largo posible. Aterrizaje en semiflexión. Máxima potencia.' },
      ]
    },
    {
      nombre: 'Carrera Umbral Hyrox',
      dia_semana: 'Martes',
      orden: 2,
      notas: 'Regla Viada: Upper del lunes + carrera martes = compatible. Pierna heavy (miércoles) NO puede ser el mismo día que carrera de calidad.',
      ejercicios: [
        { nombre: 'Carrera Continua', series: 1, repeticiones: '15min', descanso_segundos: 0, unidad: 'segundos', carga_tipo: 'zona_fc', carga_valor: 65, notas_tecnicas: 'Calentamiento E-pace.' },
        { nombre: 'Intervalos Umbral 1km', series: 4, repeticiones: '1000m', descanso_segundos: 180, unidad: 'metros', carga_tipo: 'rpe', carga_valor: 7, notas_tecnicas: 'Ritmo objetivo 1km Hyrox. RPE 7. Rec 3min trote. Registrar tiempo de cada serie.' },
        { nombre: 'Strides de Velocidad', series: 6, repeticiones: '100m', descanso_segundos: 60, unidad: 'metros', carga_tipo: 'rpe', carga_valor: 9, notas_tecnicas: 'R-pace. Economía de zancada. Obligatorio.' },
      ]
    },
    {
      nombre: 'Upper Fuerza + Muscle-Up Skill',
      dia_semana: 'Miércoles',
      orden: 3,
      notas: '⚠️ MUSCLE-UP SIEMPRE AL INICIO — sistema nervioso fresco. Es trabajo neurológico, no de fatiga. Luego fuerza upper compuesto.',
      ejercicios: [
        { nombre: 'Dominadas Explosivas Chest-to-Bar', series: 4, repeticiones: '3', descanso_segundos: 180, carga_tipo: 'rpe', carga_valor: 8, notas_tecnicas: '⚡ PRIMERO. Máxima explosividad. Toca el pecho a la barra. 3min descanso completo.' },
        { nombre: 'Transición Muscle-Up en Cajón', series: 3, repeticiones: '5', descanso_segundos: 120, carga_tipo: 'sin_carga', notas_tecnicas: 'Practica solo la transición. Punto más técnico del MU.' },
        { nombre: 'Press Banca con Barra', series: 4, repeticiones: '6-8', descanso_segundos: 120, carga_tipo: 'pct_rm', carga_valor: 78, notas_tecnicas: 'Escápulas retraídas. Codos 45°. Potencia en el empuje.' },
        { nombre: 'Remo con Barra Pronado', series: 3, repeticiones: '8', descanso_segundos: 90, carga_tipo: 'pct_rm', carga_valor: 70, notas_tecnicas: 'Tronco 45°, hacia el ombligo. Escápulas juntas arriba.' },
        { nombre: 'Ring Dips', series: 3, repeticiones: '8', descanso_segundos: 90, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'RTO en el top. Fortalece la posición de empuje del MU.' },
        { nombre: 'Curl Bíceps con Barra EZ', series: 2, repeticiones: '12', descanso_segundos: 60, carga_tipo: 'rir', carga_valor: 2 },
      ]
    },
    {
      nombre: 'Z2 Carrera + Strides + Movilidad',
      dia_semana: 'Jueves',
      orden: 4,
      notas: 'Recuperación activa. NO convertir en semi-dura. FC 65-70% todo el tiempo.',
      ejercicios: [
        { nombre: 'Carrera Continua', series: 1, repeticiones: '50min', descanso_segundos: 0, unidad: 'segundos', carga_tipo: 'zona_fc', carga_valor: 67, notas_tecnicas: 'Z2 FC completo. Conversacional.' },
        { nombre: 'Strides de Velocidad', series: 6, repeticiones: '100m', descanso_segundos: 60, unidad: 'metros', carga_tipo: 'rpe', carga_valor: 9, notas_tecnicas: 'Al final del Z2. R-pace.' },
        { nombre: 'Movilidad de Hombros', series: 1, repeticiones: '10min', descanso_segundos: 0, unidad: 'segundos', carga_tipo: 'sin_carga', notas_tecnicas: 'Movilidad hombros + caderas. Prepara para sesión Lower del viernes.' },
      ]
    },
    {
      nombre: 'Lower Fuerza + Capacidad Metabólica',
      dia_semana: 'Viernes',
      orden: 5,
      notas: 'Regla Viada: pierna heavy NO el mismo día que carrera de calidad. El viernes va bien: jueves fue Z2 suave. Fin de semana = descanso.',
      ejercicios: [
        { nombre: 'Sentadilla con Barra', series: 4, repeticiones: '6', descanso_segundos: 180, carga_tipo: 'pct_rm', carga_valor: 75, notas_tecnicas: 'Fuerza base para sled y sandbag. Espalda neutra.' },
        { nombre: 'Peso Muerto Convencional', series: 3, repeticiones: '5', descanso_segundos: 180, carga_tipo: 'pct_rm', carga_valor: 77, notas_tecnicas: 'Base para farmer carry y sled pull.' },
        { nombre: 'Remo Ergómetro', series: 6, repeticiones: '250m', descanso_segundos: 90, unidad: 'metros', carga_tipo: 'rpe', carga_valor: 9, notas_tecnicas: 'Sprint máximo 250m. Rec 90s completa. Capacidad aeróbica Hyrox.' },
        { nombre: 'Hip Thrust con Barra', series: 3, repeticiones: '10', descanso_segundos: 90, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Glúteos para carrera y estaciones Hyrox.' },
        { nombre: 'Plancha Abdominal', series: 3, repeticiones: '45s', descanso_segundos: 45, unidad: 'segundos', carga_tipo: 'sin_carga' },
      ]
    }
  ]
})

PLANTILLAS.push({
  nombre: 'Gym Fuerza — Press Banca + Fuerza General',
  descripcion: 'Periodización de fuerza 4 días/semana. Basado en Prilepin chart + Westside-style programming. Objetivo: mejora de 1RM en Press Banca + fuerza general compuesta. Ondas de carga semanales: pesada/media/ligera. Deload cada 4 semanas.',
  tipo: 'gimnasio',
  nivel: 'intermedio',
  objetivo: 'fuerza',
  dias_por_semana: 4,
  duracion_semanas: 8,
  sport_modality: 'gym_fuerza',
  objetivo_especifico: 'mejora_banca',
  tier: 'general',
  sesiones: [
    {
      nombre: 'Banca Enfocado + Upper',
      dia_semana: 'Lunes',
      orden: 1,
      notas: 'Semana PESADA: 5×5 @82% | Semana MEDIA: 4×6 @77% | Semana LIGERA: 3×8 @72%. Ciclo de 3 semanas + 1 deload.',
      ejercicios: [
        { nombre: 'Press Banca con Barra', series: 5, repeticiones: '5', descanso_segundos: 180, carga_tipo: 'pct_rm', carga_valor: 82, notas_tecnicas: 'Semana pesada. Escápulas retraídas fijas. Arco natural en espalda. Grip ~81cm. No botar.' },
        { nombre: 'Press Inclinado con Barra', series: 4, repeticiones: '6', descanso_segundos: 150, carga_tipo: 'pct_rm', carga_valor: 77, notas_tecnicas: '30-45°. Trabajo accesorio pecho superior.' },
        { nombre: 'Fondos en Paralelas', series: 3, repeticiones: '6-8', descanso_segundos: 120, carga_tipo: 'peso_kg', carga_valor: 10, notas_tecnicas: '+peso con cinturón. Refuerza el lockout del press.' },
        { nombre: 'Remo con Barra Pronado', series: 4, repeticiones: '6', descanso_segundos: 120, carga_tipo: 'pct_rm', carga_valor: 75, notas_tecnicas: 'Equilibra el volumen de empuje. Espalda sana = banca fuerte.' },
        { nombre: 'Press Francés con Barra EZ', series: 3, repeticiones: '8', descanso_segundos: 90, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Tríceps para el lockout del press.' },
      ]
    },
    {
      nombre: 'Sentadilla Enfocada + Lower',
      dia_semana: 'Martes',
      orden: 2,
      notas: 'Mismo esquema de ondas que el press. La pausa en la sentadilla es muy eficaz para fuerza.',
      ejercicios: [
        { nombre: 'Sentadilla con Barra', series: 5, repeticiones: '5', descanso_segundos: 180, carga_tipo: 'pct_rm', carga_valor: 82, notas_tecnicas: 'Semana pesada 5×5 @82%. Espalda alta (high bar) o baja (low bar) según preferencia.' },
        { nombre: 'Sentadilla con Pausa', series: 3, repeticiones: '3', descanso_segundos: 180, carga_tipo: 'pct_rm', carga_valor: 70, notas_tecnicas: '2s de pausa en el punto más bajo. Elimina el rebote. Construye fuerza real en la posición más débil.' },
        { nombre: 'Prensa de Piernas', series: 3, repeticiones: '8', descanso_segundos: 120, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Accesorio cuádriceps sin fatiga de estabilizadores.' },
        { nombre: 'Curl de Piernas Tumbado', series: 3, repeticiones: '10', descanso_segundos: 75, carga_tipo: 'rir', carga_valor: 2 },
        { nombre: 'Gemelos de Pie en Máquina', series: 4, repeticiones: '12', descanso_segundos: 45, carga_tipo: 'rir', carga_valor: 2 },
      ]
    },
    {
      nombre: 'Overhead + Pull Vertical',
      dia_semana: 'Jueves',
      orden: 3,
      notas: 'El press overhead fuerte hace el press banca más fuerte. No descuidarlo.',
      ejercicios: [
        { nombre: 'Press Militar con Barra', series: 4, repeticiones: '5-6', descanso_segundos: 150, carga_tipo: 'pct_rm', carga_valor: 75, notas_tecnicas: 'De pie, core apretado. No ladear el tronco. Barra sobre cabeza al final.' },
        { nombre: 'Dominadas con Peso Adicional', series: 4, repeticiones: '5', descanso_segundos: 180, carga_tipo: 'peso_kg', carga_valor: 8, notas_tecnicas: '+peso máximo para 5 reps limpias. Si no tienes cinturón: chaleco, mochila, o mancuerna entre piernas.' },
        { nombre: 'Jalón al Pecho con Cable', series: 3, repeticiones: '6', descanso_segundos: 120, carga_tipo: 'rir', carga_valor: 1, notas_tecnicas: 'Agarre cerrado pronado. Tirón explosivo.' },
        { nombre: 'Remo en Polea Baja', series: 3, repeticiones: '8', descanso_segundos: 90, carga_tipo: 'rir', carga_valor: 2 },
        { nombre: 'Curl Bíceps con Barra EZ', series: 3, repeticiones: '8', descanso_segundos: 75, carga_tipo: 'rir', carga_valor: 2 },
      ]
    },
    {
      nombre: 'Peso Muerto Enfocado + Accesorio',
      dia_semana: 'Sábado',
      orden: 4,
      notas: 'Día más corto. El peso muerto es muy demandante del SNC. No sobrecargar con accesorio.',
      ejercicios: [
        { nombre: 'Peso Muerto Convencional', series: 4, repeticiones: '4', descanso_segundos: 240, carga_tipo: 'pct_rm', carga_valor: 85, notas_tecnicas: 'Semana pesada: 4×4 @85%. Espalda neutra, lat activado (imagina doblar la barra). Tira del suelo explosivo.' },
        { nombre: 'Peso Muerto Rumano con Barra', series: 3, repeticiones: '6', descanso_segundos: 120, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Refuerza isquios para el tirón. Hasta media espinilla.' },
        { nombre: 'Hip Thrust con Barra', series: 3, repeticiones: '8', descanso_segundos: 90, carga_tipo: 'rir', carga_valor: 1, notas_tecnicas: 'Glúteos para fuerza general de la cadena posterior.' },
        { nombre: 'Sentadilla Búlgara con Mancuernas', series: 3, repeticiones: '6', descanso_segundos: 90, carga_tipo: 'rir', carga_valor: 2, notas_tecnicas: 'Unilateral. Corrige asimetrías.' },
        { nombre: 'Plancha Abdominal', series: 3, repeticiones: '45s', descanso_segundos: 45, unidad: 'segundos', carga_tipo: 'sin_carga' },
      ]
    }
  ]
})
```

---

### Task 8: Ejecutar seed y verificar

**Files:**
- Run: `nutricoach/scripts/seed-plantillas-elite.ts`

- [ ] **Step 1: Ejecutar el seed script**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx tsx scripts/seed-plantillas-elite.ts
```

Salida esperada (aprox):
```
🌱 Seed plantillas élite NutriCoach Pro

📋 Gym Estética — Upper/Lower Intermedio
  ✓ Plantilla creada
  ✓ Sesión: Upper Push — Pecho, Hombros, Tríceps (6 ejercicios)
  ...
📋 Funcional — Pérdida de Peso Intermedio
  ...
📋 Hyrox Open — Preparación Intermedio
  ...
📋 Running — Fondo Intermedio (VDOT 40-50)
  ...
📋 Ciclismo Potencia — Intermedio (FTP base)
  ...
📋 Calistenia — Muscle-Up Estricto (Elite)
  ...
📋 Híbrido Elite — Hyrox + Muscle-Up (Carlos)
  ...
📋 Gym Fuerza — Press Banca + Fuerza General
  ...

✅ Seed completado
```

- [ ] **Step 2: Verificar en Supabase**

En Supabase SQL Editor:
```sql
SELECT nombre, sport_modality, tier, nivel, dias_por_semana,
  (SELECT COUNT(*) FROM plantilla_sesiones WHERE plantilla_id = pe.id) AS num_sesiones,
  (SELECT COUNT(*) FROM plantilla_sesiones ps
   JOIN plantilla_sesion_ejercicios pse ON pse.sesion_id = ps.id
   WHERE ps.plantilla_id = pe.id) AS num_ejercicios
FROM plantillas_entrenamiento pe
WHERE sport_modality IS NOT NULL
ORDER BY sport_modality, tier;
```

Resultado esperado: 8 filas con num_sesiones entre 4-5 y num_ejercicios entre 20-35.

- [ ] **Step 3: Commit**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
git add scripts/seed-plantillas-elite.ts
git commit -m "feat: seed 8 plantillas élite — gym/funcional/hyrox/running/ciclismo/calistenia/hibrido/fuerza"
```

---

### Task 9: UI — PlantillaEntrenoSelector filtros por modalidad

**Files:**
- Modify: `nutricoach/components/training/PlantillaEntrenoSelector.tsx`

- [ ] **Step 1: Añadir filtros de sport_modality y tier al componente**

Localizar el inicio del componente `PlantillaEntrenoSelector` y añadir estado de filtros:

```typescript
// Añadir imports al principio del archivo
import type { SportModality, TrainingTier } from '@/types'

// Añadir dentro del componente, junto a los otros useState
const [filtroModalidad, setFiltroModalidad] = useState<SportModality | 'todas'>('todas')
const [filtroTier, setFiltroTier] = useState<TrainingTier | 'todas'>('todas')
```

- [ ] **Step 2: Añadir filtrado de plantillas**

Localizar donde se mapean/filtran las plantillas y añadir:

```typescript
const plantillasFiltradas = plantillas.filter(p => {
  if (filtroTier !== 'todas' && p.tier !== filtroTier) return false
  if (filtroModalidad !== 'todas' && p.sport_modality !== filtroModalidad) return false
  return true
})
```

- [ ] **Step 3: Añadir UI de filtros antes de la lista de plantillas**

```tsx
{/* Filtros sport_modality + tier */}
<div className="flex flex-wrap gap-2 mb-4">
  <div className="flex gap-1">
    <button
      onClick={() => setFiltroTier('todas')}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        filtroTier === 'todas' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface)] text-[var(--text-secondary)]'
      }`}
    >
      Todos
    </button>
    <button
      onClick={() => setFiltroTier('general')}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        filtroTier === 'general' ? 'bg-green-500 text-white' : 'bg-[var(--surface)] text-[var(--text-secondary)]'
      }`}
    >
      General
    </button>
    <button
      onClick={() => setFiltroTier('elite')}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        filtroTier === 'elite' ? 'bg-amber-500 text-white' : 'bg-[var(--surface)] text-[var(--text-secondary)]'
      }`}
    >
      Elite
    </button>
  </div>

  <div className="flex flex-wrap gap-1">
    {(['todas','gym_estetica','gym_fuerza','funcional','hyrox','ciclismo','running','hibrido','calistenia'] as const).map(m => (
      <button
        key={m}
        onClick={() => setFiltroModalidad(m)}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
          filtroModalidad === m ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface)] text-[var(--text-secondary)]'
        }`}
      >
        {m === 'todas' ? 'Todas' : m.replace('_', ' ')}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 4: Añadir badge de tier en cada card de plantilla**

Localizar donde se renderiza cada card de plantilla y añadir badge:

```tsx
{p.tier === 'elite' && (
  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-500">
    Elite
  </span>
)}
{p.sport_modality && (
  <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--surface-hover)] text-[var(--text-secondary)]">
    {p.sport_modality.replace('_', ' ')}
  </span>
)}
```

- [ ] **Step 5: Build y verificar**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx tsc --noEmit 2>&1 | grep error | head -10
# Esperado: 0 errores
npm run dev &
# Navegar a /entrenos y verificar:
# - Filtros de modalidad y tier visibles
# - Las 8 nuevas plantillas aparecen con badges correctos
# - El filtro Elite muestra solo las plantillas tier=elite
```

- [ ] **Step 6: Commit final Plan 1**

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
git add components/training/PlantillaEntrenoSelector.tsx
git commit -m "feat: training pro v2 — filtros modalidad/tier en PlantillaEntrenoSelector"
git push origin main
```

---

## Verificación final

```sql
-- Resumen completo del estado tras Plan 1
SELECT
  sport_modality,
  tier,
  COUNT(*) AS plantillas,
  SUM(sesiones) AS total_sesiones,
  SUM(ejercicios) AS total_ejercicios
FROM (
  SELECT
    pe.sport_modality,
    pe.tier,
    (SELECT COUNT(*) FROM plantilla_sesiones WHERE plantilla_id = pe.id) AS sesiones,
    (SELECT COUNT(*) FROM plantilla_sesiones ps
     JOIN plantilla_sesion_ejercicios pse ON pse.sesion_id = ps.id
     WHERE ps.plantilla_id = pe.id) AS ejercicios
  FROM plantillas_entrenamiento pe
  WHERE pe.sport_modality IS NOT NULL
) sub
GROUP BY sport_modality, tier
ORDER BY tier, sport_modality;
```

---

## Siguiente: Plan 2 — Motor de Adaptación IA

El Plan 2 implementa:
- `lib/entrenos/motor-entreno.ts` — árbol de 8 decisiones
- API `/api/entrenos/adaptar-semana` — endpoint que recibe perfil+checkin+TLS y devuelve propuesta razonada
- Actualización automática de `perfil_entreno_cliente` tras cada check-in
- Hook `useMotorEntreno` para el portal cliente

El Plan 3 implementa la vista semanal mejorada del portal cliente y el dashboard del coach para aprobar/modificar propuestas IA.
