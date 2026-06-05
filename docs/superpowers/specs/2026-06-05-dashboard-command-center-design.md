# Dashboard Command Center - Diseño

Fecha: 05-06-2026
Proyecto: Casanova Nutrition / NutriCoach
Estado: aprobado en enfoque, pendiente de plan de implementación

## 1. Objetivo

Rediseñar `/dashboard` como una pantalla de mando diaria para Carlos como coach.

El dashboard no debe parecer una app genérica con gráficos decorativos. Debe responder rápido a cuatro preguntas:

1. A qué cliente tengo que atender hoy.
2. Por qué tengo que atenderlo.
3. Qué acción concreta debo hacer.
4. Qué impacto tiene en retención, negocio o progreso del cliente.

Además, `/dashboard` debe tener una pestaña extendida `Negocio` para separar la gestión económica del trabajo diario de coaching. La vista principal responde "qué hago hoy"; `Negocio` responde "cómo está entrando y reteniéndose el dinero".

## 2. Benchmark usado

Referencias revisadas:

- Everfit: dashboard de check-ins con señales semanales de training, nutrición y hábitos. Fuente: https://help.everfit.io/en/articles/14495409-introducing-coach-check-in-dashboard-beta-testing
- Trainerize: insights de progreso, compliance, hábitos, mensajería y riesgo de abandono. Fuente: https://www.trainerize.com/features/
- Nutrium: seguimiento de plan, peso, agua, diario alimentario, actividad, recetas, lista de compra y dudas. Fuente: https://help.nutrium.com/en/articles/3372169-what-are-the-features-of-the-nutrium-mobile-app-for-nutrition-clients
- Healthie: dashboard profesional con tareas, engagement y billing. Fuente: https://help.gethealthie.com/article/535-your-provider-dashboard
- TrueCoach: alertas cuando baja el cumplimiento del cliente. Fuente: https://truecoach.co/features/
- NutriAdmin: CRM, cuestionarios, pagos, portal, informes y análisis nutricional. Fuente: https://nutriadmin.com/features

Conclusión: las mejores herramientas no ganan por tener más gráficos. Ganan porque reducen el tiempo entre señal y acción.

## 3. Principios de diseño

- Accionable antes que visual: cada bloque debe llevar a una decisión o ruta concreta.
- Datos reales antes que métricas vanidosas: usar solo datos existentes o baratos de calcular.
- Coach primero: el dashboard es una mesa de trabajo, no un informe de marketing.
- Prioridad por riesgo: lo urgente sube arriba aunque no sea lo más bonito.
- Móvil válido: Carlos accede mucho desde iOS; la primera pantalla debe funcionar en vertical.
- Cero ruido: quitar sparklines, donuts y barras si no cambian una decisión.

## 4. Datos disponibles

Ya existen fuentes suficientes para una primera versión sin migraciones grandes:

- `clientes`: activo, onboarding, fecha de próxima revisión, membresía, fecha fin.
- `profiles`: nombre, apellidos, email.
- `planes_nutricion`: plan activo, kcal, macros, cliente.
- `planes_entrenamiento`: plan activo de entrenamiento.
- `checkins`: peso, adherencia, energía, sueño, notas, fecha.
- `respuestas_clientes`: estado y fecha.
- `agente_tareas`: tareas IA pendientes, prioridad, tipo, agente, cliente.
- `competiciones`: fecha, disciplina, cliente, estado activo.
- `registros_sets`: entrenamientos registrados.
- `seguimiento_peso`: progreso de peso.
- `/api/dashboard/costes-clientes`: coste semanal, ingredientes sin precio, cobertura.
- Stripe reciente: endpoints de checkout, payment link y webhook ya existen; se puede usar estado de cliente si está persistido.

## 5. Nueva estructura del dashboard

La estructura base tendrá dos pestañas:

- `Command Center`: vista diaria operativa. Es la pestaña por defecto.
- `Negocio`: vista extendida de pagos, transacciones, renovaciones y salud comercial.

No deben mezclarse. Un pago fallido o una membresía a punto de caducar puede aparecer como acción urgente en `Command Center`, pero el análisis financiero completo vive en `Negocio`.

### 5.1 Cabecera compacta

Contenido:

- Fecha.
- Estado operativo del día: `X acciones pendientes`.
- CTA principal: `Nuevo cliente`.
- CTA secundaria contextual: `Generar link de pago` si hay cliente seleccionado o acceso rápido a `/clientes`.

No debe ocupar altura excesiva.

### 5.2 Banda "Hoy requiere atención"

Primer bloque visible.

Muestra una lista priorizada, no tarjetas sueltas:

1. Check-ins sin responder.
2. Tareas IA pendientes de aprobar.
3. Respuestas nuevas o dietas rechazadas.
4. Clientes sin plan activo.
5. Clientes sin onboarding.
6. Competiciones en tapering o esta semana.

Cada fila debe tener:

- Cliente.
- Motivo.
- Antiguedad o fecha.
- Severidad.
- Acción directa.

Ejemplos de acciones:

- `Responder check-in`.
- `Revisar tarea IA`.
- `Crear plan`.
- `Enviar mensaje`.
- `Ver competición`.

### 5.3 Panel "Clientes en riesgo"

Lista corta de clientes ordenados por deuda de atención.

Señales:

- Más de 10 días sin check-in.
- Membresía caduca en 30 días o menos.
- Cliente nuevo sin check-in tras 7 días.
- Baja adherencia si hay check-ins.
- Baja energía/sueño si hay check-ins.
- Sin entrenamiento registrado si tiene plan de entreno.

Cada cliente debe mostrar:

- Nombre.
- 2-3 señales máximo.
- Riesgo estimado: bajo, medio, alto.
- Acción recomendada.

La lógica inicial puede ser heurística en frontend o en una API agregada. No necesita IA para funcionar.

### 5.4 Panel "Inbox IA"

Sustituye el AutoCoach actual como bloque mejor integrado.

Contenido:

- Tareas IA pendientes desde `agente_tareas`.
- Agrupación por tipo: nutrición, entrenamiento, retención, mensaje, actualización de plan.
- Prioridad real.
- Botón a `/entrenos/brain-ia` o flujo de aprobación existente.

Regla: si una tarea IA no se puede aprobar/aplicar desde el dashboard, al menos debe llevar a la pantalla exacta donde se revisa.

### 5.5 Panel "Operación semanal"

Resumen de salud del negocio y ejecución:

- Clientes activos.
- Clientes con plan nutricional activo.
- Clientes con plan entrenamiento activo.
- Check-ins pendientes.
- Revisiones próximas en 7/30 días.
- Membresías que caducan en 30 días.

Formato: tabla/resumen denso con números y estado, no 4 cards grandes.

### 5.6 Panel "Coste y fricción alimentaria"

Usa `/api/dashboard/costes-clientes`.

Contenido:

- Coste semanal medio por cliente.
- Top 5 planes más caros.
- Clientes con ingredientes sin precio.
- CTA a `/precios/escandallo`.

Valor real: permite detectar planes poco sostenibles o incompletos para el cliente.

### 5.7 Panel "Calendario deportivo"

Contenido:

- Competiciones próximas.
- Días restantes.
- Disciplina.
- Cliente.
- Estado: normal, tapering, race week, hoy.

No usar gráfico. Usar timeline compacto.

### 5.8 Bloques a retirar o degradar

Retirar de la primera pantalla:

- `MiniSparkline` de stats estáticos.
- Bar chart de nuevos clientes por mes.
- Donut de distribución de respuestas.
- Cards genéricas de "Clientes", "Dietas activas", etc. si no tienen acción asociada.

Si se conservan, deben ir al final como "histórico" y no condicionar la pantalla diaria.

### 5.9 Pestaña extendida "Negocio"

Objetivo: dar una vista clara de caja, pagos, renovaciones y fricción comercial sin convertir el dashboard principal en un CRM financiero.

Contenido prioritario:

1. Ingresos recientes:
   - transacciones pagadas;
   - fecha;
   - cliente;
   - importe;
   - plan o concepto;
   - origen: checkout, payment link o registro manual si existe.

2. Pagos pendientes o problemáticos:
   - payment links generados sin completar;
   - pagos fallidos si Stripe lo persiste;
   - clientes activos sin membresía configurada;
   - clientes con membresía caducada.

3. Renovaciones:
   - membresías que caducan en 7, 14 y 30 días;
   - importe potencial si hay precio del plan;
   - acción: `Generar link`, `Contactar`, `Renovar`.

