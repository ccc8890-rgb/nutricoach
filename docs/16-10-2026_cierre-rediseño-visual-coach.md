# Cierre del rediseño visual de la app coach

Fecha: 16-10-2026

## Estado

La migración visual profunda de la app coach queda desplegada en producción y alineada con el sistema visual de la app cliente. Se ha mantenido la arquitectura, las rutas, las consultas y las funciones existentes.

Producción: https://nutricoach-delta.vercel.app

## Alcance completado

- Sistema base, navegación, cabecera, tipografía e iconografía.
- Dashboard y listado de clientes.
- Ficha profunda de cliente: Nutrición, Entrenamiento, Seguimiento, Comunicación, Perfil y Resumen.
- Dietas, editor, alimentos y plantillas.
- Training OS, planes, plantillas, biblioteca de ejercicios y componentes internos.
- Recetario, revisión, auditoría, cobertura, imágenes, alta y edición.
- Compra, precios, escandallo y rentabilidad.
- Contenido, conocimiento, cuestionarios, respuestas, sistema y ajustes.

## Auditoría final

- Tipografía efectiva confirmada: `Instrument Sans`.
- Revisión autenticada en producción a 1440 × 900 y 375 × 812 px.
- Cero desbordamientos horizontales globales en las rutas comprobadas.
- 17 suites del sistema coach en PASS.
- Training Workspace en PASS.
- TypeScript: 0 errores.
- ESLint: 0 errores y 182 avisos legacy no bloqueantes.
- Build: 162 rutas generadas correctamente.

Las capturas contienen información real de clientes y se guardaron solo en local, fuera del repositorio:

`~/.gstack/projects/nutricoach/designs/design-audit-20261016/screenshots/`

## Correcciones finales

- `e1e5adc`: integra `/compra` dentro de `CoachShell`.
- `f3042f8`: corrige la cabecera de `/compra` a «Compra y costes» y su acceso a «Escandallo».

## Próxima sesión: pulido visual fino

El sistema ya está unificado. La siguiente fase no es otro rediseño general, sino una pasada de detalle sobre huecos y excepciones visibles.

### P0 — Recorrido visual con datos cargados

1. Esperar a que desaparezcan todos los esqueletos antes de capturar Recetario y Dashboard.
2. Revisar estados vacíos, error, carga y éxito de cada módulo principal.
3. Comprobar modales y menús desplegables, no solo las pantallas base.
4. Comparar modo oscuro y claro en las superficies de mayor uso.

### P1 — MacBook y densidad profesional

1. Revisar anchos útiles a 1280, 1366, 1440 y 1512 px.
2. Ajustar espacios muertos excesivos sin ensanchar textos o formularios innecesariamente.
3. Revisar densidad de las tablas de clientes, ejercicios, dietas y precios.
4. Comprobar encabezados duplicados visualmente entre `CoachTopBar` y el título interno.
5. Uniformar alturas de botones, filtros, badges y campos compactos.

### P1 — Ficha profunda de cliente

1. Revisar las subpestañas completas de Seguimiento, Comunicación, Perfil y Resumen.
2. Pulir el scroll horizontal deliberado del plan semanal en móvil.
3. Revisar jerarquía de avisos, estados de revisión y acciones secundarias.
4. Validar Nutrición y Entrenamiento con clientes que tengan y no tengan planes activos.

### P2 — Consistencia y accesibilidad

1. Corregir targets táctiles menores de 44 px en móvil donde no afecten a la densidad de escritorio.
2. Revisar contraste de textos secundarios, bordes y estados deshabilitados.
3. Confirmar foco visible y navegación por teclado en formularios y modales.
4. Reducir los 182 avisos de lint que afecten directamente a UI: dependencias de hooks, imágenes y variables obsoletas.
5. Auditar que no queden emojis usados como iconos funcionales donde corresponda Lucide.

## Criterio de cierre de la siguiente pasada

- Captura antes/después de cada corrección real.
- Sin cambios de arquitectura ni funcionalidad.
- Tests específicos, TypeScript, lint sin errores y build en verde.
- Despliegue progresivo y comprobación autenticada en producción.
