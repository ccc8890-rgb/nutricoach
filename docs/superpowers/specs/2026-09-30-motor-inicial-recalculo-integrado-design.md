# Motor inicial y de recálculo integrado — Especificación de diseño

**Fecha:** 30-09-2026  
**Estado:** Pendiente de revisión final de Carlos  
**Ámbito:** NutriCoach — nutrición, entrenamiento, Garmin, Strava y seguimiento del cliente  
**Dirección:** Codex  
**Colaboración técnica:** Claude  

## 1. Resumen ejecutivo

NutriCoach evolucionará desde varios generadores y revisores parcialmente independientes hacia un sistema único de prescripción y seguimiento. El sistema generará un plan inicial coordinado de nutrición y entrenamiento a partir del onboarding y aumentará su precisión conforme acumule datos de ejecución, check-ins, Garmin, Strava y registros manuales.

El enfoque aprobado es híbrido:

1. Las reglas deterministas calculan límites, dosis, alertas y condiciones de seguridad.
2. Una capa de calidad y confianza determina si los datos permiten decidir.
3. La IA actúa como asesora para interpretar contexto complejo, comparar alternativas y redactar propuestas estructuradas.
4. El coach revisa y aprueba siempre antes de aplicar cualquier cambio.
5. Todo plan y modificación queda versionado, justificado, trazable y reversible.

El sistema no debe reaccionar a una medición aislada ni confundir ausencia de datos con ausencia de actividad. Debe declarar explícitamente cuándo conviene mantener, observar, pedir información adicional, proponer un cambio o escalar el caso.

## 2. Problema y hallazgos de la auditoría

La plataforma dispone de onboarding, planes nutricionales, plantillas de entrenamiento, check-ins, periodización, actividad de Garmin y Strava, registros de sesiones y revisores semanales. Sin embargo, estas piezas todavía no forman una única cadena de decisión coherente.

Hallazgos que esta especificación debe resolver:

- La generación posterior al onboarding puede recibir un `401` silencioso, dejando el proceso incompleto sin una explicación útil para el coach.
- Existen caminos capaces de crear planes duplicados si una operación se reintenta o si dos acciones concurren.
- El entrenamiento inicial automático parte de una plantilla básica y no aprovecha de forma completa el perfil del atleta, la fase deportiva ni la coordinación con nutrición.
- El generador científico de entrenamiento y la asignación inicial no comparten un único núcleo de prescripción.
- El recálculo nutricional actual puede modificar objetivos de kcal y macros sin reconstruir coherentemente recetas, cantidades, micronutrientes, lista de compra y coste.
- Garmin, Strava y el registro interno aportan señales heterogéneas y pueden representar una misma actividad más de una vez.
- La ausencia de actividad puede deberse a una sincronización rota, especialmente en fuentes basadas en webhook, y no debe interpretarse automáticamente como inactividad.
- No hay una política única y explícita que separe revisiones diarias, semanales, quincenales, mensuales y extraordinarias.
- Las reglas científicas y referencias existentes no están conectadas de forma sistemática con la decisión concreta, la población, la versión y el nivel de evidencia.
- La aplicación de recomendaciones requiere reforzar la comprobación de que el coach es propietario o está autorizado sobre el cliente.
- Los planes observados en el caso piloto de Carlos son aceptables como base, pero resultan demasiado básicos en personalización, progresión, variedad y coordinación entre carga deportiva y alimentación.

Estos hallazgos son requisitos de diseño: una implementación no se considerará completa si añade una nueva capa de IA sin corregir primero la integridad del flujo y de los datos.

## 3. Objetivos

### 3.1 Objetivos funcionales

- Crear un perfil base versionado desde el onboarding, sin inventar valores ausentes.
- Generar planes iniciales coordinados de nutrición y entrenamiento.
- Funcionar desde el primer día sin wearable y mejorar gradualmente con datos reales.
- Normalizar señales de Garmin, Strava, la aplicación, check-ins y registros manuales.
- Producir recomendaciones con confianza, justificación, evidencia y fecha de reevaluación.
- Aplicar cambios únicamente tras aprobación expresa del coach.
- Recalcular planes completos y coherentes, no solo sus cifras resumen.
- Mantener snapshots íntegros y permitir rollback.
- Construir una base científica versionada y auditable.
- Ampliar el recetario según huecos medibles de cobertura.
- Validar el sistema con Carlos antes de extenderlo a otros clientes.

### 3.2 Objetivos de calidad

