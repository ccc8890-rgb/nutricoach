# Planificar con IA — un solo punto de entrada para el plan de entreno

Fecha: 10-10-2026 · Estado: pendiente de revisión de Carlos · Ruta: arquitectónica

## 1. Problema
Para crear o cambiar el plan de entreno de un cliente hay hoy seis puertas con efectos distintos:

| Dónde | Botón | Efecto |
|---|---|---|
| Ficha → Plan activo | Regenerar | Abre `revisar-plan`, que regenera el plan **completo** (nutrición + entreno) con `generar-plan-inicial` |
| Ficha → Plan activo | Plantilla | Asigna una plantilla fija (`/api/plantillas-entreno/[id]/asignar`), sin IA |
| Ficha → Plan activo | Nuevo plan | Editor manual (`/entrenos/nueva`) |
| Ficha → «Panel IA» (plegado) | Generar siguiente bloque | `proponer-plan-ciencia` (solo clientes híbridos) |
| `revisar-plan` | Proponer plan IA | `proponer-plan-ciencia` otra vez |
| Rendimiento | Aplicar semana | Cambia pasos de sesiones existentes |

Además `proponer-plan-ciencia` **desactiva el plan activo y guarda el nuevo al instante**, sin aprobación previa. Con un motor cuyas reglas el coach aún está validando, esto es arriesgado.

## 2. Objetivo y criterios de éxito
Intención de Carlos: «la IA ayuda al máximo en todo; por separado no tiene sentido»; el coach solo aprueba.

- Un único botón **«Planificar con IA»** para el plan de entreno de un cliente.
- Toda salida de la IA es una **propuesta** que el coach aprueba; el plan actual no cambia hasta entonces.
- Las propuestas aparecen en el sitio donde ya se aprueban las decisiones de IA, y alimentan el aprendizaje existente.
- El motor (esqueleto del macrociclo, fundamentos, validador, vallas de la IA) no cambia; solo se reorganiza quién lo llama.
- Plantilla, editor manual y abrir plan siguen existiendo, en un menú secundario.

Fuera de alcance: nutrición (su regeneración queda aparte), alta de clientes nuevos (`revisar-plan` como flujo de onboarding), panel de Rendimiento, estética (la lleva Codex).

## 3. Diseño

### 3.1 Decisión de modo (función pura, testeable)
`decidirModoPlanificacion(estado)` devuelve el modo según el plan activo del cliente:

| Situación | Modo | Qué hace |
|---|---|---|
| Sin plan activo | `crear` | Genera el primer bloque |
| Quedan ≤ 7 días del bloque, o el bloque ya acabó | `siguiente_bloque` | Genera el bloque siguiente (híbrido: rotación Base→Fuerza→Resistencia→Deload; resto: nuevo plan con el esqueleto del macrociclo) |
| A mitad de bloque | `ajustar` | No sustituye el plan: ejecuta ahora el análisis de rendimiento existente y propone ajustes. Si no hay datos suficientes del reloj, devuelve `sin_datos` con el motivo y no propone nada |

El estado se calcula con `calcularEstadoBloque` (ya existe, `lib/entrenos/bloques.ts`). El botón muestra el modo previsto antes de pulsar («Siguiente bloque: Base · el actual acaba en 3 días»).

### 3.2 Servicio y ruta
- `lib/entrenos/planificar-con-ia.ts` → `planificarConIA(db, { clienteId, coachId })`:
  1. Lee el estado y decide el modo.
  2. `crear` / `siguiente_bloque`: llama al **mismo núcleo generador** que hoy vive dentro de `proponer-plan-ciencia` (extraído a `lib/entrenos/generar-plan-ia.ts`: arma el contexto, el esqueleto, el prompt, llama a DeepSeek, parsea y valida). **No guarda el plan.**
  3. Guarda una tarea en `agente_tareas` (`tipo: 'plan_entreno_ia'`, `estado: 'pendiente'`, `agente: 'planificador'`) con el payload descrito en 3.3.
  4. `ajustar`: reutiliza el servicio de análisis de rendimiento (`analisis_rendimiento`) y devuelve la tarea que cree.
