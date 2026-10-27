# Iconos de la app: estudio, estado actual y cómo volver atrás (27-10-2026)

Carlos quería iconos menos genéricos («los que usan otras apps hechas con IA») pero claros y serios. Se probaron seis familias en una sesión. Este documento deja anotado qué hay, por qué, y cómo cambiar o deshacer cada cosa.

## Estado actual (qué familia usa cada superficie)

| Superficie | Familia | Dónde se decide |
|---|---|---|
| **App del coach** (menú lateral y todas las pantallas) | **Hugeicons** (MIT) | `components/icons/lucide.tsx`, `phosphor.tsx`, `MarcaIconos.tsx` |
| **Portal cliente** (`app/cliente`, `components/PortalCliente`, componentes de entreno del cliente) | **Material Symbols Light · Sharp** (Apache 2.0) | `components/icons/portal-lucide.tsx`, `portal-phosphor.tsx`, `portal-marca.tsx` |

Motivo: a Carlos le gustó mucho la barra lateral del coach con Hugeicons (casa, clientes, película, tablilla, libro, bolsa). En el portal cliente, Hugeicons le pareció redondeado y «poco serio» frente al estilo editorial (Sora, rótulos mono, esquinas casi rectas), así que ahí se prueba la familia de esquinas secas. **Es una prueba: Carlos aún no la ha visto en el iPhone.**

## Cómo cambiar de familia (una línea)

Cada superficie tiene un fichero «interruptor» de una línea.

- **Portal cliente → volver a Hugeicons:** en los tres ficheros `portal-*.tsx` cambiar el `export * from` por el de Hugeicons:
  - `portal-lucide.tsx`: `export * from './lucide'`
  - `portal-phosphor.tsx`: `export * from './phosphor'`
  - `portal-marca.tsx`: `export * from './MarcaIconos'`
- **Coach → Material Sharp:** en `lucide.tsx` y `phosphor.tsx` sustituir su contenido por `export * from './sharp-lucide'` / `'./sharp-phosphor'`, y en `Sidebar.tsx` importar de `./MarcaIconosSharp` en vez de `./MarcaIconos`.
- **Todo a una sola familia:** cambiar ambos interruptores a la misma.

`tsc` avisa si falta algún nombre. Las dos familias exportan **exactamente los mismos nombres**.

## Cómo está montado

- Los ~225 nombres de iconos que usaba el código (Lucide y Phosphor) se mantienen: los ficheros `lucide.tsx` / `phosphor.tsx` (Hugeicons) y `sharp-lucide.tsx` / `sharp-phosphor.tsx` (Material) los reexportan con los dibujos de cada familia. Por eso no hubo que tocar cada uso, solo la ruta del `import`.
- Los dibujos están **incrustados** (no hay dependencia nueva): `hugeicons-core.tsx` y `sharp-core.tsx`. Ficheros generados; las licencias (MIT de Hugeicons, Apache 2.0 de Google) van en la cabecera de cada uno.
- Iconos propios de navegación y acciones (Hoy, Dieta, Recetas, Entreno, Datos, Compra, Chat, Check-in…): `MarcaIconos.tsx` (Hugeicons) y `MarcaIconosSharp.tsx` (Material). `NavHoy/NavDieta/NavRecetas/NavEntreno/NavDatos` son los de la barra inferior del cliente.
- `weight="fill"` / `"duotone"` (iconos de estado del dashboard) se pintan con un tinte suave en Hugeicons y con la variante rellena en Material.
- Generadores (solo locales, `salidas/27-10-2026_iconos/`): `gen.py` (Hugeicons), `gen_sharp.py` (Material), `mapa.py` y `tr.py` (equivalencias entre nombres). El código generado es la fuente de verdad; regenerar solo si se cambia una equivalencia.

## Elecciones concretas de la barra del portal cliente

| Pestaña | Hugeicons | Material Sharp |
|---|---|---|
| Hoy | `calendar-01` (calendario con «17») | `today` |
| Dieta | `rice-bowl-01` (cuenco de arroz) | tenedor y cuchillo finos de **Phosphor Light** (`fork-knife-light`, excepción a mano en `sharp-core.tsx`, decidido 27-10) |
| Recetas | `book-open-02` | `menu-book` |
| Entreno | `dumbbell-01` (mancuerna inclinada) | `fitness-center` |
| Datos | `analytics-up` | `bar-chart-4-bars` |

