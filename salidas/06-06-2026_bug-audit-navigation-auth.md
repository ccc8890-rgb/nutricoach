# Auditoria de bugs: navegacion y acceso coach

Fecha: 06-06-2026
Proyecto: NutriCoach

## Contexto

Tras mejorar la fluidez entre modulos, se reviso el codigo tocado para detectar bugs introducidos o riesgos colaterales.

## Bug encontrado

`components/CoachShell.tsx` validaba el acceso coach con una condicion demasiado permisiva:

- Si existia usuario autenticado.
- Si la query a `profiles` fallaba o no devolvia perfil con rol.
- Entonces el shell acababa devolviendo acceso coach por defecto.

Antes era un riesgo acotado a cada montaje. Tras introducir cache de acceso para mejorar fluidez, esa decision podia quedar memorizada durante la sesion del navegador.

## Correccion aplicada

El shell ahora solo concede acceso coach si `profiles.role === 'coach'`.

Si `profiles` falla, no existe o el rol no es coach, se redirige fuera del panel coach.

## Verificacion pendiente en esta pasada

- ESLint de archivo tocado.
- Build completo.
- Commit y push a `main`.

## Siguiente mejora

Revisar paginas con carga propia de datos (`/dietas`, `/clientes`, entrenamiento) para separar:

- Navegacion instantanea del shell.
- Estados de carga internos por modulo.
- Datos cacheables via API o helpers comunes.