- Reproducibilidad: mismos datos y misma versión de reglas producen el mismo núcleo de cálculo.
- Explicabilidad: el coach puede saber qué cambió, por qué y con qué datos.
- Seguridad: los límites clínicos y deportivos no dependen de la IA.
- Idempotencia: reintentar una operación no duplica planes, actividades ni propuestas.
- Observabilidad: cada ejecución deja resultado, estado, entradas, versión y errores.
- Degradación segura: una fuente ausente reduce la confianza, pero no bloquea innecesariamente el servicio.

## 4. No objetivos

- Diagnosticar patologías ni sustituir atención médica, fisioterapia o psicología.
- Aplicar cambios automáticamente, incluso cuando la confianza sea alta.
- Usar una métrica propietaria de Garmin o Strava como verdad clínica absoluta.
- Recomendar cambios basados en una sola lectura anómala sin contexto suficiente.
- Generar recetas o ejercicios inexistentes y publicarlos sin validación.
- Crear un plan clínico para situaciones fuera del alcance profesional declarado.
- Ejecutar inicialmente el nuevo motor contra toda la cartera de clientes.
- Reemplazar el juicio del coach por un score opaco.

## 5. Principios de decisión

1. **Seguridad antes que optimización.** Contraindicaciones, disponibilidad energética insuficiente, lesión, enfermedad o deterioro agudo detienen el ajuste normal y escalan el caso.
2. **Tendencias antes que puntos aislados.** Las decisiones usan ventanas temporales y comparan línea base, variabilidad y contexto.
3. **Calidad antes que cantidad.** Más datos no implican más confianza si están duplicados, desactualizados o son contradictorios.
4. **Ausencia de evidencia no es evidencia de ausencia.** Una fuente rota no demuestra inactividad.
5. **Cambios mínimos efectivos.** Se propone la menor modificación razonable y se define cuándo reevaluarla.
6. **Una hipótesis por ajuste.** Siempre que sea viable, se evita cambiar demasiadas variables simultáneamente.
7. **Plan conjunto.** Entrenamiento y nutrición comparten calendario, carga prevista, recuperación y competición.
8. **Coach en control.** Confianza alta prioriza la revisión, nunca autoriza la aplicación automática.
9. **Versionado completo.** Las decisiones históricas conservan las reglas y evidencias vigentes cuando se tomaron.
10. **Reversibilidad.** Todo cambio aplicado puede compararse y restaurarse desde un snapshot válido.

## 6. Arquitectura de alto nivel

```text
Onboarding + contexto del coach + calendario deportivo
                         │
                         ▼
              Perfil base versionado
                         │
                         ▼
        Núcleo científico determinista común
              ┌──────────┴──────────┐
              ▼                     ▼
       Prescripción nutricional   Prescripción de entrenamiento
              └──────────┬──────────┘
                         ▼
              Plan coordinado propuesto
                         │
                  aprobación coach
                         ▼
                   Plan activo Vn
                         │
      ┌──────────────────┼───────────────────┐
      ▼                  ▼                   ▼
 check-ins/app      Garmin/Strava       sesiones internas
      └──────────────────┬───────────────────┘
                         ▼
          Ingesta, deduplicación y normalización
                         ▼
       Calidad + frescura + tendencias + confianza
                         ▼
        Reglas científicas + IA asesora acotada
                         ▼
            Recomendación estructurada
                         │
                  aprobación coach
                         ▼
          transacción + snapshot + Plan Vn+1
                         ▼
              medición y posible rollback
```

La IA no ocupa el centro de autoridad. Recibe un contexto preparado y salidas deterministas, y devuelve una propuesta dentro de un esquema estricto. Las validaciones se ejecutan antes y después de su intervención.

## 7. Componentes e interfaces

### 7.1 Constructor de perfil base

Responsabilidades:

- Validar y normalizar el onboarding.
- Separar dato declarado, dato medido, inferencia y decisión del coach.
- Registrar origen, fecha, unidad, frescura y calidad.
- Detectar campos críticos ausentes y contradicciones.
- Crear una versión inmutable del perfil utilizada por la generación inicial.

Capas del perfil:

- Salud y seguridad: patologías, medicación, alergias, lesiones, contraindicaciones y derivaciones.
- Antropometría y objetivo: peso, altura, composición, experiencia, objetivo y prioridad.
- Entrenamiento: modalidad, nivel, disponibilidad, equipamiento, marcas, competición y experiencia.
- Nutrición: hábitos, horarios, restricciones, preferencias, habilidades de cocina y presupuesto.
- Conducta y recuperación: sueño, estrés, autoeficacia, barreras y adherencia esperada.

