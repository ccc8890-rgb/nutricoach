# Spec: Sistema de Entrenamiento Pro — NutriCoach

**Fecha:** 17-05-2026
**Estado:** Aprobado por Carlos — pendiente de plan de implementación
**Autor:** Carlos Casanova + Claude (sesión brainstorming)

---

## Contexto y objetivo

La pestaña de entrenos actual tiene plantillas funcionales pero genéricas. El objetivo de este sistema es convertirla en una herramienta de coaching de alto nivel que:

1. Ofrezca contenido científicamente riguroso y específico por disciplina deportiva
2. Se adapte dinámicamente al estado real del atleta en cada momento
3. Escale desde el cliente de gym de estética hasta el atleta Hyrox/ciclismo de nivel pro-amateur
4. Sea el diferenciador de valor percibido que justifica el precio frente a Harbiz u otras plataformas genéricas

El primer caso de uso real es Carlos como cliente propio — atleta híbrido (gym + Hyrox + calistenia, objetivo muscle-up estricto).

---

## Arquitectura general (3 capas)

```
CAPA 1 — Librería de plantillas científicas
  Plantillas pre-construidas por modalidad × nivel × objetivo específico
  Parámetros reales: %FTP, %1RM, RIR, zonas FC, pace VDOT, RPE estación
  Contenido inmutable — base de confianza para la IA

      ↓ alimenta

CAPA 2 — Motor de adaptación dinámica IA
  Inputs: perfil_entreno_cliente + check-in semanal + TLS + fase competición + HRV
  Output: propuesta semanal razonada con justificación de ajustes
  Coach aprueba / modifica / revierte

      ↓ presenta en

CAPA 3 — Portal cliente (vista semanal)
  Semana completa con sesiones detalladas
  Badge de ajuste IA cuando algo cambió
  Registro de cumplimiento + feedback post-sesión
```

---

## Sección 1 — Modelo de datos

### Cambios en `plantillas_entrenamiento`

```sql
ALTER TABLE plantillas_entrenamiento ADD COLUMN sport_modality text
  CHECK (sport_modality IN (
    'gym_estetica', 'gym_fuerza', 'funcional', 'hyrox',
    'ciclismo', 'running', 'hibrido', 'calistenia'
  ));

ALTER TABLE plantillas_entrenamiento ADD COLUMN objetivo_especifico text;
-- Valores por modalidad:
-- gym_estetica: 'pecho_hombros' | 'gluteos' | 'abs_definicion' | 'brazos' | 'espalda_ancha' | 'composicion_general'
-- gym_fuerza: 'mejora_banca' | 'mejora_sentadilla' | 'mejora_peso_muerto' | 'fuerza_general'
-- calistenia: 'muscle_up' | 'handstand' | 'front_lever' | 'planche' | 'dominadas_maximas'
-- hyrox: 'open' | 'pro' | 'mejora_skierg' | 'mejora_sled' | 'mejora_wall_balls'
-- ciclismo: 'subir_ftp' | 'gran_fondo' | 'sprint_potencia'
-- running: 'maraton' | '10k' | 'velocidad_base'
-- hibrido: 'hyrox_fuerza' | 'running_gym' | 'triatlon'

ALTER TABLE plantillas_entrenamiento ADD COLUMN tier text DEFAULT 'general'
  CHECK (tier IN ('general', 'elite'));

-- Multiplicadores de volumen/intensidad por fase de competición
ALTER TABLE plantillas_entrenamiento ADD COLUMN phase_adjustments jsonb DEFAULT '{
  "base": {"volumen": 1.0, "intensidad": 1.0},
  "construccion": {"volumen": 1.15, "intensidad": 1.1},
  "pico": {"volumen": 1.0, "intensidad": 1.15},
  "tapering": {"volumen": 0.65, "intensidad": 0.9},
  "race_day": {"volumen": 0.2, "intensidad": 0.6},
  "recuperacion": {"volumen": 0.45, "intensidad": 0.7}
}';
```

### Cambios en `plantilla_sesion_ejercicios`

