# Traspaso a Codex — presentación para el coach (10-10-2026)

Claude ha dejado la **estructura y el contenido**; el **acabado visual** es de Codex. No hace falta tocar lógica: todo el texto sale de un módulo probado.

## Regla de oro
Los textos, el orden y las etiquetas viven en **`lib/rendimiento/presentacion.ts`** (con `scripts/presentacion.test.ts`). Si quieres cambiar una palabra, cámbiala ahí y actualiza el test; los componentes solo pintan. Así el coach y (más adelante) el cliente leen lo mismo.

## Qué se ve y cómo se lee (3 niveles)
1. **Titular:** una etiqueta de estado (*Todo en orden · Hay algo que mirar · Revisa antes de aprobar*) y una frase.
2. **Cambios, una fila cada uno:** una línea de qué cambiar y **una sola etiqueta** (*Seguro · Mirar · Revisar*) en lugar de cuatro.
3. **«Por qué» plegado** (`<details>`): razón, estudios con enlace, fiabilidad, avisos. Para quien quiera revisar y aprender; no es obligatorio.

## Componentes tocados
| Componente | Dónde sale | Qué pulir |
|---|---|---|
| `components/clientes/PlanificarConIA.tsx` | Ficha → Entrenamiento → Plan activo (botón único y línea de modo, mensaje de resultado) | Jerarquía del botón primario, estado de carga, mensaje de éxito/error |
| `components/clientes/PropuestaPlanEntreno.tsx` | Dentro de la tarjeta de «Decisiones de IA pendientes» (tipo *Plan de entreno*) | Titular + chip de estado, bloque «Qué cambia», lista «La semana» (pasarla a tabla compacta en escritorio), «Revisar antes de aprobar», «Por qué» plegado |
| `components/clientes/DecisionesIACliente.tsx` | Mismo sitio | Tarjeta colapsada: que se lea el titular sin abrir; botones Aprobar/Ignorar |
| `components/rendimiento/AnalisisIA.tsx` | Ficha → Entrenamiento → Rendimiento → Entrenador IA | Titular y chip, filas de «Qué cambiar» con su etiqueta, vista previa Ahora/Propuesto, «Datos que lo explican» plegado |
| `app/clientes/[id]/page.tsx` (bloque Plan activo) | Menú «Más opciones» (`<details>` con posición absoluta) | Que se cierre al elegir, foco y teclado |

## Cosas concretas a revisar
- **Colores:** hoy hay hexadecimales (`#6AAF85` verde, `#C8A96A` ámbar, `#E0557A` rojo) para las etiquetas; sustituir por los tokens del sistema visual y comprobar contraste en **modo oscuro**.
- **Móvil (390 px):** chips que se rompen en dos líneas, lista de la semana, «Más opciones».
- **Densidad:** que con todo plegado la tarjeta se lea en 5 segundos; lo desplegado puede ser más denso.
- **Accesibilidad:** `<details>/<summary>` ya son navegables con teclado; mantener el foco visible.
- La etiqueta de estado `reemplazada` (tareas sustituidas por una más nueva) aparece tal cual en algunos paneles: darle texto amable («Reemplazada por una más reciente»).

## Qué NO cambiar sin avisar
- Ni la lógica de `etiquetaDecision`/`estadoAnalisis` (decide qué es «Seguro», «Mirar» o «Revisar»; si cambia hay que decidirlo con Carlos).
- Ni los datos que llegan (`PayloadPlanEntrenoIA`).
- Ni quitar la ayuda de «Por qué»: es lo que permite revisar y aprender sin obligar a hacerlo.

## Fuera de alcance (a propósito)
Versión para el cliente (explicación en vivo o por chat) y la simplificación de la pestaña Entrenamiento (fusionar tipos de tarea y paneles): son las siguientes tareas (`docs/10-10-2026_siguientes-tareas.md`).
