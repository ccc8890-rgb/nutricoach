# Plataforma multi-coach (SaaS): estudio previo — 19-10-2026

> Estado: **idea a futuro, nada construido.** Estudio de viabilidad hecho leyendo el código. Se activa cuando haya coaches interesados de verdad.

## 1. Idea (palabras de Carlos)

- Carlos es el **master coach**: mantiene la base de la app (catálogo de recetas, alimentos y ejercicios, motor de dietas y planes, auditorías, taxonomía). Supervisa la app.
- Otros coaches se suscriben y reciben **la app terminada**, sin la parte de configuración y revisión.
- Cada coach puede **ampliar** con sus propias recetas, ejercicios, plantillas, planes de dieta y entreno, y con su metodología y papers.
- Cada coach **conecta lo suyo**: su IA (Claude, GPT… con su clave y su pago) y sus apps de entreno (TrainingPeaks, Garmin, etc.).
- Objetivo: ingresos recurrentes con una cartera de coaches, **sin que el sistema se caiga** y pudiendo escalar (Vercel/Supabase más potentes, tiendas de apps si hace falta).

## 2. Qué hay hoy en el código (medido el 19-10-2026)

| Hallazgo | Dato | Qué implica |
|----------|------|-------------|
| Rutas API | 221 | Superficie grande que revisar |
| Rutas/ficheros que usan **service role** (se saltan la RLS) | 202 | El aislamiento entre coaches depende de que **cada ruta** compruebe a mano de quién es el dato. Es el mayor riesgo del paso a multi-coach |
| Ficheros que mencionan `coach_id` | 98 | La base ya piensa en «coach»; falta convertirlo en «inquilino» de verdad |
| RLS con `coach_id = auth.uid()` | en ~24 SQL | Buena base: segunda capa de defensa ya existe en muchas tablas |
| Catálogo (`recetas`, `alimentos`, `ejercicios`, plantillas) | todas con `coach_id` (en `alimentos` y `ejercicios` es opcional) | Se puede hacer la capa «base de plataforma + propio del coach» sin rehacer tablas |
| Stripe | `webhook` usa un único `NUTRICOACH_COACH_ID` de entorno | Hoy todo cobro cae en Carlos. Hay que pasar a cobros por coach/suscripción |
| IA | Enrutador `lib/ia/enrutador.ts` con claves globales (`ANTHROPIC/OPENAI/DEEPSEEK_API_KEY`) | Ya hay rutas por tarea y respaldos; falta que la clave se resuelva **por coach** |
| Integraciones | Tabla `integraciones_cliente` (41 usos), Garmin por cliente cifrado (`GARMIN_CREDENTIALS_KEY`), OAuth de Strava/Whoop/Coros/Google Fit con **una sola app de la plataforma** | El modelo por cliente ya existe. Bien: la app OAuth puede ser la de la plataforma. Garmin con usuario/contraseña es no oficial: riesgo a escala |
| Crons | 10 tareas globales que recorren a todos; `maxDuration` 300 s; «Planificar con IA» con Opus tarda 140-250 s y hace **una propuesta por ejecución** | No escala a decenas de coaches: hace falta cola de trabajos |
| Hosting | `CLAUDE.md` indica **Vercel Hobby** | Hobby no permite uso comercial. Antes de cobrar a nadie hay que pasar a Pro |
| Scripts de datos (Content Radar, bridge, pasada autónoma de recetario) | Corren en el Mac de Carlos con launchd | Son parte del «detrás» de la plataforma, solo de Carlos: bien así |
| Metodología y papers | `knowledge-base.ts`, `ingesta-papers`, `metodologia-recetario.ts` | Hoy global. Hay que decidir qué es de plataforma y qué de cada coach |

## 3. Decisión de arquitectura (recomendada)

**Un solo producto, una sola base de datos, muchos coaches («multi-inquilino agrupado»).** El inquilino es el coach (o su organización). No una copia de la app por coach.

Por qué: una copia por coach multiplica mantenimiento, despliegues y costes; con una sola, cada mejora que haces llega a todos. Es lo que ya describes («nosotros por encima de la subapp»).

Tres capas:

1. **Plataforma (Carlos, rol `platform_admin`)**: catálogo base, motor, auditorías, revisión de recetas, taxonomía, ajustes globales. Solo lo ve Carlos.
2. **Espacio del coach (rol `coach`)**: sus clientes, planes, plantillas, recetas y ejercicios propios, su metodología, sus conexiones, su facturación. Ve el catálogo base (solo lectura) mezclado con lo suyo, con marca de origen.
3. **Cliente final (rol `cliente`)**: como hoy; pertenece a un coach.

Catálogo en capas: `coach_id` nulo (o el de plataforma) = base; con valor = propio. Las consultas devuelven base + propio. Si algo propio es muy bueno, Carlos puede **ascenderlo** a base (idea nuestra, a confirmar).

## 4. Fases propuestas

Cada fase deja la app mejor y segura aunque no llegue nunca ningún coach (sobre todo 1 y 2).

