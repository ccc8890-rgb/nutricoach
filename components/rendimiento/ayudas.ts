// Explicaciones de cada análisis del panel: qué mide, cómo leerlo y qué cuidado tener. Un solo sitio para el coach y, más adelante, para la app del cliente.
export interface Ayuda {
  que: string
  como: string[]
  ojo?: string
}

export const AYUDAS = {
  carga: {
    que: 'Resume cuánto entrena el atleta y cómo lo está absorbiendo, sumando todos los deportes. Cada sesión puntúa según su duración e intensidad (TSS).',
    como: [
      'Forma (CTL): carga media de las últimas ~6 semanas. Sube con el entrenamiento constante; es la base física acumulada.',
      'Fatiga (ATL): carga media de los últimos 7 días. Sube y baja rápido: es el cansancio reciente.',
      'Frescura (TSB) = forma − fatiga. Entre −10 y +5 es zona de trabajo; muy negativo (por debajo de −25) es sobrecarga; positivo llega descansado (competición).',
      'Subida de forma: cuánto sube la forma en 7 días. Más de +8 por semana es subir demasiado deprisa.',
      'Monotonía: si todos los días son parecidos sube (más de 2 es poca variación entre días duros y suaves).',
    ],
    ojo: 'Son modelos, no medidas. Con poco historial o con actividades sin pulso el cálculo es menos fiable.',
  },
  cargaSemana: {
    que: 'Estrés de entrenamiento (TSS) y kilómetros por semana, para ver la progresión de volumen.',
    como: ['Lo sano es subir poco a poco y descargar una semana de cada 3-4.', 'Un salto de más del 10-15 % sobre la semana anterior es un factor de riesgo de lesión.'],
  },
  baseAerobica: {
    que: 'Mide si la base aeróbica mejora comparando solo rodajes suaves, que es lo comparable: a igual esfuerzo, ¿corre más rápido o con menos pulso?',
    como: [
      'El ritmo «a 154 ppm» (el techo de la zona suave) sale de la eficiencia: metros por minuto por cada latido.',
      'Si ese ritmo baja y el pulso medio de los rodajes no sube, la base mejora.',
      'Se comparan los últimos 28 días con los 28 anteriores, con medianas y al menos 3 rodajes en cada ventana.',
    ],
    ojo: 'Un cambio de ±2 % es ruido: el calor, el sueño, las cuestas o la hidratación lo mueven. Interpreta la tendencia de varias semanas, no un rodaje suelto.',
  },
  intensidad: {
    que: 'Reparto del tiempo de carrera entre esfuerzo suave, medio y duro según el pulso de cada vuelta y el umbral del atleta.',
    como: [
      'En resistencia lo habitual es ~80 % suave y ~20 % duro (modelo polarizado de Seiler).',
      '«Zona gris»: demasiado tiempo en medio (ni suave para recuperar ni duro para progresar). Es el error más común.',
      'Si domina lo duro, riesgo de fatiga acumulada.',
    ],
    ojo: 'Depende de que el pulso de umbral del reloj esté bien medido. Si cambia mucho, los cortes cambian.',
  },
  deriva: {
    que: 'Cuánto sube el pulso, a igual ritmo, entre la primera y la segunda mitad de una carrera continua (desacoplamiento Pa:Hr).',
    como: [
      'Menos de 5 %: base aeróbica sólida para esa duración y ritmo.',
      '5-10 %: moderada, aceptable si es una tirada larga o hace calor.',
      'Más de 10 %: ese ritmo le exige demasiado; bajar ritmo o acumular más volumen suave.',
    ],
    ojo: 'Se calcula sin los primeros 10 minutos y solo en carreras continuas de 30+ min. El calor y la deshidratación la inflan.',
  },
  eficiencia: {
    que: 'Eficiencia aeróbica: metros por minuto por cada latido en carreras continuas de 25+ min.',
    como: ['Si sube con el tiempo, corre más rápido con el mismo pulso.', 'Mezcla todo tipo de carreras continuas; para comparar solo rodajes suaves mira «Base aeróbica».'],
  },
  parciales: {
    que: 'Los mejores 1 km y 5 km de cada salida.',
    como: ['Más bajo = más rápido.', 'Sirve para ver cómo evoluciona el techo de velocidad sin necesidad de carreras oficiales.'],
    ojo: 'Un parcial rápido en una salida de series no equivale a un esfuerzo continuo.',
  },
  vo2max: {
    que: 'Estimación de la capacidad aeróbica máxima que hace Garmin tras cada carrera.',
    como: ['Valórala por su tendencia, no por el número exacto.'],
    ojo: 'Suele sobrestimar unos puntos frente a una prueba de laboratorio. El VDOT de Daniels (carreras reales) es más fiable para fijar ritmos.',
  },
  umbrales: {
    que: 'El pulso y el ritmo en el umbral de lactato que mide Garmin. Anclan las zonas de pulso y el cálculo de carga.',
    como: ['El pulso de umbral fija el techo de la zona suave (90 %) y el reparto de intensidad.', 'Si cambian mucho de un mes a otro, conviene confirmarlos con una prueba.'],
  },
  planVsRealizado: {
    que: 'Compara cada sesión estructurada con lo que realmente se corrió, repetición a repetición.',
    como: ['Verde: dentro del ritmo previsto. Azul: más rápido de lo previsto. Ámbar: más lento.', 'Una sesión «parcial» o «no cumplida» no es un fallo: pregunta primero por la causa (sueño, calor, fatiga, horario).'],
    ojo: 'Si el reloj no marcó repeticiones (carrera libre) no se puede comparar.',
  },
  tecnica: {
    que: 'Cadencia, zancada, tiempo de contacto y oscilación vertical medidos por el reloj.',
    como: ['Cambian con el ritmo, por eso se comparan a igual ritmo.', 'Una mejora útil: menos contacto y oscilación al mismo ritmo, sin perder cadencia.'],
    ojo: 'Depende del dispositivo y de llevarlo bien colocado. No cambies la técnica por un solo dato.',
  },
  bateria: {
    que: 'Body Battery de Garmin: un índice de 0 a 100 de la energía disponible. Aquí, el máximo de cada día.',
    como: ['Indica cuánto se recupera por la noche. Si el máximo baja varios días seguidos, falta descanso.'],
    ojo: 'Es una métrica propia de Garmin (mezcla pulso, HRV, estrés y sueño). Sin llevar el reloj de noche es menos fiable.',
  },
  rhr: {
    que: 'Pulso en reposo.',
    como: ['Si sube varios días seguidos (más de 3-5 ppm sobre lo habitual) suele indicar fatiga, enfermedad o estrés.', 'Bajar poco a poco con el entrenamiento es buena señal.'],
  },
  preparacion: {
    que: 'Preparación para entrenar de Garmin (Training Readiness): puntuación de 0 a 100.',
    como: ['Combina sueño, recuperación, HRV, carga reciente y estrés.', 'Alta: listo para trabajo de calidad. Baja: priorizar rodaje suave o descanso.'],
    ojo: 'Es el criterio de Garmin, no el nuestro. Úsalo como un dato más junto al pulso, las sensaciones y la carga.',
  },
  seguimiento: {
    que: 'Antes y después de cada cambio aplicado al plan, medido con los datos reales del atleta.',
    como: ['★ marca el indicador que el cambio buscaba mejorar.', 'La línea base son las últimas 4 semanas.'],
    ojo: 'No es una prueba de que el cambio sea la causa: el calor, el descanso o una carrera también mueven estas cifras.',
  },
} satisfies Record<string, Ayuda>

export type AyudaId = keyof typeof AYUDAS
