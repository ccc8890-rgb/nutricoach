# Dashboard del coach — reorganización visual (08-10-2026)

## Problema
`app/dashboard/page.tsx` (825 líneas) apila ~13 bloques de lista con el mismo peso visual, repartidos en dos pestañas (Hoy / Negocio). Hay datos repetidos (check-ins pendientes y clientes en riesgo salen 2-3 veces). Nada indica qué hacer primero.

## Objetivo
Abrir el panel y ver en 5 segundos: qué toca hoy, cómo va el negocio y a dónde ir. Una sola pantalla, sin pestañas, iPhone y Mac.

## Diseño (pantalla única, 3 capas + plegado)
1. **HOY — 3 tarjetas grandes**: número gigante + 3 primeros casos, color por urgencia (rojo crítico / ámbar pendiente / verde 0).
   - Check-ins por revisar: `operacion.checkins_pendientes` + `respuestas_pendientes`; casos desde `hoy` filtrando tipo check-in.
   - Clientes en riesgo: `clientes_riesgo` (motivo en una línea).
   - Listo para aprobar (IA): `inbox_ia`.
   - Si las tres están a 0 → un único mensaje «Todo al día».
2. **NÚMEROS — 4 cifras**: clientes activos (`operacion.clientes_activos`), ingresos del mes, MRR, renuevan 7d (`negocio.resumen`). Aviso rojo si hay pagos pendientes o clientes sin membresía. Sin gráficas (las APIs no dan series).
3. **ACCESOS — 6 botones**: Nuevo cliente, Clientes, Revisar recetas (badge de pendientes), Contenido, Dietas, Entrenos.
4. **«Más detalle» plegado por defecto**: calendario deportivo, coste y fricción alimentaria, renovaciones, pagos pendientes, transacciones recientes, embudo.

Se eliminan: pestañas Hoy/Negocio, «Foco semanal», «Operación semanal» (datos duplicados).

## Técnica
- Sin cambios de API: se siguen usando `/api/dashboard/command-center`, `/costes-clientes` y `/negocio`. Negocio se pide a la vez que command-center (no lazy), sin bloquear las tarjetas de Hoy (skeleton propio).
- Partir la página en `components/dashboard/`: `HoyCards.tsx`, `NumerosClave.tsx`, `Accesos.tsx`, `DetalleColapsable.tsx`. Reutilizar los subcomponentes actuales (listas de renovaciones, pagos, transacciones, coste, calendario) moviéndolos tal cual al plegado.
- Estilos: variables CSS del proyecto (`var(--surface)`, `--error`, `--warning`, `--success`), sin colores fijos; funciona en modo claro y oscuro. Mobile-first: 1 columna, cifras 2×2, accesos 3×2.
- Errores: si falla command-center → tarjetas con estado de error y reintento; si falla negocio → solo las cifras muestran «—» con reintento.

## Verificación
`npx tsc --noEmit`, `npm run build`, y revisión visual con `browse --headed` (handoff, Carlos inicia sesión) en ancho Mac y 390 px, claro y oscuro.

## Fuera de alcance
Gráficas con series temporales, rediseño del menú lateral, cambios en las páginas destino.