Pendiente de Carlos en esa barra: **Entreno**. Las pesas (mancuerna, barra, kettlebell) le parecen «las típicas de IA»; se le han enseñado ideas que no son una pesa (persona levantando barra, cronómetro, comba, zapatilla… en `salidas/27-10-2026_iconos/candidatos3-entreno-y-cubiertos.png`). Recomendado: persona con barra (mingcute `weightlifting-line`). Dieta decidida: cubiertos finos.

## Historial de lo probado (por orden) y por qué se descartó

Commits en `main` (nutricoach). Antes de empezar, la app usaba Phosphor y Lucide directamente (último commit sin tocar: `a36f56c5`).

| Commit | Qué | Veredicto de Carlos |
|---|---|---|
| `8fd9d554` | Set propio de línea fina con punto (barra inferior y entreno) | «Genérico» seguía; muy fino a 22 px |
| `ec75efbd` | Mismo set en el menú del coach | — |
| `e4fd695a` | Barra con formas geométricas (círculo, triángulo…) | «Demasiado ambiguos» |
| `32950a18` | Set macizo tipo estarcido (kettlebell, cuenco, libro, amanecer) | «Tan simples que no se sabe qué son» |
| `8af0a10b` | Hugeicons incrustados en los iconos propios | Mejor; la kettlebell no se entiende |
| `66cbbc8a` | **Toda la app** pasa a Hugeicons vía módulo de compatibilidad | «No está mal»; la barra del coach **le gusta bastante** |
| `bde8a6d1`, `5c76c6ba` | Entreno = mancuerna, Hoy = calendario, Dieta = cuenco de arroz | «Poco serios, desentonan con la app aunque nos vamos acercando» |
| (esta sesión) | Portal cliente prueba Material Light Sharp; coach conserva Hugeicons | pendiente de ver |

**Volver al estado anterior a todo esto:** `git revert` de los commits desde `8fd9d554` hasta el último de iconos (en orden inverso), o `git checkout a36f56c5 -- <fichero>` por fichero. Para recuperar solo Phosphor/Lucide originales en toda la app: `git checkout 66cbbc8a~1 -- app components lib hooks` es demasiado amplio; mejor cambiar los dos ficheros `lucide.tsx` y `phosphor.tsx` para que reexporten las librerías originales (siguen instaladas: `lucide-react` y `@phosphor-icons/react`) y deshacer los `import` con un `sed` inverso.

## Lo que se aprendió

- A 22 px, un icono macizo y esquemático (kettlebell, zapatilla) pierde los detalles que lo identifican; los **símbolos literales con algo de detalle** funcionan mejor que las formas abstractas.
- «Serio» en esta app = esquinas rectas y trazo fino y uniforme (como los rótulos mono y las tarjetas casi cuadradas), no iconos redondeados ni a color.
- Las **etiquetas de la barra inferior están ocultas** (`sr-only`); mostrarlas resolvería la ambigüedad con cualquier familia. No se ha probado.
- El buscador de Iconify limita por exceso de peticiones (error 429): pedir los iconos por lotes con `…/<set>.json?icons=a,b,c`.
- Un `for f in $variable` en zsh no separa por líneas y rompe con corchetes (`[id]`): leer ficheros con `while read`.

## Opciones consideradas (imágenes en `salidas/27-10-2026_iconos/`, solo local)

`comparativa-sets.png` y `comparativa-sets3.png` (Hugeicons, Solar, Game-icons, Fluent, Material Sharp, Ionicons), `candidatos.png` (alternativas de Hoy, Dieta y Entreno), `opciones-iconos*.png` (los sets propios descartados), `sharp-*.png` (hojas de contacto de Material Sharp).

- Otras familias vistas: **Solar** (macizo; licencia dudosa entre MIT y CC BY 4.0), **Game-icons** (siluetas detalladas, CC BY 3.0, estilo videojuego), **Streamline Plump** (sin iconos de entreno), **Fluent flat** (a color; fuera de estilo), **Ionicons Sharp** (macizo y pesado).

## Pendiente

1. Que Carlos vea la barra del cliente (Material Sharp) en el iPhone y decida: mantener, volver a Hugeicons o mezclar por icono.
2. Decidir Entreno (mancuerna vs barra con discos) y Dieta (cuenco vs cubiertos).
3. Probar etiquetas visibles bajo los iconos de la barra inferior.
4. Si se mantiene Material en el portal, comprobar que el trazo fino se lee a 22 px en el iPhone (la familia es muy ligera).
5. Los iconos de las pantallas compartidas del coach que no sean del portal siguen en Hugeicons; `PlanTimeline` y `PlantillaEntrenoSelector` son solo del coach.