Interfaz conceptual de salida:

```ts
interface PerfilBaseVersionado {
  clienteId: string
  version: number
  creadoEn: string
  datos: Record<string, DatoPerfil>
  alertas: AlertaSeguridad[]
  faltantesCriticos: string[]
  contradicciones: Contradiccion[]
  calidadGlobal: number
}

interface DatoPerfil {
  valor: unknown
  unidad?: string
  origen: 'onboarding' | 'coach' | 'medicion' | 'wearable' | 'importacion'
  observadoEn: string
  calidad: number
}
```

### 7.2 Núcleo científico determinista

Responsabilidades:

- Calcular gasto energético como rango y registrar fórmula y supuestos.
- Determinar objetivos de proteína, grasa mínima, carbohidratos y distribución.
- Evaluar disponibilidad energética y límites de seguridad.
- Calcular volumen, frecuencia, intensidad, progresión, recuperación y fase deportiva.
- Aplicar restricciones de lesión, salud, experiencia, disponibilidad y equipamiento.
- Entregar límites y opciones válidas a los constructores de plan.

Cada resultado del núcleo incluye `reglaId`, `reglaVersion`, entradas, salida, rango permitido y referencias de evidencia.

### 7.3 Coordinador de plan inicial

Responsabilidades:

- Crear una única propuesta que combine nutrición y entrenamiento.
- Convertir el calendario de entrenamiento en días de carga alta, media, baja y descanso.
- Coordinar kcal, carbohidratos, timing, hidratación y recuperación con esas cargas.
- Seleccionar estructura de mesociclo y progresión compatibles con objetivo y experiencia.
- Impedir duplicados mediante una clave de idempotencia por cliente, versión de perfil y solicitud.
- Presentar cálculos, supuestos, alertas y datos ausentes al coach antes de activar.

### 7.4 Ingestor y normalizador de señales

Responsabilidades:

- Importar Garmin, Strava, sesiones internas, registros manuales y check-ins.
- Conservar el evento bruto y producir una señal normalizada separada.
- Unificar unidades, zona horaria y semántica.
- Deduplicar la misma actividad entre proveedores.
- Marcar cobertura, frescura, retraso de sincronización y posibles fallos.

La deduplicación utilizará identificadores externos cuando existan y, en su defecto, una huella compuesta por cliente, intervalo temporal, tipo, duración, distancia y tolerancias configuradas. La procedencia de todas las copias se conserva.

Categorías normalizadas:

- Carga externa: duración, distancia, desnivel, series, repeticiones, tonelaje, ritmo y potencia.
- Carga interna: RPE, frecuencia cardiaca, tiempo en zonas y respuesta fisiológica.
- Recuperación: sueño, HRV, frecuencia cardiaca en reposo, fatiga y percepción.
- Adherencia: sesiones completadas, ingestas registradas y seguimiento declarado.
- Resultado: peso, composición, rendimiento y síntomas.

### 7.5 Evaluador de calidad y confianza

La confianza no es una opinión del modelo. Se calcula a partir de:

- Cobertura de las señales necesarias.
- Frescura de cada dato.
- Fiabilidad conocida de la fuente y de la métrica.
- Consistencia entre fuentes.
- Longitud y estabilidad de la tendencia.
- Adherencia suficiente para atribuir resultados al plan.
- Ausencia de eventos que invaliden la comparación.

Las ponderaciones y los umbrales de este cálculo serán configurables y versionados. Se calibrarán mediante casos sintéticos y el piloto con Carlos, y nunca se introducirán como constantes arbitrarias sin origen, justificación y trazabilidad.

Salida conceptual:

```ts
interface EvaluacionDecision {
  estado: EstadoDecision
  confianza: number
  senalesAFavor: EvidenciaObservada[]
  senalesEnContra: EvidenciaObservada[]
  datosAusentes: string[]
  calidadPorFuente: Record<string, number>
  proximaRevision: string
}

type EstadoDecision =
  | 'datos_insuficientes'
  | 'datos_desactualizados'
  | 'fuentes_contradictorias'
  | 'mantener_plan'
  | 'observar'
  | 'proponer_cambio'
  | 'revision_prioritaria'
```

### 7.6 Motor de recomendaciones

Responsabilidades:

- Ejecutar reglas de seguridad y elegibilidad.
- Seleccionar la cadencia apropiada.
- Determinar si procede mantener, observar, pedir datos, cambiar o escalar.
- Limitar magnitud y frecuencia de cambios.
- Construir una propuesta comparativa y reversible.
- Invocar a la IA solo con datos necesarios, ya normalizados y minimizados.

Interfaz de recomendación:

```ts
interface RecomendacionPlan {
  id: string
  clienteId: string
  tipo: 'nutricion' | 'entrenamiento' | 'coordinada' | 'recopilar_datos' | 'escalar'
  estadoDecision: EstadoDecision
  confianza: number
  resumen: string
  cambios: CambioPropuesto[]
  datosUtilizados: ReferenciaDato[]
  datosAusentes: string[]
  contradicciones: string[]
  reglasAplicadas: ReferenciaRegla[]
  impactoEsperado: string
  riesgos: string[]
  fechaReevaluacion: string
  requiereAprobacionCoach: true
}
```

### 7.7 Asesor de IA

Usos autorizados:

- Interpretar combinaciones complejas dentro de límites ya calculados.
- Comparar alternativas válidas.
- Proponer una estructura de mesociclo entre opciones seguras.
- Detectar contradicciones semánticas.
- Redactar explicaciones profesionales para el coach.

Usos prohibidos:

- Alterar límites de seguridad.
- Inventar datos faltantes.
- Crear ejercicios o recetas no presentes en catálogos validados.
- Aplicar cambios.
- Decidir la autorización del coach.
- Ocultar incertidumbre o convertir una asociación en causalidad.

La salida debe validarse contra un esquema estructurado. Un fallo del modelo nunca modifica el plan activo; produce un error observable o una recomendación puramente determinista.

### 7.8 Constructor nutricional integral

Al crear o recalcular una dieta debe reconstruir coherentemente:

- Energía y macros diarios y por tipo de día.
- Distribución por comidas y timing peri-entreno.
- Recetas, ingredientes, cantidades y porciones.
- Micronutrientes y alertas de cobertura.
- Restricciones, alérgenos y preferencias.
- Variedad, repetición y viabilidad culinaria.
- Lista de compra, coste estimado y disponibilidad.

No se considera recálculo integral cambiar únicamente `kcal_objetivo` o los macros resumen.

### 7.9 Constructor de entrenamiento integral

Al crear o recalcular un plan debe reconstruir coherentemente:

- Objetivo y fase del bloque.
- Frecuencia, volumen, intensidad y distribución semanal.
- Sesiones, ejercicios, series, repeticiones, descansos y progresión.
- Carrera: volumen, intensidad, zonas, desnivel y sesiones clave.
- Compatibilidad entre fuerza y resistencia.
- Días de descanso, descarga, tapering y recuperación.
- Restricciones de lesión, equipamiento y agenda.
- Relación con la estrategia nutricional de cada día.

### 7.10 Gestor de versiones, transacciones y rollback

Responsabilidades:

- Crear un snapshot completo antes de cada aplicación.
- Aplicar nutrición, entrenamiento y dependencias en una transacción.
- Registrar autor, fecha, motivo, recomendación, reglas, evidencia y versión del motor.
- Restaurar una versión anterior sin perder el historial posterior.
- Impedir estados parciales si falla cualquier operación.

## 8. Modelo conceptual de datos

Entidades principales:

- `perfil_base_versiones`: fotografía del perfil usado en cada prescripción.
- `fuentes_dato_cliente`: conexiones, estado, última recepción y calidad por fuente.
- `eventos_actividad_brutos`: payload original con acceso restringido y retención definida.
- `senales_normalizadas`: observaciones canónicas, unidad, origen y calidad.
- `grupos_actividad_deduplicada`: relación entre eventos equivalentes.
- `reglas_cientificas`: regla, versión, población, rango, límites y estado.
- `referencias_cientificas`: cita, DOI/PMID, tipo de evidencia y evaluación.
- `regla_referencias`: vínculo entre regla y evidencia.
- `ejecuciones_motor`: cadencia, entradas, versiones, estado y errores.
- `recomendaciones_plan`: propuesta, confianza, razones, estado y aprobación.
- `recomendacion_datos`: señales exactas utilizadas.
- `recomendacion_reglas`: reglas y versiones aplicadas.
- `versiones_plan`: snapshot lógico de nutrición y entrenamiento.
- `aprobaciones_plan`: coach, autorización, decisión y comentario.
- `resultados_ajuste`: medición posterior y evaluación del efecto.
- `cobertura_recetario`: huecos por tipo de comida, macros, dieta y uso deportivo.

