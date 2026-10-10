# Bases científicas: nutrición según las sesiones del día (dobles, pre y post)

Fecha: 10-10-2026 · Estado: **estudio previo, nada implementado**. Prioridad actual de Carlos: primero planes de entreno con IA potentes y eficaces; esto se retoma después.

Objetivo de Carlos: que el motor fije unas **bases lógicas** (el cliente luego hará lo que quiera): con dos sesiones el mismo día o sesiones movidas de día, la dieta ajusta carga y comidas; y los platos pre/post se eligen por composición según la hora y el tipo de sesión (p. ej. correr por la mañana → pre rico en hidratos de absorción rápida).

## 1. Qué hace hoy el motor

- `objetivosPorDia` (`lib/nutricion/objetivo-dia.ts`) lee el `dia_semana` de las sesiones en cada cálculo y ajusta kcal, proteína e hidratos por tipo de día (fuerza +8 %, cardio +10 %, híbrido +12 %, descanso −5 %). Tras mover una sesión hay que pulsar «Ajustar al entreno».
- Con **dos sesiones el mismo día** solo cuenta la más exigente (híbrido > cardio > fuerza). No se suma carga ni se añade comida.
- `momentoDeEntreno` marca qué comida cae pre y cuál post según la hora; solo **prefiere** recetas marcadas `es_pre_entreno` / `es_post_entreno`. No decide la composición (hidratos rápidos, fibra baja…).

## 2. Qué respalda la base de estudios (406 entradas en `knowledge_base`)

Leído de la propia base (resúmenes y puntos clave guardados), no de memoria. «Respaldo» = hay una entrada que lo sostiene; «falta» = no hay fuente en la base.

| Regla candidata | Respaldo en la base | Nivel / límite |
|---|---|---|
| Hidratos diarios según volumen: 3-10 g/kg (hasta 6-10 en alto volumen) | Burke 2011 (10.1080/02640414.2011.585473); Thomas 2016 ACSM/AND/DC (10.1016/j.jand.2015.12.006) | Consenso. El peso por g/kg ya lo usa el motor |
| Comida pre: 1-4 g/kg, 1-4 h antes | Burke 2011 (en el resumen de la base) | Consenso, rango amplio |
| Comida pre ~3 h antes: mixta de **índice glucémico bajo** mejoró un 10 km (55,2 vs 57,0 min) y la oxidación de grasa | RCT 10.1139/apnm-2024-0219 | **n = 12 corredores varones, calor-humedad, 3 h antes.** No generalizable a otras horas ni a mujeres |
| Reducir **FODMAP** en las 48 h previas baja los síntomas digestivos antes y durante el ejercicio (sin cambiar el rendimiento) | RCT 10.1139/apnm-2023-0508 | Atletas de resistencia, dieta de 12 g/kg de hidratos. Apoya fibra/FODMAP bajos antes de pruebas |
| Entrenar el intestino: probar geles/bebidas en entreno antes de competir | Jeukendrup 2017 «Training the gut» (10.1007/s40279-017-0690-6) | Revisión. Apoya «no estrenar nada en la prueba» |
| Durante >60 min: 30-60 g/h (hasta 90 con glucosa+fructosa) | Burke 2011; Jeukendrup 2014 (10.1007/s40279-014-0148-z) | Ya usado en suplementación |
| Proteína: 0,3-0,4 g/kg por toma, 4-5 tomas/día, umbral de leucina | Areta 2013 (10.1113/jphysiol.2012.244897); Phillips & Van Loon 2011; Morton 2018 | Estudio agudo + metaanálisis. Apoya repartir la proteína, también post-sesión |
| Disponibilidad energética: <30 kcal/kg masa magra/día es riesgo | IOC RED-S (10.1136/bjsports-2018-099193) | **Clave para dobles sesiones:** no bajar la ingesta en días de mucha carga |
| **Recuperación rápida (<4 h entre sesiones):** 1,2 g/kg/h de hidratos (mejor de IG alto, >70), o 0,8 g/kg/h de hidratos + 0,2-0,4 g/kg/h de proteína (mismo rebrote de glucógeno); cafeína 3-8 mg/kg como ayuda | ISSN nutrient timing 2017 (10.1186/s12970-017-0189-4) y Beelen 2010 (10.1123/ijsnem.20.6.515), **cargados el 10-10-2026**; cifras leídas del abstract | Posición de sociedad + revisión narrativa. Es la base de las dobles sesiones |
| Hidratos 8-12 g/kg/día maximizan el glucógeno; los agota más el volumen alto | ISSN nutrient timing 2017 | Posición de sociedad |
| Proteína 0,25-0,40 g/kg por toma (20-40 g) cada 3-4 h; 20 g de proteína tras el ejercicio; proteína en las primeras 2 h | ISSN nutrient timing 2017; ISSN proteína 2017 (10.1186/s12970-017-0177-8, cargado) | Posición de sociedad |
| Si el pre es grande, la proteína post pesa menos («el tamaño y el momento de la comida pre influyen en cuánta proteína post hace falta») | ISSN nutrient timing 2017 | Posición de sociedad |
| Hidratos durante el ejercicio >60 min a ~30-60 g/h en solución 6-8 % | ISSN nutrient timing 2017; Burke 2011 | Consenso |
| Periodizar nutrientes según carga de entrenamiento | Thomas 2016; marco TFC (10.3390/nu18040693, revisión narrativa, sin cifras) | Principio general, sin cifras que aplicar |
| Interferencia en entreno concurrente (fuerza + resistencia), orden y separación | Wilson 2012; Schumann & Rønnestad 2019 | Es entreno, no nutrición; útil para decidir qué sesión va primero |
| Dieta de bajo índice glucémico 28 días: menos variabilidad glucémica sin perder rendimiento (ultra-resistencia) | RCT 10.1002/ejsc.70092 | Población muy concreta |