| Fase | Qué | Cuándo | Coste/Esfuerzo |
|------|-----|--------|----------------|
| **0. Decidir y medir** | Confirmar modelo (inquilino = coach), planes y precios tentativos, qué papers/metodología son de plataforma | Ahora (este documento) | Bajo |
| **1. Aislamiento** | Auditar las 202 rutas con service role: toda ruta debe resolver el coach del usuario y filtrar por él. Una función común de autorización, y **tests de «el coach B no ve nada del coach A»** en las tablas principales. Test que falle si una ruta nueva no la usa | Primero; vale ya como seguridad | Medio |
| **2. Catálogo en capas** | Base + propio en recetas, alimentos, ejercicios, plantillas, planes. Base solo lectura para coaches. Marca de origen en la interfaz | Tras 1 | Medio |
| **3. Roles y pantallas** | `platform_admin` vs `coach`: ocultar Revisión, Auditoría, Estado del sistema, Coste de recetas globales… al coach normal | Tras 2 | Bajo-medio |
| **4. IA propia por coach (BYOK)** | Tabla de claves cifradas por coach; el enrutador resuelve la clave del coach; **nunca cae a la clave de Carlos sin acuerdo** (o con créditos medidos). Registro de consumo por coach. Aviso de saldo/clave inválida | Tras 3 | Medio |
| **5. Conexiones del coach** | TrainingPeaks (hay que ver si su API exige aprobación como partner), Garmin/Strava/Coros/Whoop con la app OAuth de plataforma; envío de entrenos por coach. Garmin no oficial: plan B | Tras 4 | Medio-alto |
| **6. Suscripciones** | Stripe Billing: planes, prueba gratis, límites por plan (clientes activos, uso de IA), webhook por coach, bloqueo suave si impago | Tras 3 | Medio |
| **7. Alta y legal** | Registro del coach, onboarding guiado, términos, RGPD: son **datos de salud** (categoría especial); contrato de encargado de tratamiento (el coach es responsable, tú el encargado), borrado/exportación de datos | Antes de aceptar el primer coach de pago | Medio (asesoría) |
| **8. Escala** | Cola de trabajos para planes con IA y sincronizaciones (en vez de crons que recorren todo en 300 s); Vercel Pro, Supabase Pro/compute mayor, índices por `coach_id`, caché; monitorización por coach; límites de uso | Cuando haya ~5-10 coaches o antes si el cron se queda corto | Medio-alto |

Orden recomendado: **0 → 1 → 2 → 3**, y a partir de ahí 4, 6, 7 en paralelo, luego 5 y 8. Lanzar a un grupo muy pequeño de coaches «amigos» (beta) tras la fase 4.

## 5. Escalabilidad: qué se rompería primero

1. **Crons globales con límite de 300 s** (propuestas de bloque con Opus, sincronizaciones Garmin, agentes diarios): con más clientes no terminan. → cola de trabajos y procesar por coach/cliente.
2. **Hosting Hobby**: no es válido para negocio. → Vercel Pro mínimo antes del primer cobro.
3. **Gasto de IA**: con claves propias de cada coach se reparte; si usan la tuya, tienes que medirlo y cobrarlo.
4. **Fuga de datos entre coaches**: el riesgo grave (fase 1).
5. **Garmin no oficial**: puede romperse con un cambio de Garmin y afectar a todos a la vez.
6. **Coste de Supabase** (BD, ancho de banda, almacenamiento): hoy bajo; revisar plan al pasar de unas decenas de clientes activos.

## 6. Apps de tienda (App Store / Google Play)

- **Hoy:** PWA (iOS: «añadir a pantalla de inicio»). Es suficiente para empezar y evita comisiones y revisiones.
- **Si hace falta app de tienda:** envolver la web (Capacitor u otro) para el cliente final. Una sola app de la plataforma, no una por coach.
- **Apps con la marca de cada coach (marca blanca):** son caras de mantener y las tiendas ponen condiciones a las apps «de plantilla». **No empezar por ahí.**
- Cobro de la suscripción del coach: en la web (Stripe), fuera de la app. Las reglas de pagos dentro de apps (comisión de Apple/Google) hay que **verificarlas en el momento** antes de decidir; cambian.

## 7. Qué NO hacer (de momento)

- No crear una instalación por coach.
- No construir marca blanca ni app propia por coach.
- No vender el acceso antes de cerrar las fases 1, 2 y 7 (aislamiento, catálogo y legal).
- No dar a los coaches acceso a la revisión/auditoría del catálogo base.

## 8. Preguntas abiertas (para Carlos)

1. **Modelo de cobro:** cuota fija por coach, por número de clientes, o mixto. ¿Rango de precio en mente?
2. **IA:** ¿solo con clave propia del coach, o también un plan «todo incluido» con tu IA y créditos?
3. **Ascender contenido del coach al catálogo base:** ¿sí, con tu aprobación? ¿Qué pasa con la autoría?
4. **Metodología/papers:** ¿los papers de la base son para todos y los coaches añaden los suyos privados?
5. **¿Sus clientes finales ven tu marca o la del coach?** (cambia el alcance del portal cliente).
6. **TrainingPeaks:** comprobar si su API está abierta o requiere solicitud de partner, y plazos.
7. **Fiscalidad:** Carlos no es autónomo; el cobro de una suscripción recurrente tiene que facturarse desde alguien con alta (hoy Jorge). Resolver antes de cobrar.