Las tablas actuales podrán adaptarse mediante vistas o relaciones. La implementación deberá preservar compatibilidad hasta completar la migración y evitar dos fuentes de verdad activas.

## 9. Flujo de creación inicial

1. El cliente completa el onboarding.
2. El constructor valida campos, unidades, seguridad y consistencia.
3. Se crea una versión del perfil base.
4. El núcleo determinista calcula rangos nutricionales y de entrenamiento.
5. Se comprueba si faltan datos críticos. Los no críticos reducen confianza; los críticos bloquean la propuesta y generan preguntas concretas.
6. El coordinador genera una propuesta conjunta por tipos de día.
7. El constructor nutricional selecciona recetas validadas y escala cantidades.
8. El constructor de entrenamiento crea el bloque y sus progresiones.
9. Se ejecutan validaciones cruzadas de energía, recuperación, agenda, lesiones y competición.
10. La IA asesora explica supuestos y compara alternativas válidas cuando sea necesario.
11. El coach revisa cálculos, alertas, plan y evidencia.
12. Tras aprobación, una transacción crea la versión activa y su snapshot.
13. El sistema agenda las primeras revisiones según disponibilidad de datos.

El flujo completo usa una clave de idempotencia. Si una petición se repite, devuelve el resultado existente o continúa una ejecución recuperable; nunca crea un segundo plan activo accidental.

## 10. Flujo de seguimiento y recálculo

1. Se reciben eventos de fuentes conectadas y registros internos.
2. Se conserva el evento bruto, se normaliza y se intenta deduplicar.
3. Se evalúa salud de cada fuente antes de interpretar ausencia de actividad.
4. Se forman ventanas de tendencia ajustadas a la cadencia.
5. Se calcula calidad y confianza por dominio.
6. Las reglas determinan el estado de decisión.
7. Si procede, se construye una recomendación con cambio mínimo, límites y reevaluación.
8. La IA asesora puede interpretar el contexto, sin alterar restricciones.
9. El coach compara plan actual y propuesta y aprueba o rechaza.
10. La aprobación crea snapshot y aplica el nuevo plan de forma transaccional.
11. El resultado se mide en la ventana prevista.
12. El coach puede mantener, iterar o restaurar una versión anterior.

## 11. Cadencias

### 11.1 Diaria

- Ingesta y salud de sincronizaciones.
- Alertas relevantes de seguridad, recuperación o dolor.
- Preparación contextual para la sesión o el día.
- No modifica normalmente la estructura del plan.

### 11.2 Semanal

- Cumplimiento del plan y sesiones realizadas.
- Carga, fatiga, recuperación y tolerancia.
- Pequeños desajustes operativos.
- Recomendaciones de magnitud limitada si existe señal suficiente.

### 11.3 Quincenal

- Tendencias de peso, composición, hambre, rendimiento y adherencia.
- Ajustes de dosis nutricional, volumen o intensidad cuando la atribución sea razonable.
- Revisión de variedad, tolerancia y disponibilidad real.

### 11.4 Mensual o fin de bloque

- Recalibración completa.
- Nueva progresión o mesociclo.
- Revisión de objetivos y supuestos.
- Evaluación global de resultados y calidad de la prescripción.

### 11.5 Extraordinaria

- Lesión, enfermedad, competición, viaje o cambio importante de horarios.
- Cambio clínicamente relevante o deterioro inesperado.
- Pérdida de conexión de una fuente crítica.
- Revisión prioritaria, sin aplicación automática.

## 12. Política de cambios

Toda propuesta debe especificar:

- Estado de decisión.
- Confianza y cómo se calculó.
- Datos a favor, en contra, ausentes y desactualizados.
- Plan actual frente a propuesta.
- Magnitud máxima permitida.
- Tiempo desde el último cambio.
- Riesgos y validaciones de seguridad.
- Reglas y referencias aplicadas.
- Impacto esperado y fecha de reevaluación.
- Ruta de rollback.

Las guardas mínimas incluyen:

- Periodo mínimo entre cambios de la misma variable salvo evento extraordinario.
- Magnitudes acotadas por regla y población.
- No atribuir falta de progreso al plan si la adherencia es insuficiente.
- No atribuir inactividad si una integración está desactualizada o caída.
- No acumular recomendaciones equivalentes pendientes.
- No aplicar un cambio a un plan inexistente o inactivo.
- No aprobar en nombre de un coach no autorizado.

