# Bloques configurables en sesiones de entrenamiento

**Fecha:** 09-10-2026
**Estado:** propuesta para revisión

## Objetivo

Dar estructura visual y operativa a cada sesión sin imponer bloques innecesarios. La IA propone calentamiento, movilidad, pliometría, trabajo principal, accesorios y vuelta a la calma cuando correspondan; el coach decide la composición final para cada cliente y cada día.

Además, evitar la repetición entre la etiqueta de modalidad y el nombre de la sesión. Si la interfaz ya muestra `HÍBRIDA`, el título visible debe ser `SkiErg + fuerza de tren superior`, no `Híbrida: SkiErg + fuerza de tren superior`.

## Principios

1. Ningún bloque es obligatorio por interfaz.
2. Solo se muestran bloques que contienen ejercicios.
3. La IA propone; el coach confirma o modifica.
4. La elección se realiza por ejercicio, lo que permite adaptar cada sesión al cliente, día, fase, lesiones y objetivo.
5. Los planes existentes continúan funcionando sin edición manual.
6. La estructura debe ser igual en editor coach, Hoy, Semana, Mes y ejecución de sesión.

## Modelo de datos

Añadir a `sesion_ejercicios` una columna `bloque` de texto con valor por defecto `principal` y una restricción para estos valores:

- `calentamiento`
- `movilidad`
- `pliometria`
- `principal`
- `accesorios`
- `vuelta_calma`

La migración asignará `principal` a los registros actuales. No se añade configuración redundante a `sesiones_entrenamiento`: la presencia de ejercicios clasificados determina qué bloques existen en cada sesión.

El orden visual estable de bloques será el listado anterior. Dentro de cada bloque se conservará `sesion_ejercicios.orden`.

## Editor del coach

Cada tarjeta de ejercicio incluirá un selector compacto de bloque. Al cambiarlo:

- se persiste el nuevo valor;
- la tarjeta se mueve al grupo correspondiente;
- se mantiene un orden coherente dentro del grupo;
- el cambio queda reflejado inmediatamente en el portal cliente.

El editor mostrará encabezados para los bloques presentes. No mostrará interruptores globales ni secciones vacías. Para incorporar un bloque, el coach asigna uno o más ejercicios a ese bloque; para eliminarlo, reasigna o elimina sus ejercicios.

El sistema actual de arrastrar y soltar seguirá reordenando ejercicios dentro del bloque. Mover entre bloques se hará inicialmente mediante el selector, evitando ampliar en esta fase la complejidad del drag-and-drop.

## Generación con IA

El contrato JSON de cada ejercicio incorporará `bloque`. El generador deberá crear ejercicios reales para calentamiento y vuelta a la calma en vez de esconderlos en las notas del primer ejercicio.

Reglas de decisión:

- `calentamiento`: recomendado cuando exista trabajo principal; específico a la sesión.
- `movilidad`: solo cuando mejore la preparación para el patrón del día, exista una limitación relevante o sea una sesión de recuperación.
- `pliometria`: solo con objetivo de potencia, economía de carrera o preparación específica, y si nivel, fatiga y lesiones lo permiten.
- `principal`: contiene el estímulo prioritario de la sesión.
- `accesorios`: complementos que no deben competir con el trabajo principal.
- `vuelta_calma`: cuando aporte valor por intensidad o tipo de trabajo; no se añadirá como relleno.

El backend validará los valores recibidos. Un valor ausente o inválido se normalizará a `principal` para no perder ejercicios.

## Presentación al cliente

Las listas de ejercicios se agruparán por bloque y mostrarán un encabezado editorial en mayúsculas, con la tipografía monoespaciada ya usada en Training. Los ejercicios conservarán numeración, detalle desplegable y estado completado.

La numeración será continua durante toda la sesión, no se reiniciará en cada bloque. Esto mantiene una referencia inequívoca para coach y cliente.

La ejecución móvil mostrará el nombre del bloque al entrar en el primer ejercicio de cada grupo. No añadirá pantallas intermedias obligatorias.

## Limpieza de títulos

La interfaz eliminará solo al mostrar prefijos iniciales equivalentes a la modalidad actual, por ejemplo:

- `Híbrida: SkiErg + fuerza` → `SkiErg + fuerza`
- `Carrera — Series cortas` → `Series cortas`
- `Mixta: Fuerza + carrera` → `Fuerza + carrera`

No se modificarán los nombres guardados en base de datos durante esta fase. La limpieza será conservadora y no eliminará palabras internas necesarias, como `Carrera + SkiErg combinado`.

## Compatibilidad y seguridad

- Los registros antiguos reciben `principal` mediante migración y valor por defecto.
- APIs que no soliciten `bloque` seguirán funcionando.
- El selector del coach reutilizará la autorización existente del editor; la actualización debe quedar limitada a planes propiedad del coach autenticado.
- No se expondrá ninguna operación nueva mediante escritura directa desde el navegador sin verificación de propiedad en servidor.

## Verificación

1. Pruebas unitarias para normalización, etiquetas, orden de bloques y limpieza conservadora de títulos.
2. Prueba de API: un coach solo puede cambiar bloques de ejercicios pertenecientes a sus planes.
3. Prueba del generador: valores ausentes o inválidos terminan en `principal`.
4. Prueba de interfaz coach: cambiar el selector reagrupa el ejercicio.
5. Prueba de interfaz cliente: no aparecen bloques vacíos y la numeración es continua.
6. Comprobación manual móvil de Hoy, Semana, Mes y ejecución.
7. ESLint, TypeScript y build completo antes de desplegar.

## Fuera de alcance

- Crear recomendaciones clínicas automáticas nuevas.
- Convertir el editor en un constructor completo de ejercicios si todavía no existe esa capacidad.
- Drag-and-drop entre bloques en esta primera versión.
- Reclasificar automáticamente todo el historial mediante inferencia de nombres.