```sql
-- Unidad de medida de la prescripción (sustituye/complementa 'repeticiones')
ALTER TABLE plantilla_sesion_ejercicios ADD COLUMN unidad text DEFAULT 'reps'
  CHECK (unidad IN ('reps', 'cal', 'metros', 'segundos', 'km', 'pct_ftp', 'km_h', 'kg'));

-- Tipo de carga/intensidad
ALTER TABLE plantilla_sesion_ejercicios ADD COLUMN carga_tipo text
  CHECK (carga_tipo IN ('peso_kg', 'pct_rm', 'pct_ftp', 'rpe', 'zona_fc', 'rir', 'sin_carga'));

-- Valor numérico de la carga (ej: 85 si carga_tipo=pct_ftp, 2 si rir, 7 si rpe)
ALTER TABLE plantilla_sesion_ejercicios ADD COLUMN carga_valor float;

-- Cue técnico del ejercicio — lo que hace parecer al coach de verdad
ALTER TABLE plantilla_sesion_ejercicios ADD COLUMN notas_tecnicas text;

-- Sustituciones automáticas según condición: array de {condicion, ejercicio_id}
-- Permite múltiples sustituciones por ejercicio (hombro, rodilla, sin equipo, etc.)
-- Ej: [{"condicion":"molestia_hombro","ejercicio_id":"uuid-press-neutro"},
--      {"condicion":"sin_sled","ejercicio_id":"uuid-farmer-carry"}]
ALTER TABLE plantilla_sesion_ejercicios ADD COLUMN sustituciones jsonb DEFAULT '[]';
```

### Nueva tabla `perfil_entreno_cliente`

