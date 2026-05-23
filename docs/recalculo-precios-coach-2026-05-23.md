# Recalculo de Precios Coach desde Productos Reales — 23/05/2026

## Índice

1. [Objetivo](#1-objetivo)
2. [Arquitectura del Script](#2-arquitectura-del-script)
3. [Configuración y Constantes](#3-configuración-y-constantes)
4. [Pipeline de Procesamiento](#4-pipeline-de-procesamiento)
5. [Sistema de Pesos y Confianza](#5-sistema-de-pesos-y-confianza)
6. [Sanity Checks y Filtros Anti-corrupción](#6-sanity-checks-y-filtros-anti-corrupción)
7. [Cambios Aplicados (24)](#7-cambios-aplicados-24)
8. [Casos Problemáticos Investigados](#8-casos-problemáticos-investigados)
9. [Limitaciones Conocidas](#9-limitaciones-conocidas)
10. [Cómo Revisar/Depurar en el Futuro](#10-cómo-revisardepurar-en-el-futuro)
11. [Pendientes y Próximos Pasos](#11-pendientes-y-próximos-pasos)

---

## 1. Objetivo

Recalcular los precios de referencia (`precio_kg_referencia` en `productos_supermercado`) de todos los alimentos que se usan en recetas, utilizando **productos reales de supermercado** como fuente de verdad.

Antes de esta sesión, el script solo procesaba alimentos **sin ningún producto directo vinculado**. Ahora (v2) procesa **todos** los alimentos con ref coach, incluyendo aquellos que YA tienen productos directos, para refinar precios existentes obsoletos.

## 2. Arquitectura del Script

**Archivo**: [`scripts/calcular-precios-coach-desde-reales.mjs`](../scripts/calcular-precios-coach-desde-reales.mjs)

### Flujo general

```
1. Cargar alimentos referenciados en recetas
2. Cargar todos los productos reales
3. Construir índice semántico (palabras clave → productos)
4. Para cada alimento con ref coach:
   a. Buscar productos directos (alimento_id coincidente)
   b. Buscar matches semánticos (por palabras clave)
   c. Filtrar falsos positivos (red flags, contenedores)
   d. Elegir mejor método de cálculo
   e. Calcular precio ponderado
   f. Si --apply: actualizar en Supabase
5. Reporte final
```

### Dependencias

- `@supabase/supabase-js` — cliente Supabase
- `service_role` key — requiere permisos de escritura en `productos_supermercado`

## 3. Configuración y Constantes

Todas las constantes están al inicio del script para facilitar ajustes futuros.

### Matching

| Constante | Valor | Propósito |
|---|---|---|
| `MIN_RATIO` | 0.40 | Ratio mínimo de solapamiento de tokens para considerar match semántico |
| `MAX_PRODUCTOS` | 200 | Máximo de productos a cargar por alimento (paginación) |
| `MAX_MATCHES` | 200 | Máximo de matches semánticos a considerar |
| `MAX_SUPERS_POR_PRECIO` | 5 | Máximo de supermercados diferentes para ponderación |

### Filtros de texto

| Lista | Contenido |
|---|---|
| `SKIP_MAIN_WORDS` | `['eco', 'ecológico', 'ecologica', 'certificación', 'certificado', 'certificacion', 'comercio justo', 'sin gluten', 'sin lactosa', 'integral', 'light', '0%', '0,0%', 'desnatado', 'entero', 'tradicional', 'casero', 'casera', 'artesano', 'artesana', 'gourmet', 'premium', 'selección', 'seleccion', 'mascota', 'perro', 'gato', 'congelado', 'congelada', 'vegetal', 'animal', 'refrigerado', 'pasterizado', 'pasteurizado'] |
| `RED_FLAG_WORDS` | `['lata', 'lata de', 'frasco', 'frasco de', 'pack', 'pack de', 'pack de 2', 'pack de 3', 'pack de 4', 'pack de 6', 'pack de 8', 'pack de 10', 'pack de 12', 'caja', 'caja de', 'botella', 'botella de', 'bote', 'bote de', 'tarrina', 'tarrina de', 'bandeja', 'bandeja de', 'huevos', 'pastillas', 'pastilla', 'sobre', 'sobre de', 'bolsa', 'bolsa de', 'servicio', 'raciones', 'ración', 'para 1', 'para 2', 'para 4', 'unidad', 'envase'] |

> ⚠️ **Nota importante**: Los `RED_FLAG_WORDS` de tipo contenedor (`lata`, `frasco`, `caja`, `botella`, etc.) se evalúan de forma diferente para **directos** vs **semánticos**:
> - **Directos**: se filtran si el producto contiene la palabra contenedor Y el nombre del alimento NO la contiene (ej: "Atún en lata" vinculado a "Aceite de oliva" → se filtra porque "lata" no está en "aceite de oliva")
> - **Semánticos**: se filtran siempre que aparezca cualquier red flag en el nombre del producto

### Sanity

| Constante | Valor | Propósito |
|---|---|---|
| `SANITY_DIRECT_SEMANTIC_RATIO` | 5.0 | Si mediana directa > 5x mediana semántica, descartar directos como corruptos |
| `MIN_DIRECT_CONFIDENCE` | 0.3 | Confianza mínima para aceptar un precio directo |
| `Q1_FALLBACK_MIN_SUPERS` | 2 | Si hay menos de N supermercados con directos y no hay semánticos, usar Q1 |

### Pesos

| Constante | Valor | Propósito |
|---|---|---|
| `CONF_DIRECT` | 1.0 | Confianza base para precio directo (producto vinculado explícitamente) |
| `CONF_SEMANTIC` | 0.6 | Confianza base para precio semántico (match por palabras clave) |
| `RECENCY_WEIGHTS` | ver abajo | Pesos por antigüedad del precio |

#### Pesos por recencia

```js
const RECENCY_WEIGHTS = {
  '30': 1.0,   // último mes
  '60': 0.9,   // 1-2 meses
  '90': 0.8,   // 2-3 meses
  '180': 0.6,  // 3-6 meses
  '365': 0.4,  // 6-12 meses
  '9999': 0.25 // >12 meses
};
```

## 4. Pipeline de Procesamiento

### Paso 1: Carga de datos
```sql
-- Alimentos que aparecen en recetas (con ref coach manual)
SELECT DISTINCT a.id, a.nombre, a.categoria
FROM alimentos a
JOIN receta_alimentos ra ON ra.alimento_id = a.id
WHERE a.precio_kg_referencia IS NOT NULL;
```

### Paso 2: Productos directos (Section 7A)
Para cada alimento, busca productos con `alimento_id = a.id`. Filtra:
- Productos con `tiene_precio = true`
- Productos cuyo nombre NO contenga palabras contenedor ausentes en el nombre del alimento

### Paso 3: Matching semántico (Section 7B)
1. Extrae palabras clave del nombre del alimento (limpia: acentos → ASCII, paréntesis, cardinales, tildes)
2. Identifica el **sustantivo principal** (primera palabra con >2 caracteres)
3. Busca en el índice semántico inverso: palabras clave → productos
4. Filtra productos que no contengan el sustantivo principal
5. Filtra productos con red flags en el nombre
6. Deduplica por producto_id (mismo producto puede matchear por varias palabras)

### Paso 4: Fusión de señales (Section 7C)
1. Unifica directos + semánticos
2. **Sanity check**: si mediana directa > `SANITY_DIRECT_SEMANTIC_RATIO` × mediana semántica → descarta todos los directos como corruptos
3. Selecciona conjunto final (`directosFinal`, `semanticosFinal`)

### Paso 5: Cálculo de precio (Section 8)
1. Agrupa precios por supermercado (usar mediana por super, no todos los precios individuales)
2. Calcula precio ponderado con `weightedMedian()`
3. **Q1 fallback**: si todos los directos vienen de 1 solo supermercado y no hay semánticos → usar percentil 25 en lugar de mediana ponderada
4. Compara con ref actual:
   - `--apply` sin `--force`: solo actualiza si cambio >5%
   - `--apply --force`: actualiza siempre

### Paso 6: Actualización en Supabase
```sql
UPDATE productos_supermercado
SET precio_kg_referencia = <nuevo_valor>
WHERE alimento_id = <id>;
```

## 5. Sistema de Pesos y Confianza

### Peso compuesto para weightedMedian

```
peso = confianza_base × peso_recencia × ratio_extra
```

Donde:
- `confianza_base`: `CONF_DIRECT` (1.0) o `CONF_SEMANTIC` (0.6)
- `peso_recencia`: según antigüedad del precio (ver RECENCY_WEIGHTS)
- `ratio_extra`: solo para semánticos = ratio de solapamiento de tokens (0.4-1.0). Para directos = 1.0

### weightedMedian (cálculo)

```
1. Ordenar precios por valor ascendente
2. Acumular pesos en el mismo orden
3. Encontrar punto donde suma acumulada >= 50% del peso total
4. Interpolar entre los dos precios adyacentes
```

### Ejemplo
Un producto semántico con ratio 0.7, precio de hace 45 días:
```
peso = 0.6 × 0.9 × 0.7 = 0.378
```

Un producto directo con precio de hace 20 días:
```
peso = 1.0 × 1.0 × 1.0 = 1.0
```

## 6. Sanity Checks y Filtros Anti-corrupción

### 6.1 Filtro de palabras contenedor (directos)
**Problema**: Productos como "Atún claro en aceite de oliva" con `alimento_id` apuntando a "Aceite de oliva 0,4º" — precio totalmente fuera de lugar.

**Solución**: Si el nombre del producto contiene palabras como `lata`, `frasco`, `caja`, `botella`, etc. Y el nombre del alimento NO contiene esa misma palabra → el producto se descarta como directo.

### 6.2 Sanity check directo vs semántico
**Problema**: Incluso tras filtrar contenedores, puede haber directos con precio anómalo (ej: pan rallado de marca Gallo a 16€/kg).

**Solución**: Si hay tanto directos como semánticos, y `median(directos) / median(semanticos) > SANITY_DIRECT_SEMANTIC_RATIO (5.0)`, se descartan todos los directos y se usa solo la señal semántica.

### 6.3 Q1 fallback para monopolio de supermercado
**Problema**: Alimentos con directos de un solo supermercado y sin semánticos (ej: pan rallado, solo Eroski, 9 productos entre 11-17€/kg). La mediana da 12.81€ pero puede estar inflada por marcas premium.

**Solución**: Si `numSupersDirectos < Q1_FALLBACK_MIN_SUPERS (2) && numSupersSemanticos === 0`, se usa el **percentil 25** (Q1) en lugar de la mediana ponderada. Esto da un precio más representativo del commodity.

### 6.4 Filtro de red flags (semánticos)
**Problema**: El matching semántico puede traer productos no comestibles (comida para mascotas), formatos no comparables (bandejas, raciones) o productos muy procesados.

**Solución**: Se filtran todos los productos cuyo nombre contenga cualquier palabra de `RED_FLAG_WORDS`. Esto se aplica SIEMPRE para semánticos.

## 7. Cambios Aplicados (24)

### Con precio directo (8)

| Alimento | Ref Antes | Ref Después | Cambio | Método | Confianza |
|---|---|---|---|---|---|
| Pan rallado | 2,50€ | 12,00€ | +380,0% 🔴 | directo_q1 | Media: 9 directs 1 super, Q1 = 12.00€ |
| Cilantro molido | 18,00€ | 6,25€ | -65,3% 🔴 | ponderado_directo | 1 directo Mercadona |
| Pasta de curry rojo | 10,00€ | 19,30€ | +93,0% 🔴 | ponderado_directo | 1 directo + 1 semántico |
| Muslos de pollo | 5,00€ | 6,49€ | +29,8% 🔴 | ponderado_directo | 1 directo + 7 semánticos |
| Comino molido | 18,00€ | 19,83€ | +10,2% 🟡 | ponderado_directo | 1 directo Mercadona |
| Yogur proteína chocolate | 3,20€ | 2,20€ | -31,3% 🔴 | ponderado_directo | 1 directo + 29 semánticos |
| Chirivia Granel | 2,50€ | 3,39€ | +35,6% 🔴 | ponderado_directo | 1 directo + 1 semántico |
| Arroz basmati | 2,40€ | 3,49€ | +45,4% 🔴 | ponderado_directo | 1 directo + 6 semánticos |

### Solo matching semántico (16)

| Alimento | Ref Antes | Ref Después | Cambio |
|---|---|---|---|
| Aceite de oliva 0,4º | 7,50€ | 14,78€ | +97,1% 🔴 |
| Harina de trigo | 1,10€ | 1,20€ | +9,1% 🟠 |
| Semillas de sésamo | 8,00€ | 5,76€ | -28,0% 🔴 |
| Caldo de pescado | 14,00€ | 3,00€ | -78,6% 🔴 |
| Atún en lata al natural | 14,00€ | 10,00€ | -28,6% 🔴 |
| Nuez moscada molida | 21,27€ | 14,20€ | -33,2% 🔴 |
| Salsa de tomate | 4,60€ | 4,83€ | +5,0% 🟠 |
| Azúcar glas | 25,02€ | 5,20€ | -79,2% 🔴 |
| Gelatina en láminas | 8,63€ | 5,50€ | -36,3% 🔴 |
| Cereales cubiertos chocolate blanco | 6,38€ | 7,07€ | +10,8% 🟡 |
| Vinagre de vino | 0,88€ | 0,65€ | -26,1% 🔴 |
| Tortita de arroz | 15,14€ | 16,06€ | +6,1% 🟡 |
| Boquerón limpio sin cabeza | 9,48€ | 3,95€ | -58,3% 🔴 |
| Sal en escamas (para decorar) | 22,96€ | 19,92€ | -13,2% 🟡 |
| Tomate pelado | 2,38€ | 1,95€ | -18,1% 🟡 |
| Leche en polvo | 9,15€ | 7,72€ | -15,6% 🟡 |

### Sin cambio (13)

Aguacate, Pechuga de pavo, Salmón ahumado, Queso batido desnatado 0% M.G., Alitas de pollo, Huevos camperos, espárrago verde, Cebolla Granel, Harina de maíz, Huevo de codorniz, Huevos de codorniz cocidos, Cebolla deshidratada en escamas, Tomate natural triturado — nuevo precio dentro del ±5%.

### Sin match semántico (59)

Alimentos sin ningún producto directo ni match por palabras clave. Se quedan con su ref actual hasta que se vinculen manualmente o lleguen más productos.

## 8. Casos Problemáticos Investigados

### 8.1 Aceite de oliva 0,4º
- **Problema**: Directo único = "Atún claro en aceite de oliva" (12,79€/kg)
- **Causa raíz**: `alimento_id` mal asignado — el atún comparte "aceite de oliva" en el nombre
- **Detección**: Red flag "lata" en producto, ausente en "aceite de oliva"
- **Resolución**: Directo descartado, se usa solo señal semántica (116 productos en 4 supers) → **14,78€/kg**
- **Veredicto**: Subida del precio real del aceite de oliva en supermercados

### 8.2 Caldo de pescado
- **Problema**: Directo único = "Caldo de pescado en pastillas KNORR" a 115,75€/kg
- **Causa raíz**: Producto de 120g en cajita → precio/kg disparado (el precio real por unidad es ~1,39€)
- **Detección**: Red flag "pastillas" + "caja" en producto — "caldo de pescado" no contiene "pastillas" ni "caja"
- **Resolución**: Directo descartado, se usa señal semántica → **3,00€/kg**
- **Veredicto**: Precio correcto, el antiguo 14,00€ era una estimación manual muy alta

### 8.3 Pan rallado
- **Problema**: 9 directos legítimos (todos de Eroski) entre 11,13-16,76€/kg. Sin semánticos.
- **Causa raíz**: Solo productos de marca (Gallo, Eroski Selección) en un solo supermercado
- **Detección**: `numSupersDirectos (1) < 2 && numSupersSemanticos (0) === 0` → Q1 fallback
- **Resolución**: Q1 (percentil 25) = **12,00€/kg** en lugar de mediana 12,81€
- **Veredicto**: Precio razonable para pan rallado de supermercado. Antiguo 2,50€ era irreal.

## 9. Limitaciones Conocidas

1. **59 alimentos sin match**: No tienen productos directos ni semánticos. Requieren vinculación manual o nuevos productos en BD.
2. **Dependencia de supermercados**: Los precios reflejan solo los supers en BD (Mercadona, Consum, Eroski, Carrefour, etc.). Faltan Aldi, Lidl, Dia.
3. **Marcas premium**: En supers con solo productos de marca (ej: Eroski sin marca blanca para pan rallado), el precio puede estar inflado. El Q1 fallback mitiga parcialmente.
4. **Formato engañoso**: Productos como especias o pastillas tienen precio/kg muy alto por ser formatos pequeños. El script no puede normalizar por formato.
5. **Falsos positivos en matching semántico**: Palabras compartidas entre alimentos distintos (ej: "aceite de oliva" en nombre de atún). Los red flags mitigan, pero no eliminan.
6. **Sin estacionalidad**: Los precios no consideran temporada (ej: verduras de temporada más baratas).

## 10. Cómo Revisar/Depurar en el Futuro

### Ejecutar dry-run
```bash
node scripts/calcular-precios-coach-desde-reales.mjs --dry-run
```

### Ver resultados de un alimento específico
Para investigar un caso concreto, se puede añadir un filtro temporal al inicio del bucle principal (línea ~350):

```js
if (a.nombre !== 'Nombre del alimento') continue; // filtro temporal
```

O directamente hacer queries a Supabase:

```sql
-- Ver productos directos de un alimento
SELECT p.id, p.nombre, p.precio_kg, p.supermercado, p.updated_at
FROM productos_supermercado p
WHERE p.alimento_id = '<alimento_id>' AND p.es_real = true
ORDER BY p.updated_at DESC;

-- Ver matches semánticos potenciales
SELECT p.id, p.nombre, p.precio_kg, p.supermercado
FROM productos_supermercado p
WHERE p.es_real = true
  AND p.tiene_precio = true
  AND p.nombre ILIKE '%palabra_clave%';
```

### Síntomas de alarma
- **Cambio >500%**: Revisar si es un producto mal vinculado
- **Precio >100€/kg** para alimentos básicos (harina, arroz): probablemente formato engañoso
- **Precio <0,50€/kg**: posible error en precio_unitario (ej: producto en oferta)
- **0 semánticos**: el alimento no tiene buena cobertura en BD

### Logging adicional
El script imprime por cada alimento:
- `Método`: cómo se calculó (`ponderado_directo`, `solo_semantico`, `directo_q1`, `status_quo`)
- `Ponderado`: precio ponderado por weightedMedian
- `Sin outliers`: precio tras eliminar outliers por IQR
- `Rango`: min-max de precios considerados
- Nº de directos, semánticos y supermercados

## 11. Pendientes y Próximos Pasos

- [ ] **Futuro: normalizar por formato** — Detectar productos de gramaje pequeño (especias, pastillas, sobres) y ajustar precio/kg o excluirlos
- [ ] **Futuro: vinculación semiautomática** — Script para sugerir `alimento_id` a productos sin asignar basado en matching semántico
- [ ] **Futuro: cobertura de supers** — Añadir Aldi, Lidl, Dia para tener precios más representativos
- [ ] **Futuro: alertas de deriva** — Monitorizar cambios de precio >20% en ejecuciones sucesivas
- [ ] **Ahora**: 59 alimentos sin match — requerirían asignación manual o scraping adicional
