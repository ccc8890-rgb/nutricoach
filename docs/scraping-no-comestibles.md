# No Comestibles — Sistema de Filtrado y Limpieza

> Documento único de referencia sobre el manejo de productos no comestibles (cosmética, limpieza, alcohol, mascotas, farmacia, etc.) en la BD.
> Creado: 2026-05-22
> Próxima revisión recomendada: antes de cualquier modificación en scraping o clasificador.

---

## 📋 Resumen

Los scrapers de supermercados devuelven **todo** el catálogo: alimentos, cosmética, limpieza, alcohol, mascotas, farmacia, menaje, etc. Para evitar que productos no comestibles contaminen escandallos, precios y recomendaciones, existen **3 capas de defensa** y **1 script de limpieza retroactiva**.

---

## 🛡️ Capa 1 — Filtro en scraping (en caliente)

**Archivo:** [`lib/scraping/guard-no-comestible.ts`](lib/scraping/guard-no-comestible.ts)

Es el **único punto de verdad** para definir qué productos son no comestibles. Durante el scraping, cada producto se evalúa con `esProductoNoComestible()` **en memoria** y se descarta antes de llegar a la BD.

### Cobertura de patrones (~210 regex)

| Familia | Ejemplos |
|---------|----------|
| Mascotas | pienso, arena, comida gato/perro, snack mascotas |
| Higiene femenina | compresa, tampón, copa menstrual, salvaslip |
| Cuidado dental | pasta dientes, dentífrico, cepillo, hilo dental, enjuague bucal |
| Champú / capilar | champú, acondicionador, mascarilla capilar, tinte, laca, gel fijador |
| Jabón / ducha | jabón manos/baño/íntimo, gel ducha/baño, gel íntimo |
| Desodorante / perfumes | desodorante, antitranspirante, colonia, perfume, body spray |
| Crema / loción corporal | crema hidratante/nutritiva/corporal/facial, aceite corporal, manteca |
| Cosmética facial | sérum facial, agua micelar, desmaquillante, tónico facial |
| Labial | barra labios, pintalabios, bálsamo labios, perfilador labial |
| Maquillaje | base maquillaje, colorete, máscara pestañas, sombra ojos |
| Uñas | esmalte uñas, quitaesmalte, cutícula, laca de uñas |
| Brochas / accesorios | pincel maquillaje, brocha, esponja, rizador pestañas, cejas |
| Mercadona Deliplus | deliplus maquillaje, deliplus champú, deliplus crema corporal, deliplus men care |
| Solar | protector solar, crema solar, aftersun, autobronceador |
| Depilación | cera depilatoria, maquinilla afeitar, crema depilatoria, after shave |
| Limpieza hogar | lejía, detergente, suavizante, limpia-cocinas, estropajo, bayeta, papel higiénico, bolsa basura |
| Menaje / descartables | vela, mechero, pilas, bombilla, guantes, platos/cubiertos desechables, pajitas |
| Papelería | cuaderno, bolígrafo, rotulador, pegamento, tijeras |
| Bebés no comida | pañal, toallitas bebé, biberón, chupete, tetina |
| Farmacia / salud | tirita, venda, suero fisiológico, laxante, lentes contacto, clorhexidina, minoxidil |
| Antiedad / anticelulítico | reductor, anticelulítico, antiestrías |
| Kits | kit viaje, kit higiene, kit bebé, kit cosmético |
| Alcohol | cerveza, vino, cava, whisky, vodka, ginebra, ron, licor, vermut, sidra, sangría |
| Bebidas energéticas | Monster, Red Bull, Burn, bebida energética, energy drink |
| Electrodomésticos | cualquier producto con `### W` (vatios) |

### Excepciones (evitan falsos positivos)

Productos que **suenan** a no comestible pero SÍ lo son:

- `miel con dosificador` / `miel envase` — NO es cosmética
- `chorizo extra vela` — NO es vela decorativa
- `jabón glicerina` — ingrediente alimentario
- `grill tostada` / `freidora de aire` — electrodomésticos de cocina
- `vinagre de vino` — NO es alcohol
- `levadura de cerveza` — NO es cerveza
- `tarta/bombones/trufas al ron` — NO es alcohol, es repostería
- `pasas al ron` — ingrediente
- `oporto carne/carrillera/estofado` — platos cocinados
- `vitamina` — "vino con vitaminas" no es alcohol

> ⚠️ **Regla:** Siempre que añadas un patrón nuevo, verifica que no haya falsos positivos añadiendo una excepción.

### API pública

```typescript
// Devuelve true si el nombre corresponde a un producto no comestible
esProductoNoComestible(nombre: string): boolean

// Versión para arrays (útil en pipelines)
filtrarComestibles(productos: Array<{ nombre: string }>): Array<{ nombre: string }>
```

---

## 🛡️ Capa 2 — Filtro en clasificador (post-scraping)

**Archivo:** [`lib/scraping/post-scraping.ts`](lib/scraping/post-scraping.ts)

Cuando un producto no tiene match en `alimentos`, el clasificador `clasificarPendientes()` decide si crear un alimento nuevo. Antes de crearlo, **vuelve a validar** con `esProductoNoComestible()`.