## 9. Próximo paso concreto

Cuando Carlos quiera avanzar: **fase 1** (mapa y auditoría de aislamiento de las 202 rutas + tests entre coaches). Es seguridad útil ya, sin lanzar ningún SaaS.

---

## 10. Ampliación (19-10-2026): ¿hay que migrar? ¿Vale para ~10 coaches? Hoja de ruta profesional

### Veredicto
**No hace falta migrar.** Next.js + Supabase (Postgres) + Vercel es el patrón estándar para SaaS de este tamaño. Con 10 coaches (≈ 200-500 clientes finales) la carga es pequeña. Los límites que importan son de **código** (aislamiento, tareas largas de IA, cobros), no de plataforma. Migrar solo se plantearía con cientos de coaches o requisitos de empresa (SSO, región dedicada), y aun así sería subir de plan, no cambiar de sistema.

### Coste de infraestructura para empezar (precios de las webs oficiales, 19-10-2026; revisar antes de contratar)
| Pieza | Plan | Coste |
|-------|------|-------|
| Vercel | Pro: 20 $/mes por persona, con 20 $ de crédito de uso y 1 TB de transferencia incluidos. **Hobby es solo para uso personal/no comercial**, así que Pro es obligatorio al cobrar | ≈ 20 $/mes |
| Supabase | Pro: desde 25 $/mes (8 GB de BD, 250 GB de salida, 100 GB de archivos, copias diarias 7 días, sin pausas). La capa gratuita se pausa por inactividad y no tiene copias | ≈ 25 $/mes (+ subir de instancia si hace falta) |
| Cloudinary (fotos) | Plan gratuito, hoy suficiente | 0 $ |
| Correo (Resend) | A revisar según volumen | 0-20 $ |
| IA | **La paga cada coach con su clave** (BYOK). Si incluyes IA en el plan, mídelo y cóbralo | 0 $ para ti |
| Sentry/monitorización, dominio | Recomendado | ≈ 10-20 $ |
| Terra (TrainingPeaks/Whoop/Coros vía intermediario) | Es de pago; **no he comprobado tarifa** | por confirmar |
| **Total base estimado** | | **≈ 55-90 $/mes** + comisión de Stripe |

Con 10 coaches a, por ejemplo, 30-60 €/mes cada uno, ingresos de 300-600 €/mes frente a unos 60-90 € de coste fijo: viable. No he comprobado el plan actual de Supabase ni el tamaño real de la base de datos; mirarlo en el panel antes de decidir.

### Por qué no se cae con 10 coaches (y qué sí vigilar)
- Postgres con índices por `coach_id` va sobrado a esta escala.
- **Tareas largas de IA** (propuesta de bloque con Opus: 140-250 s, límite 300 s): con 10 coaches empiezan a competir. Solución: cola de trabajos (una tarea por mensaje, reintentos) en lugar de un cron que recorre todo.
- **Sincronización de relojes:** Garmin por usuario y contraseña es **no oficial** y puede romperse o ser bloqueado. Para vender, mejor integración oficial o intermediario (Terra), y avisar al coach si falla.
- **Strava:** en producción la app necesita aprobación y tiene límites de atletas; hay que solicitarla antes de abrir (verificar condiciones vigentes).
- **TrainingPeaks:** su API es **solo para socios aprobados** («partner-gated», se solicita en api.trainingpeaks.com/request-access y son selectivos). Plan realista: empezar por Terra (que lo ofrece como integración) o exportación de archivos, y pedir acceso directo en paralelo, sin depender de la respuesta.

### Hoja de ruta como app profesional (con 10 coaches como objetivo)
**Etapa A — Base segura (sin coaches nuevos aún).** *Orden de magnitud: 2-4 semanas de trabajo con Claude.*
1. Mapa y auditoría de las 202 rutas con service role; una función común `autorizarCoach` obligatoria; test automático «coach B no ve nada de coach A» en cada tabla; test que falle si una ruta nueva no la usa.
2. Entorno de pruebas (staging) separado de producción, con datos ficticios.
3. Copias de seguridad y restauración probada (Supabase Pro).
4. Monitorización de errores y de tareas programadas.

**Etapa B — Producto multi-coach.** *3-5 semanas.*
5. Tabla `coaches`/organización con plan, estado y límites; roles `platform_admin` y `coach`.
6. Catálogo en capas (base + propio) y ocultar pantallas de plataforma (Revisión, Auditoría, Estado del sistema).
7. Metodología/papers: base común + privados por coach.
8. IA propia por coach: claves cifradas, enrutador por coach, medición de consumo, aviso de saldo/clave inválida, nunca usar tu clave por defecto.