- `POST /api/entrenos/planificar-ia` `{ cliente_id }` → `{ modo, tarea_id | null, resumen, motivo? }`. Autenticación de coach + `autorizarCoachCliente`; límite de 5 peticiones/min (el que ya usa el generador); respuesta 409 si ya hay una tarea `plan_entreno_ia` pendiente del mismo cliente (evita duplicados).
- `GET /api/entrenos/planificar-ia?cliente_id=…` → `{ modo, etiqueta }` para pintar el texto bajo el botón.
- `proponer-plan-ciencia` pasa a ser una capa fina sobre el núcleo (o se retira cuando nadie la llame; decisión en el plan de implementación). Sus tests y el validador se conservan.

### 3.3 Payload de la tarea `plan_entreno_ia`
```
{ modo, fase_bloque, plan: <JSON de la IA>, macrociclo: <esqueleto, fundamentos, avisos, supuestos, datos que faltan>,
  validacion: <hallazgos del validador>, contexto: { modalidad, vdot, minutosReales }, generado_en }
```
`propuesta` (texto corto para la tarjeta): «Bloque Base · 3 carreras (100 min/sem) + 3 de fuerza · 2 avisos del validador». `razonamiento` y `fuentes`: los fundamentos con su tipo.

### 3.4 Aprobación
`aplicarTarea` gana el caso `plan_entreno_ia` → `aplicarPlanEntrenoIA(db, tarea)`:
1. Valida el payload (plan con sesiones, cliente del coach, sin otro plan creado desde la propuesta).
2. Llama a `guardarPlanEntreno(db, …)` (extraída del código de guardado actual): desactiva los planes previos del cliente, crea el plan, las sesiones y los ejercicios vinculados con `matchEjercicio`, y devuelve el id.
3. Si algo falla a mitad, borra lo creado y deja el plan anterior activo (misma garantía que el resto de `aplicar*`); guarda `error_aplicacion`.
Rechazar o editar una propuesta usa el flujo y el aprendizaje que ya existen (`agente_aprendizaje`).

### 3.5 Interfaz (estructura; el acabado visual lo hace Codex)
- Ficha → Plan activo: un botón primario **«Planificar con IA»** con su línea de modo, el menú «Más opciones» (Plantilla, Nuevo plan, Abrir plan) y el listado de «Decisiones de IA pendientes» ya existente, donde cae la propuesta. Se retiran «Regenerar» (del plan de entreno) y el panel plegado `GenerarBloqueHibridoPanel`.
- La tarjeta de la propuesta debe mostrar mínimo: resumen, esqueleto semana 1, hallazgos del validador y los fundamentos con su insignia (estudio / libro / criterio). Un componente nuevo y sencillo `PropuestaPlanEntreno`; Codex lo pule.
- `revisar-plan` (onboarding de cliente nuevo): su «Proponer plan IA» llama al mismo endpoint.

### 3.6 Errores y seguridad
- Fallo de IA o JSON inválido: no se crea tarea, se devuelve el error genérico (sin `err.message`) y el plan no cambia.
- Sin datos del reloj en `ajustar`: respuesta `sin_datos`, nunca se inventa un ajuste.
- La ruta exige rol coach y propiedad del cliente; la aprobación pasa por `PATCH /api/agentes/tareas` (ya protegido).
- Sin migraciones: `agente_tareas.tipo` es texto libre (comprobado con tipos nuevos anteriores); se verifica con una inserción de prueba que se borra.

## 4. Pruebas
- `decidirModoPlanificacion`: sin plan, bloque que acaba, bloque terminado, a mitad, plan sin duración, cliente híbrido y no híbrido.
- Construcción del payload y de la tarea (cliente falso de Supabase, como `contenido-piezas-db.test.ts`): una sola tarea pendiente por cliente, 409 si ya existe.
- `aplicarPlanEntrenoIA`: crea plan y sesiones, desactiva el anterior, vincula ejercicios, revierte si falla a mitad, rechaza payload inválido y no se aplica dos veces.
- Regresión: el núcleo extraído produce el mismo prompt y el mismo esqueleto que `proponer-plan-ciencia` actual (test con salida de DeepSeek simulada).
- Se añaden los tests nuevos a `npm run verificar:motor`.

## 5. Riesgos y decisiones abiertas
- **Extraer el núcleo del generador** toca la ruta más delicada; se hace con el test de regresión primero.
- **Modo `ajustar`** depende de que haya datos suficientes; con clientes sin reloj el botón dirá «sin datos» y ofrecerá esperar o usar plantilla.
- La propuesta es larga para una tarjeta; la vista detallada la define Codex.
- Pendiente de decidir en el plan: retirar `proponer-plan-ciencia` o dejarla como alias.