## 13. Base científica versionada

Cada regla tendrá:

- Pregunta o decisión que resuelve.
- Población y exclusiones.
- Entradas necesarias.
- Fórmula, rango o condición operativa.
- Límites y contraindicaciones.
- Resultado práctico.
- Nivel de certeza.
- Referencias con DOI o PMID cuando exista.
- Fecha de revisión y versión.
- Estado: activa, en revisión o retirada.

Jerarquía de evidencia:

1. Guías de consenso y posicionamientos profesionales.
2. Revisiones sistemáticas y metaanálisis.
3. Ensayos controlados.
4. Estudios observacionales.
5. Opinión experta identificada explícitamente.

Dominios iniciales obligatorios:

- Gasto energético y calibración por respuesta real.
- Disponibilidad energética y RED-S.
- Proteína total, distribución y umbral por comida.
- Carbohidratos según modalidad, carga y competición.
- Grasas mínimas y calidad dietética.
- Hidratación, sodio y termorregulación.
- Nutrición pre, intra y postentrenamiento.
- Pérdida de grasa y preservación muscular.
- Hipertrofia, fuerza, resistencia y perfiles híbridos.
- Volumen, intensidad, progresión, deload y tapering.
- Sueño, fatiga, HRV y recuperación.
- Interferencia fuerza-resistencia.
- Lesión y retorno progresivo.
- Validez y limitaciones de métricas de wearables.

Una actualización científica crea una nueva versión de regla. Los planes históricos mantienen la referencia original y las nuevas ejecuciones utilizan únicamente versiones activas.

## 14. Recetario guiado por cobertura

La ampliación se prioriza por una matriz de huecos, no por cantidad total de recetas.

Dimensiones de cobertura:

- Desayuno, comida, cena, snack y peri-entreno.
- Rangos de kcal, proteína, carbohidratos y grasa.
- Día alto, medio, bajo y descanso.
- Omnívoro, vegetariano y vegano.
- Alergias, intolerancias y exclusiones.
- Preparación rápida, batch cooking y elaboración avanzada.
- Presupuesto y disponibilidad comercial.
- Transportabilidad y restauración.
- Alta densidad energética y alto volumen.
- Precompetición, intra, recuperación y tolerancia digestiva.

Quality gate de receta:

- Ingredientes y cantidades plausibles.
- Macros y micronutrientes recalculados desde alimentos válidos.
- Porciones realistas y escalables.
- Alérgenos y restricciones completos.
- Coste y disponibilidad estimables.
- Etiquetas deportivas y digestivas verificadas.
- Estado aprobado antes de ser elegible por el motor.

El auditor de cobertura genera un ranking de huecos por frecuencia de demanda, impacto y dificultad para encajar planes. Las nuevas recetas se crean y validan contra ese ranking.

## 15. Seguridad, autorización y privacidad

- Toda lectura o mutación valida sesión y rol.
- Toda aprobación comprueba relación autorizada entre coach y cliente.
- Las operaciones privilegiadas no confían en un `clienteId` recibido sin verificar propiedad.
- Los datos de salud y actividad se minimizan en prompts y registros.
- Tokens de Garmin y Strava se almacenan cifrados y nunca se incluyen en logs ni prompts.
- Los payloads brutos tienen acceso y retención restringidos.
- Cada acceso sensible y cada cambio de plan deja auditoría.
- Las alertas de alcance clínico se escalan; no se convierten en prescripción automática.
- Un fallo de IA, sincronización o transacción conserva el plan activo anterior.
- La revocación de una integración detiene nuevas ingestas sin borrar el historial necesario para auditoría.

## 16. Observabilidad y manejo de errores

Cada ejecución registra:

- Identificador y clave de idempotencia.
- Cliente, cadencia y origen.
- Versiones del perfil, reglas, motor y esquema.
- Fuentes consideradas y estado de sincronización.
- Resultado, duración, warnings y error tipado.
- Recomendación creada o razón explícita para no crearla.

Errores relevantes para el coach deben mostrarse con una acción concreta. Un `401`, falta de conexión, datos desactualizados o transacción fallida no puede presentarse como una pantalla vacía ni como “todo correcto”.

## 17. Estrategia de pruebas

### 17.1 Pruebas unitarias