**Etapa C — Negocio.** *2-4 semanas.*
9. Stripe Billing: planes, prueba, límites por plan, facturación desde la entidad con alta (hoy Jorge), webhook por coach.
10. Alta guiada del coach (onboarding), páginas legales: términos, privacidad, contrato de encargado de tratamiento (RGPD, datos de salud), exportar y borrar datos.
11. Soporte: canal de contacto, estado del servicio, registro de cambios.

**Etapa D — Integraciones del coach.** *Paralelo a B/C.*
12. Conexión de relojes y apps por coach vía integraciones oficiales o intermediario; solicitud de acceso a TrainingPeaks y Strava en producción.

**Etapa E — Beta cerrada.** 2-3 coaches conocidos, gratis o con descuento, 1-2 meses; medir tiempos, errores, consumo de IA y qué piden. Solo después abrir a más hasta 10.

**Etapa F — Escalar (cuando se acerque a 10 o antes si hay síntomas).**
13. Cola de trabajos para IA y sincronizaciones (Vercel Queues/Workflow u otra), límites por coach, caché, subir instancia de Supabase.
14. App de tienda (envoltorio de la PWA, una sola app para todos) solo si los coaches la piden.

### Qué NO hacer
- No reescribir en otra plataforma «por si acaso».
- No abrir a coaches antes de la Etapa A y de las páginas legales.
- No incluir IA «gratis» en el plan sin medir el coste por coach.
- No depender de Garmin no oficial ni de TrainingPeaks directo como promesa de venta.

### Decisiones que tomar antes de la Etapa B
Precio y modelo de cobro; IA incluida o solo propia; qué ve el cliente final (tu marca o la del coach); quién factura; si se permite ascender contenido de un coach al catálogo base.

---

## 11. Aclaración de Carlos (19-10-2026): claves propias de cada coach y app master para probar

**Modelo pedido:** cada coach mete sus propias cuentas (IA tipo Claude/Codex, TrainingPeaks) en su app y trabaja con sus clientes. La app master es para Carlos y sus clientes como hoy, y además sirve para gestionar la plataforma global y probar las funciones nuevas antes de pasarlas a la app de los coaches.

### Cómo encaja (recomendación)
Un solo código y una sola base de datos, con **tres entornos**:
1. **Producción – master:** el espacio de Carlos (coach + admin de plataforma). Sus clientes reales, como ahora. Ve además la consola de plataforma: catálogo base, revisión, auditorías, coaches, planes, consumo, interruptores de funciones.
2. **Producción – coaches:** cada coach en su espacio aislado; ve la app terminada.
3. **Pruebas (staging):** copia separada con datos ficticios (otro proyecto de Supabase y despliegue de vista previa de Vercel). Aquí se prueba todo lo nuevo, también el aislamiento entre coaches, **antes** de tocar los clientes reales de Carlos.

**Interruptores de funciones por espacio (feature flags):** cada función nueva nace activada solo en el espacio master; luego en 2-3 coaches beta; luego en todos. Si falla, se apaga sin desplegar. Así «probar en mi app y luego pasarlo a la de coaches» es un interruptor, no dos aplicaciones distintas.

### Claves de IA (Claude, GPT…)
- Cada coach pega **una clave de API** de su propio proveedor (Anthropic u OpenAI). Se guarda cifrada, se muestra enmascarada, tiene botón «probar clave» y aviso si falla o se queda sin saldo. El enrutador de modelos usa la clave del coach que lanza la tarea.
- **Importante:** una suscripción de chat (Claude Pro/Max o ChatGPT Plus) **no es una clave de API** y no vale para una app de terceros; Codex CLI y Claude Code funcionan con el login de la cuenta, no desde un servidor. El coach necesita crear una clave de API de pago por uso en la consola del proveedor (verificar condiciones vigentes de cada proveedor antes de prometerlo).
- Recomendar al coach fijar un límite de gasto mensual en su consola. Regla nuestra: nunca usar la clave de Carlos como respaldo para otro coach.

### TrainingPeaks
- **No se guardan usuario y contraseña de TrainingPeaks de los coaches:** no hay API pública con contraseña, hacerlo sería fraguar el acceso (frágil y contrario a sus condiciones) y un riesgo de seguridad grave.
- Vía correcta: **OAuth**. La plataforma (NutriCoach) es la aplicación autorizada y cada coach pulsa «Conectar TrainingPeaks» e inicia sesión en TrainingPeaks; nosotros solo guardamos tokens cifrados. Requiere que TrainingPeaks apruebe a NutriCoach como socio (se solicita una vez).
- Mientras llega esa aprobación: Terra (intermediario, mismo flujo de «Conectar») o exportar el entreno como archivo.
- Igual para Garmin, Strava, Coros y Whoop: la autorización la hace cada coach/atleta, la app es una sola.

### Efecto en la hoja de ruta
- Etapa A añade: **entorno de pruebas** y base de **interruptores de funciones**.
- Etapa B: consola de plataforma solo para `platform_admin`; claves de IA por coach (cifrado, probar, avisos).
- Etapa D: solicitud de socio a TrainingPeaks y Strava como tarea con plazo incierto; el producto no depende de ella.

---

## 12. Investigación profunda (19-10-2026): modelo «tipo Harbiz», escalado a corto y largo plazo

