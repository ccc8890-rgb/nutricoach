# Training OS 2.0 — Diseño de producto

**Fecha:** 01-06-2026  
**Proyecto:** NutriCoach  
**Estado:** Borrador para revisión de Carlos  
**Objetivo:** rediseñar por completo el módulo de entrenamiento para coach y cliente, con IA, evidencia científica y automatización como base operativa.

---

## 1. Principio central

Training OS 2.0 no debe ser solo una app donde el coach carga entrenos y el cliente marca sets.

Debe ser un sistema de decisión asistida:

> La IA analiza cada cliente, cruza sus datos con papers, método del coach y contexto deportivo, y propone la siguiente mejor acción. El coach revisa decisiones, no reconstruye análisis desde cero.

El objetivo de negocio es claro: que Carlos pueda atender más clientes sin bajar calidad, reduciendo tareas repetitivas y aumentando precisión.

La segunda condición es igual de importante:

> Todo ese motor debe presentarse con una UI/UX clara, ordenada, intuitiva y premium. Si la IA recomienda bien pero el coach tiene que buscar entre pantallas confusas, el sistema falla.

El rediseño visual no es decoración. Es parte del producto: reduce carga mental, acelera decisiones y mejora adherencia del cliente.

---

## 2. Referencias de mercado

### Lo que hacen bien las apps top

| Producto | Lo útil para NutriCoach | Fuente |
|----------|-------------------------|--------|
| ABC Trainerize | Entrenamiento, nutrición, hábitos, mensajes, cumplimiento y app cliente todo en uno | https://www.trainerize.com/features/ |
| Everfit | Automatizaciones tipo autoflow, workout builder, tracking fields, auto progression | https://help.everfit.io/en/articles/3661707-autoflow-overview |
| TrueCoach | Programación simple, librería de vídeo, navegación fácil para cliente | https://apps.apple.com/app/id1439127794 |
| TrainingPeaks | Calendario, carga, umbrales, análisis de rendimiento, planificación hacia competición | https://www.trainingpeaks.com/coach-features/ |
| Hevy Coach | Registro de entrenos rápido, historial por ejercicio, PRs y experiencia móvil clara | https://hevycoach.com/features/ |

### Hueco estratégico detectado

Las apps actuales hacen tres cosas bien:

1. Guardar planes.
2. Registrar entrenos.
3. Mostrar métricas.

Pero fallan o se quedan cortas en:

1. Priorizar qué cliente necesita atención hoy.
2. Explicar qué cambio conviene hacer y por qué.
3. Conectar entrenamiento, nutrición, fatiga, check-ins y papers en una decisión única.
4. Reducir el análisis repetitivo del coach.

Training OS 2.0 debe ocupar ese hueco.

---

## 3. Usuarios y jobs principales

### Coach

El coach entra para responder:

1. Qué clientes necesitan atención hoy.
2. Qué sesión toca ajustar.
3. Qué cliente está acumulando fatiga.
4. Quién está progresando y puede subir carga.
5. Quién no está cumpliendo y necesita mensaje.
6. Qué recomienda la IA y qué evidencia lo respalda.

### Cliente

El cliente entra para responder:

1. Qué tengo que hacer hoy.
2. Por qué me toca esto.
3. Cómo ejecuto la sesión sin pensar demasiado.
4. Qué peso/reps hago según mi historial.
5. Cómo informo al coach de cómo me fue.
6. Qué cambia la próxima sesión si estoy fatigado, lesionado o progresando.

---

## 4. Modelo de producto

Training OS 2.0 se organiza en siete capas.

### 4.1 Command Center

Pantalla principal del coach.

No ordena clientes alfabéticamente. Ordena por prioridad operativa.

Prioridades:

1. Riesgo alto: fatiga alta, dolor, RPE alto sostenido, sueño bajo, caída de adherencia.
2. Acción pendiente: IA propone ajuste y necesita aprobación.
3. Cliente sin actividad: sesiones perdidas o varios días sin registrar.
4. Progreso positivo: PR, RPE bajo, margen para progresar.
5. Estables: sin acción urgente.

Cada cliente muestra:

- Nombre.
- Plan activo y semana.
- Estado de semana.
- Cumplimiento.
- TLS o carga semanal.
- RPE reciente.
- PRs.
- Última sesión.
- Próxima sesión.
- Badge de acción: `Revisar`, `Subir carga`, `Descarga`, `Mensaje`, `OK`.

### 4.2 AI Review Inbox

Bandeja de decisiones para el coach.

La IA genera tarjetas accionables:

- “Bajar volumen 20% en sesión de pierna.”
- “Mantener progresión: RPE medio 6.2 y cumplimiento 100%.”
- “Enviar mensaje: 2 sesiones perdidas esta semana.”
- “Mover sesión intensa por fatiga alta.”
- “Ajustar CHO peri-entreno por sesión de alta carga.”

Cada tarjeta tiene:

- Recomendación.
- Motivo.
- Datos usados.
- Evidencia aplicada.
- Riesgo si no se actúa.
- Botones: `Aprobar`, `Editar`, `Ignorar`, `Enviar mensaje`, `Ver cliente`.

Regla clave:

> La IA no cambia nada crítico sin aprobación del coach.

Cambios críticos:

- Modificar volumen/intensidad.
- Cambiar ejercicios por lesión.
- Regenerar una semana.
- Cambiar objetivo de fase.
- Enviar mensajes sensibles.

Cambios no críticos que pueden ser automáticos:

- Preparar borradores.
- Resumir sesión.
- Marcar alertas.
- Prellenar pesos sugeridos.
- Generar explicación para el cliente.

### 4.3 Cliente Training Room

Ficha profunda de entrenamiento por cliente.

Secciones:

1. **Resumen actual:** plan, semana, fase, objetivo, adherencia, fatiga.
2. **Siguiente sesión:** qué toca, objetivo, peso sugerido, riesgos.
3. **Historial:** sesiones, RPE, PRs, carga, notas.
4. **IA y evidencia:** recomendaciones activas, reglas aplicadas, papers usados.
5. **Nutrición conectada:** ajuste peri-entreno si la sesión lo requiere.
6. **Perfil atleta:** modalidad, métricas, lesiones, equipo, preferencias.

Esta pantalla sustituye la necesidad de mirar 5 sitios antes de decidir.

### 4.4 Plan Builder

Editor estructural del plan.

Jerarquía:

```text
Plan
  Bloque / mesociclo opcional
    Semana
      Sesión
        Bloque de sesión
          Ejercicio
            Sets
```

Bloques de sesión:

- Calentamiento.
- Fuerza.
- Técnica.
- Metcon / circuito.
- Zona 2.
- Intervalos.
- Core.
- Movilidad.
- Cooldown.

El coach puede crear desde:

- Plantilla.
- Plan anterior.
- Generación IA.
- Semana en blanco.

### 4.5 Next Session Engine

Motor que decide la recomendación de la siguiente sesión.

Input mínimo:

- Sesión programada.
- Historial de ese ejercicio.
- RPE último.
- Cumplimiento semanal.
- TLS/carga.
- Check-in.
- Dolor/lesiones.
- Sueño/HRV/body battery si existe.
- Objetivo y fase.
- Nutrición/adherencia.

Output:

- Mantener.
- Progresar carga.
- Progresar reps.
- Bajar volumen.
- Sustituir ejercicio.
- Cambiar orden.
- Convertir en sesión técnica.
- Recomendar descanso.
- Pedir revisión manual.

Cada output incluye:

- Explicación para coach.
- Versión simplificada para cliente.
- Nivel de confianza.
- Evidencia o regla usada.

### 4.6 Evidence Layer

Capa de conocimiento que alimenta la IA.

Fuentes:

- Papers ingeridos en `conocimiento`.
- Reglas del método del coach.
- Umbrales internos de carga.
- Perfil atleta.
- Datos históricos del cliente.
- Integraciones wearable.
- Datos de nutrición y check-ins.

Formato recomendado para cada regla/paper:

```text
Título
Ámbito: fuerza / hipertrofia / running / Hyrox / recuperación / nutrición
Población: principiante / intermedio / avanzado / lesionado / endurance
Regla práctica
Contraindicaciones
Cuándo aplicarla
Cuándo no aplicarla
Prioridad
Fuente
```

