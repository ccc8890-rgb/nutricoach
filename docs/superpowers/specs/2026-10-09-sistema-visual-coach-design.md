# Sistema visual unificado para la app coach

**Fecha:** 09-10-2026  
**Estado:** diseño aprobado; pendiente de revisión del documento  
**Proyecto:** NutriCoach

## 1. Objetivo

Trasladar a la aplicación coach el lenguaje visual y de interacción ya consolidado en el portal cliente. La aplicación debe sentirse como un único producto, aunque cada entorno conserve una arquitectura y unas necesidades operativas diferentes.

El coach se utilizará principalmente en MacBook. Por tanto, el diseño priorizará escritorio, densidad operativa, navegación rápida y lectura simultánea de datos, sin perder la compatibilidad móvil existente.

## 2. Restricciones

- Mantener rutas, APIs, modelos de datos, autenticación, permisos y lógica de negocio.
- Mantener la sidebar y la organización actual de la navegación coach.
- No reproducir literalmente el layout móvil del cliente en escritorio.
- No reestructurar módulos funcionales durante la migración visual.
- No introducir nuevas dependencias salvo necesidad demostrada.
- Usar las dependencias ya instaladas: Tailwind CSS 4, Geist, Phosphor y Framer Motion.
- Conservar modo claro y oscuro.
- Hacer cambios progresivos, verificables y reversibles.

## 3. Principios del sistema

### 3.1 Un producto, dos contextos

Cliente y coach compartirán identidad, tokens y comportamiento de componentes. La diferencia estará en la densidad: el cliente seguirá siendo más guiado y táctil; el coach será más compacto y orientado a gestión.

### 3.2 Escritorio primero para coach

La referencia principal será 1440×900 y 1512×982. El contenido tendrá un ancho máximo coherente, jerarquía clara y capacidad para mostrar paneles simultáneos sin convertir toda la interfaz en una sucesión de tarjetas.

### 3.3 Arquitectura estable

El trabajo se apoyará en componentes y estilos compartidos. Las páginas conservarán sus consultas, mutaciones y estado. Cuando una pantalla mezcle lógica y presentación, se sustituirá únicamente su capa visual mediante componentes compatibles con sus props actuales.

### 3.4 Semántica antes que decoración

Los colores de estado conservarán significado estable: activo/positivo, aviso, alerta e información. El acabado metálico y editorial se reservará para jerarquía, navegación y acciones principales, sin reducir legibilidad.

## 4. Fundamentos visuales

### Tipografía

- Geist Sans para interfaz y texto.
- Geist Mono o cifras tabulares para métricas, tiempos, macros y valores comparables.
- Escala compartida para título de página, título de sección, etiqueta, cuerpo y dato.
- Titulares compactos, con tracking ajustado; textos auxiliares más suaves y legibles.

### Color y superficies

- Reutilizar los tokens Atelier existentes de `globals.css`.
- Fondo, superficies, bordes, estados y sombras procederán de variables semánticas, no de colores Tailwind aislados.
- Mantener una única familia neutra y un acento metálico.
- Reservar colores cromáticos para datos y estados, no para decoración.

### Iconografía

- Phosphor será el sistema estándar.
- Tamaños y pesos se fijarán por contexto: navegación, acción, dato y estado.
- Lucide se retirará progresivamente solo de las pantallas que entren en cada bloque de migración.
- No se mezclarán familias de iconos dentro de un mismo componente o pantalla migrada.

### Espaciado y geometría

- Escala consistente de separación, padding y alturas de control.
- Radios diferenciados: controles, paneles secundarios y contenedores principales.
- Menos tarjetas decorativas; se usarán divisores, grupos y fondos cuando expresen mejor la jerarquía.
- Contenedor principal adaptado a MacBook, sin estirar contenido indiscriminadamente.

### Movimiento

- Transiciones breves para hover, selección, despliegues y cambios de estado.
- Animaciones mediante `transform` y `opacity`.
- Respeto a `prefers-reduced-motion`.
- Sin animaciones perpetuas en las pantallas operativas.

## 5. Componentes compartidos

La implementación consolidará primitivas visuales compatibles con el código actual:

- `PageHeader`: título, contexto, acciones principales y secundarias.
- `SectionHeader`: título de bloque, ayuda y acción contextual.
- `Surface`: niveles de superficie sin forzar una tarjeta en cada agrupación.
- `Metric`: dato, unidad, variación y estado.
- `Button` e `IconButton`: variantes primaria, secundaria, discreta y destructiva.
- `Tabs` y `SegmentedControl`: navegación local y filtros mutuamente excluyentes.
- `Input`, `Select`, `Textarea` y campos de búsqueda con estados uniformes.
- `DataTable`: cabecera, selección, orden, acciones y adaptación móvil.
- `StatusBadge`: estados semánticos con texto, no solo color.
- `EmptyState`, `Skeleton` y `InlineError`.
- `Modal` y panel lateral con foco, cierre y jerarquía consistentes.

Las primitivas existentes que ya cubran estos roles se ampliarán antes de crear duplicados.

## 6. Shell coach

La sidebar conserva rutas, secciones y comportamiento. Su actualización se limita a:

- iconos Phosphor;
- escala tipográfica y espaciado compartidos;
- estado activo inequívoco;
- jerarquía más clara entre sección principal y subsección;
- controles de tema, ajustes y cierre de sesión coherentes;
- anchura y panel secundario adaptados al espacio de un MacBook.

El área principal conservará el shell actual y adoptará:

- márgenes y ancho máximo normalizados;
- encabezado coherente entre módulos;
- superficies y fondos compartidos con cliente;
- comportamiento responsive existente sin convertir el coach en una copia del portal móvil.

## 7. Migración por bloques

### Fase 1 — Base visible

- Shell global y sidebar.
- Dashboard coach.
- Índice de clientes.
- Definición o consolidación de primitivas compartidas.

Esta fase fija el patrón y permite validarlo antes de extenderlo.

### Fase 2 — Operación principal

- Ficha de cliente y sus pestañas.
- Nutrición y dietas.
- Entrenamiento, planificación y rendimiento.

### Fase 3 — Producción y biblioteca

- Recetas, revisión, alimentos y cobertura.
- Contenido.
- Plantillas y bibliotecas auxiliares.

### Fase 4 — Administración

- Compra, precios, costes y rentabilidad.
- Agentes, conocimiento, sistema y ajustes.
- Pantallas residuales y estados poco frecuentes.

Cada fase debe cerrar sin dejar una pantalla mezclando dos familias de iconos o dos estilos de controles principales.

## 8. Estados y accesibilidad

- Contraste legible en claro y oscuro.
- Foco visible en todos los elementos interactivos.
- Navegación por teclado en sidebar, pestañas, tablas y modales.
- Áreas de pulsación suficientes aunque el escritorio sea el objetivo principal.
- Los estados no dependerán exclusivamente del color.
- Cargas con skeleton contextual; vacíos con explicación y acción útil; errores junto al elemento afectado.

## 9. Verificación

Para cada bloque:

1. Ejecutar TypeScript, lint de archivos afectados y build.
2. Probar rutas y acciones existentes sin cambiar contratos de datos.
3. Revisar modo claro y oscuro en 1440×900 y 1512×982.
4. Comprobar al menos un viewport móvil para evitar regresiones.
5. Verificar estados de carga, vacío, error, hover, foco y selección.
6. Confirmar consistencia de iconos, tipografía, espaciado y variables semánticas.

## 10. Criterios de aceptación

- Cliente y coach se reconocen como partes del mismo producto.
- La navegación coach conserva su estructura y todas sus rutas.
- Las funciones existentes continúan operativas.
- Las pantallas principales de coach usan Geist, Phosphor y los tokens compartidos.
- No quedan colores o superficies incompatibles dentro de una pantalla migrada.
- El dashboard y clientes funcionan con comodidad en MacBook sin exceso de aire ni saturación de tarjetas.
- Claro, oscuro, teclado y móvil no presentan regresiones críticas.

## 11. Fuera de alcance

- Cambiar la arquitectura de navegación.
- Rediseñar flujos funcionales o añadir nuevas capacidades.
- Modificar esquemas de Supabase o contratos de APIs.
- Reescribir todas las páginas en una sola entrega.
- Convertir el coach en una réplica exacta del layout del cliente.