> Supuesto de lectura: «más de 100 clientes» = más de 100 **coaches suscritos** (cada uno con sus propios clientes finales). Con ~30 clientes por coach: 10 coaches ≈ 300 personas; 100 coaches ≈ 3.000; 300 coaches ≈ 9.000.
> Los precios de la competencia salen de páginas de comparativas de terceros (consultadas el 19-10-2026) y cambian a menudo: son orientativos.

### 12.1 El mercado (referencia)
| Producto | Precio de entrada | Escalado | Notas |
|----------|------------------|----------|-------|
| **Harbiz** (España) | 14-19 €/mes (5 clientes) | desde ~89-119 €/mes para más clientes | App en español, programas, nutrición, IA de planes (Harbiz Nutri AI), biblioteca de 900+ recetas **de pago aparte** |
| Everfit | 19 $/mes | 47 $ (25 clientes), 77 $ (50), hasta 242 $ (300) | Marca propia solo en planes altos |
| TrueCoach | ~26 $/mes (5 clientes) | 58 $ (20), 137 $ (50) | Sin app con marca propia |
| Trainerize | desde ~10-23 $ | hasta ~275 $ | App con marca propia: pago único de ~169 $ en plan Pro |
| Nutrium (nutrición) | 25-35 $/mes por profesional | módulos aparte (plan de comidas, seguimiento) | Referente de dietistas |

Lecciones: (1) el precio se escala **por número de clientes activos** del coach; (2) lo básico es barato y lo que se cobra son módulos (nutrición, marca, pagos, automatización): la factura real suele ser un 40-60 % mayor que el precio de entrada; (3) **ningún** gran actor ofrece app propia con marca del coach sin pagar extra, así que no es obligatorio para competir; (4) las quejas habituales de Harbiz: nutrición poco profunda (sin base de alimentos extensa ni escáner), plataforma que no une captación, automatización y pagos.

### 12.2 Dónde puede ganar NutriCoach (a confirmar con coaches reales)
No competir en precio con Harbiz (14 €). El hueco es **calidad científica + nutrición y entreno unidos + datos del reloj**: motor de dietas y planes con estudios citados, ~14.000 alimentos con micronutrientes, recetario auditado, entrenos con pasos al Garmin, análisis de rendimiento, IA supervisada. Segmento natural: **dietistas-nutricionistas y entrenadores de resistencia/híbrido (running, Hyrox, triatlón)**, que hoy juntan 3 herramientas. Precio por encima de Harbiz y por debajo de lo que paga quien usa Nutrium + TrainingPeaks.

### 12.3 Modelo de precios (propuesta, por validar)
Por **clientes activos** del coach, escalones tipo mercado, por ejemplo: prueba 14 días; hasta 10 clientes; hasta 30; hasta 60; más de 60 a medida. Módulos opcionales (IA incluida con créditos, conexión de relojes). Cobro mensual y anual (descuento). Rango orientativo de partida: 39-129 €/mes según escalón, **a validar con 3-5 coaches antes de fijarlo**. Ingresos orientativos: 10 coaches × ~60 € ≈ 600 €/mes; 100 coaches × ~60 € ≈ 6.000 €/mes.

### 12.4 Arquitectura por fases de tamaño
| Fase | Coaches | Personas | Qué hay que tener | Infra orientativa |
|------|---------|----------|-------------------|-------------------|
| **Piloto** | 1-10 | ≤ 300 | Aislamiento verificado, entorno de pruebas, interruptores de funciones, claves de IA por coach, cobro (puede ser enlace de pago de Stripe y alta manual), soporte directo por WhatsApp/correo, textos legales | Vercel Pro + Supabase Pro (≈ 55-90 $/mes) |
| **Primera tracción** | 10-30 | ≤ 1.000 | Alta autoservicio, Stripe Billing automático, límites por plan, cola de trabajos para IA y relojes, monitorización con alertas, centro de ayuda, copia de seguridad probada con restauración | Misma pila; subir instancia de Supabase y vigilar uso de Vercel |
| **Crecimiento** | 30-100 | ≤ 3.000-5.000 | Cuotas y límites de velocidad por coach (anti «vecino ruidoso»), análisis fuera de la base principal (réplica de lectura), registros y errores por coach, panel de plataforma (altas, bajas, consumo, ingresos), proceso formal de cambios y migraciones, estado del servicio | Instancia de BD mayor, réplica de lectura, trabajadores aparte para tareas largas. Orden de 100-300 $/mes (estimación, sin verificar) |
| **Escala** | 100-300+ | ≤ 10.000 | Programas de socios/afiliados, API pública y webhooks, posibles clientes grandes con espacio dedicado (aislamiento reforzado), revisión de seguridad externa, equipo de soporte | Plan Team/Enterprise de proveedores si hace falta; cambio de plataforma solo si un requisito concreto lo exige |