La IA no debe citar papers al cliente salvo que el coach lo active. Al coach sí debe mostrar evidencia resumida y accionable.

### 4.7 UX/UI System

Capa visual y de interacción transversal.

Objetivo:

- Que el coach trabaje por prioridad, no por navegación manual.
- Que el cliente sepa qué hacer sin interpretar dashboards.
- Que cada pantalla tenga una acción primaria clara.
- Que el diseño sea consistente entre coach y cliente, pero con densidad distinta.

Principios:

1. **Jerarquía antes que información:** primero decisión, luego contexto, luego detalle.
2. **Una pantalla, un trabajo:** cada vista debe resolver un job concreto.
3. **Coach denso, cliente simple:** el coach necesita escaneo rápido; el cliente necesita foco.
4. **Acciones visibles:** aprobar, editar, ignorar, registrar, ver sesión y enviar mensaje siempre deben estar donde se esperan.
5. **Estados completos:** loading, vacío, error, sin datos, sin plan, fatiga alta, sesión completada.
6. **Mobile-first en cliente:** touch targets grandes, flujo de sesión sin scroll largo, inputs fáciles.
7. **Desktop-first en coach:** layouts amplios, paneles laterales, tablas densas y filtros rápidos.
8. **Lenguaje visual sobrio:** sin estética genérica de app fitness ni exceso de colores. Una paleta neutra, acento único y semánticos claros.
9. **IA explicable:** toda recomendación debe mostrar “qué”, “por qué”, “con qué datos” y “qué hago ahora”.
10. **Menos clicks repetitivos:** cualquier acción frecuente debe poder completarse en uno o dos pasos.

Sistema visual:

- Base neutra, limpia y profesional.
- Acento principal para Training OS.
- Verde: progreso, PR y completado.
- Ámbar: revisar o precaución.
- Rojo: riesgo, fatiga o dolor.
- Azul/cyan suave: información y evidencia.
- Tipografía sans clara; números con estilo tabular o monospace donde haya métricas.
- Cards solo cuando agrupan decisiones; para datos densos usar líneas, tablas y separación por espacio.

Componentes nucleares:

- Priority row de cliente.
- Recommendation card.
- Evidence drawer.
- Session execution card.
- Weekly calendar strip.
- Fatigue/load badge.
- Coach action bar.
- Client primary CTA.
- Empty state accionable.
- Inline explanation panel.

---

## 5. Experiencia coach

### 5.1 Pantalla: Training Command Center

Objetivo: saber en 10 segundos dónde actuar.

Bloques:

- Barra superior: `Acciones pendientes`, `Fatiga alta`, `PRs`, `Sin registrar`.
- Lista priorizada de clientes.
- Filtros: `Todos`, `Revisar`, `Fatiga`, `Progreso`, `Sin actividad`.
- Acciones rápidas: mensaje, revisar sesión, aprobar ajuste.

No debe parecer una tabla administrativa. Debe parecer una bandeja de control diaria.

UX esperada:

- Escaneo en menos de 10 segundos.
- Filtros como chips, no formularios.
- Métricas compactas por fila.
- Acción principal por cliente visible sin abrir modal.
- Drawer lateral para ver detalle sin perder la lista.
- Orden por prioridad calculada, con opción de ordenar manualmente.

### 5.2 Pantalla: AI Review Inbox

Objetivo: aprobar trabajo preparado por IA.

Tipos de tarjeta:

- Ajuste de sesión.
- Cambio de ejercicio.
- Mensaje al cliente.
- Revisión de carga.
- Nutrición peri-entreno.
- Semana siguiente.

Ejemplo:

```text
Cliente: Marcos
Riesgo: fatiga acumulada
Recomendación: bajar volumen de pierna 25% y mantener intensidad técnica
Datos: TLS +34% vs media 4 sem, RPE 9 en dos sesiones, check-in energía 2/5
Evidencia: regla interna de descarga por fatiga + principio de gestión de carga
Acción: Aprobar / Editar / Ignorar
```

