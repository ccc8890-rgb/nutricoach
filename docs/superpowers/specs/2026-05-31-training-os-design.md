# Training OS — Diseño del módulo de entrenamiento

**Fecha:** 31-05-2026  
**Proyecto:** NutriCoach  
**Estado:** Aprobado por Carlos — listo para planificación técnica

---

## Problema que resuelve

El módulo de entrenamiento actual presenta el plan como una lista de datos (tipo Excel) sin contexto, sin jerarquía visual clara y sin adaptación al perfil específico del atleta. Esto produce tres fricciones concretas:

1. **Cliente:** no sabe por qué hace lo que hace — el plan existe como datos, no como conversación del coach
2. **Coach:** crear y adaptar plantillas es tedioso; no hay visión global del estado de entrenamiento de todos los clientes
3. **Ambos:** la experiencia de seguimiento en móvil es incómoda — lista lineal, registro de sets poco accesible, sin contexto en tiempo real

---

## Solución: Training OS

Rediseño integral del módulo de entrenamiento estructurado en una jerarquía clara, con contexto IA en cada nivel y dos superficies diferenciadas (coach / cliente).

---

## 1. Arquitectura de información

Jerarquía flexible de 5 niveles. El **bloque/mesociclo es opcional** — para planes cortos o abiertos va Plan→Semana→Sesión→Ejercicio directamente. Para planes con fases (Hyrox 12 sem, maratón, etc.) se activa el nivel bloque.

```
PLAN
  └── [BLOQUE/MESOCICLO]  ← opcional, para planes con fases
        └── SEMANA (microciclo)
              └── SESIÓN
                    └── EJERCICIO
```

### Contexto IA en cada nivel

Cada nivel tiene un campo de texto generado por IA (editable por el coach) que explica el "porqué":

| Nivel | Ejemplo de contexto |
|-------|---------------------|
| **Plan** | "Tu objetivo es completar Hyrox Open <1h20. El plan combina fuerza funcional, capacidad aeróbica y práctica de las 8 estaciones." |
| **Bloque** | "Fase de acumulación. Volumen alto, intensidad moderada. No busques marcas todavía — construye base." |
| **Semana** | "Semana de intensificación. Tu body battery Garmin está en verde — buen momento para apretar." |
| **Sesión** | "Hoy cadena posterior. Descansa 3 min entre series pesadas — calidad sobre cantidad." |
| **Ejercicio** | "Bulgarian Split Squat: corrige asimetría de cadera. Transferencia directa al lunge Hyrox." |

**Generación:** Coach escribe una nota breve (intención/contexto) → IA genera el texto completo usando esa nota + perfil atleta + datos Garmin/Whoop. El coach puede editar o aceptar el texto generado.

---

## 2. Superficie Coach

### 2a. Dashboard global de entrenamiento

Vista tabla con todos los clientes. Columnas:

- **Nombre + plan activo** (ej: "Hyrox 12sem · sem 6")
- **Dots semanales** — cada sesión de la semana como un cuadrado: ✓ completada, ✗ perdida, pendiente
- **% cumplimiento** semanal
- **Fatiga** — calculada desde TLS acumulado + datos wearable (baja / media / alta ⚠)
- **Próxima sesión** — día
- **Última sync** — tiempo desde última actividad
- **Acciones** — Ver / Ajustar / Contactar

**Alertas IA automáticas:** si la IA detecta fatiga alta tras varias sesiones seguidas, muestra aviso con sugerencia de descarga. Si un cliente lleva 3+ días sin sesión, lo marca en rojo.

### 2b. Constructor de plantillas

Diseño en dos paneles:

**Panel izquierdo — Biblioteca de ejercicios:**
- Búsqueda por nombre
- Filtros por grupo muscular / modalidad (Hyrox, Running, Gym, etc.)
- Cards arrastrables hacia las sesiones

**Panel derecho — Sesiones de la semana:**
- Una card por sesión (título + día + color por tipo)
- Campo de nota breve del coach por sesión (la IA usa esto para generar el contexto)
- Lista de ejercicios con series/reps/carga inline
- Zona de drop para añadir ejercicios desde la biblioteca
- Botón "Generar contexto IA" para toda la semana

### 2c. Personalización por cliente

Vista de ajustes sobre la plantilla base asignada al cliente:

- **Ajustes activos** — qué se ha modificado respecto a la plantilla base, con razón
- **Sugerencias IA** — propuestas automáticas basadas en datos del cliente (fatiga, Garmin, historial RPE). El coach aprueba o ignora.
- **Notas del coach** — campo libre por ejercicio/sesión visible solo para el coach
- **Preview** — columna derecha que muestra exactamente lo que ve el cliente con todos los ajustes aplicados

---

## 3. Superficie Cliente (móvil-first)

### 3a. Vista plan semanal

Pantalla principal al entrar al portal de entrenamiento:

- **Barra de progreso** del mesociclo (sem X de Y)
- **Contexto de la semana** (texto IA) — visible antes de empezar cualquier sesión
- **Sesión de hoy destacada** con botón "▶ Empezar" directo
- **Resto de la semana** — lista de sesiones futuras con nombre y ejercicios clave
- **Sesiones pasadas** — marcadas como completadas con fecha

El contexto de la semana se adapta dinámicamente a datos del wearable: si body battery bajo → texto cambia a mensaje de recuperación. Si datos en verde → texto anima a intensificar.

### 3b. Ejecución de sesión

Un ejercicio a la vez (no lista infinita). Flujo:

1. **Header de sesión** — nombre, contexto IA ("Hoy cadena posterior…"), timer total, barra de progreso (ejercicio X de Y)
2. **Ejercicio activo** — nombre grande, músculo principal, contexto específico del ejercicio
3. **Botón demo** — solo visible si el ejercicio tiene vídeo/foto. No intrusivo.
4. **Series** — las completadas con peso/reps anotado, la activa con botones +/− grandes para móvil
5. **Timer de descanso** — aparece automáticamente al completar una serie
6. **Siguiente ejercicio** — visible en pequeño abajo para anticipar

**Registro de carga:** botones +/− para peso y reps. La IA precarga el peso de la última sesión como punto de partida.

**PR automático:** si el peso es mayor que el récord anterior en ese ejercicio, la app lo detecta y lo muestra al terminar la sesión.

### 3c. Pantalla de fin de sesión

- Resumen: volumen total, PRs del día, RPE medio
- Campo libre "¿cómo fue?" — el coach lo ve desde el dashboard
- Sin formulario largo — solo lo esencial

---

## 4. Sistema de media para ejercicios

- **Foto** (`foto_url`) — imagen demostrativa, opcional
- **Vídeo** (`video_url` + `video_tipo`) — YouTube, Instagram, URL directa
- El botón de demo solo aparece si el ejercicio tiene media asignada
- El coach gestiona la media desde la biblioteca de ejercicios (`/entrenos/ejercicios`)
- Modal de demo: para ejercicios complejos (pliometría, movimientos olímpicos, estaciones Hyrox)

---

## 5. Integración con sistemas existentes

| Sistema existente | Integración |
|-------------------|-------------|
| **Garmin / Terra** | Contexto semana + sugerencias de ajuste IA usan body battery, fatiga, TLS |
| **Perfil atleta** (`perfil_entreno_cliente`) | IA usa sport_modality, FTP, VO2max, lesiones para personalizar contexto por ejercicio |
| **TLS (Training Load Score)** | Fatiga en dashboard coach calculada desde TLS acumulado |
| **PRs (`prs_por_ejercicio`)** | Vista historial + detección automática durante ejecución |
| **Motor-entreno** | Sigue siendo el motor de recomendación de plantillas al asignar un plan nuevo |
| **Agentes IA** | El agente `revisor-semanal-entreno` usa datos de cumplimiento y fatiga para proponer ajustes |

---

## 6. Cambios en base de datos

### Tabla `planes_entrenamiento`
- Añadir `contexto_ia TEXT` — texto generado al nivel del plan
- Añadir `nota_coach TEXT` — input del coach que la IA usa para generar el contexto

### Tabla `bloques_entrenamiento` (nueva, opcional)
```sql
id, plan_id, nombre, orden, semana_inicio, semana_fin, objetivo, contexto_ia, nota_coach
```

### Tabla `sesiones_entrenamiento` (ya existe, añadir)
- `contexto_ia TEXT`
- `nota_coach TEXT`

### Tabla `sesion_ejercicios` (ya existe, añadir)
- `contexto_ia TEXT` — "porqué" del ejercicio en esta sesión concreta

### Tabla `ejercicios` (ya existe con foto_url/video_url)
- Migration `20260529_ejercicios_media.sql` está en el repo pero **pendiente de aplicar en Supabase** — aplicar antes de F4

### Tabla `registros_sets` (crear — no existe actualmente)
```sql
CREATE TABLE registros_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_sesion_id UUID REFERENCES registros_entreno(id) ON DELETE CASCADE,
  ejercicio_id UUID REFERENCES ejercicios(id),
  numero_serie INTEGER NOT NULL,
  peso_kg NUMERIC,
  reps INTEGER,
  completado BOOLEAN DEFAULT false,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 7. Lo que NO entra en este diseño (fuera de alcance)

- Nutrición peri-entrenamiento (ya existe `lib/nutricion-peri-entreno.ts`)
- Generación de planes desde cero por IA (ya existe `proponer-plan-ciencia`)
- Integración con apps de running (Strava sync ya operativo)
- Competiciones y tapering (ya existe `competiciones` table)

---

## 8. Criterios de éxito

1. Carlos puede seguir su rutina completa desde el móvil sin tener que saltar entre pantallas
2. El contexto IA aparece en los 3 niveles mínimos (semana, sesión, ejercicio) para todos los clientes
3. El coach puede ver el estado de todos sus clientes en una sola pantalla en menos de 10 segundos
4. El registro de un set (peso + reps + completar) requiere 3 toques en móvil
5. Los PRs se detectan y guardan automáticamente sin acción del usuario

---

## 9. Orden de implementación sugerido

El diseño se implementa en 4 fases, cada una entregable de forma independiente:

| Fase | Alcance | Impacto inmediato |
|------|---------|-------------------|
| **F1 — Ejecución sesión cliente** | Vista set-by-set, registro peso/reps, PR automático, pantalla fin sesión | Carlos puede usarlo ya en sus entrenamientos |
| **F2 — Contexto IA** | Generación texto en semana + sesión + ejercicio, campo nota coach | Plan deja de verse como Excel |
| **F3 — Dashboard coach** | Tabla global clientes, dots cumplimiento, alerta fatiga | Coach ve estado de todos los clientes de un vistazo |
| **F4 — Constructor plantillas** | Panel drag-drop, biblioteca ejercicios, personalización por cliente, media ejercicios | Coach crea y ajusta planes sin fricción |