Patrón de datos recomendado a **todas** las escalas: una base compartida con una columna de inquilino en cada tabla, índices que empiezan por ella y seguridad por filas en la base de datos como segunda barrera (documentado como el estándar para SaaS de este tipo). Precauciones concretas: políticas de seguridad que no consulten por fila (si no, se ralentizan al crecer las tablas), tareas programadas conscientes del inquilino, límites por coach y análisis fuera de la base principal. Un coach muy grande puede pasar más tarde a un espacio dedicado sin cambiar el resto.

### 12.5 Cambios técnicos que el crecimiento exige (aparte de multi-coach)
1. **Tareas largas a cola:** planes con IA (140-250 s), sincronización de relojes, auditorías. Hoy son crons de 300 s que recorren todo.
2. **Los scripts del Mac de Carlos** (Content Radar, pasada autónoma del recetario, copia nocturna por launchd) son trabajo de plataforma, no de coaches: aceptable ahora; a partir de 30 coaches, trasladar lo crítico a tareas en la nube para no depender de que el Mac esté encendido.
3. **Observabilidad:** errores, duración de tareas y consumo de IA por coach; alertas.
4. **Costes de IA por coach** medidos desde el primer día, aunque pague él.
5. **Calidad automatizada:** el motor ya tiene 63 comprobaciones (`verificar:motor`); añadir pruebas de aislamiento y ejecutarlas antes de cada despliegue.
6. **Datos de salud (RGPD):** contrato de encargado de tratamiento, región de datos en la UE, exportar y borrar, registro de accesos.

### 12.6 App de tienda
- Mantener PWA mientras no haya demanda clara. Si se hace app: **una sola app de NutriCoach** con selector de coach/espacio (envoltorio de la web, p. ej. Capacitor). Apple admite plantillas solo si las envía quien proporciona el contenido; el modelo de «una app que aloja a todos» está descrito como aceptable. Las apps con marca propia por coach obligarían a cada coach a publicar con su cuenta: caro y de mucho soporte. No hacerlo.
- La suscripción del coach se cobra en la web. Las reglas de pago dentro de la app (comisiones, servicios de entrenamiento persona a persona) deben revisarse con el texto vigente de Apple/Google justo antes de publicar.

### 12.7 Riesgos principales y cómo se reducen
| Riesgo | Reducción |
|--------|-----------|
| Fuga de datos entre coaches | Etapa A completa antes del primer coach; pruebas automáticas; segunda barrera en la base |
| Responsabilidad por datos de salud | Contratos y RGPD antes de cobrar; seguro de responsabilidad a valorar |
| Tiempo de soporte (el verdadero coste a partir de ~10 coaches) | Centro de ayuda, alta guiada, límites por plan, no ofrecer personalización a medida |
| Dependencia de terceros (Garmin no oficial, TrainingPeaks cerrado, IA de coaches sin saldo) | Integraciones oficiales o intermediario; avisos claros; la app no depende de ellas para lo básico |
| Competir en precio con Harbiz | No hacerlo: vender calidad y nicho |
| Distraer a Carlos de Unité y de su propio negocio | Piloto pequeño, sin personalización, puerta cerrada hasta que la base esté lista |

### 12.8 Qué hacer primero (resumen)
1. Hablar con 3-5 dietistas/entrenadores reales (¿pagarían?, ¿cuánto?, ¿qué les falta de Harbiz/Nutrium?) **antes** de construir más.
2. Etapa A (aislamiento, entorno de pruebas, interruptores).
3. Piloto de 2-3 coaches amigos con cobro manual y soporte directo.
4. Solo con evidencia de demanda, Etapa B-C completas y llegar a 10.

---

## 13. Idea de Carlos (19-10-2026): ser más rentable que Harbiz (sin límite de clientes) y personalizar para algunos coaches — viabilidad

### 13.1 Objetivo
Que a un coach le **salga a cuenta cambiarse** a NutriCoach frente a Harbiz: más generoso (sin tope de clientes o muy alto), mejor y estable; y a algunos ofrecerles una app o apartados a medida.

### 13.2 ¿Se puede ofrecer «sin límite de clientes»? Sí, con condiciones
**Medición real (solo lectura, 19-10-2026):** la base de datos pesa **222 MB** con 12 clientes, 13.483 alimentos y 882 recetas. Lo más grande son tablas de plataforma (histórico de precios 71 MB, trabajos del puente 55 MB, auditoría de recetas 29 MB), no datos de clientes. Es decir, **el coste de infraestructura de un cliente final más es muy pequeño** (datos de unos pocos MB al año; hay que medirlo con uso real). La IA la paga el coach con su clave. Los costes que sí crecen con el número de clientes:
- fotos de progreso y de recetas (Cloudinary: gratis hasta 25 GB; después de pago),
- correos y avisos (Resend),
- relojes: sincronización de cada cliente; si se usa Terra, **su tarifa por usuario conectado** (sin comprobar),
- soporte (el coste real).

Por tanto: **tarifa plana sin tope de clientes es viable** si se protege con (a) cláusula de uso razonable (p. ej. hasta ~300 clientes activos; por encima, plan a medida), (b) módulos que sí cuestan dinero separados (conexión de relojes vía intermediario, almacenamiento extra, IA con créditos tuyos), (c) límites técnicos por coach para que uno no ralentice a los demás.