UX esperada:

- Cards agrupadas por urgencia.
- Botones fijos por tarjeta.
- Vista comparativa “antes/después” cuando la IA proponga cambiar una sesión.
- Explicación corta visible y evidencia expandible.
- Posibilidad de aprobar varias recomendaciones de bajo riesgo en lote.

### 5.3 Pantalla: Cliente Training Room

Objetivo: revisar un cliente sin perder contexto.

Layout:

- Columna izquierda: estado y alertas.
- Centro: semana actual + siguiente sesión.
- Derecha: IA, evidencia y acciones.

Acciones:

- Aprobar recomendación.
- Editar próxima sesión.
- Regenerar semana.
- Enviar mensaje.
- Ver historial.
- Añadir nota privada.

UX esperada:

- Layout de 3 zonas: estado, semana/sesión, IA/evidencia.
- No obligar al coach a cambiar de página para ver historial, perfil y recomendación.
- Timeline de eventos del cliente: sesión, check-in, PR, alerta, ajuste aprobado.
- Sticky action bar con acciones de coach.

### 5.4 Pantalla: Plan Builder

Objetivo: crear y ajustar planes rápido.

Debe tener:

- Vista calendario/semana.
- Vista bloques de sesión.
- Biblioteca de ejercicios.
- Plantillas.
- Campo “intención del coach”.
- Botón `Generar explicación IA`.
- Preview cliente.

El coach no debe escribir textos largos. Escribe intención breve; la IA redacta contexto.

UX esperada:

- Builder por bloques, no lista plana.
- Drag/drop donde aporte valor; menús rápidos donde sea más fiable.
- Preview cliente siempre disponible.
- Diferencias entre plantilla base y adaptación del cliente visibles.
- Guardado claro y estado de cambios sin ambigüedad.

---

## 6. Experiencia cliente

### 6.1 Pantalla: Hoy

Objetivo: una decisión clara.

Estados:

1. **Entrenar hoy:** sesión destacada, objetivo, duración, botón empezar.
2. **Descanso:** explicación, recomendación de movilidad/pasos/sueño.
3. **Revisión:** coach ajustó sesión, mostrar cambio simple.
4. **Sin plan:** mensaje claro.

Contenido:

- Qué toca.
- Por qué toca.
- Qué mirar.
- Botón principal.

UX esperada:

- Una card principal.
- Un CTA dominante.
- Texto corto y humano.
- Nada de métricas complejas salvo que expliquen una decisión.
- Si toca descanso, que también parezca una acción válida, no una pantalla vacía.

### 6.2 Pantalla: Semana

Objetivo: entender la estructura sin saturación.

Debe mostrar:

- Semana y fase.
- Sesiones.
- Días de descanso.
- Estado de completado.
- Carga estimada.
- Cambios hechos por el coach/IA.

Click en sesión:

- `Registrar` si es hoy o está pendiente.
- `Solo ver` para futuras.

UX esperada:

- Banda semanal clara.
- Hoy resaltado.
- Sesiones completadas con feedback positivo sobrio.
- Futuras en modo consulta.
- Cambios recientes señalados con etiqueta “Ajustado por coach”.

### 6.3 Pantalla: Sesión

Objetivo: ejecutar sin pensar.

Flujo:

1. Contexto de sesión.
2. Ejercicio actual.
3. Demo si existe.
4. Sets.
5. Peso sugerido.
6. Timer descanso.
7. Siguiente ejercicio.
8. Cierre con RPE y nota.

Reglas UX:

- Un ejercicio a la vez.
- Inputs grandes.
- Cero texto innecesario.
- Registrar set en máximo 3 toques.
- Modo `Solo ver` siempre disponible.

UX esperada:

- Pantalla tipo companion, no tabla.
- Set activo evidente.
- Peso anterior y peso sugerido visibles sin abrir historial.
- Descanso automático.
- Demo de ejercicio accesible pero no invasiva.
- Final de sesión con sensación de cierre: resumen, RPE, nota y PRs.

### 6.4 Pantalla: Progreso

Objetivo: motivar sin convertirlo en dashboard técnico.