4. MRR/ingreso esperado:
   - clientes activos por tipo de membresía;
   - ingreso mensual equivalente estimado;
   - ingreso trimestral/semestral/anual comprometido si hay datos.

5. Embudo básico:
   - clientes nuevos pendientes de pago;
   - links enviados;
   - pagos completados;
   - clientes activados.

Regla: esta pestaña sí puede usar tablas densas. No necesita gráficos salvo que un histórico mensual ayude a tomar una decisión.

## 6. Arquitectura propuesta

### 6.1 API agregada

Crear o ampliar una API:

`GET /api/dashboard/command-center`

Respuesta sugerida:

```ts
type DashboardCommandCenter = {
  hoy: AccionDashboard[]
  clientes_riesgo: ClienteRiesgoDashboard[]
  inbox_ia: TareaDashboard[]
  operacion: {
    clientes_activos: number
    planes_nutricion_activos: number
    planes_entreno_activos: number
    checkins_pendientes: number
    revisiones_7d: number
    revisiones_30d: number
    membresias_30d: number
  }
  costes: {
    coste_semanal_medio: number
    clientes_sin_precio: number
    top_caros: CosteCliente[]
  }
  competiciones: CompeticionDashboard[]
  timestamp: string
}
```

Motivo: el dashboard actual hace muchas llamadas desde el cliente y mezcla cálculos de UI con cálculos de negocio. Una API agregada reduce complejidad visual y deja la pantalla más estable.

### 6.2 API de negocio

Crear una API separada para no contaminar la respuesta operativa:

`GET /api/dashboard/negocio`

Respuesta sugerida:

```ts
type DashboardNegocio = {
  resumen: {
    ingresos_30d: number
    ingresos_mes_actual: number
    transacciones_30d: number
    clientes_membresia_activa: number
    membresias_7d: number
    membresias_30d: number
    clientes_sin_membresia: number
  }
  transacciones_recientes: TransaccionDashboard[]
  pagos_pendientes: PagoPendienteDashboard[]
  renovaciones: RenovacionDashboard[]
  embudo: {
    nuevos_sin_pago: number
    links_generados: number
    pagos_completados: number
    clientes_activados: number
  }
  timestamp: string
}
```

Fuente de datos inicial:

- `clientes.tipo_membresia`.
- `clientes.fecha_inicio_membresia`.
- `clientes.fecha_fin_membresia`.
- campos Stripe persistidos en `clientes` si existen.
- eventos/estado creado por `app/api/stripe/webhook/route.ts` si hay tabla o columnas fiables.

Si no hay tabla de transacciones propia, la primera implementación debe mostrar renovaciones, membresías y clientes sin membresía; las transacciones detalladas quedan preparadas para cuando el webhook persista esos eventos.

### 6.3 Componentes

Componentes nuevos o refactorizados:

- `DashboardCommandCenter.tsx`: layout principal.
- `DashboardTabs.tsx`: cambio entre `Command Center` y `Negocio`.
- `TodayActionQueue.tsx`: cola priorizada.
- `ClientRiskList.tsx`: clientes en riesgo.
- `AiInboxSummary.tsx`: tareas IA.
- `WeeklyOpsStrip.tsx`: operación semanal.
- `FoodCostFriction.tsx`: coste y precios incompletos.
- `SportsCalendarStrip.tsx`: competiciones.
- `BusinessDashboard.tsx`: pestaña negocio.
- `RecentTransactionsTable.tsx`: transacciones recientes.
- `RenewalsTable.tsx`: renovaciones próximas.
- `PaymentIssuesList.tsx`: pagos pendientes o problemas.
- `DashboardEmptyState.tsx`: estado inicial si no hay clientes.

Componentes existentes reutilizables:

- `CheckinsPendientes`: puede ser sustituido por `TodayActionQueue`.
- `AutoCoachPanel`: puede quedar como fuente conceptual, pero integrado como `AiInboxSummary`.
- `CostesClientes`: reutilizar lógica, no necesariamente UI.

## 7. Diseño visual

Estilo: software profesional denso, sobrio, táctico.

Reglas:

- Fondo y tokens actuales de `globals.css`.
- Tipografía existente: Geist / Plus Jakarta, números tabulares.
- Nada de hero, nada de tarjetas enormes.
- Usar líneas, divisores y agrupaciones densas más que cards repetidas.
- Color solo para severidad: crítico, aviso, activo, info.
- Botones pequeños con icono Phosphor cuando haya acción clara.
- En móvil: una sola columna con la cola de acciones arriba.

