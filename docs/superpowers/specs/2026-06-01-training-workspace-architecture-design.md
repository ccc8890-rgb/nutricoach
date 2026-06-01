# Training Workspace Architecture — Rediseño profundo

**Fecha:** 01-06-2026  
**Proyecto:** NutriCoach  
**Estado:** Spec para revisión de Carlos  
**Objetivo:** convertir el módulo de entrenamiento en un entorno profesional de trabajo para coaches, no en una colección de páginas.

---

## 1. Diagnóstico

El módulo actual ya tiene piezas valiosas:

- Command Center.
- AI Review.
- Plantillas.
- Biblioteca de ejercicios.
- Generación IA.
- Planes y sesiones.
- Registro de ejecución en cliente.

El problema no es que falten menús. El problema es que la experiencia sigue funcionando como un conjunto de pantallas separadas. Para competir con software top, el coach necesita un entorno donde pueda:

1. Ver qué clientes necesitan atención.
2. Entender por qué.
3. Abrir el contexto del cliente sin saltar entre cinco pantallas.
4. Ajustar la siguiente sesión con IA, historial y evidencia delante.
5. Guardar o aprobar cambios en pocos pasos.

La arquitectura debe pasar de "módulo de entrenos" a **Training Workspace**.

---

## 2. Referencias de mercado

### Harbiz

Harbiz destaca por centralizar entrenamiento, nutrición, seguimiento, comunicación, pagos, reservas y negocio. En entrenamiento ofrece biblioteca amplia de ejercicios/vídeos, rutinas con cargas, repeticiones, descansos y notas, programas reutilizables, feedback post-entreno, cronómetro, intervalos y app cliente. También clasifica clientes por estados operativos como pendientes, sin planificación, bajo cumplimiento o riesgo.

Fuentes:

- https://www.harbiz.io/
- https://www.harbiz.io/app-entrenamiento-personal
- https://www.harbiz.io/funcionalidades
- https://www.harbiz.io/funcionalidades/management/gestion-de-clientes

### Trainerize

Trainerize trabaja bien la idea all-in-one: entrenamiento, nutrición, hábitos, mensajes, seguimiento y app cliente.

Fuente:

- https://www.trainerize.com/features/

### TrueCoach

TrueCoach destaca por simplicidad operativa: workout builder, librería de vídeo, seguimiento de progreso y experiencia clara para cliente.

Fuente:

- https://truecoach.co/features/

### TrainHeroic

TrainHeroic se posiciona fuerte en programación, calendario, experiencia de atleta, seguimiento y sensación premium de entrenamiento serio.

Fuente:

- https://www.trainheroic.com/

### Oportunidad NutriCoach

El mercado centraliza herramientas. NutriCoach debe ir más allá:

- Entrenamiento conectado con nutrición.
- Check-ins y fatiga dentro del motor de decisión.
- Papers y reglas del coach como base de conocimiento.
- IA que propone acciones, pero el coach controla cambios críticos.
- Cliente con sesión guiada, no solo lista de ejercicios.

---

## 3. Principio de producto

Training Workspace debe responder a una pregunta:

> Qué debe hacer el coach hoy para mejorar el resultado de cada cliente con el menor número de pasos posible.

La IA no sustituye al coach. Reduce análisis repetitivo, ordena prioridades y prepara decisiones.

---

## 4. Nueva arquitectura visual

### 4.1 Shell propio de Training Workspace

El módulo necesita una estructura visual propia dentro de `CoachShell`.

Estructura:

```text
Training Workspace
  Header contextual
  Work modes
  Main canvas
  Context panel
  Action rail
```

#### Header contextual

Debe mostrar:

- Nombre del espacio: Training Workspace.
- Estado operativo del día: clientes en riesgo, IA pendiente, sesiones de hoy.
- CTA principal según contexto.
- Buscador global de cliente, plan, ejercicio o plantilla.

#### Work modes

Sustituyen la subnav como elemento protagonista.

Modos:

1. **Operate:** actuar sobre clientes.
2. **Plan:** construir o ajustar planes.
3. **Library:** gestionar activos reutilizables.
4. **Brain:** revisar IA, evidencia y automatizaciones.

Cada modo cambia el layout, no solo el enlace activo.

---

## 5. Pantallas principales

### 5.1 Operate — Coach Command

Pantalla diaria del coach.

Layout:

```text
┌──────────────────────────────────────────────┐
│ Header: estado del día + buscador + CTA       │
├───────────────┬──────────────────────────────┤
│ Priority rail │ Cliente seleccionado          │
│               │                              │
│ En riesgo     │ Training Room compacto        │
│ IA pendiente  │ Próxima sesión                │
│ Sin plan      │ Métricas clave                │
│ PR/progreso   │ Acciones recomendadas         │
└───────────────┴──────────────────────────────┘
```

Debe reemplazar la lista de cards como experiencia principal.

Cada cliente muestra:

- Estado.
- Próxima acción.
- Semana actual.
- Cumplimiento.
- Carga/TLS.
- RPE.
- Última sesión.
- Próxima sesión.
- IA pendiente.

Al seleccionar cliente, el panel central muestra:

- Qué pasa.
- Por qué importa.
- Qué recomienda la IA.
- Qué puede aprobar el coach.

### 5.2 Training Room — Cliente

Vista profunda por cliente.

Tabs internas:

1. **Hoy:** próxima sesión, objetivo y riesgos.
2. **Semana:** sesiones, adherencia, carga y notas.
3. **Historial:** PRs, ejercicios, RPE, volumen.
4. **Brain:** recomendaciones IA, evidencia, reglas aplicadas.
5. **Nutrición conectada:** ajustes por carga, CHO, energía, recuperación.
6. **Perfil atleta:** modalidad, lesiones, equipo, preferencias.

Esta vista debe estar disponible desde:

- Command Center.
- Ficha cliente.
- Plan Builder.
- AI Review.

### 5.3 Plan Builder

Debe dejar de sentirse como formulario.

Jerarquía visual:

```text
Plan
  Bloque
    Semana
      Sesión
        Bloque de sesión
          Ejercicio
            Sets
```

Layout recomendado:

```text
┌──────────────┬──────────────────────────┬──────────────┐
│ Plan outline │ Builder canvas            │ Assist panel │
│ Semanas      │ Sesión/bloques/ejercicios │ IA + library │
│ Sesiones     │ Sets y progresión         │ Historial    │
└──────────────┴──────────────────────────┴──────────────┘
```

Assist panel:

- Buscar ejercicios.
- Insertar bloque.
- Reemplazar por lesión/equipo.
- Sugerir progresión.
- Ver historial del ejercicio.
- Ver evidencia aplicada.

### 5.4 Plan Library

La biblioteca de plantillas debe ser un sistema profesional de planes.

Cada plantilla debe comunicar:

- Modalidad.
- Objetivo.
- Nivel.
- Duración.
- Días por semana.
- Fase.
- Equipamiento.
- Cliente ideal.
- Evidencia o criterio.
- Uso real: asignaciones, última vez usada.
- Calidad: completa, sin media, incompleta, legacy.

Vistas:

- Gallery: exploración visual.
- Table: gestión rápida.
- Compare: comparar dos plantillas.
- Detail: estructura completa del plan.

### 5.5 Exercise Library

Debe pasar de lista editable a base de conocimiento de ejercicios.

Ficha de ejercicio:

- Vídeo.
- Foto.
- Nombre.
- Grupo muscular.
- Músculos secundarios.
- Equipo.
- Dificultad.
- Cues técnicos.
- Errores comunes.
- Regresiones.
- Progresiones.
- Sustitutos.
- Contraindicaciones.
- Historial de uso.
- PRs asociados.

Filtros:

- Grupo muscular.
- Equipo.
- Patrón de movimiento.
- Objetivo.
- Dificultad.
- Sin vídeo.
- Sin foto.
- Sin cues.
- Aptos para lesión/equipo concreto.

### 5.6 Brain — AI Review

AI Review debe ser una bandeja de decisiones.

Cada tarjeta:

- Acción recomendada.
- Cliente afectado.
- Nivel de riesgo.
- Datos usados.
- Evidencia aplicada.
- Cambio propuesto.
- Impacto esperado.
- Botones: aprobar, editar, ignorar, abrir Training Room.

Tipos de decisión:

- Ajuste de volumen.
- Sustitución de ejercicio.
- Cambio de intensidad.
- Descarga.
- Mensaje al cliente.
- Ajuste nutricional por carga.
- Revisión manual.

---

## 6. Experiencia cliente

El cliente no debe ver un plan técnico. Debe ver una sesión guiada.

Pantalla de entreno:

1. Qué toca hoy.
2. Por qué toca.
3. Qué objetivo tiene la sesión.
4. Ejercicios con vídeo/cues.
5. Peso o reps sugeridas.
6. Registro rápido.
7. Feedback final: RPE, dolor, energía, comentario.
8. Resumen final claro.

La IA puede prellenar:

- Peso sugerido.
- Reps objetivo.
- Nota de ejecución.
- Adaptación si reporta dolor o fatiga.

Cambios críticos siempre requieren aprobación del coach.

---

## 7. IA y evidencia

La IA debe tener cuatro capas:

1. **Datos del cliente:** perfil atleta, lesiones, equipo, historial, adherencia, check-ins.
2. **Datos de entrenamiento:** sesiones, sets, RPE, carga, PRs, cumplimiento.
3. **Datos de nutrición:** kcal, macros, CHO, adherencia, recuperación.
4. **Base de conocimiento:** papers, reglas del coach y criterios internos.

Outputs:

- Recomendación para coach.
- Explicación corta para cliente.
- Nivel de confianza.
- Evidencia/regla usada.
- Riesgo si no se actúa.

---

## 8. Dirección visual

Estética:

- Profesional.
- Técnica.
- Premium.
- Clara.
- Densa solo donde aporte.

No debe parecer:

- CRUD de admin.
- Dashboard genérico de cards.
- Plantilla SaaS con gradientes IA.
- Lista interminable de formularios.

Principios visuales:

- Layout tipo cockpit en Operate.
- Builder en 3 columnas para planificación.
- Panel contextual persistente.
- Números con fuente mono/tabular.
- Color neutro con un único acento.
- Estados visuales claros: riesgo, atención, progreso, estable.
- Menos cards decorativas, más jerarquía por líneas, densidad y paneles.

---

## 9. Fases de implementación

### Fase A — Training Workspace Shell

Objetivo: crear la arquitectura visual base.

Cambios:

- Nuevo componente `TrainingWorkspaceShell`.
- Header contextual.
- Work modes.
- Layout responsive.
- Context panel opcional.
- Mantener rutas actuales para no romper navegación.

Verificación:

- `/entrenos`, `/entrenos/plantillas`, `/entrenos/ejercicios`, `/entrenos/brain-ia` cargan.
- Mobile sin solapamientos.
- Build y lint OK.

### Fase B — Operate cockpit

Objetivo: convertir `/entrenos` en espacio de decisión.

Cambios:

- Priority rail.
- Cliente seleccionado.
- Panel de acción.
- Resumen IA.
- Estados vacíos/carga/error.

Verificación:

- Command Center sigue usando `/api/entrenos/command-center`.
- Filtros mantienen funcionalidad.
- Cliente puede abrir ficha y AI Review.

### Fase C — Training Room compacto

Objetivo: crear componente reusable para contexto de cliente.

Cambios:

- `TrainingRoomPanel`.
- Datos actuales y estados vacíos estructurados si falta alguna fuente.
- Acciones rápidas.

Verificación:

- Se puede montar en `/entrenos` sin romper ficha cliente.

### Fase D — Plan Library y Exercise Library v2

Objetivo: convertir bibliotecas en sistema de activos.

Cambios:

- Plan Library: gallery/table/detail.
- Exercise Library: grid + detail panel.
- Quality score visible.

Verificación:

- Crear/asignar plantilla sigue funcionando.
- Guardar media de ejercicio sigue funcionando.

### Fase E — Plan Builder visual

Objetivo: builder de planes por outline, canvas y assist panel.

Cambios:

- Reestructurar `/entrenos/nueva`.
- Integrar búsqueda de ejercicios.
- Integrar sugerencias IA.

Verificación:

- Crear plan manual sigue operativo.
- No se pierden sesiones ni ejercicios.

### Fase F — Cliente sesión guiada

Objetivo: experiencia cliente más simple y potente.

Cambios:

- Sesión de hoy.
- Vídeo/cues.
- Registro rápido.
- Feedback final.
- Siguiente recomendación.

Verificación:

- Registrar sesión sigue guardando sets y RPE.
- Cliente móvil sin fricción.

---

## 10. Límites explícitos

No se debe hacer todo en un único commit.

Orden recomendado:

1. Fase A.
2. Fase B.
3. Fase C.
4. Fase D.
5. Fase E.
6. Fase F.

La primera entrega debe demostrar el cambio de arquitectura visual sin tocar de forma agresiva la base de datos.

---

## 11. Criterio de éxito

El rediseño está bien si:

- El coach entra y sabe qué hacer hoy.
- La IA queda integrada como asistente de decisión, no como pantalla aparte.
- Las bibliotecas parecen activos profesionales, no listados.
- El builder se entiende visualmente.
- El cliente puede entrenar sin explicación extra.
- El sistema reduce pasos repetitivos del coach.
