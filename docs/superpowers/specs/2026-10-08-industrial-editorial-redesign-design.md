# Rediseño Industrial Editorial Hybrid

Fecha: 08-10-2026
Estado: aprobado visualmente, pendiente de plan de implementación

## 1. Objetivo

Rediseñar el portal cliente de NutriCoach para que deje de parecer una aplicación genérica construida con tarjetas y adopte una identidad propia, sobria y profesional.

El cambio mantiene intactos:

- arquitectura, rutas y APIs;
- navegación principal y número de secciones;
- datos y funciones disponibles;
- lógica de Supabase, autenticación y permisos;
- estructura conceptual de Hoy, Dieta, Entreno, Recetas y Ajustes.

El rediseño sí puede cambiar la composición interna, jerarquía, agrupación, tipografía, superficies, controles, iconografía y movimiento de cada pantalla.

## 2. Dirección aprobada

Nombre: **Industrial Editorial Hybrid**.

La dirección combina tres ideas:

1. **Identidad editorial:** portada de gran escala, composición asimétrica, títulos breves y bloques continuos.
2. **Secuencia operativa:** las acciones del día se organizan temporalmente, evitando una colección de tarjetas equivalentes.
3. **Instrumentación compacta:** métricas y progreso se presentan como lecturas técnicas secundarias, sin dominar toda la pantalla.

La experiencia debe sentirse como un instrumento de rendimiento bien diseñado, no como una aplicación de fitness motivacional ni como un dashboard de IA.

## 3. Principios visuales

### 3.1 Paleta

- Fondo principal: negro grafito ligeramente frío.
- Superficies: carbón, acero oscuro y titanio.
- Texto principal: blanco mineral, nunca blanco puro.
- Texto secundario: gris aluminio.
- Selección: plata sólida o inversión blanco mineral sobre grafito.
- Color funcional: verde, ámbar y rojo exclusivamente para estados reales.
- Azul: no se usa como acento decorativo ni para pestañas activas.

El modo oscuro es la identidad principal. El modo claro es una adaptación funcional del mismo sistema, no otra dirección artística.

### 3.2 Tipografía

- Instrument Sans continúa como familia principal.
- Geist Mono se utiliza para kcal, gramos, horas, porcentajes, series, repeticiones y numeración técnica.
- Los títulos editoriales usan pesos medios, tracking cerrado y saltos de línea intencionales.
- Las etiquetas de sistema se muestran en mayúsculas, tamaño reducido y tracking amplio.
- No se incorporan fuentes ornamentales ni serif en esta fase.

### 3.3 Geometría

- Radios pequeños y controlados: entre 2 y 8 px en el contenido.
- La navegación inferior puede mantener una geometría más suave por ser una superficie flotante.
- Se sustituyen las cuadrículas de tarjetas idénticas por paneles continuos, divisores y composición asimétrica.
- Los bordes son de 1 px y utilizan tonos de metal oscuro.
- No se usan franjas laterales de color como decoración.

### 3.4 Materialidad

- Liquid Glass se reserva para navegación inferior, cabeceras flotantes, menús y overlays.
- Paper Shaders puede generar una atmósfera metálica muy sutil en portadas o fondos, sin competir con el contenido.
- No se aplica blur a todas las tarjetas.
- Las superficies principales permanecen nítidas y legibles.

### 3.5 Movimiento

- Motion se usa para comunicar cambios de estado, selección y continuidad espacial.
- Duración habitual: 160–220 ms.
- La pestaña activa puede desplazarse físicamente entre destinos.
- No hay animaciones decorativas de entrada ni coreografías al cargar.
- `prefers-reduced-motion` elimina shaders animados y transiciones no esenciales.

## 4. Navegación global del cliente

Se mantienen cinco destinos:

1. Hoy
2. Dieta
3. Entreno
4. Recetas
5. Ajustes

La navegación inferior permanece fija y accesible. Se presenta como una única superficie flotante de vidrio oscuro con borde metálico.

La selección activa:

- no utiliza azul;
- usa una pieza plateada o una inversión tonal;
- se desplaza con Motion entre pestañas;
- conserva texto e icono legibles;
- dispone de estado de foco visible y área táctil mínima de 44 px.

La cabecera inteligente ya implementada se conserva: se repliega al bajar, reaparece al subir y siempre vuelve cerca del inicio.

## 5. Traducción por pantalla

### 5.1 Hoy: portada + secuencia

La pantalla se divide en cuatro zonas:

1. Cabecera compacta con identidad y fecha.
2. Portada editorial con protocolo o semana activa y un título breve.
3. Franja de métricas principales, sin tarjetas individuales.
4. Secuencia temporal del día con alimentación, entrenamiento, recuperación y check-in.

El elemento actual se distingue mediante inversión tonal, no mediante azul. La instrumentación circular queda en una columna o zona secundaria compacta.

### 5.2 Dieta: documento semanal operativo

- Selector semanal horizontal integrado en el documento.
- Cada comida funciona como capítulo numerado.
- Macros y kcal se leen mediante líneas, proporciones y datos monoespaciados.
- Los ingredientes se expanden progresivamente dentro del flujo.
- Acciones como cambiar alimento, ver receta o lista de compra mantienen su función actual.
- Se evita una tarjeta completa por comida cuando un divisor y una jerarquía tipográfica sean suficientes.

### 5.3 Entreno: hoja técnica de sesión

