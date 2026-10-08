# Plan de mejoras — próximas sesiones (propuesto 08-10-2026)

Ordenado por impacto para Carlos (primer cliente real y captación). Cada bloque cabe en una sesión.

## 1. Verificar en uso real lo construido (30-45 min, antes de añadir nada)
- Recorrer en producción, en iPhone y Mac: ficha → plan → volver; dashboard → cifras; scroll al volver. Anotar solo lo que falle.
- Probar la tarjeta de suplementación del portal con un cliente que tenga algo aprobado y que vitamina D/ferritina <30 generen propuestas en pantalla (hoy solo cubierto por test).
- Repaso del dashboard a 390 px y modo oscuro tras los cambios de Codex («Industrial Liquid»).

## 2. Recetario: fotos y huecos (mayor deuda visible)
- ≈389 recetas sin foto (OpenAI sin saldo): decidir presupuesto o plan B (fotos propias de grabación con el apartado Contenido).
- Más recetas veganas y cenas ligeras (lotes con `importar-lote-verificado.ts`), y decidir Mealprep Carne / Kebab / Pollo burger.
- 19 recetas con <3 ingredientes y 2 con datos erróneos.
- Migración de sabor (dulce/salado) y mini-comida.

## 3. Motor de dietas: transparencia para el coach
- Mostrar por qué se propone cada plato y una pantalla «lo aprendido del cliente» (gustos, swaps rechazados).
- Aviso de huecos también al reajustar o activar semana (hoy solo al generar).
- Descontar los hidratos de la bebida de carrera del objetivo de comida sólida.
- Probar semana de carga/tapering con una competición real cargada.

## 4. Ficha del cliente y dashboard
- Cifras del dashboard con series en el tiempo (hoy solo totales): guardar un snapshot diario de ingresos/MRR/activos.
- Informe de micronutrientes también en la ficha del coach (hoy tarjeta en Nutrición → Más herramientas).
- Contenido: enlace automático con un reel real de Content Radar (probar el puente con datos reales, prioridad #1 del CLAUDE.md raíz).

## 5. Portal del cliente
- Medir velocidad en iPhone real y precalentar Compra/Chat/Check-in/Progreso/detalle de sesión.
- Guardar el estado de pestañas del portal en la URL con el mismo hook (`useEstadoUrl`) donde falte.
- Foto IA de comida y código de barras (Fase C resto).

## 6. Seguridad y mantenimiento
- Auditar el resto de rutas `/api/recetas/*` (solo se revisaron `revisar`, `estado`, `clasificacion`).
- Cambio de contraseña pidiendo la actual; límite de frecuencia en `PATCH /api/ajustes/perfil`.
- Borrar código muerto confirmado: `lib/alto-rendimiento/macros-por-fase.ts`, alimento «Daqui pii» (con permiso).
- Confirmar región de Supabase (`cdg1` vs `fra1`).

## 7. Negocio (cuando haya clientes reales)
- Fase D cocina profesional/horeca: escandallo por lote, mermas, food cost, ficha técnica exportable.
- Registrar Terra (TrainingPeaks/Whoop/COROS) si se quieren integraciones nativas.
