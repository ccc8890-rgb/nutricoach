# Rediseño Página de Clientes — Design Spec
**Fecha:** 2026-05-28  
**Estado:** Pendiente implementación

---

## 1. Contexto y objetivo

La página `/clientes` es el centro de operaciones diario del coach. Actualmente usa un layout de cards en grid 2 columnas que consume mucho espacio vertical y dificulta trabajar con más de 10 clientes. El coach accede frecuentemente desde iPhone.

**Objetivos:**
- Máxima densidad de información por píxel
- Gestión de membresías (tipo + fechas) vinculable a Stripe en el futuro
- Filtros que convierten la lista en cola de trabajo priorizada
- Features diferenciales que no tiene ningún software de coaching actual
- Navegación clara en iPhone con back button al dashboard

---

## 2. Layout general

### Desktop (Mac / iPad ≥ 768px)
Tabla densa con cabecera fija y filas de ~44px. Todas las columnas visibles. Sin scroll horizontal.

### Mobile (iPhone < 768px)
Lista vertical. Cada cliente ocupa una tarjeta de 2 líneas + fila de mini-stats. Los filtros van en scroll horizontal arriba. Back button visible en la esquina superior izquierda.

---

## 3. Estructura visual

### 3.1 Header (ambas plataformas)

**Mobile:** Barra superior con `← Dashboard` (izquierda), título "Clientes" (centro), botón `+` (derecha).

**Desktop:** Mantiene el header actual simplificado — título "Clientes" + botones "Invitar" y "Nuevo" a la derecha.

### 3.2 Toolbar de búsqueda y filtros

Una sola fila con este orden (izquierda → derecha):

```
[🔍 Buscar cliente… ~185px] | [Atención 3] [Todos 12] [Riesgo] [Sin check-in] [Nuevos] | [⏰ Caduca 2] [📅 Alta ▾] [📅 Revisiones ▾] [💬 Chats 4]  ···  [↕ Check-in ▾]
```

- Búsqueda: input fijo de 185px, padding-left 28px para la lupa (no se solapa el texto)
- Separador visual (`|`) entre grupos de chips
- Chips de estado: Atención · Todos · Riesgo · Sin check-in · Nuevos · Activos
- Chips de membresía: "⏰ Caduca pronto" (≤30d, con contador rojo) · "📅 Alta ▾" (dropdown: Este mes / Últimos 3 meses / Rango libre)
- Chips nuevos: "📅 Revisiones ▾" (próximas revisiones en 7/14 días) · "💬 Chats sin leer" (contador)
- Sort: al extremo derecho, dropdown con opciones (Check-in, Nombre, Membresía caduca, Score adherencia)

**Mobile:** search + sort en una fila, chips debajo en `overflow-x: auto`, `scrollbar-width: none`.

### 3.3 Tabla — columnas (desktop)

| Columna | Ancho | Contenido |
|---------|-------|-----------|
| Avatar | 30px | Inicial del nombre, color generado del ID |
| Cliente | flex 1 | Nombre en negrita + email en gris debajo |
| Membresía | 110px | Pill tipo (Trimestral/Semestral/Anual) + "caduca en Xd" + barra progreso (roja si <30d) |
| Check-in | 56px | Días sin check-in, coloreado (verde <4d, naranja 4-10d, rojo >10d) |
| Objetivo | 90px | Tag gris compacto |
| Planes | 48px | Dos puntos: punto 1 = dieta activa, punto 2 = entreno activo (verde = activo, gris = sin plan) |
| Adherencia | 56px | Score 0–100, coloreado (verde ≥70, naranja 40–69, rojo <40) |
| Estado | 82px | Pill de estado (Riesgo / Sin check-in / IA pendiente / Activo / Revisar plan) |
| Arrow | 14px | `›` gris |

Cabecera de tabla: clicable para ordenar por esa columna. Columna activa con indicador `↑` / `↓`.

### 3.4 Lista mobile — cada fila

```
[Avatar 32px]  [Nombre · badge estado      ]  [›]
               [pill membresía · "caduca Xd"]
               [Xd check-in]  [N IA]  [●● planes]
```

---

## 4. Base de datos — campos nuevos

Tabla `clientes`, nuevas columnas:

```sql
tipo_membresia     TEXT CHECK (tipo_membresia IN ('trimestral','semestral','anual'))
fecha_inicio_membresia  DATE
fecha_fin_membresia     DATE
```

**Nota Stripe:** Cuando se implemente la integración de pagos, estos campos se poblarán automáticamente desde webhooks de Stripe (`customer.subscription.created` / `updated`). El campo manual que el coach edita hoy es el mismo campo — no habrá migración.

**Edición:** El coach puede editar `tipo_membresia`, `fecha_inicio` y `fecha_fin` desde la ficha del cliente (`/clientes/[id]`), no desde la lista.

---

## 5. Features diferenciales

### 5.1 Score de adherencia (0–100)

Calculado en el frontend al cargar los datos del cliente. No requiere columna nueva en BD (se calcula en runtime desde datos existentes).

**Fórmula:**
```
score = (check_in_score × 0.40) + (comidas_score × 0.30) + (entreno_score × 0.20) + (peso_score × 0.10)
```

- `check_in_score`: 100 si <4 días, decrece linealmente hasta 0 a los 14 días
- `comidas_score`: % de comidas registradas esta semana (de `registro_comidas_dia`)
- `entreno_score`: % de sesiones completadas esta semana (de `registros_entreno`)
- `peso_score`: 100 si hay registro de peso en los últimos 7 días, 0 si no

Mostrado como número coloreado en la columna Adherencia. Sortable.

### 5.2 Predictor de baja