Layout desktop:

```text
Tabs: Command Center | Negocio

Header compacto
┌──────────────────────── Hoy requiere atención ────────────────────────┐
│ lista priorizada de acciones                                            │
└────────────────────────────────────────────────────────────────────────┘

┌──────── Clientes en riesgo ────────┐ ┌──────── Inbox IA ───────────────┐
│ lista corta                         │ │ tareas pendientes               │
└─────────────────────────────────────┘ └────────────────────────────────┘

┌──────── Operación semanal ─────────────────────────────────────────────┐
│ métricas densas + revisiones + membresías                              │
└────────────────────────────────────────────────────────────────────────┘

┌──────── Coste/fricción ────────────┐ ┌──────── Calendario deportivo ────┐
│ coste semanal, precios faltantes    │ │ competiciones                    │
└─────────────────────────────────────┘ └────────────────────────────────┘
```

Layout `Negocio`:

```text
Tabs: Command Center | Negocio

┌──────── Resumen económico ─────────────────────────────────────────────┐
│ ingresos 30d | mes actual | renovaciones 7d/30d | sin membresía        │
└────────────────────────────────────────────────────────────────────────┘

┌──────── Renovaciones ──────────────┐ ┌──────── Pagos pendientes ────────┐
│ tabla por fecha e importe potencial │ │ links/fallos/clientes sin setup  │
└─────────────────────────────────────┘ └────────────────────────────────┘

┌──────── Transacciones recientes ───────────────────────────────────────┐
│ cliente | importe | fecha | estado | origen                             │
└────────────────────────────────────────────────────────────────────────┘
```

## 8. Estados

Loading:

- Skeletons con forma de lista, no spinner.

Empty:

- Si no hay clientes: CTA a crear cliente.
- Si hay clientes pero no señales: estado "Sin acciones pendientes" + enlaces a clientes/recetas/precios.

Error:

- Mensaje inline: "No se pudo cargar el command center".
- Botón `Reintentar`.

## 9. Scope de primera implementación

Incluido:

- Nueva API agregada.
- Nueva API o sección agregada para `Negocio`.
- Nuevo layout del dashboard.
- Pestañas `Command Center` y `Negocio`.
- Retirada de gráficos decorativos de la primera pantalla.
- Integración de check-ins, agentes, costes, competiciones, revisiones y membresías.
- Integración inicial de datos comerciales disponibles: membresías, caducidad, clientes sin membresía y Stripe si está persistido.
- Responsive móvil.
- Build y lint.

No incluido:

- Nuevas migraciones SQL salvo que se detecte imprescindible.
- Nuevos gráficos.
- Rediseño de `/clientes`, `/entrenos` o portal cliente.
- Sistema completo de calendario.
- Nuevas automatizaciones IA.
- Contabilidad formal, fiscalidad, facturación legal o conciliación bancaria.

## 10. Verificación

Técnica:

- `npm run lint`
- `npm run build`
- Probar `/dashboard` con sesión de coach.
- Confirmar que la API devuelve 401 sin auth.
- Confirmar que el dashboard no rompe si no hay clientes, check-ins, tareas IA, costes o competiciones.

Producto:

- La primera pantalla responde "qué hago ahora".
- Cada bloque tiene ruta o acción clara.
- No hay gráficos sin decisión asociada.
- En móvil se ve primero la cola de acciones.
- La pestaña `Negocio` separa pagos/renovaciones de coaching operativo.
- Los datos mostrados salen de tablas/endpoints reales.

## 11. Riesgos y mitigación

Riesgo: consultas pesadas por cargar todo desde una API.
Mitigación: limitar rangos temporales y número de filas; usar counts cuando baste.

Riesgo: duplicar lógica ya existente en `AutoCoachPanel` y `CheckinsPendientes`.
Mitigación: mover cálculo a helpers puros o reutilizar endpoints actuales dentro de la API agregada.

Riesgo: dashboard demasiado denso.
Mitigación: prioridad visual estricta: cola diaria arriba, resto en módulos compactos.

Riesgo: datos de Stripe incompletos.
Mitigación: incluir membresía y caducidad primero; pagos Stripe solo si hay campos persistidos fiables.