- Fórmulas y límites nutricionales.
- Reglas de carga, progresión y recuperación.
- Cálculo de frescura, calidad y confianza.
- Deduplicación de actividades.
- Magnitud máxima y periodo mínimo entre cambios.
- Selección de recetas y escalado de cantidades.
- Serialización y restauración de snapshots.

### 17.2 Pruebas de integración

- Onboarding a perfil versionado.
- Perfil a propuesta coordinada.
- Garmin y Strava a señal canónica.
- Recomendación a aprobación y aplicación transaccional.
- Recálculo de dieta con comidas, micros, compra y coste.
- Recálculo de entrenamiento con sesiones y progresión.
- Persistencia de reglas, referencias y versiones.
- Fallo intermedio con rollback completo.

### 17.3 Casos sintéticos obligatorios

- Cliente nuevo sin historial ni wearable.
- Pérdida de grasa con buena adherencia.
- Pérdida de grasa con mala adherencia.
- Ganancia muscular con estancamiento.
- Runner con competición próxima.
- Atleta Hyrox/híbrido con fuerza y carrera.
- Fatiga acumulada y recuperación insuficiente.
- Solo Garmin, solo Strava, ambos y ninguno.
- Misma actividad recibida desde dos fuentes.
- Sincronización rota con actividad manual existente.
- Datos contradictorios entre percepción y wearable.
- Lesión o contraindicación.
- Propuesta aprobada, rechazada y revertida.
- Reintento de creación inicial sin duplicado.
- Coach intentando aprobar un cliente no autorizado.

### 17.4 Pruebas end-to-end

- Invitación, onboarding, propuesta, revisión, aprobación y portal.
- Primera semana sin datos suficientes y solicitud de información.
- Revisión quincenal con propuesta coordinada.
- Aplicación atómica y visualización de la nueva versión.
- Rollback y recuperación del plan anterior.

## 18. Métricas de éxito

### 18.1 Integridad técnica

- 0 planes activos duplicados por cliente y dominio.
- 0 actividades dobles tras deduplicación confirmada.
- 100 % de cambios aplicados con snapshot previo.
- 100 % de recomendaciones con reglas y datos trazables.
- 0 aplicaciones sin aprobación expresa del coach.
- 0 aplicaciones parciales ante fallo transaccional.

### 18.2 Calidad de decisión

- Porcentaje de ejecuciones con estado explícito.
- Porcentaje de recomendaciones aceptadas, modificadas y rechazadas.
- Tiempo medio del coach hasta decisión.
- Frecuencia de rollback y causa.
- Concordancia entre impacto esperado y resultado observado.
- Tasa de recomendaciones bloqueadas por datos insuficientes o fuentes desactualizadas.

### 18.3 Resultado del servicio

- Adherencia nutricional y de entrenamiento.
- Cumplimiento de sesiones y progresiones.
- Evolución de objetivos acordados.
- Incidencia de fatiga, molestias y abandonos.
- Variedad real de recetas y repetición semanal.
- Cobertura de los huecos prioritarios del recetario.

Las métricas de resultado no se usarán para inferir causalidad sin controlar adherencia, cambios externos y calidad de datos.

## 19. Fases de implementación

### Fase 0 — Integridad del flujo actual

- Resolver el `401` posterior al onboarding con error visible y autenticación correcta.
- Introducir idempotencia y evitar planes duplicados.
- Reforzar propiedad/autorización coach-cliente.
- Impedir que una recomendación se marque aplicada sin plan activo.
- Hacer visibles fallos y estados de las fuentes.

### Fase 1 — Perfil y generación inicial unificados

- Crear perfil base versionado.
- Consolidar el núcleo de reglas compartido.
- Coordinar nutrición y entrenamiento por tipos de día.
- Sustituir la asignación básica por una propuesta completa revisable.

### Fase 2 — Modelo común de señales

- Ingesta canónica, unidades y procedencia.
- Deduplicación Garmin/Strava/app.
- Salud de fuentes, frescura y cobertura.
- Ventanas de tendencia y calidad.

### Fase 3 — Recomendaciones por cadencia

- Estados explícitos de decisión.
- Confianza calculada.
- Guardas de magnitud y frecuencia.
- Recomendación estructurada con comparación y evidencia.

### Fase 4 — Versionado y aplicación segura

- Snapshots integrales.
- Transacciones de aplicación.
- Historial comparativo.
- Rollback probado.

### Fase 5 — Recálculo integral

- Reconstrucción completa de dietas.
- Reconstrucción completa de entrenamiento.
- Coordinación entre carga, recuperación y nutrición.
- Lista de compra, coste y micronutrientes consistentes.