### Lo que sigue **sin** respaldo en la base (hay que cargar fuente antes de implementarlo)

1. **Hidratos de absorción rápida justo antes (<60 min), bajos en fibra y grasa:** no hay estudio. Se apoya en la práctica de las guías, sin fuente cargada. El único RCT de comida pre apunta al contrario para la comida de 3 h antes (IG bajo). Una segunda parte útil: la ISSN dice que un IG alto (>70) conviene para la recuperación rápida **entre sesiones**, no para el pre lejano.
2. **Periodización de hidratos** (Impey 2018, ya cargado): es un marco teórico, no da cifras para aplicar automáticamente; decisión del coach.
3. **Mujeres, ciclo menstrual y dobles sesiones:** sin literatura cargada.

### Cargado el 10-10-2026

Con `scripts/cargar-papers-clave.ts --apply` (abstract real de PubMed, `verificado=true`):

| Tema | Referencia | DOI |
|---|---|---|
| Nutrient timing (ISSN) | Kerksick et al. 2017 | 10.1186/s12970-017-0189-4 |
| Recuperación posejercicio | Beelen et al. 2010, IJSNEM | 10.1123/ijsnem.20.6.515 |
| Periodización de hidratos | Impey et al. 2018, Sports Med | 10.1007/s40279-018-0867-7 |
| Proteína y ejercicio (ISSN) | Jäger et al. 2017 | 10.1186/s12970-017-0177-8 |

Las cifras de recuperación entre sesiones salen **del abstract**; antes de usarlas como regla conviene leer el texto completo.

### Incidencias de la propia base (corregidas el 10-10-2026)

- La entrada de Burke 2011 decía «revisión del ACSM»; es un consenso del COI en *Journal of Sports Sciences*. Corregido el texto y añadido un aviso: la pre-carga 7-12 g/kg y el 1-1,5 g/kg posejercicio de su resumen **no figuran en el abstract original** (script `scripts/corregir-burke-2011-kb.ts`).
- Había 2 copias activas sin DOI («Carbohidratos perientrino/perientreno…»): **desactivadas, no borradas** (se reactivan con `activo=true`). Siguen 2 copias inactivas más.
- Casi todas las entradas son abstracts sin `contenido_completo` en las clásicas: el motor solo puede citar el resumen.