### 13.3 Propuesta de planes (hipótesis, por validar con coaches)
| Plan | Precio orientativo | Incluye |
|------|-------------------|---------|
| **Coach** | 39-59 €/mes | Todo el producto (nutrición, entreno, recetario, motor, check-ins, chat), clientes sin tope con uso razonable, IA con su clave |
| **Studio** | 99-149 €/mes | Lo anterior + marca propia (logo, colores, nombre, dominio), módulos a elegir, equipo de varios profesionales, soporte prioritario |
| **A medida** | pago único de alta + mensualidad | Módulos o pantallas específicos para un coach, con contrato y alcance cerrado |

Comparativa (precios de comparativas de terceros): Harbiz sube a ~89-119 €/mes al crecer; Everfit 77 $ (50 clientes) a 242 $ (300); TrueCoach 137 $ (50 clientes). Una tarifa plana de ~49 € sin tope es muy agresiva para coaches con muchos clientes.

**Números (estimación mía):** 10 coaches × 49 € = 490 €/mes frente a ~90 € de infraestructura y ~15 € de comisiones de cobro: margen de ~385 €/mes antes de tu tiempo. 100 coaches = 4.900 €/mes frente a ~250-400 € de infraestructura y ~120 € de comisiones. La infraestructura se cubre con 2-3 coaches; **lo caro es tu tiempo** (soporte, personalizaciones).

### 13.4 Lo que hace que un coach se cambie de verdad
1. **Migración asistida:** el mayor freno es el cambio de herramienta. Importar clientes, planes y recetas propias desde lo que el coach exporte de Harbiz (CSV/Excel/PDF) con un asistente, y migración «hecha por nosotros» en la beta. No acceder a Harbiz con el usuario del coach ni extraer datos de su web; solo lo que él mismo exporte. Hay que comprobar qué permite exportar Harbiz.
2. **Garantía de salida:** «exporta todos tus datos cuando quieras» (genera confianza ante un producto nuevo).
3. **Precio de fundador** bloqueado de por vida para los primeros 10 coaches y prueba larga.
4. **Estabilidad demostrable:** página de estado, copias de seguridad probadas, pruebas automáticas antes de cada versión. Con un producto nuevo, la estabilidad se demuestra con hechos, no con promesas.
5. **Paridad de funciones con lo que el coach ya usa.** Hueco probable frente a Harbiz (a confirmar con una matriz de funciones): **agenda y reservas de sesiones/clases**, **cobro del coach a sus clientes** (Stripe Connect, facturas), videollamada/citas y biblioteca de ejercicios con vídeo. Es lo que más puede frenar el cambio, no el motor de dietas.

### 13.5 Personalización: tres niveles
| Nivel | Qué es | Coste para ti | Cómo |
|-------|--------|---------------|------|
| **1. Configuración** | Logo, colores, nombre, módulos activados/desactivados, campos del cuestionario, textos, plantillas | Muy bajo (una vez en el producto) | Ajustes por espacio; el sistema visual ya usa variables de diseño, falta hacerlas configurables por coach |
| **2. Módulo opcional** | Función pedida por un coach, construida **una vez** y activada con interruptor | Medio, pero reutilizable | Lo que pide uno suele pedirlo otro: entra al catálogo de módulos |
| **3. A medida de verdad** | Pantallas o flujos solo para ese coach, o app propia en tienda | Alto y continuo | Solo como módulo con interruptor **dentro del mismo código**; cobrar alta + mensualidad con alcance cerrado |

Regla clave: **nunca bifurcar el código por coach** (una copia por cliente multiplica el mantenimiento y mata las mejoras compartidas). Todo lo particular vive como configuración o módulo con interruptor.
- **App propia en tienda para un coach:** solo si publica con su cuenta de desarrollador (Apple y Google cobran cuota anual al desarrollador; importes a verificar), con mantenimiento mensual aparte. La PWA con su logo y colores cubre la mayoría de casos sin tienda.

### 13.6 Riesgos de esta estrategia
| Riesgo | Mitigación |
|--------|-----------|
| Atrae coaches grandes con miles de clientes y costes altos | Uso razonable y plan a medida por encima de ~300 clientes activos |
| Las personalizaciones se comen tu tiempo | Alta de pago, contrato, alcance cerrado, tope de proyectos a la vez; priorizar módulos reutilizables |
| Precio bajo sin base de pago suficiente | Validar disposición a pagar con 3-5 coaches antes de fijar precios; precio de fundador solo para los primeros |
| Promesa de «mejor y estable» sin pruebas | Beta cerrada, estado público, métricas de errores, copias probadas |
| Paridad de funciones insuficiente frente a Harbiz | Matriz de funciones y priorizar las que frenan el cambio (agenda, cobros) |
| Carga legal/RGPD | Contrato de encargado, borrado y exportación de datos, región UE |

