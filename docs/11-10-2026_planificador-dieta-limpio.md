# Planificador de dieta más limpio (11-10-2026, tarde)

Archivo: `components/clientes/SemanaDietaPlanner.tsx`. Solo estructura y lógica de interfaz; sin cambios de API ni de BD. Pulido visual pendiente (Codex).

## Qué cambió (commits `eecdd67` → `97ed38e`, en `main`)
- **Cabecera mínima:** título, selector 1 semana / 2 semanas / Mes, ampliar, menú `⋯` (componente local `MenuMas`) y «Generar semana» (en 2 semanas/mes: «Generar semana en curso», con tooltip de las franjas).
- **Menú `⋯`:** Ajustes de generación, Aplicar plantilla, Guardar como plantilla, Ajustar al entreno (solo si hay entrenos) y el botón «Nuevo plan» que pasa la ficha (`accionExtra`).
- **Ajustes de generación plegados:** franjas a generar y «Comidas al día» ya no ocupan filas fijas (`ajustesGen`). El texto largo de «Comidas al día» quedó como tooltip.
- **Menú `⋯` por semana planificada:** Generar con IA, Copiar semana en curso (desactivado si la semana en curso no tiene recetas), Vaciar. «Activar» sigue visible en la semana +1.
- **Quitado el selector Resumen/Platos.** Siempre Platos. El código de `SemanaResumen` y `modo === 'resumen'` queda sin uso (se menciona, no se borra).
- **Semanas plegables** (`semanasPlegadas`): en 2 semanas y Mes arrancan desplegadas y cada una se pliega desde su título (▾/▸). En 1 semana siempre abierta. Cambiar de vista lo restablece.
- **Detalle del día plegado en 2 semanas/mes:** barra bajo cada semana con el día y «Desplegar/Plegar detalle» (`detalles` por semana: cada semana recuerda su día y su estado). Día por defecto: hoy en la semana en curso, lunes en las planificadas. En 1 semana el detalle sigue abierto siempre.

## Verificado
`tsc` limpio (queda un error previo en tipos generados de `.next`), ESLint sin avisos, `npm run build` OK, sin tests ni scripts que dependan de los botones movidos, sin secretos en el diff. Carlos lo probó en producción en 2 semanas («perfecto»).

## Pendiente
- Probar la vista **Mes** y el menú `⋯` en pantalla completa.
- Barra «Desplegar detalle» también sale en semanas planificadas vacías (ocultar si molesta).
- Resaltado del día solo en el último pulsado; no por semana.
- Con la semana plegada no se pueden soltar platos en ella.
- Acabado visual de los menús: Codex.