Mostrar:

- Sesiones completadas.
- Racha.
- PRs.
- Carga semanal simple.
- Evolución de ejercicios clave.
- Mensajes del coach.

No mostrar:

- Gráficas técnicas excesivas.
- Métricas sin explicación.

UX esperada:

- Progreso entendible en 30 segundos.
- Comparativas contra uno mismo, no contra otros.
- Mensajes de refuerzo del coach.
- PRs y consistencia por encima de vanity metrics.

---

## 7. Datos necesarios

### Ya existentes o parcialmente existentes

- `planes_entrenamiento`
- `sesiones_entrenamiento`
- `sesion_ejercicios`
- `registros_sets`
- `perfil_entreno_cliente`
- `prs_por_ejercicio`
- TLS / `get_tls_dashboard`
- Check-ins
- Integraciones Garmin/Terra/Strava
- Papers y conocimiento
- Recetario / plan nutricional

### Nuevas tablas o extensiones propuestas

#### `training_recommendations`

Guarda recomendaciones IA.

Campos:

- `id`
- `cliente_id`
- `plan_id`
- `sesion_id`
- `tipo`
- `prioridad`
- `estado`: `pendiente`, `aprobada`, `editada`, `ignorada`, `aplicada`
- `titulo`
- `recomendacion`
- `motivo`
- `datos_usados JSONB`
- `evidencia_usada JSONB`
- `accion_propuesta JSONB`
- `created_at`
- `resolved_at`

#### `training_decision_logs`

Auditoría de decisiones.

Campos:

- `id`
- `recommendation_id`
- `coach_id`
- `accion`
- `antes JSONB`
- `despues JSONB`
- `nota_coach`
- `created_at`

#### `training_knowledge_rules`

Reglas prácticas extraídas de papers o método coach.

Campos:

- `id`
- `titulo`
- `modalidad`
- `objetivo`
- `nivel`
- `regla`
- `contraindicaciones`
- `fuente`
- `prioridad`
- `activo`

---

## 8. Motor IA

### 8.1 Agente diario

Se ejecuta cada mañana o al entrar el coach.

Hace:

1. Lee clientes activos.
2. Calcula estado de cada cliente.
3. Detecta riesgos.
4. Detecta oportunidades de progreso.
5. Genera recomendaciones pendientes.
6. Ordena Command Center.

### 8.2 Agente post-sesión

Se ejecuta al terminar una sesión.

Hace:

1. Resume sesión.
2. Detecta PRs.
3. Compara RPE esperado vs real.
4. Evalúa si la siguiente sesión necesita ajuste.
5. Genera feedback para coach.
6. Prepara mensaje opcional para cliente.

### 8.3 Agente semanal

Se ejecuta antes de empezar nueva semana.

Hace:

1. Revisa cumplimiento.
2. Revisa carga.
3. Revisa check-ins.
4. Revisa nutrición.
5. Propone siguiente microciclo.
6. Genera lista de aprobaciones.

### 8.4 Agente de evidencia

No decide solo. Recupera conocimiento aplicable.

Hace:

1. Busca reglas/papers relevantes.
2. Resume aplicación práctica.
3. Marca confianza.
4. Advierte limitaciones.

---

## 9. Guardrails

### Seguridad profesional

La IA no debe:

- Diagnosticar lesiones.
- Dar consejo médico.
- Ignorar dolor reportado.
- Subir carga si hay señales claras de riesgo.
- Cambiar planes críticos sin aprobación.
- Enviar mensajes sensibles sin revisión.

La IA debe:

- Recomendar derivar a profesional sanitario si hay dolor persistente o señales preocupantes.
- Mostrar incertidumbre cuando falten datos.
- Priorizar adherencia y seguridad frente a agresividad.

### Escalado de decisión

| Nivel | Acción | Aprobación coach |
|-------|--------|------------------|
| Bajo | Resumir, ordenar, prellenar | No |
| Medio | Sugerir pesos, preparar mensaje, explicar sesión | Opcional |
| Alto | Cambiar volumen, intensidad, ejercicio o semana | Sí |
| Crítico | Dolor, lesión, mareo, señales clínicas | Sí + aviso de prudencia |

