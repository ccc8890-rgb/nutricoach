# Traspaso a Codex — Informe del caso (10-10-2026)

**Qué es:** una función **de prueba** para que el coach pueda explicarle el caso a un cliente por chat, WhatsApp o llamada. Solo la ve el coach; el portal del cliente no cambia. Carlos aún no sabe cuántos formatos se quedan: está pensada para poder quitarse.

## Regla de oro
Los textos, el orden y las plantillas viven en **`lib/informe-caso/construir.ts`** (con `scripts/informe-caso.test.ts`). Los componentes solo pintan. Si cambias una palabra, hazlo ahí y actualiza el test. Todo número del mensaje y del guion tiene que salir de los datos: hay un test que lo comprueba.

## Dónde está
| Pieza | Archivo |
|---|---|
| Botón «Preparar conversación» y panel con 4 pestañas | `components/clientes/InformeCaso.tsx` (montado en la ficha, junto a «Planificar con IA») |
| Contenido (mensaje, guion, resumen, preguntas, «lo que no sé») | `lib/informe-caso/construir.ts` |
| Página imprimible (PDF) | `lib/informe-caso/html.ts` (`?formato=html` de la ruta) |
| Ruta | `app/api/clientes/[id]/informe-caso/route.ts` |

## Qué pulir
- **Panel con pestañas** (Mensaje, Guion, Resumen, PDF): móvil a 390 px, estado seleccionado, modo oscuro.
- **Botón «Copiar»**: estado «Copiado», tamaño táctil. El mensaje debe poder leerse y editarse antes de enviarlo.
- **Resumen:** jerarquía de «Dónde está», «Qué cambia», «Para decidir tú antes de hablar» y «Lo que no sé» (este último importante: evita afirmar lo que el sistema no ve).
- **Página para PDF:** el CSS de impresión es mínimo; mejorar tipografía y saltos de página.

## Qué NO cambiar sin avisar
- Las plantillas y su prioridad de escenarios (alerta > propuesta de bloque > ajustes > sin cambios).
- La sección «Lo que no sé».
- Que el mensaje no supere 700 caracteres y no lleve emojis.

## Cómo quitarlo
Borrar `lib/informe-caso/`, `app/api/clientes/[id]/informe-caso/`, `components/clientes/InformeCaso.tsx`, los cuatro tests `scripts/informe-caso*.test.ts`, `scripts/informe-caso-real.ts` y las dos líneas de `app/clientes/[id]/page.tsx` (el `dynamic` y `<InformeCaso …/>`).