- La sesión activa abre con nombre, duración, bloque y RPE objetivo.
- Los ejercicios aparecen en orden técnico numerado.
- Series, repeticiones, carga y descanso usan Geist Mono.
- El modo de registro conserva controles táctiles grandes.
- La información del coach o de IA se muestra como nota técnica secundaria, no como tarjeta azul.
- El historial y la semana utilizan el mismo lenguaje de tabla o secuencia.

### 5.4 Recetas: archivo gastronómico editorial

- Los filtros se presentan como controles técnicos compactos.
- La lista prioriza imagen, nombre, kcal, proteína y contexto de uso.
- Se reduce la sensación de cuadrícula de tarjetas repetidas.
- Las recetas pueden alternar filas editoriales y piezas destacadas.
- El detalle de receta mantiene sus datos e interacciones actuales.

### 5.5 Ajustes: panel continuo de sistema

- Cuenta, experiencia, integraciones y seguridad se organizan como grupos continuos.
- Los campos se distinguen de la superficie mediante profundidad tonal y borde metálico.
- Toggles y selectores usan plata/grafito para estados activos.
- No se repite una tarjeta independiente por opción.
- El cierre de sesión y las acciones destructivas conservan confirmación y color semántico.

## 6. Componentes del sistema

La implementación debe introducir una capa reutilizable, sin reescribir la lógica de las páginas:

- `EditorialMasthead`: portada de sección.
- `TechnicalReadout`: dato numérico con etiqueta.
- `MetricRail`: franja continua de métricas.
- `TimelineSequence`: eventos temporales o secuenciales.
- `TechnicalRow`: fila numerada para comida, ejercicio, receta o ajuste.
- `IndustrialTabs`: selector de vistas sin acento azul.
- `LiquidDock`: navegación inferior flotante.
- `ProgressInstrument`: progreso compacto y opcional.

Los componentes reciben datos mediante props y no realizan peticiones. Las páginas actuales conservan la obtención y mutación de datos.

## 7. Estrategia técnica

### 7.1 Dependencias

- Reutilizar `framer-motion`, ya instalado.
- Reutilizar `@paper-design/shaders-react`, ya instalado.
- No instalar Base UI, shadcn, Aceternity ni otra librería durante la primera fase.
- Evaluar componentes headless solo si aparece una limitación concreta de accesibilidad o interacción.

### 7.2 Migración

La migración será incremental:

1. Tokens globales y primitivas editoriales.
2. Pantalla Hoy completa.
3. Navegación inferior y cabecera.
4. Dieta.
5. Entreno.
6. Recetas.
7. Ajustes.
8. Adaptación clara.

Cada fase debe poder desplegarse y revertirse sin romper las siguientes.

### 7.3 Rendimiento

- Los shaders se cargan dinámicamente y solo donde sean visibles.
- En dispositivos con reducción de movimiento se utiliza un fondo estático.
- La navegación y el contenido crítico no dependen de WebGL.
- No se añaden vídeos de fondo ni texturas raster pesadas.
- Se debe comprobar el tamaño del bundle del portal antes y después.

## 8. Accesibilidad y comportamiento

- Contraste suficiente en ambos temas.
- Áreas táctiles mínimas de 44 × 44 px.
- Foco visible para teclado.
- Navegación inferior con `aria-current` o estado equivalente.
- La información nunca depende únicamente del color.
- Las animaciones respetan `prefers-reduced-motion`.
- El contenido continúa siendo utilizable si Paper Shaders o WebGL no cargan.

## 9. Fuera de alcance

- Cambiar rutas, arquitectura o modelo de datos.
- Añadir nuevas funcionalidades de nutrición o entrenamiento.
- Rediseñar el panel coach en la primera implementación.
- Sustituir todo el sistema de iconos.
- Crear una marca, logotipo o naming nuevos.
- Copiar literalmente Apple, WHOOP, Linear u otra aplicación.

El panel coach se abordará después de validar el sistema completo en el portal cliente.

## 10. Verificación

### Funcional

- Todas las pestañas mantienen las mismas acciones actuales.
- Cambiar de pestaña conserva URL, caché y estado existentes.
- Cabecera inteligente y navegación inferior continúan operativas.
- Formularios, registro de entreno, check-in y recetas siguen funcionando.

### Visual

- Capturas a 390 × 844 px en oscuro y claro.
- Capturas a 430 × 932 px para comprobar escalado móvil.
- No existe scroll horizontal.
- No aparecen fondos azules en pestañas o selecciones decorativas.
- Hoy, Dieta, Entreno, Recetas y Ajustes comparten identidad sin repetir la misma composición.

### Técnica

- Tests visuales estructurales actualizados.
- ESLint sin errores en archivos modificados.
- TypeScript limpio.
- `npm run build` completo.
- Comparación de bundle del portal antes y después.
- Prueba de reducción de movimiento.

## 11. Criterios de aceptación

1. Carlos identifica la app como un rediseño real, no como el mismo producto con otro color.
2. La pantalla Hoy se corresponde con la dirección híbrida aprobada visualmente.
3. La navegación no utiliza azul decorativo.
4. Las cinco secciones mantienen sus funciones y rutas.
5. Cada sección adapta el lenguaje visual a su tarea.
6. El portal sigue siendo rápido y legible en móvil.
7. El modo oscuro actúa como identidad principal y el claro conserva equivalencia funcional.
8. El diseño puede extenderse al coach sin rehacer sus fundamentos.