### Fase 6 — Base científica operativa

- Esquema versionado de reglas y referencias.
- Primera biblioteca por dominios prioritarios.
- Visualización de evidencia en cada propuesta.
- Proceso de revisión y retirada de reglas.

### Fase 7 — Cobertura del recetario

- Matriz de demanda y huecos.
- Auditor automático de cobertura.
- Producción y validación de recetas prioritarias.
- Incorporación únicamente tras quality gate.

### Fase 8 — Piloto Carlos

- Generar una nueva propuesta desde su perfil real.
- Compararla con los planes actuales.
- Validar importación y deduplicación de sus fuentes disponibles.
- Simular revisiones semanal, quincenal y mensual.
- Aplicar solo cambios aprobados y medir resultados.
- Cerrar defectos antes de ampliar alcance.

### Fase 9 — Despliegue progresivo

- Incorporar clientes por cohortes pequeñas.
- Observar errores, aceptación, carga del coach y rollback.
- Ampliar únicamente tras cumplir los criterios de la cohorte anterior.

## 20. Criterios de aceptación

La iniciativa se considera funcionalmente aceptada cuando:

1. Un cliente nuevo puede completar onboarding y obtener una propuesta conjunta sin `401`, duplicados ni estados silenciosos.
2. La propuesta inicial muestra cálculos, supuestos, alertas, calidad de datos, reglas y evidencia.
3. Nutrición refleja el calendario de entrenamiento y distingue tipos de día cuando corresponde.
4. Entrenamiento incluye bloque, progresión, recuperación y restricciones específicas del perfil.
5. El sistema funciona sin wearable y declara correctamente su menor confianza.
6. Garmin, Strava y la app se normalizan y una misma actividad no cuenta dos veces.
7. Una fuente desactualizada se identifica como tal y no genera una falsa alerta de inactividad.
8. Cada revisión finaliza en uno de los estados explícitos definidos.
9. Toda recomendación contiene cambio, motivo, confianza, evidencia, riesgos y reevaluación.
10. Ningún cambio se aplica sin aprobación de un coach autorizado para ese cliente.
11. Una dieta recalculada mantiene coherencia entre objetivos, recetas, cantidades, micros, compra y coste.
12. Un entrenamiento recalculado mantiene coherencia entre bloque, sesiones, progresión, recuperación y nutrición.
13. Toda aplicación crea snapshot, es transaccional y admite rollback verificado.
14. Las decisiones históricas conservan las versiones de reglas y referencias utilizadas.
15. El recetario dispone de una medición reproducible de cobertura y las altas responden a huecos priorizados.
16. Todos los casos sintéticos críticos y los flujos end-to-end pasan.
17. El piloto de Carlos produce un plan materialmente más personalizado que el actual y permite completar al menos un ciclo de recomendación, aprobación, medición y eventual reversión.

## 21. Criterios de salida del piloto Carlos

El sistema no se extenderá a otros clientes hasta verificar:

- Perfil base completo y revisión profesional de sus supuestos.
- Plan inicial coordinado con fuerza, CrossFit/Hyrox, running, horarios y objetivo nutricional.
- Datos de Garmin y Strava correctamente atribuidos, o fuente marcada como no disponible/desactualizada.
- Cero duplicación de actividades en la ventana piloto.
- Recomendaciones diferenciadas para revisión semanal, quincenal y mensual.
- Al menos una decisión explícita de mantener u observar y una propuesta de cambio evaluable.
- Aplicación aprobada con snapshot y rollback técnico probado.
- Explicación comprensible y útil para el coach.
- Ausencia de alertas críticas de seguridad, autorización o integridad.

## 22. Decisiones cerradas

- El enfoque será híbrido: reglas deterministas, calidad/confianza e IA asesora.
- La aprobación del coach será obligatoria para todos los cambios.
- La generación inicial coordinará dieta y entrenamiento.
- El sistema admitirá clientes con o sin Garmin/Strava.
- La ausencia de datos no se interpretará automáticamente como inactividad.
- El recálculo será integral y versionado.
- Las reglas científicas serán trazables y versionadas.
- El recetario crecerá según cobertura medible.
- La aplicación será transaccional, con snapshot y rollback.
- Carlos será el primer piloto; no habrá ejecución masiva inicial.
- Codex dirigirá arquitectura, decisiones y revisión; Claude colaborará en análisis e implementación técnica.
