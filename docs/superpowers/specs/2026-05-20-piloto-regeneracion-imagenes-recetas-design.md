# Piloto Regeneracion Imagenes Recetas Design

**Fecha:** 20-05-2026

## Objetivo

Validar un flujo de regeneracion visual para recetas rechazadas por Carlos sin tocar la base de datos. El piloto debe comparar la imagen actual contra una candidata nueva y permitir decidir si la direccion estetica sirve antes de procesar las 194 rechazadas.

## Criterio Visual

Las imagenes aceptadas por Carlos comparten un patron claro: foto real de creador, normalmente Instagram/TikTok, con composicion de movil o food creator y sin apariencia plastica. El flujo debe priorizar imagen real o similar real antes de generar desde cero.

Reglas:
- No tocar las 73 imagenes aceptadas.
- No actualizar `recetas.imagen_url` durante el piloto.
- Guardar todo en `salidas/revision-imagenes/piloto-20-05-2026/`.
- Usar IA como edicion ligera cuando haya imagen base.
- Usar IA desde cero solo como ultimo recurso o como muestra controlada del fallback.

## Flujo

1. Recetas con `url_origen`: recuperar thumbnail/foto real con `yt-dlp`, `agent-browser` u `og:image`.
2. Recetas sin `url_origen`: buscar una foto similar en fuentes de recetas accesibles.
3. Normalizar candidato a cuadrado 1:1.
4. Aplicar prompt de limpieza minima:
   - conservar comida, plato, angulo y composicion
   - eliminar texto, manos, logos y watermarks
   - mantener textura real, luz natural y pequenas imperfecciones
5. Si no hay candidato, generar desde cero con prompt anti-plastico basado en ingredientes reales.
6. Crear panel HTML con imagen actual vs candidata.

## Lote Piloto

Doce recetas rechazadas:
- 4 con fuente original: `Adobos de pollo`, `Arroz con pollo y salsa de cilantro`, `Bizcocho proteico con pepitas de chocolate`, `Chuck Fudge Protein Balls`
- 4 sin fuente pero buscables: `Albóndigas de pollo en salsa ligera de tomate`, `Berenjenas a la parmesana ligeras`, `Huevos poché sobre aguacate y pan integral`, `Lentejas estofadas con verduras`
- 4 fallback IA controlado: `Barritas Proteicas de Chocolate y Cacahuete`, `Batido verde de manzana y espinacas`, `Bacalao confitado a 65 °C con pil-pil de ajo negro y espárragos a la plancha`, `Tiramisu en vaso`

## Exito

El piloto es valido si al menos una de estas rutas produce candidatas aceptables:
- fuente original + limpieza ligera
- busqueda real + limpieza ligera
- fallback IA anti-plastico

El resultado no se sube hasta que Carlos apruebe visualmente el panel.