---

## 10. Fases de implementación

### Fase 1 — Command Center real

Objetivo: que el coach vea prioridades.

Incluye:

- Ranking de clientes por acción.
- Badges reales.
- Fatiga/carga.
- Cumplimiento.
- Próxima sesión.
- Acciones rápidas.

### Fase 2 — Training Recommendations

Objetivo: crear la bandeja IA.

Incluye:

- Tabla `training_recommendations`.
- API de recomendaciones.
- UI inbox.
- Estados aprobar/editar/ignorar.

### Fase 3 — Next Session Engine

Objetivo: recomendar qué toca después.

Incluye:

- Motor de decisión.
- Pesos/reps sugeridos.
- Ajuste por RPE/carga.
- Explicación para coach y cliente.

### Fase 4 — Evidence Layer

Objetivo: que la IA use papers y método coach de forma trazable.

Incluye:

- Reglas estructuradas.
- Recuperación de conocimiento.
- Evidencia en recomendaciones.
- Vista “por qué”.

### Fase 5 — Cliente Hoy + Semana + Sesión refinadas

Objetivo: experiencia cliente simple.

Incluye:

- Pantalla Hoy.
- Semana clara.
- Sesión un ejercicio a la vez.
- Feedback post-sesión.

### Fase 6 — UI/UX Coach + Cliente completa

Objetivo: convertir la arquitectura funcional en una experiencia premium, intuitiva y consistente.

Incluye:

- Rediseño visual final del Command Center.
- Rediseño visual final del Cliente Training Room.
- Sistema de componentes Training OS.
- Estados loading/empty/error.
- Responsive desktop coach.
- Responsive mobile cliente.
- QA visual de las rutas críticas.

### Fase 7 — Automatización semanal

Objetivo: ahorrar trabajo repetitivo.

Incluye:

- Agente diario.
- Agente post-sesión.
- Agente semanal.
- Borradores de mensaje.
- Regeneración de semana con aprobación.

---

## 11. Criterios de éxito

### Para coach

1. En menos de 10 segundos sabe qué clientes necesitan atención.
2. El 80% de revisiones rutinarias llegan preanalizadas.
3. Ajustar una sesión recomendada requiere menos de 3 acciones.
4. Los mensajes repetitivos salen como borrador.
5. Las decisiones importantes quedan auditadas.
6. Las pantallas principales se entienden sin documentación.
7. El coach puede revisar, aprobar o ignorar recomendaciones sin abrir más de una vista secundaria.

### Para cliente

1. Entra y sabe qué hacer hoy.
2. Registrar una serie requiere máximo 3 toques.
3. Entiende por qué hace la sesión.
4. Puede reportar cómo fue sin formulario largo.
5. Ve progreso sin saturarse.
6. La sesión móvil puede completarse con una mano.
7. La app no exige interpretar métricas técnicas para saber qué toca.

### Para negocio

1. Más clientes por coach sin bajar calidad.
2. Menos tiempo semanal por cliente.
3. Mejor adherencia por feedback más rápido.
4. Mejor diferenciación frente a apps genéricas.
5. Experiencia visual suficientemente premium para vender coaching de mayor valor.

---

## 12. Fuera de alcance de esta spec

No entra todavía:

- Marketplace de planes.
- Comunidad/grupos.
- Pagos.
- Chat completo tipo WhatsApp.
- App nativa.
- Automatización sin revisión humana para cambios de entrenamiento importantes.

---

## 13. Decisión recomendada

Construir Training OS 2.0 en este orden:

1. Command Center.
2. Training Recommendations.
3. Next Session Engine.
4. Evidence Layer.
5. Cliente Hoy/Semana/Sesión refinado.
6. UI/UX Coach + Cliente completa.
7. Automatización semanal.

Esto evita rehacer estética antes de tener el sistema de decisiones. Primero se define qué debe hacer el coach cada día; después se pulen las pantallas.

La UI/UX se implementa en paralelo a cada fase, no como “capa final”. Cada entrega debe salir usable, ordenada y visualmente consistente desde el primer bloque.
