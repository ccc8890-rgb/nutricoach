# Informe del caso — material para que el coach explique el caso al cliente

Fecha: 10-10-2026 · Estado: pendiente de revisión de Carlos · Ruta: arquitectónica · **Versión de prueba, diseñada para poder quitarse**

## 1. Para qué
Carlos quiere poder **explicarle a un cliente su caso** por chat, WhatsApp o llamada sin juntar datos de varios paneles. Necesita tener a mano el resumen detallado, cómo contárselo y un mensaje listo. **Solo lo ve el coach**: no es una pantalla del portal del cliente (eso se valorará en el futuro). Carlos no está seguro de cuántos formatos hacen falta: es una prueba para ver qué se queda y qué se quita.

## 2. Alcance de la v1
- **Entrenamiento y rendimiento** (carga, cumplimiento, plan activo, análisis, propuesta pendiente). El modelo se organiza en secciones para añadir después nutrición y check-ins.
- **Cuatro formatos**, que son cuatro lecturas del mismo informe: **Mensaje** (chat/WhatsApp), **Guion de llamada**, **Resumen detallado** y **PDF** (página imprimible).
- **Fuera de alcance:** enviar mensajes por su cuenta, adaptar el tono a los mensajes del coach, mostrar nada al cliente, nutrición y check-ins, un PDF generado como archivo.

## 3. Principio: no inventar
Nada lo escribe una IA libre. El informe sale de **plantillas con datos reales** y cada número que aparece tiene que venir de los datos (hay un test que lo comprueba). Lleva una sección **«Lo que no sé»** (por ejemplo: sin registro de fuerza, sin VDOT, sin datos del reloj) para que el coach no afirme algo que el sistema no ve.

## 4. Diseño

### 4.1 Módulo de contenido (puro y probado)
`lib/informe-caso/construir.ts` → `construirInformeCaso(datos: DatosInforme): InformeCaso`.

`DatosInforme` (lo reúne la ruta, ya existe cada pieza):
- `nombre` del cliente (solo el nombre de pila se usa en los textos);
- `estado` del atleta (`EstadoAtleta` de `lib/rendimiento/estado.ts`: minutos y salidas por semana, reparto de intensidad, forma y fatiga, ejecución, retorno, alertas, perfil);
- `plan` activo `{ nombre, created_at, duracion_semanas, sesiones }` y su avance (`calcularEstadoBloque`);
- `analisis` más reciente (payload de `analisis_rendimiento`: resumen, decisiones, alerta prioritaria, preguntas);
- `propuesta` pendiente (`PayloadPlanEntrenoIA`) si existe.

`InformeCaso`:
```
{ cliente, generadoEn, escenario,
  situacion: { titulo, datos: { etiqueta, valor }[] },      // dónde está el cliente
  plan: { nombre, bloque, semana },                          // qué lleva
  cambios: string[],                                         // qué cambia y qué se queda igual
  porQue: { texto, origen }[],                               // de dónde sale (estudio / libro / criterio)
  loQueNoSe: string[],
  mensaje: string,                                           // chat / WhatsApp
  guion: { paso, texto }[],                                  // llamada
  preguntas: string[] }
```

### 4.2 Escenarios (cambian el texto)
Por orden de prioridad: **alerta** (alerta prioritaria del análisis o alerta alta del estado) → **propuesta_bloque** (hay una propuesta de plan pendiente) → **ajustes** (el análisis propone cambios) → **sin_cambios**. Cada uno tiene su plantilla de mensaje y de guion (saludo, cómo va, qué cambia y por qué, qué le pides, cierre). El mensaje es breve (≤ 700 caracteres), en primera persona del coach, tuteo, sin emojis.

### 4.3 Ruta
`GET /api/clientes/[id]/informe-caso` → JSON del informe; `?formato=html` → página imprimible (con `escapeHtml`, misma técnica que `plan-pdf`). Exige sesión y que el cliente sea del coach (`autorizarCoachCliente`); errores genéricos.

### 4.4 Interfaz (estructura; el acabado lo pule Codex)
`components/clientes/InformeCaso.tsx`: botón **«Preparar conversación»** junto a «Planificar con IA» que abre un panel con cuatro pestañas (Mensaje, Guion, Resumen, PDF) y un botón **«Copiar»** en el mensaje y en el guion. La pestaña PDF abre `?formato=html` en una pestaña nueva. Nada se envía solo.

### 4.5 Para poder quitarlo
Todo vive en `lib/informe-caso/`, `app/api/clientes/[id]/informe-caso/`, `components/clientes/InformeCaso.tsx` y una línea en la ficha. Quitar la función = borrar esos tres lugares y esa línea.

## 5. Pruebas
- Cada escenario produce su mensaje y su guion (casos con datos reales de Carlos: sin cambios, con ajustes, con propuesta, con alerta).
- **Todo número del mensaje y del guion aparece en los datos de entrada** (propiedad).
- Datos faltantes (sin reloj, sin plan, sin análisis) → no revienta y lo declara en «Lo que no sé».
- El HTML escapa el contenido; la ruta devuelve 401/403 sin permiso.
- Se añaden al `verificar:motor`.

## 6. Riesgos
- Que los textos no suenen como Carlos: es una prueba; se ajusta con su opinión.
- Que alguien copie algo que no debía: el informe lleva siempre «Lo que no sé» y la propuesta pendiente se marca como tal («te propongo», no «hemos cambiado»).
