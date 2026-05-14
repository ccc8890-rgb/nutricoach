# CHANGELOG — Adaptación móvil + BackButton + Merge a main

## Fecha
2026-05-12

---

## 1. Adaptación móvil para iPhone

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| [`app/globals.css`](../app/globals.css) | Sección responsive completa: 3 breakpoints iPhone (375px, 430px, 768px), utilidades móviles (`.bottom-nav`, `.sheet-mobile`, `.stack-mobile`, `.pb-nav-safe`, `.fab`, `.hide-scrollbar`, etc.), touch targets Apple HIG, safe areas, landscape mode, `prefers-reduced-motion` |
| [`app/layout.tsx`](../app/layout.tsx) | `Viewport` export con `viewportFit: "cover"`, `maximumScale: 1`; `appleWebApp` metadata (PWA); `themeColor` dark/light; `WebkitTapHighlightColor`, `overscrollBehavior` |
| [`public/manifest.json`](../public/manifest.json) | `display: standalone`, `orientation: portrait`, `status_bar: black-translucent` |
| [`next.config.ts`](../next.config.ts) | `Service-Worker-Allowed` header, manifest caching |
| [`components/Sidebar.tsx`](../components/Sidebar.tsx) | Bottom tab bar con 5 ítems (Inicio, Consulta, Clientes, Dietas, Recetas) + bottom sheet para "Más" con navegación completa. Hamburguesa movida de `left-4` a `right-4` |
| [`components/ui/Modal.tsx`](../components/ui/Modal.tsx) | Full-screen bottom sheet en móvil, iOS handle, sticky footer |

### Layouts con `pb-nav-safe`

- [`app/dashboard/layout.tsx`](../app/dashboard/layout.tsx)
- [`app/clientes/layout.tsx`](../app/clientes/layout.tsx)
- [`app/dietas/layout.tsx`](../app/dietas/layout.tsx)
- [`app/precios/layout.tsx`](../app/precios/layout.tsx)
- [`app/entrenos/layout.tsx`](../app/entrenos/layout.tsx)
- [`app/cuestionarios/layout.tsx`](../app/cuestionarios/layout.tsx)
- [`app/conocimiento/layout.tsx`](../app/conocimiento/layout.tsx)
- [`app/respuestas/layout.tsx`](../app/respuestas/layout.tsx)
- [`app/recetas/layout.tsx`](../app/recetas/layout.tsx)

### Páginas con ajustes responsive

- [`app/dashboard/page.tsx`](../app/dashboard/page.tsx) — Header `stack-mobile`, botones compactos
- [`app/clientes/page.tsx`](../app/clientes/page.tsx) — Header `stack-mobile`, botones compactos
- [`app/login/page.tsx`](../app/login/page.tsx) — Espaciado reducido, logo responsive
- [`app/page.tsx`](../app/page.tsx) — Botón full-width en móvil
- [`components/PortalCliente/DashboardCliente.tsx`](../components/PortalCliente/DashboardCliente.tsx) — Safe areas, header responsive, tabs compactos
- [`app/cliente/page.tsx`](../app/cliente/page.tsx) — `pt-safe`, responsive sizing

---

## 2. Botón de retroceso (BackButton)

### Nuevo archivo
- **`components/BackButton.tsx`** — Botón fijo `top-4 left-4` con glass style, `ChevronLeft` icon, visible solo en móvil (`lg:hidden`). Usa `router.back()` por defecto o acepta `href` prop.

### Páginas con BackButton

| Archivo | href |
|---------|------|
| [`app/clientes/[id]/page.tsx`](../app/clientes/[id]/page.tsx) | `/clientes` |
| [`app/recetas/[id]/page.tsx`](../app/recetas/[id]/page.tsx) | `/recetas` |
| [`app/dietas/[id]/page.tsx`](../app/dietas/[id]/page.tsx) | `/dietas` |
| [`app/entrenos/[id]/page.tsx`](../app/entrenos/[id]/page.tsx) | `/entrenos` |
| [`app/recetas/[id]/editar/page.tsx`](../app/recetas/[id]/editar/page.tsx) | `/recetas/${id}` |

Cada página tiene `pt-16 lg:pt-8` para evitar solapamiento con el botón fijo.

---

## 3. Merge feature/ui-estetica → main

### Conflictos resueltos (~25 archivos)
- **`AA` (add/add)**: 12 archivos (layouts, Modal, manifest, scripts) → resueltos con `--ours` (nuestra versión móvil)
- **`UU` (content)**: 13 archivos (globals.css, layout.tsx, Sidebar.tsx, páginas, next.config, scrape-receta route) → resueltos con `--ours` (nuestra versión móvil)
- **Scripts nuevos de `main`**: 11 scripts de scraping y fixes de ingredientes preservados

### Commits
```
eb28208 merge: pull main into feature/ui-estetica (resolve conflicts)
1b604a8 fix: use correct variable name 'id' instead of 'params' in BackButton href
74ea79e feat: add BackButton component to detail pages & move hamburger to right side
```

### Deploy
- URL: https://nutricoach-ui.vercel.app
- Estado: ✅ Ready (200 OK)
- Build: Next.js 16.2.4, Turbopack, 77 rutas generadas
