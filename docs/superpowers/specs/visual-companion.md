# Visual Companion: Training OS (NutriCoach)

## 1. Alcance del Rediseño Visual
El rediseño cubre la pestaña de entrenamientos completa (sidebar):
1. **Dashboard Coach (`/entrenos`)**: Vista de clientes con actividad, TLS y PRs recientes.
2. **Editor de Planes (`/entrenos/[id]`)**: Constructor visual avanzado (bloques, semanas, sesiones, ejercicios).
3. **Flujo del Cliente (`/cliente/sesion/[id]`)**: Ejecución set-by-set mejorada con timer y feedback de progreso.

## 2. Lenguaje Visual (Graphite Apple Pro / Instrument)
El diseño heredará el sistema base definido en `globals.css`:
- **Fondos Acromáticos**: Uso estricto de la paleta fría/negra (`--bg`, `--surface`). Eliminados los morados y verdes tailwind por defecto.
- **Glassmorphism**: Componentes flotantes (`.glass-card`, `.glass-btn`) con `backdrop-filter` para dar sensación premium (iOS-like).
- **Datos Numéricos**: Uso de `font-data` (`Geist Mono` o monospace equivalente) para TLS, cargas, PRs y timers.
- **Glow & Elevación**: Efectos sutiles al interactuar (`hover:shadow-glow`).

## 3. Interfaces Clave y Arquitectura de UI

### 3.1. Dashboard Coach (`/entrenos`)
- **Layout**: Grid responsivo con tarjetas `.glass-card` por cliente.
- **Módulos por Tarjeta**:
  - **Identidad**: Avatar generado y nombre del cliente. Estado del plan (activo, semanas).
  - **TLS (Training Load Score)**: Número de impacto visual (`text-3xl font-data`) acompañado de pill badge (`semaforo` = bajo/normal/alto/muy_alto usando colores semánticos).
  - **PRs Recientes**: Lista compacta de los últimos récords conseguidos.
  - **Actividad**: Última acción realizada y botón de acceso rápido al perfil de entrenamiento del atleta.

### 3.2. Editor de Planes (`/entrenos/[id]`)
- **Distribución Espacial**: 
  - Panel lateral (Sidebar): Árbol de navegación rápido entre semanas y sesiones.
  - Panel principal (Canvas): Editor de ejercicios de la sesión seleccionada.
- **Interacción Premium**:
  - Inputs minimalistas integrados en la tabla de ejercicios (sin bordes gruesos, focus ring suave).
  - Controles flotantes para arrastrar/soltar o reordenar ejercicios.
  - Estado vacío ("empty states") artísticos y no genéricos.

### 3.3. Flujo del Cliente (Ejecución Set-by-Set)
- **Modo Inmersivo (Mobile-First)**: Aprovechando safe-areas (`pt-safe-top`, `pb-nav-safe`). Header flotante con barra de progreso integrada.
- **Acordeón Inteligente**:
  - Ejercicio Activo: Expandido mostrando tabla de sets, notas y contexto IA.
  - Ejercicio Completado: Borde semántico activo, colapsado, opacidad reducida al 70% para quitar ruido visual.
- **Rest Timer**: Posicionado como isla flotante (sticky-bottom). Anillo de progreso SVG, números grandes y controles limpios (Play/Pause/Reset).
- **Celebración de Fin de Sesión**: Iconografía trofeo con glow, resumen de métricas (duración, volumen total) y selector RPE.

## 4. Estándares Técnicos para la Implementación
1. **Evitar inline colors Tailwind**: Usar estilos mapeados a variables (ej. `style={{ color: 'var(--text-muted)' }}`).
2. **Micro-interacciones**: Transiciones estándar de `0.15s` a `0.25s` en hovers y active states. Clases `animate-fade-in` para cargas de página.
3. **Hardware Acceleration**: Transformaciones con `translateZ(0)` implícito o uso de clases transform.