Badge rojo `⚠ Riesgo baja` visible en la fila cuando se cumplen ≥2 de estas condiciones:
- Score adherencia < 40
- Membresía caduca en ≤30 días
- Sin respuesta a mensajes del coach en >5 días (último mensaje de `chat_mensajes` del coach sin respuesta)
- Días sin check-in > 10

No requiere BD. Calculado en frontend al cargar el listado.

### 5.3 Deuda de atención

Columna opcional activable desde el dropdown de ordenación ("Ordenar por deuda de atención"). Muestra un ratio:

```
deuda = urgencia_score / max(interacciones_coach_7d, 1)
```

- `urgencia_score`: suma ponderada de señales (días sin check-in × 2 + tareas IA pendientes × 3 + mensajes sin leer × 2)
- `interacciones_coach_7d`: conteo de `chat_mensajes` WHERE `enviado_por = 'coach'` AND `created_at > now() - 7 days` AND `cliente_id = X`

Rojo si deuda > 3 (cliente urgente sin atención reciente). Verde si < 1.

---

## 6. Filtros completos — implementación

| Filtro | Lógica |
|--------|--------|
| Atención | `revisado_por_coach=false` OR `tareas_ia_pendientes>0` OR `dias_sin_checkin>4` |
| Todos | sin filtro |
| Riesgo | `dias_sin_checkin>10` |
| Sin check-in | `dias_sin_checkin>4` |
| Nuevos | `revisado_por_coach=false` |
| Activos | `activo=true` |
| ⏰ Caduca pronto | `fecha_fin_membresia` entre hoy y hoy+30d |
| 📅 Alta ▾ | `fecha_inicio_membresia` en el rango seleccionado |
| 📅 Revisiones ▾ | `fecha_proxima_revision` en los próximos 7 o 14 días |
| 💬 Chats sin leer | clientes con mensajes en `chat_mensajes` no leídos por el coach |

Los filtros de estado y los de membresía/fecha son acumulativos (AND lógico). Solo puede haber un filtro de estado activo a la vez; los filtros de fecha son independientes y se suman al filtro de estado activo. El chip activo se muestra en índigo, inactivo en gris.

---

## 7. Navegación

### iPhone — back button
- Posición: top-left, altura 44px mínima (touch target)
- Contenido: `← Dashboard`
- Implementación: `Link href="/dashboard"` con icono `ArrowLeft` de Phosphor
- Sticky: sí, se queda fijo al hacer scroll

### Desktop — breadcrumb
- Encima del título: `Dashboard / Clientes`
- Solo texto, sin botón prominente (la sidebar ya está visible)

---

## 8. Cambios respecto a la página actual

| Elemento | Antes | Después |
|----------|-------|---------|
| Layout lista | Grid 2 cols de cards | Tabla densa 1 col |
| Búsqueda | Input ancho completo | Input fijo 185px |
| Filtros | Chips en fila debajo | Misma fila que búsqueda |
| Membresía | No existe | Columna con tipo + barra + días |
| Score adherencia | No existe | Columna numérica 0–100 |
| Predictor baja | No existe | Badge en fila |
| Deuda atención | No existe | Sortable en columna |
| Filtros membresía | No existen | Caduca pronto + Alta por fecha |
| Filtro revisiones | No existe | Próximas 7/14 días |
| Filtro chats | No existe | Sin leer con contador |
| Back button mobile | No existe | `← Dashboard` sticky |
| Stats tiles top | 4 tiles grandes | Eliminados (datos en toolbar chips) |

---

## 10. Agente de retención (fase 2 prioritaria)

Un agente IA dedicado exclusivamente a reducir abandono y mejorar el ratio de renovaciones. Se suma al sistema multiagente existente (`lib/agentes/`).

**Nombre:** `agente-retencion.ts`

**Cuándo se activa:** diariamente, igual que los agentes existentes.

**Señales que monitoriza por cliente:**
- Score adherencia < 40 durante ≥3 días consecutivos
- Membresía que caduca en ≤30, ≤14, ≤7 días sin renovación confirmada
- Sin respuesta del cliente a mensajes del coach en >5 días
- Predictor de baja activo (ver §5.2)
- Primera semana de membresía sin check-in (crítico para retención temprana)

**Acciones que propone al coach (kanban de agentes existente):**
- Mensaje personalizado de re-enganche (redactado por DeepSeek con contexto del cliente)
- Propuesta de ajuste de plan si hay plateau o desmotivación detectada
- Recordatorio de renovación con oferta personalizable (ej: descuento semana extra)
- Alerta de "cliente en riesgo" con resumen de señales para que el coach llame

**Output:** tareas en `agente_tareas` con `tipo='retencion'`, visibles en el kanban `/agentes` con sección propia "Retención".

**Métricas futuras:** tasa de retención mensual, revenue recuperado por intervención del agente.

---

## 11. Archivos afectados — actualizado

| Archivo | Cambio |
|---------|--------|
| `app/clientes/page.tsx` | Reescritura completa |
| `supabase/migrations/YYYYMMDD_membresia_clientes.sql` | 3 nuevas columnas en `clientes` |
| `lib/utils.ts` | `calcularScoreAdherencia()`, `calcularDeudaAtencion()`, `esPredictorBaja()` |
| `app/clientes/[id]/page.tsx` | Editor campos membresía en ficha |
| `lib/agentes/agente-retencion.ts` | Nuevo agente retención |
| `app/api/agentes/ejecutar/route.ts` | Registrar agente-retencion en el director |

---

## 12. Fuera de alcance (fase 3)

- Integración Stripe para auto-poblar membresías
- Acciones en lote (enviar mensaje a grupo, renovar membresías)
- Etiquetas personalizadas del coach
- Vista kanban por estado
- Exportar lista a CSV

