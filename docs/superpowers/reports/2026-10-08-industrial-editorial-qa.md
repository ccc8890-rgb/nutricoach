# QA — Industrial Editorial Hybrid

Fecha: 08-10-2026

## Candidato

- Base de diseño: `1a22d77`
- `main` desplegado: `11b1b8b`
- Producción: `https://nutricoach-delta.vercel.app`
- Deployment Vercel: `dpl_525N4m6yVBZ5HdBSJQ8bHnPrMK7P` — Ready

## Verificación técnica

- `npx tsx scripts/industrial-editorial-portal.test.tsx`: PASS, 6 contratos renderizados.
- `scripts/test-comidas-dia.ts`: PASS, 46/46.
- `scripts/test-training-workspace.ts`: PASS.
- `scripts/training-os.test.ts`: PASS.
- `scripts/receta-competicion.test.ts`: PASS.
- ESLint de todos los archivos modificados: 0 errores.
- ESLint completo: 0 errores y 273 warnings preexistentes fuera del alcance visual.
- `npx tsc --noEmit`: PASS.
- `npm run build`: PASS, 178 páginas generadas.
- Vercel production build: Ready.

## Revisión de implementación

- Cinco destinos conservados: Hoy, Dieta, Entreno, Recetas y Ajustes.
- Rutas, APIs, Supabase, autorización y modelos de datos sin cambios.
- Cabecera retráctil conservada.
- Dock accesible con `aria-current`, selector interno con `aria-selected`.
- Fallback CSS disponible sin WebGL y shader oculto con reducción de movimiento.
- Selección decorativa azul eliminada de tabs, dock y hoja de entrenamiento.
- Safe areas y ajustes específicos para 390/430 px incluidos.
- Modo claro traducido con superficies minerales y grafito.

## QA de navegador

- Producción responde correctamente en `/cliente`.
- El navegador automatizado sin sesión muestra correctamente el login y confirma que el despliegue está servido.
- La matriz autenticada de capturas no pudo ejecutarse desde el entorno de Codex: no había navegador compartido disponible y el navegador headless no contiene la sesión privada de Carlos.
- La aceptación visual autenticada queda pendiente de abrir la app con la sesión de cliente ya existente y revisar los cinco destinos.

## Incidencias corregidas durante revisión

1. `ProgressInstrument` exponía `aria-valuemax=0` sin objetivo: corregido y cubierto RED→GREEN.
2. La ruta de sesión consumía tokens CSS definidos solo en el shell del portal: tokens añadidos al scope de sesión.
3. Una sesión seleccionada mantenía texto claro sobre superficie plateada: corregido a contraste carbono.
4. El preview de rama falló porque Vercel no expone las variables Supabase al entorno Preview; producción dispone de ellas y compiló correctamente. No se alteraron secretos ni configuración.

## Estado de criterios

1. Rediseño compositivo real: implementado; aceptación final de Carlos pendiente.
2. Hoy híbrido portada/secuencia/instrumentación: implementado.
3. Navegación sin azul decorativo: verificado en código.
4. Funciones y rutas de las cinco secciones: conservadas y compiladas.
5. Lenguaje diferenciado por sección: implementado.
6. Responsive móvil: implementado; captura autenticada pendiente.
7. Oscuro principal y claro funcional: implementado.
8. Primitivas extensibles al coach: implementadas en `components/PortalCliente/editorial/`.