### 13.7 Veredicto y siguientes pasos
**Viable**, y es una estrategia razonable para un producto nuevo: infraestructura casi gratis por cliente y valor diferencial (motor científico, nutrición+entreno+reloj). Lo que decide si funciona no es el coste técnico, sino (1) la paridad de funciones con lo que el coach ya usa, (2) la migración fácil y (3) tu capacidad de soporte.
Pasos de estudio, sin construir nada aún:
1. **Matriz de funciones Harbiz vs NutriCoach** (qué tiene cada uno, qué falta, qué frena el cambio).
2. **Qué puede exportar un coach de Harbiz** y viabilidad del importador.
3. **Entrevistas** a 3-5 coaches (precio, funciones imprescindibles, qué personalizarían).
4. Con eso, afinar planes y fijar el alcance de la etapa A-B.

---

## 14. Matriz de funciones Harbiz vs NutriCoach (20-10-2026)

> Harbiz: lo que publica en su web (harbiz.io) y su centro de ayuda; no he usado el producto. NutriCoach: lo que hay en el código hoy (páginas, rutas y librerías). «No encontrado» = no hay rastro en el código; confirmar con Carlos.

| Área | Harbiz | NutriCoach hoy | Brecha |
|------|--------|----------------|--------|
| Planes de nutrición | Sí; IA de planes; biblioteca de 900+ recetas (pago aparte) | **Más profundo**: motor con reglas clínicas, ~13.500 alimentos con micronutrientes, 882 recetas auditadas, planificador semanal, lista de la compra, suplementación | Ventaja nuestra |
| Planes de entrenamiento | Rutinas, programas por bloques, IA | Plantillas, bloques con progresión, Hyrox/running, pasos al Garmin, calendario por fecha | Ventaja nuestra; falta biblioteca de ejercicios con vídeo propio completa |
| Seguimiento / check-ins / progreso | Sí | Sí (peso, fotos, medidas, adherencia, análisis de rendimiento) | Paridad o ventaja |
| Datos de relojes | No lo menciona | Garmin, Strava, Google Fit, Whoop, Coros | Ventaja nuestra (con las cautelas de Garmin/TrainingPeaks) |
| IA | Rutinas y planes de nutrición | Entrenador IA supervisado, análisis, planes con estudios citados | Ventaja nuestra |
| Cuestionarios / formularios | Sí | Sí | Paridad |
| Chat con el cliente | Sí | Sí | Paridad |
| **Agenda y reservas de sesiones** | Sí (horarios, reservas, políticas de cancelación, recordatorios) | **No encontrado** | **Brecha** |
| **Cobros recurrentes, facturas y control financiero** | Sí (automatización, facturación recurrente, facturas) | Solo cobro puntual con Stripe (enlace de pago y checkout) y el cobro de la suscripción a ti; **sin facturas, sin cobro recurrente del coach a sus clientes** (sin Stripe Connect) | **Brecha** |
| **Gestión de personal / varios profesionales** | Sí | **No**: un coach por espacio | **Brecha** (necesaria para plan Studio) |
| App con marca propia | Sí (en su oferta) | PWA propia sin marca por coach | Brecha parcial: la PWA con logo y colores por coach es alcanzable |
| Retos, logros, comunidad, referidos | Sí | Logros retirados a propósito del portal; sin comunidad ni referidos | Brecha menor / decisión de producto |
| Web personal del coach | Sí | No | Brecha menor (no prioritaria) |
| Videollamada | No lo menciona | No encontrado | No es diferencial |
| Idiomas | Español y más | Solo castellano | Brecha si se sale de España |
| Exportar datos del coach | No verificado | Solo PDF de dieta; **sin exportación completa de datos** | **Brecha** (necesaria para la garantía de salida y el RGPD) |
| Importar desde otra herramienta | No verificado | No existe | **Brecha clave** para captar coaches |

### Lectura
- **Ganamos** en profundidad de nutrición y entreno, relojes e IA. Es el argumento de venta.
- **Perdemos** en lo que hace funcionar el negocio del coach: **cobros recurrentes y facturas, agenda/reservas, varios profesionales**, y en la puerta de entrada y salida: **importar y exportar datos**.
- Para que a un coach le compense cambiar, antes de captar nada hay que cubrir al menos: **exportar e importar**, **cobro del coach a sus clientes (Stripe Connect o equivalente) con facturas** y **agenda/reservas básica**. Lo demás puede esperar.

### Orden de construcción sugerido (tras la etapa A de aislamiento)
1. Exportar todos los datos del coach (CSV/ZIP) — sirve también para RGPD y la garantía de salida.
2. Importador desde hojas/CSV (clientes, pautas, recetas propias).
3. Cobro recurrente del coach a sus clientes con facturas (Stripe Connect; valorar requisitos fiscales).
4. Agenda y reservas básicas con recordatorios.
5. Marca propia por coach (logo, colores, nombre) en la PWA.
6. Varios profesionales por espacio (plan Studio).
Fuera de alcance por ahora: web personal, comunidad, retos, videollamada.

### Pendiente de verificar (necesita a Carlos o a coaches reales)
- Qué datos deja exportar Harbiz a un coach (para el importador).
- Qué funciones usan de verdad los coaches de Harbiz (entrevistas).
- Requisitos fiscales de cobrar a los clientes del coach a través de la plataforma.