## 3. Propuesta de bases lógicas (por niveles de confianza)

**Nivel A, respaldado, se puede implementar con lo que hay:**
1. No dejar que la ingesta caiga en días de mucha carga (RED-S, ACSM): suelo de kcal por kg de masa magra y avisar si el plan lo incumple.
2. Reparto de proteína en 4-5 tomas con una dosis post-sesión (Areta, Morton).
3. En los 1-2 días previos a una prueba, FODMAP y fibra bajos (RCT 2023-0508) y «nada nuevo el día de la prueba» (Training the gut). Ya hay perfil de víspera; falta la regla de fibra/FODMAP.
4. Comida pre con 1-4 g/kg a 1-4 h (Burke). Con ≥2-3 h de margen, preferir mezcla de IG bajo (RCT, con cautela).

**Nivel B, fuente ya cargada (cifras del abstract; confirmar en texto completo):**
5. **Doble sesión:** sumar la carga de la segunda sesión al objetivo del día (no solo la más exigente) y, si hay <4 h entre sesiones, añadir comida de recuperación: 1,2 g/kg/h de hidratos (IG alto) o 0,8 g/kg/h + 0,2-0,4 g/kg/h de proteína, repartidos en la ventana (ISSN 2017; Beelen 2010). Con ≥8 h basta la comida normal.
6. **Pre muy cercano a la sesión (<60 min):** hidratos fáciles de digerir, poca fibra y grasa. Distinguir «pre lejano» (comida mixta, IG bajo) de «pre cercano» (rápidos).
7. Entrenar con poco glucógeno solo como decisión del coach (periodización de hidratos), nunca automática.

**Nivel C, criterio de dietista (sin paper), marcar como tal y que apruebe el coach:**
8. Porcentajes concretos de aumento de kcal por doble sesión y tamaño del tentempié extra.

## 4. Datos que necesita el motor (algunos ya existen)

- `hora_inicio` y `duracion_estimada_min` por sesión (ya existen) para saber la distancia entre sesiones y hasta la comida anterior.
- Intensidad o RPE esperado de cada sesión (hoy solo hay tipo híbrido/cardio/fuerza por el nombre).
- Franja de comida y si el cliente acepta una comida extra (comidas al día ya es editable por el coach).
- Tolerancia digestiva del cliente (no hay campo; podría salir del cuestionario o del feedback).

## 5. Cómo implementarlo en la siguiente fase (orden propuesto)

1. ~~Corregir la base y cargar los 4 candidatos~~ (hecho 10-10-2026). Falta leer el texto completo de la recuperación entre sesiones.
2. Módulo puro `lib/nutricion/sesiones-dia.ts`: dado el conjunto de sesiones de un día (hora, duración, tipo, intensidad), devuelve carga total, distancia entre sesiones y el contexto de cada comida (pre lejano, pre cercano, entre sesiones, post). Con tests con los casos de Carlos y de los clientes de prueba.
3. Reglas por nivel (A primero), cada una con su cita en `fundamentos` (estudio / libro / criterio), como ya hace el motor de rendimiento.
4. Recetas: composición por contexto (hidratos/fibra/grasa por ración) sobre las recetas existentes y lote nuevo si faltan pre/post cercano.
5. Aviso al coach cuando mover o duplicar una sesión desajusta la dieta; el coach aprueba, nada se aplica solo.
6. Comprobar con los clientes de prueba (Carlos, Marcos, Andrés, Natalia, Laura) y medir desviaciones día a día como en sesiones anteriores.

## 6. Límites honestos de este estudio

- Revisados resúmenes y puntos clave guardados en la base y abstracts de PubMed (incluidos los 4 nuevos); **no se han leído textos completos**.
- Dos entradas clave (Burke 2011, FODMAP/LGI) vienen de abstracts de estudios pequeños y específicos: no extrapolar a todos los perfiles.
- No hay literatura cargada sobre mujeres atletas, dobles sesiones ni ciclo menstrual para estas reglas.