```sql
CREATE TABLE perfil_entreno_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES clientes(id) UNIQUE,
  sport_modality text,
  objetivo_especifico text,
  nivel text CHECK (nivel IN ('principiante', 'intermedio', 'avanzado')),
  dias_disponibles int DEFAULT 4,
  mejor_momento_sesion text CHECK (mejor_momento_sesion IN ('manana', 'tarde', 'noche', 'variable')),
  -- Capacidades base (se actualizan con tests periódicos)
  ftp_watts int,                         -- ciclismo
  vdot float,                            -- running (Jack Daniels)
  rm_sentadilla_kg float,
  rm_banca_kg float,
  rm_peso_muerto_kg float,
  dominadas_max_reps int,
  -- Perfil de adaptación (IA actualiza progresivamente)
  capacidad_recuperacion text DEFAULT 'media' CHECK (capacidad_recuperacion IN ('baja', 'media', 'alta')),
  respuesta_a_volumen text DEFAULT 'media' CHECK (respuesta_a_volumen IN ('bajo', 'medio', 'alto')),
  patron_lesiones jsonb DEFAULT '[]',    -- array de {zona, frecuencia, ultima_vez}
  adherencia_historica_pct float,
  respuesta_psicologica text DEFAULT 'rutina' CHECK (respuesta_psicologica IN ('variedad', 'rutina', 'competicion')),
  plateau_detectado boolean DEFAULT false,
  semanas_sin_progresion int DEFAULT 0,
  -- Restricciones actuales
  equipo_disponible jsonb DEFAULT '["barra", "mancuernas", "polea", "cardio_maquinas"]',
  restricciones_temporales text,         -- "viaje sem 3", "trabajo turnos noche", etc.
  -- Biomarkers (actualizados manualmente o via integración)
  hrv_baseline float,                    -- HRV medio de las últimas 2 semanas (ms)
  hrv_fecha_ultimo date,
  vo2max_estimado float,
  fms_score jsonb,                       -- {deep_squat, hurdle_step, inline_lunge, shoulder_mobility, active_straight_leg_raise, trunk_stability, rotary_stability}
  -- Integración wearables
  garmin_user_id text,
  strava_athlete_id text,
  apple_health_enabled boolean DEFAULT false,
  -- Informes médicos/fisio
  fisio_informe jsonb DEFAULT '[]',      -- array de {fecha, diagnostico, estructuras, contraindicados[], correctivos[], alta_deportiva}
  analisis_sangre jsonb DEFAULT '[]',    -- array de {fecha, ferritina, hierro, vit_d, hemoglobina, testosterona, cortisol, pcr}
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Nueva tabla `ajustes_sesion_cliente`

```sql
CREATE TABLE ajustes_sesion_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES clientes(id),
  plantilla_sesion_id uuid REFERENCES plantilla_sesiones(id),
  fecha_semana date,                     -- lunes de la semana en cuestión
  motivo text CHECK (motivo IN (
    'lesion', 'molestia', 'fatiga_alta', 'hrv_bajo', 'viaje',
    'equipo_no_disponible', 'sobreentrenamiento', 'deload', 'coach_manual'
  )),
  detalle_motivo text,                   -- descripción libre
  ajuste_aplicado jsonb,                 -- diff de lo que cambió vs plantilla base
  razonamiento_ia text,                  -- explicación legible del por qué
  generado_por text DEFAULT 'ia' CHECK (generado_por IN ('ia', 'coach')),
  estado text DEFAULT 'propuesto' CHECK (estado IN ('propuesto', 'aprobado', 'modificado', 'revertido')),
  coach_notas text,
  created_at timestamptz DEFAULT now()
);
```

---

## Sección 2 — Librería de plantillas científicas

### Estructura por modalidad

Cada modalidad tiene **3 niveles** (principiante / intermedio / avanzado) y entre 1 y 3 objetivos específicos. Total estimado: ~35 plantillas de alta calidad.

### Parámetros científicos por disciplina

#### Gym Estética / Recomposición
**Base científica:** Schoenfeld (2010, 2017), meta-análisis de hipertrofia Krieger (2010), Helms et al. (2014)
- Volumen: 10-20 series/grupo muscular/semana en mesociclos de 4 semanas
- Métrica de intensidad: **RIR (Reps In Reserve)** — semana 1 RIR 3 → semana 4 RIR 0 → deload
- Rangos: 6-12 reps (hipertrofia), 15-20 (metabólico/pump), 3-6 (fuerza base)
- Splits según días: Full Body (3d) → Upper/Lower (4d) → PPL (5-6d)
- Prescripción ejemplo:
  ```
  4×10 Press Banca | 75% 1RM | RIR 2 | Descanso 2min
  Cue: escápulas retraídas y deprimidas durante todo el recorrido, no rebotar
  ```

#### Gym Fuerza (Powerlifting/Strength)
**Base científica:** Prilepin's chart, Westside Barbell methodology, Helms et al. "Strength and Conditioning for Natural Bodybuilders"
- Rangos de fuerza: 1-5 reps al 85-97.5% 1RM
- Periodización lineal por ondas (semana pesada/media/ligera)
- Accesorios en 3×8-12 para trabajo de debilidades específicas
- Deload cada 4 semanas obligatorio

#### Funcional / Pérdida de peso
**Base científica:** ACSM guidelines 2021, entrenamiento concurrente Coffey & Hawley
- HIIT estructurado: ratios trabajo:descanso 1:2 (principiante) → 2:1 (avanzado)
- Patrones de movimiento primarios: empuje, tirón, bisagra, sentadilla, core antirotación, locomoción
- Cardio: Z2 como base aeróbica (60-70% FCmax), Z4 para EPOC (80-90% FCmax)

#### HYROX
**Base científica:** Hunter McIntyre training methodology, Hyrox official guidelines, CrossFit Endurance (Maffetone)
- **4 bloques de entrenamiento diferenciados:**
  1. Capacidad aeróbica base (Z2, 60-70% FCmax, rodajes largos y SkiErg/remo continuo)
  2. Umbral de carrera (3-5×8min al ritmo objetivo Hyrox 1km, recuperación 3min)
  3. Fuerza estación-específica (ejercicios aislados de las 8 estaciones con cargas oficiales)
  4. Simulacros parciales y completos (secuencias de estaciones + carrera)
- **Cargas oficiales por categoría:**
  - Open Hombre: Sled Push 102kg, Sled Pull 102kg, Sandbag Lunges 20kg, Wall Balls 9kg (9m)
  - Open Mujer: Sled Push 63kg, Sled Pull 63kg, Sandbag Lunges 10kg, Wall Balls 6kg (9m)
  - Pro Hombre: Sled Push 225kg, Sled Pull 225kg, Sandbag Lunges 30kg, Wall Balls 9kg (10m)
  - Pro Mujer: Sled Push 150kg, Sled Pull 150kg, Sandbag Lunges 20kg, Wall Balls 9kg (10m)
- **Prescripción ejemplo sesión Hyrox:**
  ```
  BLOQUE 1 — Umbral carrera
  3×1km @ ritmo objetivo Hyrox | recuperación 3min trote Z1
  
  BLOQUE 2 — Estaciones específicas
  SkiErg 4×500m | objetivo: −5s/500m bajo ritmo carrera | rec 2min walk activo
  Sled Push 4×25m | 102kg (Open H) / 63kg (Open M) | rec 3min completa
  Wall Balls 5×15 reps | 9kg / 6kg | rec 90s
  
  BLOQUE 3 — Capacidad aeróbica
  Remo 20min continuo @ Z2 (60-70% FCmax)
  ```
- **Periodización 16 semanas hacia competición:**
  - Sem 1-6: Base aeróbica (volumen ×1.0, Z2 dominante 80%)
  - Sem 7-11: Construcción específica (volumen ×1.15, simulacros parciales)
  - Sem 12-14: Pico de intensidad (volumen ×1.0, intensidad máxima, simulacros completos)
  - Sem 15-16: Tapering (volumen ×0.65, intensidad preservada, carrera de activación día −2)

#### Ciclismo
**Base científica:** Coggan & Allen "Training and Racing with a Power Meter" (3rd Ed.), Seiler polarized training model, Friel "The Cyclist's Training Bible"
- **7 zonas de potencia (% FTP del ciclista):**
  - Z1 Recuperación activa: <55% FTP
  - Z2 Resistencia aeróbica: 56-75% FTP
  - Z3 Tempo: 76-90% FTP
  - Z4 Umbral láctico: 91-105% FTP
  - Z5 VO2max: 106-120% FTP
  - Z6 Capacidad anaeróbica: >120% FTP
  - Z7 Neuromuscular: sprints máximos
- **Workouts clave:**
  ```
  Sweet Spot: 2×20min @ 88-93% FTP | cadencia 85-95rpm | rec 5min Z1
  Threshold over-unders: 5×(3min@105%FTP + 3min@95%FTP) | rec 8min Z1
  VO2max: 5×3min @115-120% FTP | cadencia libre | rec 3min Z1
  Z2 largo: 90-150min continuo @56-75% FTP | cadencia >90rpm
  Tabata: 8×(20s @150%FTP + 10s recuperación) — anaeróbico
  ```
- **Ratio 80/20 (Seiler polarized):** 80% volumen en Z1-Z2, 20% en Z4-Z7
- **TSS semanal objetivo por fase:**
  - Base: 300-400 TSS/semana
  - Construcción: 500-600 TSS/semana
  - Pico: 600-700 TSS/semana
  - Tapering: 200-300 TSS/semana
- **Test FTP:** Protocolo Ramp Test (preferido, 20-25min) o 20min all-out × 0.95

#### Running
**Base científica:** Jack Daniels "Daniels' Running Formula" (4th Ed., VDOT system), Hansons Marathon Method, Seiler 80/20
- **5 ritmos de entrenamiento desde VDOT del atleta:**
  - Easy (E): 59-74% VO2max — conversacional, mayoría del volumen
  - Marathon (M): 75-84% VO2max — esfuerzo de maratón
  - Threshold (T): 83-88% VO2max — "cómodamente duro", ~1h raza
  - Interval (I): 97-100% VO2max — series de 3-5min máximo
  - Repetition (R): 105-120% VO2max — velocidad pura, series <2min
- **Sesión ejemplo VDOT 45 (sub-4h maratón):**
  ```
  Calentamiento: 2km @ E-pace (6:15/km)
  Trabajo: 4×1600m @ I-pace (5:12/km) | recuperación 400m trote
  Strides: 6×100m @ R-pace (4:30/km) | recuperación 100m walk
  Vuelta calma: 2km @ E-pace
  ```
- **Strides semanales** (6×100m @ R-pace): obligatorias 2×/semana para economía de carrera
- **Long run:** máximo 25-30% del volumen semanal total

#### Híbrido (Gym + Running / CrossFit)
**Base científica:** Viada "The Hybrid Athlete", Crawley Fergus concurrent training protocols, Coffey & Hawley interference effect research
- **Regla de compatibilidad de sesiones (efecto interferencia):**
  - NO: sentadilla pesada el mismo día que long run
  - NO: trabajo de pierna alta intensidad + running de calidad en <6h
  - SÍ: fuerza upper + running el mismo día (sin interferencia)
  - SÍ: fuerza lower AM + running Z2 largo PM (separados ≥6h)
- **Estructura semanal 5 días:**
  ```
  Lunes:    Fuerza Upper (press, remo, dominadas — 5×5 fuerza + 3×10 hipertrofia)
  Martes:   Carrera umbral (Daniels T-pace intervals)
  Miércoles:Fuerza Lower (sentadilla, peso muerto, hip thrust — alta intensidad)
  Jueves:   Carrera fácil Z2 + trabajo técnico / strides
  Viernes:  Full body potencia (clean, jumps, empuje, tirón) + capacidad aeróbica HIIT
  Sábado:   Long run @ E-pace (mayor distancia de la semana)
  Domingo:  Descanso activo (movilidad, foam roll, caminata)
  ```
- **Distribución volumen:** fuerza 40% / running 40% / movilidad-recuperación 20%

#### Calistenia
**Base científica:** Steven Low "Overcoming Gravity" (2nd Ed.), Sommer "Building the Gymnastic Body", Antranik calisthenics methodology
- **Prerrequisitos para muscle-up estricto (codificados como gates):**
  - ≥10 dominadas estrictas pronadas consecutivas
  - ≥15 dips en paralelas consecutivos
  - Pull-up con agarre falso en anillas (false grip)
- **Ruta de progresión escalonada:**
  1. Dominadas explosivas chest-to-bar (4×3 con 3min descanso — trabajo neurológico)
  2. Negativas lentas en barra (5×5 @ 5s excéntrico)
  3. Transición muscle-up asistida (cajón + agarre mixto)
  4. Muscle-up con kip controlado → muscle-up estricto
  5. Para anillas: false grip pull-up → ring transition drills → RTO (rings turned out)
- **Regla de adaptación tendinosa:** connective tissue adapts 8-12 weeks per block — NUNCA incrementar volumen >10%/semana en trabajo de anillas; dolor en codo = parar inmediatamente
- **Trabajo neuro siempre al inicio de sesión** (skill fresco, no fatiga previa)
- **Sesión ejemplo muscle-up:**
  ```
  Neurológico (inicio, fresco):
  4×3 Dominadas explosivas chest-to-bar | 3min descanso completo
  3×5 Transición muscle-up cajón | 2min descanso
  
  Fuerza de apoyo:
  3×8 Dips búlgaros (ring dips si disponibles) | RIR 2
  3×6 Remo supino en anillas | pausa 2s arriba
  
  Core:
  3×30s Plancha RTO (rings turned out, roscada hacia afuera)
  2×10 L-sit pulses desde suelo
  ```

---

## Sección 3 — Motor de adaptación dinámica IA

### Inputs del motor

```typescript
interface MotorEntrenoInputs {
  perfil: PerfilEntrenoCliente;
  checkin: {
    energia: 1 | 2 | 3 | 4 | 5;
    sueño_horas: number;
    molestias: Array<{zona: string; intensidad: 1|2|3}>;
    adherencia_semana_anterior: number; // 0-100%
    rpe_percibido: number;              // RPE promedio entrenamientos anteriores
    nota_libre: string;                 // "esta semana mucho estrés laboral"
  };
  tls_actual: number;
  tls_media_4semanas: number;
  fase_competicion: 'base' | 'construccion' | 'pico' | 'tapering' | 'race_day' | 'recuperacion' | null;
  dias_para_competicion: number | null;
  hrv_hoy: number | null;
  hrv_baseline: number | null;
  historial_progresion: Array<{
    semana: string;
    cargas: Record<string, number>; // ejercicio → kg/watts/pace
    completado_pct: number;
  }>;
}
```

### Árbol de decisión

```
1. ¿HRV hoy < 85% del baseline? → Cambiar a sesión de recuperación activa / técnica
2. ¿Energía check-in ≤ 2? → Deload automático esta semana (−40% volumen)
3. ¿TLS actual > 120% media 4 semanas? → Reducir volumen 15-20%
4. ¿Molestia con intensidad ≥ 2 en zona X? → Activar ejercicio_sustitucion_id para ejercicios con condicion_sustitucion = zona X
5. ¿Fase = tapering? → Aplicar multiplicadores phase_adjustments.tapering
6. ¿Adherencia semana anterior < 70%? → Simplificar plan (−1 ejercicio por sesión, ↓ series)
7. ¿plateau_detectado = true y semanas_sin_progresion ≥ 2? → Cambio de estímulo: shift rep range o técnica de intensidad (myo-reps, drop sets, tempo)
8. ¿dias_para_competicion ≤ 14? → Override a tapering independientemente de la fase asignada
9. Default: aplicar plantilla base con multiplicadores de fase
```

### Estructura del output al coach

```typescript
interface PropuestaEntrenoSemanal {
  semana: string;
  sesiones: SesionDetallada[];
  razonamiento_ia: string;    // "He reducido volumen pierna 20% por molestia rodilla (intensidad 2) reportada + TLS 118% de la media. Las sentadillas han sido sustituidas por leg press para evitar flexión profunda. Propongo revisión con fisio si la molestia persiste."
  ajustes_aplicados: Array<{
    tipo: string;
    descripcion: string;
    confianza: 'alta' | 'media' | 'baja';
  }>;
  alertas: string[];           // "⚠️ 9 días para competición — confirmar que el tapering es el correcto"
  estado: 'propuesto';
}
```

### Archivo clave a crear

`nutricoach/lib/entrenos/motor-entreno.ts` — espejo del `motor-macros.ts` de nutrición pero para entrenamiento.

---

## Sección 4 — Portal cliente: vista semanal mejorada

### Lo que el cliente ve

```
┌─────────────────────────────────────────────┐
│ SEMANA DEL 19 AL 25 MAYO · FASE: CONSTRUCCIÓN │
│ 🤖 Sesión adaptada esta semana — ver detalle  │
├────────┬────────┬────────┬────────┬──────────┤
│ LUNES  │MARTES  │ MIÉRC  │ JUEVES │ VIERNES  │
│ Fuerza │ Umbral │ Fuerza │  Z2 +  │Full body │
│ Upper  │carrera │ Lower  │strides │+ HIIT    │
│ Ver ↓  │ Ver ↓  │ Ver ↓  │  Ver ↓ │  Ver ↓   │
└────────┴────────┴────────┴────────┴──────────┘
```

### Detalle de sesión expandida

Cada sesión muestra:
- Nombre, duración estimada, tipo (fuerza / cardio / técnica / mixta)
- Ejercicios con: series × reps/distancia/cal @ carga (RIR/RPE/%FTP/kg) + descanso
- Cue técnico por ejercicio
- Nota de la IA si el ejercicio fue sustituido ("sustituido por X debido a molestia hombro")
- Botón "Registrar completado" → abre `RegistrarEntrenoModal` existente + nuevo campo de feedback

### Componente de feedback post-sesión

```typescript
// Ampliación del check-in: feedback por sesión individual
interface FeedbackSesion {
  completado: boolean;
  rpe_real: number;           // 1-10
  tiempo_real_min: number;
  molestia_nueva: string | null;
  nota: string;               // "no llegué a los 105% FTP en la última serie"
  ejercicios_modificados: Array<{ejercicio_id: string; motivo: string}>;
}
```

---

## Sección 5 — Dashboard del coach: gestión de ajustes IA

### Vista de ajustes pendientes de aprobar

El coach ve, por cada cliente con ajuste propuesto:
- Nombre del cliente + modalidad + fase
- Resumen del ajuste en 2 líneas (razonamiento_ia resumido)
- Botón **Aprobar** / **Modificar** / **Revertir a plantilla base**
- Si hay alerta médica (molestia ≥ 3, HRV muy bajo, meseta >4 semanas) → badge rojo con prioridad

### Override campo a campo

El coach puede editar la propuesta de la IA ejercicio a ejercicio antes de aprobar, con un campo de nota que queda registrado en `ajustes_sesion_cliente.coach_notas`. Cada override entrena el `perfil_entreno_cliente` del cliente.

---

## Hoja de ruta de integración de datos externos

| Fase | Integración | Valor | Esfuerzo |
|------|-------------|-------|---------|
| **MVP** | Input manual HRV matutino (número en check-in) | Alto | Bajo |
| **MVP** | FMS score en onboarding (7 patrones, puntuación 1-3) | Alto | Bajo |
| **MVP** | Analítica de sangre (upload manual o entrada de valores) | Alto | Bajo |
| **Fase 2** | Strava API (import automático de actividades completadas) | Muy alto | Medio |
| **Fase 2** | CTL/ATL/TSB Performance Management Chart (visual) | Alto | Medio |
| **Fase 3** | Apple HealthKit / Garmin Connect API (HRV, sueño, carga) | Muy alto | Alto |
| **Fase 3** | Whoop API | Alto | Medio |
| **Fase 4** | Chat IA con el coach (conversacional, ajustes en tiempo real) | Muy alto | Alto |
| **Fase 4** | Tests laboratorio (VO2max, lactato, DEXA) — almacenamiento + análisis | Alto | Medio |

---

## Caso de uso 1 — Auto-test Carlos (cliente real)

**Perfil:** Atleta híbrido 65kg/1.67m. Objetivo: Hyrox Open + muscle-up estricto + mantenimiento composición corporal.

**Plantilla asignada:** `hibrido` tier elite → `hyrox_fuerza` + `calistenia` muscle-up superpuesto.

**Semana tipo:**
```
Lunes:    Hyrox estaciones específicas (SkiErg + Sled circuit + Wall Balls) + Upper fuerza
Martes:   Carrera umbral (3×10min @ T-pace Daniels)
Miércoles:Fuerza Lower (sentadilla, RDL, hip thrust) + muscle-up progression (inicio sesión)
Jueves:   Z2 largo 45-60min + strides + movilidad
Viernes:  Full body potencia + capacidad HIIT (burpees, KB swings, remo)
Sábado:   Long run @ E-pace 10-14km
Domingo:  Descanso activo (foam roll, movilidad articular)
```

**Ajuste automático si Carlos reporta molestia en hombro:**
- Press overhead → neutro grip press o Landmine press
- SkiErg → sustituido por Remo ergómetro
- Alerta al coach para revisar en próxima consulta

---

## Consideraciones de implementación

1. **El modelo de datos se aplica en Supabase** — migraciones SQL antes que cualquier código
2. **Las plantillas de élite se crean como SQL seed** — fichero `seed_plantillas_elite.sql` con contenido completo y verificado antes de insertar
3. **El motor de entreno espeja el patrón de `motor-macros.ts`** — misma estructura de inputs/outputs/árbol de decisión
4. **La vista semanal ampliada extiende `PlantillaEntrenoSelector.tsx`** — no reemplaza, añade capa de detalle
5. **El dashboard del coach reutiliza el patrón de `PeriodizacionPanel`** — misma lógica de propuesta → aprobar/modificar
6. **Cada plantilla elite pasa por revisión científica** antes de seed — citar fuente bibliográfica en `descripcion` de la plantilla

---

## Definición de éxito

- Un cliente Hyrox puede ver su semana completa con cargas reales (kg de sled, cal SkiErg, pace carrera) sin ambigüedad
- Un cliente de gym puede ver "4×10 Press Banca | RIR 2 | Cue: escápulas retraídas" y saber exactamente qué hacer
- El coach puede revisar y aprobar ajustes IA de 5 clientes en menos de 10 minutos
- Carlos completa 4 semanas de su plan Hyrox + muscle-up sin necesidad de preguntar nada
