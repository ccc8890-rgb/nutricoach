# Spec: Lista de la Compra con Comparativa de Precios

**Fecha:** 09-05-2026  
**Proyecto:** NutriCoach — worktree `nutricoach-modulos/`  
**Estado:** Aprobado por Carlos

---

## Problema

La base de datos de alimentos mezcla dos tipos de entradas sin distinguirlos:
- Alimentos genéricos (pechuga de pollo, arroz, brócoli) — macros iguales en cualquier supermercado
- Productos de marca o procesados (patatas fritas Hacendado, tortitas Lidl) — macros propios, precio concreto

El scraper de Mercadona creó ~550 entradas nuevas en `alimentos` para productos que no casaron con ningún genérico existente, dejando duplicados con macros=0 y precios huérfanos. Resultado: el escandallo de recetas no muestra precios aunque los datos están en la BD.

Adicionalmente, no existe en el portal del cliente una lista de la compra semanal que agregue ingredientes y permita comparar precios por supermercado para elegir dónde comprar cada cosa.

---

## Objetivos

1. Distinguir alimentos genéricos de productos de marca en la BD
2. Limpiar duplicados y ligar los precios existentes a los genéricos correctos
3. Añadir lista de la compra semanal agregada con selección de tienda por ingrediente
4. Guardar las elecciones del cliente para que el coach vea sus hábitos de compra
5. Preparar la base para analytics de compra (fase 2)

---

## Modelo de datos

### Cambios en tabla `alimentos`

```sql
ALTER TABLE public.alimentos ADD COLUMN es_generico boolean NOT NULL DEFAULT false;
```

- `es_generico = true`: alimentos BEDCA, genéricos curados (pechuga de pollo, arroz, brócoli...)
- `es_generico = false`: productos de marca o procesados con macros propios (patatas fritas Hacendado...)
- Los 77 alimentos BEDCA originales → `es_generico = true`
- Los alimentos curados con macros reales → `es_generico = true`
- Los creados por el scraper con macros=0 → serán deduplicados o marcados como `false`

### Script de deduplicación

Identifica pares donde:
- Alimento A: tiene macros > 0, `es_generico` pendiente
- Alimento B: mismo nombre (o similar), macros = 0, tiene precio en `productos_supermercado`

Acción: transfiere los precios de B al `alimento_id` de A, elimina B, marca A como `es_generico = true`.

Los casos ambiguos (similitud baja, múltiples candidatos) se vuelcan a una tabla `dedup_revision` para revisión manual vía `AdminPrecios`.

### Nueva tabla `selecciones_lista_compra`

```sql
CREATE TABLE public.selecciones_lista_compra (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id      uuid REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  plan_id         uuid NOT NULL,  -- FK a dietas o planes según schema activo (confirmar en implementación)
  alimento_id     uuid REFERENCES public.alimentos(id) ON DELETE CASCADE NOT NULL,
  supermercado_id uuid REFERENCES public.supermercados(id) ON DELETE SET NULL,
  producto_nombre text,        -- nombre exacto del producto elegido
  precio_por_kg   numeric(10,4),
  url_producto    text,
  semana_inicio   date NOT NULL, -- lunes de la semana a la que pertenece
  seleccionado_por text CHECK (seleccionado_por IN ('coach', 'cliente')) DEFAULT 'cliente',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (cliente_id, plan_id, alimento_id, semana_inicio)
);
```

- Un registro por alimento por semana por plan
- `seleccionado_por` permite al coach ver si el cliente cambió lo que él puso
- `UNIQUE` garantiza una sola selección activa por ingrediente/semana

### Normalizador mejorado

Al scrapear nuevos productos:
- Si match con genérico existente (confianza ≥ fuzzy) → insertar precio en `productos_supermercado` con el `alimento_id` del genérico. No crear nuevo alimento.
- Si no hay match Y el producto parece genérico (sin marca en el nombre) → crear alimento con `es_generico = true`, macros=0, encolar en enriquecimiento IA.
- Si no hay match Y el producto es claramente de marca/procesado → crear alimento con `es_generico = false`, macros=0, encolar enriquecimiento.

---

## UI — Lista de la compra semanal

### Dónde vive

- **Coach:** página `/dietas/[id]` → pestaña "Lista de la compra"
- **Cliente:** portal `/mi-plan` → sección "Lista de la compra"

### Cálculo semanal

Agrega todos los ingredientes de todas las recetas del plan activo para la semana seleccionada:
- Suma cantidades del mismo alimento aunque aparezca en múltiples recetas/comidas
- Resultado: lista única de alimentos con gramos totales necesarios esa semana

### Estructura de cada ingrediente en la lista

