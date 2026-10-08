# Ajustes del coach: sustituye a «Sistema»

Fecha: 08-10-2026 · Estado: implementado y en producción (ec5f9a1)

## Objetivo

Un único sitio para lo que no es trabajo con clientes: cuenta, parámetros de la app y método del coach. Hoy «Sistema» (`/sistema`) solo enlaza a tres pantallas de trabajo y los ajustes de cuenta están sueltos en el pie del menú (`components/Sidebar.tsx`: «Cambiar contraseña», «Cerrar sesión», interruptor de tema).

## Alcance de la primera versión

Ruta nueva `/ajustes`, con cuatro secciones:

1. **Cuenta**: nombre, apellidos y teléfono editables (columnas existentes de `profiles`); correo en solo lectura; cambiar contraseña dentro de la pantalla (misma lógica que `app/nueva-contrasena/page.tsx`, mínimo 8 caracteres y repetir); cerrar sesión.
2. **Apariencia**: claro u oscuro (no hay modo automático: `ThemeProvider` solo conoce esos dos).
3. **Seguridad**: «Cerrar sesión en todos los dispositivos» (`supabase.auth.signOut({ scope: 'global' })`) con confirmación.
4. **Método y conocimiento**: tarjetas hacia Metodología (`/coach/metodologia`), Base de conocimiento (`/conocimiento`) y Cuestionarios (`/cuestionarios`). Esas rutas no se mueven ni se reescriben.

## Fuera de alcance (a propósito)

Mi negocio (nombre comercial, logo, firma de emails), Notificaciones, Integraciones, exportar datos. No hay tabla de ajustes y el nombre de marca está escrito a mano en ~11 archivos; centralizarlo es un trabajo aparte. Se añaden cuando haya un uso real.

## Navegación

- Menú lateral: se quita el módulo «Sistema» (`CONOCIMIENTO_ITEMS` y su sección). Pie del menú: **Ajustes** y **Cerrar sesión**. «Cambiar contraseña» deja el pie y vive en Ajustes.
- `/sistema` redirige a `/ajustes`.
- Las tres rutas de «Método y conocimiento» marcan **Ajustes** como activo en el menú.
- **Cambio pedido por Carlos:** todo en una sola página con las secciones apiladas (sin submenú lateral), y «Cerrar sesión» arriba, en la cabecera de la cuenta, para no tener que bajar.
- `/nueva-contrasena` se queda tal cual (la usa el enlace de recuperar contraseña por correo).

## Datos y seguridad

- Sin migraciones. `GET/PATCH /api/ajustes/perfil` comprueba la sesión y actualiza solo el `profiles` del propio usuario con el `id` de la sesión (nunca uno recibido del cliente), con service role. Validación en `lib/ajustes/perfil.ts` (test `scripts/ajustes-perfil.test.ts`).
- Validación: nombre no vacío y máximo 80 caracteres, teléfono con formato razonable o vacío.
- El rol (`role`) no se puede tocar desde esta pantalla.

## Estética

Sin rediseño. Usa las variables CSS y patrones que ya hay (tarjetas como `app/sistema/page.tsx`). La parte visual la afina Codex.

## Verificación

1. `tsc` y `npm run build` limpios.
2. `/ajustes` carga como coach en producción y a 390 px, claro y oscuro, sin scroll horizontal.
3. `/sistema`, `/coach/metodologia`, `/conocimiento` y `/cuestionarios` siguen cargando.
4. Guardar nombre y teléfono persiste tras recargar (se restaura el valor original después).
5. Cambiar contraseña: se prueba el formulario con validaciones; la contraseña real solo se cambia si Carlos lo pide.
6. Un cliente (rol `cliente`) no accede a `/ajustes` del coach.
