# Dashboard Radar Polish - Diseño

Fecha: 05-06-2026
Proyecto: Casanova Nutrition / NutriCoach
Estado: aprobado por Carlos

## Objetivo

Pulir `/dashboard` para que sea la pantalla principal del coach: una vista de pajaro del trabajo diario y semanal, con foco en revisar, editar si hace falta y aprobar el trabajo ya preparado por IA.

La IA no debe mostrarse como un sistema tecnico de agentes. Debe sentirse como trabajo preparado: propuestas, alertas, ajustes y tareas listas para revision del coach.

## Direccion aprobada

Se implementa una mezcla A+C:

- A: Radar diario operativo como pantalla principal.
- C: Patron de revision asistida dentro de las tareas: ver propuesta, cambiar lo minimo y aprobar desde la ruta adecuada.

## Cambios de UX

1. El primer bloque visible sera una cola priorizada de acciones.
2. La cabecera dira `Radar diario`, no `Dashboard`.
3. Los textos deben responder: quien, que pasa, que toca hacer.
4. La seccion IA se renombra hacia lenguaje operativo: `Trabajo preparado por IA`.
5. La vista semanal queda debajo como contexto, no compite con la cola diaria.
6. La pestana `Negocio` se mantiene separada para pagos, renovaciones e ingresos.

## Cambios visuales

1. Subir contraste de textos secundarios en claro y oscuro.
2. Reducir texto debil o demasiado pequeno en filas principales.
3. Usar listas densas con separadores y rail de severidad antes que tarjetas decorativas.
4. Mantener paleta acromatica y estados semanticos existentes.
5. Evitar graficos decorativos y mantener numeros tabulares.

## Fuera de alcance

- Nuevas migraciones.
- Nuevas APIs de aprobacion directa.
- Cambios profundos en `/agentes` o `/entrenos/brain-ia`.
- Redisenar todas las pantallas del producto en esta pasada.

## Verificacion

- `npm run lint`
- `npm run build`
- Revisar `/dashboard` en modo claro y oscuro.
- Verificar que los textos secundarios no quedan demasiado apagados.