```
[Emoji categoría] Pechuga de pollo          1.200 g
  ├─ 🟢 Mercadona  · Hacendado pechuga entera · 7,20 €/kg · 8,64 € ← más barato
  ├─    Carrefour  · Pechuga pollo fresca      · 7,80 €/kg · 9,36 €
  └─    Lidl       · Pechuga de pollo          · 6,90 €/kg · 8,28 € [SELECCIONADO ✓]
```

- Por defecto se muestra contraído con el precio más barato disponible
- Al expandir aparecen todas las opciones con nombre del producto, precio/kg y coste para la cantidad necesaria
- La opción seleccionada queda marcada y se guarda en `selecciones_lista_compra`
- Si no hay precios para ese alimento: se muestra el ingrediente normal sin opciones, icono ⬜ discreto
- Productos procesados/marca (`es_generico = false`): solo tienen un precio (el de su supermercado), no comparativa

### Resumen al final de la lista

Bloque agrupado por supermercado con los ingredientes asignados a cada uno y el coste parcial:

```
📦 Resumen por supermercado

Mercadona       pollo, arroz, huevos, leche...     28,40 €
Lidl            tortitas, yogur griego...            9,20 €
Sin tienda asignada  aceite AOVE, sal...              —

Coste total estimado: 37,60 €
Ahorro vs. comprar todo en el super más caro: 2,80 €
```

### Comportamiento coach vs cliente

| Acción | Coach | Cliente |
|--------|-------|---------|
| Ver lista de la compra | ✅ | ✅ |
| Elegir supermercado por ingrediente | ✅ | ✅ |
| Cambiar elección del otro | ✅ coach puede fijar | ✅ cliente puede cambiar |
| Ver quién eligió qué | ✅ columna `seleccionado_por` | ❌ |

El coach puede fijar una selección para el cliente desde su vista. Si el cliente la cambia, se actualiza `seleccionado_por = 'cliente'`. El coach puede ver en la ficha del cliente qué cambió.

---

## Analytics del coach (Fase 2 — próxima sesión)

En la ficha de cliente, sección "Hábitos de compra":
- Supermercados más usados (últimas 4 semanas)
- Gasto medio semanal estimado
- Ingredientes que el cliente cambia con más frecuencia respecto a la selección del coach
- Tendencia de gasto semana a semana

Fuente de datos: `selecciones_lista_compra` agregado por `cliente_id` + `semana_inicio`.

---

## Fases de implementación

### Fase 1 — Esta sesión (núcleo funcional)

1. **Migración SQL:** añadir `es_generico`, crear `selecciones_lista_compra`, marcar BEDCA como genéricos
2. **Script deduplicación:** detectar pares, transferir precios, eliminar duplicados, volcar ambiguos a revisión
3. **Normalizador mejorado:** lógica de creación condicional por tipo de producto
4. **API lista semanal:** `GET /api/lista-compra/semanal?plan_id=&semana=` — devuelve ingredientes agregados con precios por super
5. **API selecciones:** `POST /api/lista-compra/selecciones` y `GET /api/lista-compra/selecciones?plan_id=&semana=`
6. **UI ListaCompra:** rediseño con precios inline por ingrediente + resumen por supermercado

### Fase 2 — Próxima sesión

7. **Analytics coach:** sección en ficha cliente con hábitos de compra
8. **Admin revisión dups:** interfaz en `AdminPrecios` para resolver los duplicados ambiguos
9. **Scrapers adicionales:** Carrefour, Día, Alcampo, Consum, Lidl, Eroski → más cobertura de precios

---

## Archivos que toca esta feature

| Archivo | Cambio |
|---------|--------|
| `supabase_precios_supermercado.sql` (nuevo migration) | `es_generico`, `selecciones_lista_compra` |
| `scripts/deduplicar-alimentos.mjs` | Script nuevo |
| `lib/scraping/normalizador.ts` | Lógica condicional de creación |
| `app/api/lista-compra/semanal/route.ts` | API nueva |
| `app/api/lista-compra/selecciones/route.ts` | API nueva |
| `components/ListaCompra.tsx` | Rediseño con precios inline |
| `types/index.ts` | Tipos nuevos |

### Límites de worktree

Este feature pertenece a `nutricoach-modulos/` (rama `feature/modulos`). No tocar `app/globals.css`, `app/layout.tsx` ni `app/recetas/`.

---

## Criterios de éxito

- [ ] El escandallo de recetas muestra precios para ≥ 70% de los ingredientes genéricos
- [ ] El cliente puede elegir supermercado por ingrediente y la selección persiste
- [ ] La lista semanal agrega correctamente las cantidades de todo el plan
- [ ] El coach ve `seleccionado_por` en cada ingrediente
- [ ] No hay regresiones en el cálculo de macros/kcal existente