```typescript
// post-scraping.ts línea 130
if (esProductoNoComestible(nombreNormalizado)) {
  // Marca como clasificado pero NO crea el alimento
  // Así no se vuelve a procesar en futuras ejecuciones
}
```

### ⚠️ Fuga conocida (rama match)

Cuando un producto **SÍ tiene match** con un alimento existente, la validación no se ejecuta:

```typescript
if (!alimentoId) {
  // ✅ Aquí SÍ se valida esProductoNoComestible()
  ...
} else {
  // ❌ AQUÍ NO. Si un no comestible hace match con un alimento,
  //    se vincula directamente sin validación de guard.
}
```

**Impacto:** Bajo, porque requiere que (1) el producto se haya scrapeado (ya se filtra en capa 1) Y (2) exista un alimento con nombre similar. Pero en teoría posible si un producto se cuela por cambio en los patrones o por scraping anterior al guard.

**Fix recomendado:** Añadir `esProductoNoComestible()` también en la rama `else` del match.

---

## 🛡️ Capa 3 — Filtro en vistas SQL

**Archivo:** [`supabase_es_comestible.sql`](supabase_es_comestible.sql)

Tres vistas clave filtran por `es_comestible` para evitar que productos no comestibles aparezcan en escandallos:

| Vista | Propósito |
|-------|-----------|
| `mejores_precios_por_alimento` | Mejor precio por supermercado para cada alimento |
| `top_precios_escandallo` | Top 3 precios más baratos por alimento |
| `precios_actuales` | Precio más reciente por alimento+supermercado |

Todas usan el mismo filtro:

```sql
WHERE (a.es_comestible = true OR a.es_comestible IS NULL)
```

### ⚠️ Problema con NULLs

La columna `es_comestible` se añadió con `DEFAULT true` pero los alimentos creados **antes** de la migración tienen `NULL`. El filtro `true OR NULL` los deja pasar, pero es semánticamente incorrecto.

**Fix recomendado:** Backfill: `UPDATE alimentos SET es_comestible = true WHERE es_comestible IS NULL;`

---

## 🗑️ Script de limpieza retroactiva

**Archivo:** [`scripts/delete-no-comestibles.ts`](scripts/delete-no-comestibles.ts)

Barre **toda** la tabla `alimentos` aplicando `esProductoNoComestible()` y elimina físicamente los que coinciden.

### Orden de borrado (respeta FKs)

```
1. precios_historico       (ON DELETE CASCADE)
2. productos_supermercado  (ON DELETE CASCADE)
3. alimentos_enriquecimiento_cola (ON DELETE CASCADE)
4. alimentos_nutricion_audit (ON DELETE CASCADE)
5. lista_compra_items      (ON DELETE CASCADE)
6. comida_alimentos        (ON DELETE RESTRICT — aborta si hay refs)
7. receta_ingredientes     (NO ACTION — setea NULL y borra)
8. alimentos               (target final)
```

### Uso

```bash
# Solo ver qué se borraría (recomendado primero)
npx tsx scripts/delete-no-comestibles.ts --dry-run

# Ejecutar borrado real
npx tsx scripts/delete-no-comestibles.ts
```

### ⚠️ Bloqueantes

Si hay referencias en `receta_ingredientes` o `comida_alimentos`, el script **aborta** porque esos registros significan que un producto no comestible está siendo usado en planes de nutrición o recetas.

En ese caso, hay que investigar manualmente y decidir:
1. Reemplazar las referencias por `NULL`
2. O revisar por qué un no comestible se usó en una receta

---

## 📊 Referencias cruzadas

| Archivo | Rol |
|---------|-----|
| [`lib/scraping/guard-no-comestible.ts`](lib/scraping/guard-no-comestible.ts) | 🛡️ ÚNICO punto de verdad — define patrones y excepciones |
| [`lib/scraping/index.ts`](lib/scraping/index.ts) | Lo usa en línea 177 para filtrar durante scraping |
| [`lib/scraping/post-scraping.ts`](lib/scraping/post-scraping.ts) | Lo usa en línea 130 — validación en clasificador |
| [`lib/scraping/normalizador.ts`](lib/scraping/normalizador.ts) | Lo usa en línea 536 — validación al crear alimento manualmente |
| [`scripts/delete-no-comestibles.ts`](scripts/delete-no-comestibles.ts) | 🗑️ Limpieza retroactiva de BD |
| [`supabase_es_comestible.sql`](supabase_es_comestible.sql) | 🛡️ Filtro en vistas SQL + columna `es_comestible` |

---

## ⚡ Acciones pendientes

- [ ] **Ejecutar dry-run** de `delete-no-comestibles.ts` para cuantificar el problema actual
- [ ] **Cerrar fuga** en `post-scraping.ts`: añadir `esProductoNoComestible()` en la rama `else` del match
- [ ] **Backfill NULLs**: `UPDATE alimentos SET es_comestible = true WHERE es_comestible IS NULL`
- [ ] **Añadir NOT NULL** a la columna `es_comestible` o al menos constraint CHECK
- [ ] **Decidir** si ejecutar borrado real o solo mantener el filtro en vistas
