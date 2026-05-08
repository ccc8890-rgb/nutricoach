import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ============================================================
// PLANTILLAS DE ENTRENAMIENTO — v1
// ============================================================
// Basadas en metodología de:
// • Renaissance Periodization (Dr. Mike Israetel)
// • Jeff Nippard (periodización, PPL, Upper/Lower)
// • Brad Schoenfeld (volumen, frecuencia, hipertrofia)
// ============================================================

interface PlantillaSeed {
    nombre: string
    descripcion: string
    tipo: 'gimnasio' | 'cardio' | 'mixto'
    duracion_semanas: number
    nivel: 'principiante' | 'intermedio' | 'avanzado'
    objetivo: 'hipertrofia' | 'fuerza' | 'perdida_grasa' | 'cardio' | 'tonificacion' | 'rendimiento'
    dias_por_semana: number
    progresion?: any[]
    sesiones: {
        nombre: string
        dia_semana: string
        orden: number
        ejercicios: { nombre: string; series: number; repeticiones: string; descanso_segundos: number; rpe?: string; orden: number }[]
    }[]
}

const PLANTILLAS: PlantillaSeed[] = [
    {
        nombre: 'Full Body 3 días',
        descripcion: 'Rutina de cuerpo completo 3 días/semana ideal para principiantes. Trabaja todos los grupos musculares en cada sesión con ejercicios compuestos. Descanso 48h entre sesiones.',
        tipo: 'gimnasio',
        duracion_semanas: 8,
        nivel: 'principiante',
        objetivo: 'tonificacion',
        dias_por_semana: 3,
        sesiones: [
            {
                nombre: 'Full Body A', dia_semana: 'Lunes', orden: 0,
                ejercicios: [
                    { nombre: 'Sentadilla con barra', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 0 },
                    { nombre: 'Press banca plano', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Remo con barra', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 2 },
                    { nombre: 'Elevaciones laterales', series: 3, repeticiones: '10-12', descanso_segundos: 60, orden: 3 },
                    { nombre: 'Curl con mancuernas', series: 3, repeticiones: '12-15', descanso_segundos: 60, orden: 4 },
                    { nombre: 'Extensión en polea alta', series: 3, repeticiones: '12-15', descanso_segundos: 60, orden: 5 },
                    { nombre: 'Plancha', series: 3, repeticiones: '15', descanso_segundos: 45, orden: 6 },
                ],
            },
            {
                nombre: 'Full Body B', dia_semana: 'Miércoles', orden: 1,
                ejercicios: [
                    { nombre: 'Peso muerto rumano', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 0 },
                    { nombre: 'Press inclinado con mancuernas', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Jalón al pecho en polea', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 2 },
                    { nombre: 'Press militar con barra', series: 3, repeticiones: '10-12', descanso_segundos: 60, orden: 3 },
                    { nombre: 'Curl martillo', series: 3, repeticiones: '12-15', descanso_segundos: 60, orden: 4 },
                    { nombre: 'Patada de tríceps', series: 3, repeticiones: '12-15', descanso_segundos: 60, orden: 5 },
                    { nombre: 'Crunch abdominal', series: 3, repeticiones: '15', descanso_segundos: 45, orden: 6 },
                ],
            },
            {
                nombre: 'Full Body C', dia_semana: 'Viernes', orden: 2,
                ejercicios: [
                    { nombre: 'Sentadilla búlgara', series: 3, repeticiones: '8-12', descanso_segundos: 90, orden: 0 },
                    { nombre: 'Press banca inclinado', series: 3, repeticiones: '8-12', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Remo en polea baja', series: 3, repeticiones: '8-12', descanso_segundos: 90, orden: 2 },
                    { nombre: 'Pájaro o elevaciones posteriores', series: 3, repeticiones: '10-12', descanso_segundos: 60, orden: 3 },
                    { nombre: 'Curl concentrado', series: 3, repeticiones: '12-15', descanso_segundos: 60, orden: 4 },
                    { nombre: 'Press francés', series: 3, repeticiones: '12-15', descanso_segundos: 60, orden: 5 },
                    { nombre: 'Elevación de piernas tumbado', series: 3, repeticiones: '12', descanso_segundos: 45, orden: 6 },
                ],
            },
        ],
    },
    {
        nombre: 'Push/Pull/Legs 6 días',
        descripcion: 'Rutina PPL clásica 6 días/semana. Push: Pecho, Hombros, Tríceps. Pull: Espalda, Bíceps. Piernas: Cuádriceps, Isquios, Glúteos, Gemelos. Alta frecuencia para máximo estímulo de hipertrofia.',
        tipo: 'gimnasio',
        duracion_semanas: 12,
        nivel: 'avanzado',
        objetivo: 'hipertrofia',
        dias_por_semana: 6,
        sesiones: [
            {
                nombre: 'Push A', dia_semana: 'Lunes', orden: 0,
                ejercicios: [
                    { nombre: 'Press banca plano', series: 4, repeticiones: '6-10', descanso_segundos: 120, orden: 0 },
                    { nombre: 'Press inclinado con mancuernas', series: 4, repeticiones: '8-12', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Aperturas con mancuernas', series: 3, repeticiones: '10-12', descanso_segundos: 60, orden: 2 },
                    { nombre: 'Press militar con barra', series: 4, repeticiones: '8-12', descanso_segundos: 90, orden: 3 },
                    { nombre: 'Elevaciones laterales', series: 3, repeticiones: '12-15', descanso_segundos: 45, orden: 4 },
                    { nombre: 'Extensión en polea alta', series: 3, repeticiones: '12-15', descanso_segundos: 45, orden: 5 },
                    { nombre: 'Fondos en banco', series: 3, repeticiones: '10-12', descanso_segundos: 45, orden: 6 },
                ],
            },
            {
                nombre: 'Pull A', dia_semana: 'Martes', orden: 1,
                ejercicios: [
                    { nombre: 'Peso muerto', series: 4, repeticiones: '6-10', descanso_segundos: 120, orden: 0 },
                    { nombre: 'Dominadas', series: 4, repeticiones: '8-12', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Remo con barra', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 2 },
                    { nombre: 'Face pull en polea', series: 3, repeticiones: '12-15', descanso_segundos: 60, orden: 3 },
                    { nombre: 'Curl con barra', series: 3, repeticiones: '10-12', descanso_segundos: 60, orden: 4 },
                    { nombre: 'Curl martillo', series: 3, repeticiones: '12-15', descanso_segundos: 45, orden: 5 },
                ],
            },
            {
                nombre: 'Legs A', dia_semana: 'Miércoles', orden: 2,
                ejercicios: [
                    { nombre: 'Sentadilla con barra', series: 4, repeticiones: '6-10', descanso_segundos: 150, orden: 0 },
                    { nombre: 'Prensa de piernas', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Curl femoral tumbado', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 2 },
                    { nombre: 'Extensión de cuádriceps', series: 3, repeticiones: '12-15', descanso_segundos: 60, orden: 3 },
                    { nombre: 'Gemelos de pie', series: 4, repeticiones: '10-15', descanso_segundos: 60, orden: 4 },
                    { nombre: 'Hip thrust', series: 3, repeticiones: '12', descanso_segundos: 60, orden: 5 },
                ],
            },
            {
                nombre: 'Push B', dia_semana: 'Jueves', orden: 3,
                ejercicios: [
                    { nombre: 'Press banca declinado', series: 4, repeticiones: '8-12', descanso_segundos: 90, orden: 0 },
                    { nombre: 'Press con mancuernas', series: 4, repeticiones: '8-12', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Crossover en polea', series: 3, repeticiones: '10-12', descanso_segundos: 60, orden: 2 },
                    { nombre: 'Press con mancuernas (hombros)', series: 4, repeticiones: '8-12', descanso_segundos: 90, orden: 3 },
                    { nombre: 'Elevaciones frontales', series: 3, repeticiones: '12-15', descanso_segundos: 45, orden: 4 },
                    { nombre: 'Extensión con mancuerna sobre la cabeza', series: 3, repeticiones: '12-15', descanso_segundos: 45, orden: 5 },
                ],
            },
            {
                nombre: 'Pull B', dia_semana: 'Viernes', orden: 4,
                ejercicios: [
                    { nombre: 'Jalón al pecho en polea', series: 4, repeticiones: '8-12', descanso_segundos: 90, orden: 0 },
                    { nombre: 'Remo con mancuerna', series: 3, repeticiones: '8-12', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Peso muerto rumano', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 2 },
                    { nombre: 'Pájaro o elevaciones posteriores', series: 3, repeticiones: '12-15', descanso_segundos: 60, orden: 3 },
                    { nombre: 'Curl en polea baja', series: 3, repeticiones: '10-12', descanso_segundos: 60, orden: 4 },
                    { nombre: 'Curl concentrado', series: 3, repeticiones: '12-15', descanso_segundos: 45, orden: 5 },
                ],
            },
            {
                nombre: 'Legs B', dia_semana: 'Sábado', orden: 5,
                ejercicios: [
                    { nombre: 'Sentadilla frontal', series: 4, repeticiones: '8-12', descanso_segundos: 120, orden: 0 },
                    { nombre: 'Zancadas con mancuernas', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Curl femoral sentado', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 2 },
                    { nombre: 'Peso muerto sumo', series: 3, repeticiones: '12-15', descanso_segundos: 60, orden: 3 },
                    { nombre: 'Gemelos sentado', series: 4, repeticiones: '10-15', descanso_segundos: 60, orden: 4 },
                ],
            },
        ],
    },
    {
        nombre: 'Torso/Pierna 4 días',
        descripcion: 'Rutina torso-pierna 4 días/semana. Los días de torso trabajan pecho, espalda y hombros. Los días de pierna trabajan piernas completas. Ideal para intermedios que buscan volumen equilibrado.',
        tipo: 'gimnasio',
        duracion_semanas: 8,
        nivel: 'intermedio',
        objetivo: 'hipertrofia',
        dias_por_semana: 4,
        sesiones: [
            {
                nombre: 'Torso A', dia_semana: 'Lunes', orden: 0,
                ejercicios: [
                    { nombre: 'Press banca plano', series: 4, repeticiones: '6-10', descanso_segundos: 120, orden: 0 },
                    { nombre: 'Press inclinado con mancuernas', series: 3, repeticiones: '8-12', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Dominadas', series: 4, repeticiones: '8-12', descanso_segundos: 90, orden: 2 },
                    { nombre: 'Remo en polea baja', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 3 },
                    { nombre: 'Press militar con barra', series: 3, repeticiones: '10-12', descanso_segundos: 60, orden: 4 },
                    { nombre: 'Elevaciones laterales', series: 3, repeticiones: '12-15', descanso_segundos: 45, orden: 5 },
                ],
            },
            {
                nombre: 'Pierna A', dia_semana: 'Martes', orden: 1,
                ejercicios: [
                    { nombre: 'Sentadilla con barra', series: 4, repeticiones: '6-10', descanso_segundos: 150, orden: 0 },
                    { nombre: 'Peso muerto rumano', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Extensión de cuádriceps', series: 3, repeticiones: '12-15', descanso_segundos: 60, orden: 2 },
                    { nombre: 'Curl femoral tumbado', series: 3, repeticiones: '12-15', descanso_segundos: 60, orden: 3 },
                    { nombre: 'Gemelos de pie', series: 4, repeticiones: '10-15', descanso_segundos: 60, orden: 4 },
                ],
            },
            {
                nombre: 'Torso B', dia_semana: 'Jueves', orden: 2,
                ejercicios: [
                    { nombre: 'Press banca inclinado', series: 4, repeticiones: '8-12', descanso_segundos: 90, orden: 0 },
                    { nombre: 'Aperturas con mancuernas', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Remo con barra', series: 3, repeticiones: '8-12', descanso_segundos: 90, orden: 2 },
                    { nombre: 'Jalón al pecho en polea', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 3 },
                    { nombre: 'Press con mancuernas (hombros)', series: 3, repeticiones: '10-12', descanso_segundos: 60, orden: 4 },
                    { nombre: 'Face pull en polea', series: 3, repeticiones: '12-15', descanso_segundos: 45, orden: 5 },
                ],
            },
            {
                nombre: 'Pierna B', dia_semana: 'Viernes', orden: 3,
                ejercicios: [
                    { nombre: 'Prensa de piernas', series: 4, repeticiones: '8-12', descanso_segundos: 120, orden: 0 },
                    { nombre: 'Zancadas con barra', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Curl femoral sentado', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 2 },
                    { nombre: 'Hip thrust', series: 3, repeticiones: '12-15', descanso_segundos: 60, orden: 3 },
                    { nombre: 'Gemelos sentado', series: 4, repeticiones: '10-15', descanso_segundos: 60, orden: 4 },
                ],
            },
        ],
    },
    {
        nombre: 'Upper/Lower 4 días',
        descripcion: 'División superior/inferior 4 días/semana. Upper: pecho, espalda, hombros, brazos. Lower: piernas completas. Excelente equilibrio entre frecuencia y recuperación.',
        tipo: 'gimnasio',
        duracion_semanas: 8,
        nivel: 'intermedio',
        objetivo: 'hipertrofia',
        dias_por_semana: 4,
        sesiones: [
            {
                nombre: 'Upper A', dia_semana: 'Lunes', orden: 0,
                ejercicios: [
                    { nombre: 'Press banca plano', series: 4, repeticiones: '6-10', descanso_segundos: 120, orden: 0 },
                    { nombre: 'Dominadas', series: 4, repeticiones: '8-12', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Press militar con barra', series: 3, repeticiones: '8-12', descanso_segundos: 90, orden: 2 },
                    { nombre: 'Remo con barra', series: 3, repeticiones: '10-12', descanso_segundos: 60, orden: 3 },
                    { nombre: 'Curl con barra', series: 3, repeticiones: '10-12', descanso_segundos: 60, orden: 4 },
                    { nombre: 'Extensión en polea alta', series: 3, repeticiones: '10-12', descanso_segundos: 60, orden: 5 },
                ],
            },
            {
                nombre: 'Lower A', dia_semana: 'Martes', orden: 1,
                ejercicios: [
                    { nombre: 'Sentadilla con barra', series: 4, repeticiones: '6-10', descanso_segundos: 150, orden: 0 },
                    { nombre: 'Peso muerto rumano', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Extensión de cuádriceps', series: 3, repeticiones: '12-15', descanso_segundos: 60, orden: 2 },
                    { nombre: 'Curl femoral tumbado', series: 3, repeticiones: '12-15', descanso_segundos: 60, orden: 3 },
                    { nombre: 'Gemelos de pie', series: 4, repeticiones: '10-15', descanso_segundos: 60, orden: 4 },
                    { nombre: 'Plancha', series: 3, repeticiones: '15', descanso_segundos: 45, orden: 5 },
                ],
            },
            {
                nombre: 'Upper B', dia_semana: 'Jueves', orden: 2,
                ejercicios: [
                    { nombre: 'Press inclinado con mancuernas', series: 4, repeticiones: '8-12', descanso_segundos: 90, orden: 0 },
                    { nombre: 'Remo en polea baja', series: 3, repeticiones: '8-12', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Elevaciones laterales', series: 3, repeticiones: '10-12', descanso_segundos: 60, orden: 2 },
                    { nombre: 'Jalón al pecho en polea', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 3 },
                    { nombre: 'Curl martillo', series: 3, repeticiones: '12-15', descanso_segundos: 60, orden: 4 },
                    { nombre: 'Press francés', series: 3, repeticiones: '12-15', descanso_segundos: 60, orden: 5 },
                ],
            },
            {
                nombre: 'Lower B', dia_semana: 'Viernes', orden: 3,
                ejercicios: [
                    { nombre: 'Peso muerto', series: 4, repeticiones: '8-12', descanso_segundos: 120, orden: 0 },
                    { nombre: 'Sentadilla búlgara', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Curl femoral sentado', series: 3, repeticiones: '12-15', descanso_segundos: 60, orden: 2 },
                    { nombre: 'Hip thrust', series: 3, repeticiones: '12-15', descanso_segundos: 60, orden: 3 },
                    { nombre: 'Gemelos sentado', series: 4, repeticiones: '10-15', descanso_segundos: 60, orden: 4 },
                    { nombre: 'Elevación de piernas tumbado', series: 3, repeticiones: '12', descanso_segundos: 45, orden: 5 },
                ],
            },
        ],
    },
    {
        nombre: 'Weider 5 días',
        descripcion: 'Rutina Weider clásica: un grupo muscular grande por día + uno pequeño. Máximo volumen y aislamiento. Diseñada para avanzados que pueden manejar alto volumen semanal.',
        tipo: 'gimnasio',
        duracion_semanas: 12,
        nivel: 'avanzado',
        objetivo: 'hipertrofia',
        dias_por_semana: 5,
        sesiones: [
            {
                nombre: 'Pecho + Tríceps', dia_semana: 'Lunes', orden: 0,
                ejercicios: [
                    { nombre: 'Press banca plano', series: 4, repeticiones: '6-10', descanso_segundos: 120, orden: 0 },
                    { nombre: 'Press inclinado con mancuernas', series: 4, repeticiones: '8-12', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Aperturas con mancuernas', series: 3, repeticiones: '10-12', descanso_segundos: 60, orden: 2 },
                    { nombre: 'Crossover en polea', series: 3, repeticiones: '12-15', descanso_segundos: 60, orden: 3 },
                    { nombre: 'Press francés', series: 4, repeticiones: '8-12', descanso_segundos: 60, orden: 4 },
                    { nombre: 'Extensión en polea alta', series: 3, repeticiones: '12-15', descanso_segundos: 45, orden: 5 },
                    { nombre: 'Patada de tríceps', series: 3, repeticiones: '10-12', descanso_segundos: 45, orden: 6 },
                ],
            },
            {
                nombre: 'Espalda + Bíceps', dia_semana: 'Martes', orden: 1,
                ejercicios: [
                    { nombre: 'Peso muerto', series: 4, repeticiones: '6-10', descanso_segundos: 120, orden: 0 },
                    { nombre: 'Dominadas', series: 4, repeticiones: '8-12', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Remo con barra', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 2 },
                    { nombre: 'Jalón al pecho en polea', series: 3, repeticiones: '12-15', descanso_segundos: 60, orden: 3 },
                    { nombre: 'Curl con barra', series: 4, repeticiones: '8-12', descanso_segundos: 60, orden: 4 },
                    { nombre: 'Curl martillo', series: 3, repeticiones: '12-15', descanso_segundos: 45, orden: 5 },
                    { nombre: 'Curl concentrado', series: 3, repeticiones: '12-15', descanso_segundos: 45, orden: 6 },
                ],
            },
            {
                nombre: 'Piernas', dia_semana: 'Miércoles', orden: 2,
                ejercicios: [
                    { nombre: 'Sentadilla con barra', series: 4, repeticiones: '6-10', descanso_segundos: 150, orden: 0 },
                    { nombre: 'Prensa de piernas', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Peso muerto rumano', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 2 },
                    { nombre: 'Extensión de cuádriceps', series: 3, repeticiones: '12-15', descanso_segundos: 60, orden: 3 },
                    { nombre: 'Curl femoral tumbado', series: 3, repeticiones: '12-15', descanso_segundos: 60, orden: 4 },
                    { nombre: 'Gemelos de pie', series: 4, repeticiones: '10-15', descanso_segundos: 60, orden: 5 },
                    { nombre: 'Hip thrust', series: 3, repeticiones: '10-12', descanso_segundos: 60, orden: 6 },
                ],
            },
            {
                nombre: 'Hombros', dia_semana: 'Jueves', orden: 3,
                ejercicios: [
                    { nombre: 'Press militar con barra', series: 4, repeticiones: '8-12', descanso_segundos: 90, orden: 0 },
                    { nombre: 'Elevaciones laterales', series: 4, repeticiones: '12-15', descanso_segundos: 45, orden: 1 },
                    { nombre: 'Elevaciones frontales', series: 3, repeticiones: '12-15', descanso_segundos: 45, orden: 2 },
                    { nombre: 'Pájaro o elevaciones posteriores', series: 3, repeticiones: '12-15', descanso_segundos: 45, orden: 3 },
                    { nombre: 'Face pull en polea', series: 3, repeticiones: '12-15', descanso_segundos: 45, orden: 4 },
                ],
            },
            {
                nombre: 'Brazos', dia_semana: 'Viernes', orden: 4,
                ejercicios: [
                    { nombre: 'Curl con barra', series: 3, repeticiones: '8-12', descanso_segundos: 60, orden: 0 },
                    { nombre: 'Curl con mancuernas', series: 3, repeticiones: '10-12', descanso_segundos: 60, orden: 1 },
                    { nombre: 'Curl martillo', series: 3, repeticiones: '12-15', descanso_segundos: 45, orden: 2 },
                    { nombre: 'Press francés', series: 3, repeticiones: '8-12', descanso_segundos: 60, orden: 3 },
                    { nombre: 'Extensión en polea alta', series: 3, repeticiones: '10-12', descanso_segundos: 60, orden: 4 },
                    { nombre: 'Fondos en banco', series: 3, repeticiones: '12-15', descanso_segundos: 45, orden: 5 },
                ],
            },
        ],
    },
    {
        nombre: 'HIIT 3 días',
        descripcion: 'Entrenamiento intervalado de alta intensidad 3 días/semana. Máxima quema calórica en mínimo tiempo. Ideal para pérdida de grasa combinado con déficit calórico. Sesiones de 20-30 minutos.',
        tipo: 'cardio',
        duracion_semanas: 6,
        nivel: 'intermedio',
        objetivo: 'perdida_grasa',
        dias_por_semana: 3,
        sesiones: [
            {
                nombre: 'HIIT Cinta', dia_semana: 'Lunes', orden: 0,
                ejercicios: [
                    { nombre: 'HIIT en cinta', series: 1, repeticiones: '10x30s sprint / 30s trote', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Sentadilla con barra', series: 3, repeticiones: '15', descanso_segundos: 30, orden: 1 },
                    { nombre: 'Mountain climbers', series: 3, repeticiones: '12', descanso_segundos: 30, orden: 2 },
                ],
            },
            {
                nombre: 'HIIT Full Body', dia_semana: 'Miércoles', orden: 1,
                ejercicios: [
                    { nombre: 'Burpees', series: 3, repeticiones: '12', descanso_segundos: 45, orden: 0 },
                    { nombre: 'Battle ropes', series: 3, repeticiones: '15', descanso_segundos: 45, orden: 1 },
                    { nombre: 'Mountain climbers', series: 3, repeticiones: '12', descanso_segundos: 45, orden: 2 },
                ],
            },
            {
                nombre: 'HIIT Bicicleta', dia_semana: 'Viernes', orden: 2,
                ejercicios: [
                    { nombre: 'Bicicleta estática', series: 1, repeticiones: '8x40s sprint / 20s recuperación', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Saltar la comba', series: 3, repeticiones: '15', descanso_segundos: 30, orden: 1 },
                ],
            },
        ],
    },
    {
        nombre: 'Cardio Estado Estable 3 días',
        descripcion: 'Cardio LISS (Low Intensity Steady State) 3 días/semana. Ideal para salud cardiovascular, recuperación activa y gasto calórico adicional sin impacto articular. Intensidad: 60-70% FC máxima.',
        tipo: 'cardio',
        duracion_semanas: 0,
        nivel: 'principiante',
        objetivo: 'cardio',
        dias_por_semana: 3,
        sesiones: [
            {
                nombre: 'Cardio Cinta', dia_semana: 'Lunes', orden: 0,
                ejercicios: [
                    { nombre: 'Carrera continua', series: 1, repeticiones: '30 min ritmo constante 5-7 km/h', descanso_segundos: 0, orden: 0 },
                ],
            },
            {
                nombre: 'Cardio Bicicleta', dia_semana: 'Miércoles', orden: 1,
                ejercicios: [
                    { nombre: 'Bicicleta estática', series: 1, repeticiones: '40 min ritmo constante 70-90 rpm', descanso_segundos: 0, orden: 0 },
                ],
            },
            {
                nombre: 'Cardio Elíptica + Remo', dia_semana: 'Viernes', orden: 2,
                ejercicios: [
                    { nombre: 'Elíptica', series: 1, repeticiones: '25 min ritmo constante', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Remo ergómetro', series: 1, repeticiones: '15 min ritmo constante 500m/2:30', descanso_segundos: 0, orden: 1 },
                ],
            },
        ],
    },
    // ══════════════════════════════════════════════════════════════
    // HYROX — PRINCIPIANTE (Contreras 2023)
    // ══════════════════════════════════════════════════════════════
    {
        nombre: 'HYROX Principiante 8 semanas',
        descripcion: 'Programa de introducción al HYROX para principiantes. Combina preparación cardiovascular con las 8 estaciones de HYROX. Sesiones de 45-60 min. Progresión gradual de volumen e intensidad. Basado en Contreras (2023).',
        tipo: 'mixto',
        duracion_semanas: 8,
        nivel: 'principiante',
        objetivo: 'rendimiento',
        dias_por_semana: 4,
        sesiones: [
            {
                nombre: 'Resistencia + Empuje', dia_semana: 'Lunes', orden: 0,
                ejercicios: [
                    { nombre: 'Carrera continua', series: 1, repeticiones: '2km carrera suave + 4x100m progresivos', descanso_segundos: 60, orden: 0 },
                    { nombre: 'Sled push velocidad', series: 4, repeticiones: '20m ida y vuelta (carga ligera)', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Sled pull velocidad', series: 3, repeticiones: '10 repes (lastre moderado)', descanso_segundos: 90, orden: 2 },
                    { nombre: 'Mountain climbers', series: 3, repeticiones: '12-15', descanso_segundos: 60, orden: 3 },
                ],
            },
            {
                nombre: 'Remo y Esquí', dia_semana: 'Martes', orden: 1,
                ejercicios: [
                    { nombre: 'Remo ergómetro sprint', series: 1, repeticiones: '500m ritmo constante', descanso_segundos: 60, orden: 0 },
                    { nombre: 'SkiErg', series: 1, repeticiones: '500m ritmo constante', descanso_segundos: 60, orden: 1 },
                    { nombre: 'Remo ergómetro endurance', series: 3, repeticiones: '500m / 500m alternados x3', descanso_segundos: 90, orden: 2 },
                    { nombre: 'SkiErg sprint', series: 3, repeticiones: '30s on / 30s off x6', descanso_segundos: 30, orden: 3 },
                ],
            },
            {
                nombre: 'Wall Balls + Burpees', dia_semana: 'Jueves', orden: 2,
                ejercicios: [
                    { nombre: 'Wall balls hyrox', series: 4, repeticiones: '10 repes (balón 6kg)', descanso_segundos: 45, orden: 0 },
                    { nombre: 'Burpee broad jumps', series: 3, repeticiones: '8 repes', descanso_segundos: 60, orden: 1 },
                    { nombre: 'Kettlebell swing', series: 3, repeticiones: '12-15', descanso_segundos: 45, orden: 2 },
                    { nombre: 'Sandbag lunges', series: 3, repeticiones: '30m', descanso_segundos: 60, orden: 3 },
                ],
            },
            {
                nombre: 'Carga y Transiciones', dia_semana: 'Viernes', orden: 3,
                ejercicios: [
                    { nombre: "Farmer's carry velocidad", series: 4, repeticiones: '30m ida y vuelta (16-20kg)', descanso_segundos: 60, orden: 0 },
                    { nombre: 'HYROX transición simulación', series: 1, repeticiones: '8x100m sprints con 1 estación entre medias', descanso_segundos: 60, orden: 1 },
                    { nombre: 'Plancha', series: 3, repeticiones: '15', descanso_segundos: 45, orden: 2 },
                    { nombre: 'Sandbag walking lunges', series: 3, repeticiones: '30m', descanso_segundos: 60, orden: 3 },
                ],
            },
        ],
    },
    // ══════════════════════════════════════════════════════════════
    // HYROX — INTERMEDIO
    // ══════════════════════════════════════════════════════════════
    {
        nombre: 'HYROX Intermedio 8 semanas',
        descripcion: 'Programa HYROX para intermedios con experiencia en fitness funcional. Simulación completa de estaciones HYROX a ritmo creciente. Sesiones de 60-75 min. Incluye trabajo de transiciones y ritmo de competición.',
        tipo: 'mixto',
        duracion_semanas: 8,
        nivel: 'intermedio',
        objetivo: 'rendimiento',
        dias_por_semana: 5,
        sesiones: [
            {
                nombre: 'Resistencia + Sled Pesado', dia_semana: 'Lunes', orden: 0,
                ejercicios: [
                    { nombre: 'Progression run', series: 1, repeticiones: '3km carrera progresiva', descanso_segundos: 90, orden: 0 },
                    { nombre: 'Sled push pesado', series: 4, repeticiones: '25m ida y vuelta (carga pesada)', descanso_segundos: 120, orden: 1 },
                    { nombre: 'Sled pull pesado', series: 4, repeticiones: '25m ida y vuelta (carga pesada)', descanso_segundos: 120, orden: 2 },
                    { nombre: 'Saltar la comba', series: 3, repeticiones: '12', descanso_segundos: 60, orden: 3 },
                ],
            },
            {
                nombre: 'Remo + Esquí + Burpees', dia_semana: 'Martes', orden: 1,
                ejercicios: [
                    { nombre: 'Remo ergómetro endurance', series: 1, repeticiones: '1000m a ritmo', descanso_segundos: 90, orden: 0 },
                    { nombre: 'SkiErg endurance', series: 1, repeticiones: '1000m a ritmo', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Burpee broad jumps ritmo', series: 4, repeticiones: '10 repes', descanso_segundos: 60, orden: 2 },
                    { nombre: 'Kettlebell snatch', series: 3, repeticiones: '12', descanso_segundos: 60, orden: 3 },
                    { nombre: 'Pista de esquí ergómetro', series: 1, repeticiones: '500m a ritmo + 500m sprint', descanso_segundos: 120, orden: 4 },
                ],
            },
            {
                nombre: 'Wall Balls + Carga Pesada', dia_semana: 'Jueves', orden: 2,
                ejercicios: [
                    { nombre: 'Wall balls a ritmo', series: 4, repeticiones: '15 repes (balón 6-9kg)', descanso_segundos: 45, orden: 0 },
                    { nombre: "Farmer's carry pesado", series: 4, repeticiones: '40m ida y vuelta (24-32kg)', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Sandbag walking lunges', series: 3, repeticiones: '10 repes (sandbag 20-30kg)', descanso_segundos: 60, orden: 2 },
                    { nombre: 'Thrusters', series: 3, repeticiones: '12', descanso_segundos: 60, orden: 3 },
                ],
            },
            {
                nombre: 'Simulación HYROX', dia_semana: 'Viernes', orden: 3,
                ejercicios: [
                    { nombre: 'Carrera + SkiErg combinado', series: 1, repeticiones: '1km + SkiErg 500m + Sled push/pull 25m + 1km', descanso_segundos: 120, orden: 0 },
                    { nombre: 'HYROX transición simulación', series: 1, repeticiones: 'Simulación: 1km + Wall balls 20 + 1km', descanso_segundos: 120, orden: 1 },
                ],
            },
            {
                nombre: 'HIIT Cross-training', dia_semana: 'Sábado', orden: 4,
                ejercicios: [
                    { nombre: 'Burpees con salto vertical', series: 3, repeticiones: '15 (cada ejercicio)', descanso_segundos: 30, orden: 0 },
                    { nombre: 'Box jumps', series: 3, repeticiones: '12', descanso_segundos: 30, orden: 1 },
                    { nombre: 'Battle ropes', series: 3, repeticiones: '30s on / 30s off', descanso_segundos: 30, orden: 2 },
                    { nombre: 'Kettlebell clean and press', series: 3, repeticiones: '12', descanso_segundos: 30, orden: 3 },
                ],
            },
        ],
    },
    // ══════════════════════════════════════════════════════════════
    // HYROX — AVANZADO
    // ══════════════════════════════════════════════════════════════
    {
        nombre: 'HYROX Avanzado 8 semanas',
        descripcion: 'Programa HYROX de competición para avanzados. Sesiones de 75-90 min. Simulación completa de carrera HYROX (8km + 8 estaciones). Trabajo específico de ritmo de competición, transiciones y estaciones al fallo.',
        tipo: 'mixto',
        duracion_semanas: 8,
        nivel: 'avanzado',
        objetivo: 'rendimiento',
        dias_por_semana: 6,
        sesiones: [
            {
                nombre: 'Sled Específico + Carrera', dia_semana: 'Lunes', orden: 0,
                ejercicios: [
                    { nombre: 'Intervalos 1km', series: 1, repeticiones: '3x1km a ritmo 5K con 90s recup', descanso_segundos: 90, orden: 0 },
                    { nombre: 'Sled push pesado', series: 5, repeticiones: '25m push + 25m pull (carga competición)', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Sled pull pesado', series: 5, repeticiones: '25m (carga competición)', descanso_segundos: 90, orden: 2 },
                    { nombre: 'Carrera a ritmo de 5K', series: 1, repeticiones: '1km a ritmo competición post-sled', descanso_segundos: 120, orden: 3 },
                ],
            },
            {
                nombre: 'SkiErg + Remo Máximo', dia_semana: 'Martes', orden: 1,
                ejercicios: [
                    { nombre: 'Remo ergómetro sprint', series: 1, repeticiones: '1000m a tope + 500m recovery x3', descanso_segundos: 180, orden: 0 },
                    { nombre: 'SkiErg sprint', series: 1, repeticiones: '1000m a tope + 500m recovery x3', descanso_segundos: 180, orden: 1 },
                    { nombre: 'Remo ergómetro endurance', series: 1, repeticiones: '2km ritmo umbral', descanso_segundos: 120, orden: 2 },
                    { nombre: 'SkiErg endurance', series: 1, repeticiones: '2km ritmo umbral', descanso_segundos: 120, orden: 3 },
                ],
            },
            {
                nombre: 'Burpees + Wall Balls', dia_semana: 'Miércoles', orden: 2,
                ejercicios: [
                    { nombre: 'Burpee broad jumps ritmo', series: 5, repeticiones: '15 repes a ritmo competición', descanso_segundos: 45, orden: 0 },
                    { nombre: 'Wall balls a ritmo', series: 5, repeticiones: '20 repes (balón 9kg)', descanso_segundos: 45, orden: 1 },
                    { nombre: 'Sandbag walking lunges', series: 4, repeticiones: '12 (sandbag 30kg)', descanso_segundos: 60, orden: 2 },
                    { nombre: 'Burpees con flexión', series: 4, repeticiones: '10', descanso_segundos: 60, orden: 3 },
                ],
            },
            {
                nombre: 'Farmer Pesado + Transiciones', dia_semana: 'Jueves', orden: 3,
                ejercicios: [
                    { nombre: "Farmer's carry pesado", series: 5, repeticiones: '40m ida y vuelta (32-48kg)', descanso_segundos: 90, orden: 0 },
                    { nombre: 'HYROX transición simulación', series: 1, repeticiones: 'Simulación completa: 1km + 8 estaciones a ritmo competición', descanso_segundos: 180, orden: 1 },
                    { nombre: 'Thrusters', series: 3, repeticiones: '15', descanso_segundos: 60, orden: 2 },
                ],
            },
            {
                nombre: 'Carrera Ritmo + Sled Velocidad', dia_semana: 'Viernes', orden: 4,
                ejercicios: [
                    { nombre: 'Carrera a ritmo de 10K', series: 1, repeticiones: '5km a ritmo de competición', descanso_segundos: 120, orden: 0 },
                    { nombre: 'Sled push velocidad', series: 6, repeticiones: '15m sprint ida/vuelta (carga ligera)', descanso_segundos: 60, orden: 1 },
                    { nombre: 'Broad jumps', series: 4, repeticiones: '12', descanso_segundos: 45, orden: 2 },
                    { nombre: 'Saltar la comba', series: 3, repeticiones: '30s on / 30s off', descanso_segundos: 30, orden: 3 },
                ],
            },
            {
                nombre: 'HYROX Half Simulación', dia_semana: 'Sábado', orden: 5,
                ejercicios: [
                    { nombre: 'Carrera + SkiErg combinado', series: 1, repeticiones: '4km + 4 estaciones HYROX a ritmo de competición (mitad de carrera)', descanso_segundos: 180, orden: 0 },
                    { nombre: 'HYROX transición simulación', series: 1, repeticiones: 'Estaciones restantes + 4km final', descanso_segundos: 180, orden: 1 },
                ],
            },
        ],
    },
    // ══════════════════════════════════════════════════════════════
    // RUNNING — 5K (Daniels 2014, Fitzgerald 2021)
    // ══════════════════════════════════════════════════════════════
    {
        nombre: 'Running 5K 8 semanas',
        descripcion: 'Programa de entrenamiento para 5K basado en Daniels\' Running Formula. Combina carreras fáciles (80% volumen), trabajo de umbral, intervalos VO2max y cuestas. Incluye 3-4 días de carrera + 2 días de fuerza complementaria.',
        tipo: 'cardio',
        duracion_semanas: 8,
        nivel: 'intermedio',
        objetivo: 'rendimiento',
        dias_por_semana: 4,
        sesiones: [
            {
                nombre: 'Intervalos 400m', dia_semana: 'Martes', orden: 0,
                ejercicios: [
                    { nombre: 'Trote de calentamiento', series: 1, repeticiones: '10 min trote suave', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Intervalos 400m', series: 8, repeticiones: '400m a ritmo 5K con 90s recup trote', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Vuelta a la calma', series: 1, repeticiones: '10 min trote suave', descanso_segundos: 0, orden: 2 },
                    { nombre: 'Strides', series: 4, repeticiones: '80m técnica de carrera', descanso_segundos: 60, orden: 3 },
                ],
            },
            {
                nombre: 'Carrera Tempo', dia_semana: 'Jueves', orden: 1,
                ejercicios: [
                    { nombre: 'Trote de calentamiento', series: 1, repeticiones: '15 min trote', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Carrera tempo', series: 1, repeticiones: '20 min a ritmo tempo (10K-semi)', descanso_segundos: 0, orden: 1 },
                    { nombre: 'Vuelta a la calma', series: 1, repeticiones: '10 min trote', descanso_segundos: 0, orden: 2 },
                    { nombre: 'Strides', series: 4, repeticiones: '80m', descanso_segundos: 60, orden: 3 },
                ],
            },
            {
                nombre: 'Carrera Fácil + Fuerza', dia_semana: 'Sábado', orden: 2,
                ejercicios: [
                    { nombre: 'Carrera continua', series: 1, repeticiones: '30-40 min zona 2', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Sentadilla con barra', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Peso muerto rumano', series: 3, repeticiones: '12', descanso_segundos: 60, orden: 2 },
                    { nombre: 'Gemelos de pie', series: 3, repeticiones: '12', descanso_segundos: 60, orden: 3 },
                    { nombre: 'Plancha', series: 3, repeticiones: '15', descanso_segundos: 45, orden: 4 },
                ],
            },
            {
                nombre: 'Carrera Larga', dia_semana: 'Domingo', orden: 3,
                ejercicios: [
                    { nombre: 'Carrera larga', series: 1, repeticiones: '45-60 min zona 2', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Vuelta a la calma', series: 1, repeticiones: '10 min trote suave', descanso_segundos: 0, orden: 1 },
                    { nombre: 'Estiramiento global', series: 1, repeticiones: 'Rutina de estiramientos post-carrera', descanso_segundos: 0, orden: 2 },
                ],
            },
        ],
    },
    // ══════════════════════════════════════════════════════════════
    // RUNNING — 10K
    // ══════════════════════════════════════════════════════════════
    {
        nombre: 'Running 10K 10 semanas',
        descripcion: 'Programa de 10K con base en Daniels (2014) y 80/20 Running. Mayor volumen semanal que 5K. Incluye intervalos 800m-1.600m, tempo runs, fartlek y carrera larga progresiva. 4-5 días de carrera con trabajo de fuerza.',
        tipo: 'cardio',
        duracion_semanas: 10,
        nivel: 'intermedio',
        objetivo: 'rendimiento',
        dias_por_semana: 5,
        sesiones: [
            {
                nombre: 'Intervalos 800m-1km', dia_semana: 'Martes', orden: 0,
                ejercicios: [
                    { nombre: 'Trote de calentamiento', series: 1, repeticiones: '15 min trote', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Intervalos 800m', series: 5, repeticiones: '800m a ritmo 5K-10K con 2 min recup', descanso_segundos: 120, orden: 1 },
                    { nombre: 'Vuelta a la calma', series: 1, repeticiones: '10 min trote', descanso_segundos: 0, orden: 2 },
                ],
            },
            {
                nombre: 'Tempo + Cuestas', dia_semana: 'Miércoles', orden: 1,
                ejercicios: [
                    { nombre: 'Trote de calentamiento', series: 1, repeticiones: '15 min trote', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Carrera tempo', series: 1, repeticiones: '25 min a ritmo tempo (10K-semi)', descanso_segundos: 0, orden: 1 },
                    { nombre: 'Cuestas cortas', series: 6, repeticiones: '150m cuesta arriba a tope, trote bajada recup', descanso_segundos: 90, orden: 2 },
                    { nombre: 'Vuelta a la calma', series: 1, repeticiones: '10 min trote', descanso_segundos: 0, orden: 3 },
                ],
            },
            {
                nombre: 'Carrera Fácil', dia_semana: 'Jueves', orden: 2,
                ejercicios: [
                    { nombre: 'Carrera continua', series: 1, repeticiones: '40-50 min zona 2', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Strides', series: 4, repeticiones: '80m técnica', descanso_segundos: 60, orden: 1 },
                ],
            },
            {
                nombre: 'Fartlek', dia_semana: 'Viernes', orden: 3,
                ejercicios: [
                    { nombre: 'Trote de calentamiento', series: 1, repeticiones: '15 min trote', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Fartlek', series: 1, repeticiones: '30 min fartlek: 2min rápido + 1min lento', descanso_segundos: 0, orden: 1 },
                    { nombre: 'Vuelta a la calma', series: 1, repeticiones: '10 min trote', descanso_segundos: 0, orden: 2 },
                ],
            },
            {
                nombre: 'Carrera Larga Progresiva', dia_semana: 'Domingo', orden: 4,
                ejercicios: [
                    { nombre: 'Carrera larga con ritmo', series: 1, repeticiones: '60-90 min: 30 min zona2 + 30 min tempo + final ritmo 10K', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Vuelta a la calma', series: 1, repeticiones: '10 min trote', descanso_segundos: 0, orden: 1 },
                ],
            },
        ],
    },
    // ══════════════════════════════════════════════════════════════
    // RUNNING — MEDIA MARATÓN
    // ══════════════════════════════════════════════════════════════
    {
        nombre: 'Running Media Maratón 12 semanas',
        descripcion: 'Programa completo para media maratón (21.1K). Basado en Daniels (2014) y Fitzgerald (2021). Mayor volumen semanal (40-60km). Incluye trabajo de umbral, intervalos largos, tempo runs y carrera larga progresiva hasta 18km.',
        tipo: 'cardio',
        duracion_semanas: 12,
        nivel: 'avanzado',
        objetivo: 'rendimiento',
        dias_por_semana: 5,
        sesiones: [
            {
                nombre: 'Umbral + Intervalos 1600m', dia_semana: 'Martes', orden: 0,
                ejercicios: [
                    { nombre: 'Trote de calentamiento', series: 1, repeticiones: '15 min trote', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Intervalos 1.600m', series: 4, repeticiones: '1600m a ritmo 10K con 3 min recup', descanso_segundos: 180, orden: 1 },
                    { nombre: 'Vuelta a la calma', series: 1, repeticiones: '10 min trote', descanso_segundos: 0, orden: 2 },
                ],
            },
            {
                nombre: 'Carrera Tempo', dia_semana: 'Miércoles', orden: 1,
                ejercicios: [
                    { nombre: 'Trote de calentamiento', series: 1, repeticiones: '15 min trote', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Carrera tempo', series: 1, repeticiones: '30-40 min a ritmo tempo (semi-maratón)', descanso_segundos: 0, orden: 1 },
                    { nombre: 'Vuelta a la calma', series: 1, repeticiones: '10 min trote', descanso_segundos: 0, orden: 2 },
                ],
            },
            {
                nombre: 'Carrera Fácil', dia_semana: 'Jueves', orden: 2,
                ejercicios: [
                    { nombre: 'Carrera continua', series: 1, repeticiones: '45-60 min zona 2', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Strides', series: 4, repeticiones: '80m', descanso_segundos: 60, orden: 1 },
                ],
            },
            {
                nombre: 'Fartlek + Cuestas', dia_semana: 'Viernes', orden: 3,
                ejercicios: [
                    { nombre: 'Trote de calentamiento', series: 1, repeticiones: '15 min trote', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Fartlek progresivo', series: 1, repeticiones: '30-40 min fartlek progresivo', descanso_segundos: 0, orden: 1 },
                    { nombre: 'Cuestas largas', series: 4, repeticiones: '300m cuesta (ritmo 10K) con trote bajada', descanso_segundos: 120, orden: 2 },
                    { nombre: 'Vuelta a la calma', series: 1, repeticiones: '10 min trote', descanso_segundos: 0, orden: 3 },
                ],
            },
            {
                nombre: 'Carrera Larga', dia_semana: 'Domingo', orden: 4,
                ejercicios: [
                    { nombre: 'Carrera larga', series: 1, repeticiones: '75-120 min zona 2 (progresar hasta 18km)', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Carrera larga con ritmo', series: 1, repeticiones: 'Últimos 20-30 min a ritmo de media maratón', descanso_segundos: 0, orden: 1 },
                    { nombre: 'Vuelta a la calma', series: 1, repeticiones: '10 min trote + estiramientos', descanso_segundos: 0, orden: 2 },
                ],
            },
        ],
    },
    // ══════════════════════════════════════════════════════════════
    // RUNNING — MARATÓN
    // ══════════════════════════════════════════════════════════════
    {
        nombre: 'Running Maratón 16 semanas',
        descripcion: 'Programa completo de maratón (42.2K). Basado en Daniels (2014) y 80/20 Running. Alto volumen semanal (50-80km). Incluye intervalos 1.200m-1.600m, tempo runs, progresiones y carrera larga hasta 32km.',
        tipo: 'cardio',
        duracion_semanas: 16,
        nivel: 'avanzado',
        objetivo: 'rendimiento',
        dias_por_semana: 5,
        sesiones: [
            {
                nombre: 'Intervalos Largos', dia_semana: 'Martes', orden: 0,
                ejercicios: [
                    { nombre: 'Trote de calentamiento', series: 1, repeticiones: '15-20 min trote', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Intervalos 1.200m', series: 5, repeticiones: '1200m a ritmo 10K con 3 min recup', descanso_segundos: 180, orden: 1 },
                    { nombre: 'Vuelta a la calma', series: 1, repeticiones: '10 min trote', descanso_segundos: 0, orden: 2 },
                ],
            },
            {
                nombre: 'Tempo + Cuestas Largas', dia_semana: 'Miércoles', orden: 1,
                ejercicios: [
                    { nombre: 'Trote de calentamiento', series: 1, repeticiones: '15 min trote', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Carrera umbral', series: 1, repeticiones: '40 min a ritmo tempo (semi-maratón)', descanso_segundos: 0, orden: 1 },
                    { nombre: 'Cuestas largas', series: 5, repeticiones: '600m cuesta (ritmo 10K) con trote bajada', descanso_segundos: 120, orden: 2 },
                    { nombre: 'Vuelta a la calma', series: 1, repeticiones: '10 min trote', descanso_segundos: 0, orden: 3 },
                ],
            },
            {
                nombre: 'Carrera Fácil', dia_semana: 'Jueves', orden: 2,
                ejercicios: [
                    { nombre: 'Carrera continua', series: 1, repeticiones: '40-60 min zona 2', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Strides', series: 5, repeticiones: '80m técnica', descanso_segundos: 60, orden: 1 },
                ],
            },
            {
                nombre: 'Progression Run', dia_semana: 'Viernes', orden: 3,
                ejercicios: [
                    { nombre: 'Progression run', series: 1, repeticiones: '60-75 min: empezar zona 2, terminar ritmo maratón', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Vuelta a la calma', series: 1, repeticiones: '10 min trote', descanso_segundos: 0, orden: 1 },
                ],
            },
            {
                nombre: 'Carrera Larga Clave', dia_semana: 'Domingo', orden: 4,
                ejercicios: [
                    { nombre: 'Carrera larga con ritmo', series: 1, repeticiones: '2h-3h progresivo: zona2 hasta 25km, luego ritmo maratón últimos 5-7km', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Estiramiento global', series: 1, repeticiones: '15 min trote + estiramientos completos', descanso_segundos: 0, orden: 1 },
                ],
            },
        ],
    },
    // ══════════════════════════════════════════════════════════════
    // CICLISMO — BASE (Coggan & Allen 2023)
    // ══════════════════════════════════════════════════════════════
    {
        nombre: 'Ciclismo Base 8 semanas',
        descripcion: 'Programa de base aeróbica para ciclistas. Construcción de volumen con trabajo zona 2, sweet spot y técnica de pedaleo. Ideal para ciclistas de carretera, MTB o gravel. 4-5 días de rodillo + 2 días de fuerza complementaria.',
        tipo: 'cardio',
        duracion_semanas: 8,
        nivel: 'intermedio',
        objetivo: 'rendimiento',
        dias_por_semana: 4,
        sesiones: [
            {
                nombre: 'Rodillo Base Z2', dia_semana: 'Martes', orden: 0,
                ejercicios: [
                    { nombre: 'Rodillo base', series: 1, repeticiones: '60-90 min zona 2, 85-95 rpm', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Cadencia drills', series: 1, repeticiones: '5 min cadencia drills (110-130 rpm) al final', descanso_segundos: 0, orden: 1 },
                ],
            },
            {
                nombre: 'Sweet Spot', dia_semana: 'Miércoles', orden: 1,
                ejercicios: [
                    { nombre: 'Rodillo recuperación', series: 1, repeticiones: '15 min rodillo suave', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Sweet spot training', series: 3, repeticiones: '10 min a 88-93% FTP con 5 min recup', descanso_segundos: 300, orden: 1 },
                    { nombre: 'Rodillo recuperación', series: 1, repeticiones: '10 min rodillo suave', descanso_segundos: 0, orden: 2 },
                ],
            },
            {
                nombre: 'Fuerza Gimnasio', dia_semana: 'Jueves', orden: 2,
                ejercicios: [
                    { nombre: 'Sentadilla con barra', series: 4, repeticiones: '8-10', descanso_segundos: 120, orden: 0 },
                    { nombre: 'Peso muerto rumano', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Gemelos de pie', series: 3, repeticiones: '12', descanso_segundos: 60, orden: 2 },
                    { nombre: 'Caminata del granjero', series: 3, repeticiones: '12', descanso_segundos: 60, orden: 3 },
                    { nombre: 'Plancha', series: 3, repeticiones: '15', descanso_segundos: 60, orden: 4 },
                ],
            },
            {
                nombre: 'Tempo + Técnica', dia_semana: 'Viernes', orden: 3,
                ejercicios: [
                    { nombre: 'Rodillo recuperación', series: 1, repeticiones: '15 min rodillo suave', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Rodillo tempo', series: 1, repeticiones: '30 min a ritmo tempo (zona 3)', descanso_segundos: 0, orden: 1 },
                    { nombre: 'Pedaleo a una pierna', series: 1, repeticiones: '10 min pedaleo una pierna (5 min cada pierna)', descanso_segundos: 0, orden: 2 },
                    { nombre: 'Rodillo recuperación', series: 1, repeticiones: '10 min rodillo suave', descanso_segundos: 0, orden: 3 },
                ],
            },
        ],
    },
    // ══════════════════════════════════════════════════════════════
    // CICLISMO — INTERVALOS FTP
    // ══════════════════════════════════════════════════════════════
    {
        nombre: 'Ciclismo Intervalos FTP 8 semanas',
        descripcion: 'Programa centrado en elevar el FTP mediante trabajo de intervalos. Basado en Coggan (2023). Incluye sobre-under, intervalos VO2max, tempo y contrarreloj. 5 días de rodillo + fuerza específica.',
        tipo: 'cardio',
        duracion_semanas: 8,
        nivel: 'avanzado',
        objetivo: 'rendimiento',
        dias_por_semana: 5,
        sesiones: [
            {
                nombre: 'Sobre-Under FTP', dia_semana: 'Martes', orden: 0,
                ejercicios: [
                    { nombre: 'Rodillo recuperación', series: 1, repeticiones: '20 min rodillo suave', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Intervalos sobre-under', series: 3, repeticiones: '8 min: 3 min 105% FTP + 2 min 95% FTP + 3 min 105% FTP, 4 min recup entre series', descanso_segundos: 240, orden: 1 },
                    { nombre: 'Rodillo recuperación', series: 1, repeticiones: '15 min rodillo suave', descanso_segundos: 0, orden: 2 },
                ],
            },
            {
                nombre: 'VO2max', dia_semana: 'Miércoles', orden: 1,
                ejercicios: [
                    { nombre: 'Rodillo recuperación', series: 1, repeticiones: '20 min rodillo suave', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Intervalos cortos (VO2max)', series: 5, repeticiones: '4 min 110-120% FTP con 3 min recup entre series', descanso_segundos: 180, orden: 1 },
                    { nombre: 'Rodillo recuperación', series: 1, repeticiones: '15 min rodillo suave', descanso_segundos: 0, orden: 2 },
                ],
            },
            {
                nombre: 'Recuperación Activa', dia_semana: 'Jueves', orden: 2,
                ejercicios: [
                    { nombre: 'Rodillo recuperación', series: 1, repeticiones: '40 min rodillo suave zona 1-2', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Mobility warm-up', series: 1, repeticiones: 'Rutina completa de movilidad', descanso_segundos: 0, orden: 1 },
                ],
            },
            {
                nombre: 'Tempo + Fuerza', dia_semana: 'Viernes', orden: 3,
                ejercicios: [
                    { nombre: 'Rodillo tempo', series: 1, repeticiones: '60 min: 20 min suave + 30 min tempo zona 3 + 10 min suave', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Sentadilla con barra', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Peso muerto rumano', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 2 },
                    { nombre: 'Gemelos de pie', series: 3, repeticiones: '12', descanso_segundos: 60, orden: 3 },
                ],
            },
            {
                nombre: 'Contrarreloj', dia_semana: 'Sábado', orden: 4,
                ejercicios: [
                    { nombre: 'Cadencia drills', series: 1, repeticiones: '20 min rodillo suave + drills de cadencia', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Contrarreloj simulación', series: 1, repeticiones: '20 min a 100% FTP (simulación contrarreloj)', descanso_segundos: 0, orden: 1 },
                    { nombre: 'Rodillo recuperación', series: 1, repeticiones: '15 min rodillo suave', descanso_segundos: 0, orden: 2 },
                ],
            },
        ],
    },
    // ══════════════════════════════════════════════════════════════
    // CICLISMO — RESISTENCIA
    // ══════════════════════════════════════════════════════════════
    {
        nombre: 'Ciclismo Resistencia 10 semanas',
        descripcion: 'Programa de larga distancia para ciclistas de fondo, gran fondo o cicloturistas. Construcción de volumen aeróbico hasta 5-6h. Incluye trabajo de fuerza-resistencia, sweet spot y nutrición en ruta.',
        tipo: 'cardio',
        duracion_semanas: 10,
        nivel: 'avanzado',
        objetivo: 'rendimiento',
        dias_por_semana: 4,
        sesiones: [
            {
                nombre: 'Fuerza-Resistencia', dia_semana: 'Martes', orden: 0,
                ejercicios: [
                    { nombre: 'Rodillo recuperación', series: 1, repeticiones: '20 min rodillo suave', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Fuerza-resistencia', series: 4, repeticiones: '8 min a baja cadencia (50-60 rpm) zona 3-4, con 4 min recup', descanso_segundos: 240, orden: 1 },
                    { nombre: 'Rodillo recuperación', series: 1, repeticiones: '15 min rodillo suave', descanso_segundos: 0, orden: 2 },
                ],
            },
            {
                nombre: 'Sweet Spot Largo', dia_semana: 'Miércoles', orden: 1,
                ejercicios: [
                    { nombre: 'Rodillo recuperación', series: 1, repeticiones: '20 min rodillo suave', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Sweet spot training', series: 3, repeticiones: '12-15 min 90% FTP con 5 min recup', descanso_segundos: 300, orden: 1 },
                    { nombre: 'Rodillo recuperación', series: 1, repeticiones: '15 min rodillo suave', descanso_segundos: 0, orden: 2 },
                ],
            },
            {
                nombre: 'Fuerza + Core', dia_semana: 'Jueves', orden: 2,
                ejercicios: [
                    { nombre: 'Sentadilla con barra', series: 4, repeticiones: '8-10', descanso_segundos: 120, orden: 0 },
                    { nombre: 'Peso muerto', series: 3, repeticiones: '10', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Caminata del granjero', series: 3, repeticiones: '12', descanso_segundos: 60, orden: 2 },
                    { nombre: 'Plancha lateral', series: 3, repeticiones: '15', descanso_segundos: 45, orden: 3 },
                    { nombre: 'Pallof press', series: 3, repeticiones: '12', descanso_segundos: 45, orden: 4 },
                ],
            },
            {
                nombre: 'Rodillo Base Largo', dia_semana: 'Sábado', orden: 3,
                ejercicios: [
                    { nombre: 'Rodillo base', series: 1, repeticiones: '2-3h zona 2 a 85-95 rpm constante', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Rodillo tempo', series: 1, repeticiones: 'Últimos 20 min a ritmo tempo (zona 3)', descanso_segundos: 0, orden: 1 },
                ],
            },
        ],
    },
    // ══════════════════════════════════════════════════════════════
    // TRIATLÓN — SPRINT (Friel 2021)
    // ══════════════════════════════════════════════════════════════
    {
        nombre: 'Triatlón Sprint 8 semanas',
        descripcion: 'Programa de iniciación al triatlón distancia Sprint (750m natación + 20km bici + 5km carrera). Basado en Friel (2021). Incluye 3 sesiones de natación, 2 de bici, 2 de carrera y 1 brick (bici+carrera).',
        tipo: 'mixto',
        duracion_semanas: 8,
        nivel: 'intermedio',
        objetivo: 'rendimiento',
        dias_por_semana: 6,
        sesiones: [
            {
                nombre: 'Natación Técnica', dia_semana: 'Lunes', orden: 0,
                ejercicios: [
                    { nombre: 'Natación crol técnica', series: 1, repeticiones: '200m calentamiento + drills técnica', descanso_segundos: 30, orden: 0 },
                    { nombre: 'Series de crol 50m', series: 6, repeticiones: '50m a ritmo con 20s recup', descanso_segundos: 20, orden: 1 },
                    { nombre: 'Series de crol 100m', series: 4, repeticiones: '100m a ritmo con 30s recup', descanso_segundos: 30, orden: 2 },
                    { nombre: 'Natación crol', series: 1, repeticiones: '200m vuelta a la calma', descanso_segundos: 0, orden: 3 },
                ],
            },
            {
                nombre: 'Bici Intervalos', dia_semana: 'Martes', orden: 1,
                ejercicios: [
                    { nombre: 'Rodillo recuperación', series: 1, repeticiones: '15 min rodillo suave', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Intervalos sobre-under', series: 5, repeticiones: '3 min a 105-110% FTP + 2 min suave', descanso_segundos: 120, orden: 1 },
                    { nombre: 'Rodillo recuperación', series: 1, repeticiones: '10 min rodillo suave', descanso_segundos: 0, orden: 2 },
                ],
            },
            {
                nombre: 'Carrera Tempo', dia_semana: 'Miércoles', orden: 2,
                ejercicios: [
                    { nombre: 'Trote de calentamiento', series: 1, repeticiones: '15 min trote', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Carrera tempo', series: 1, repeticiones: '20-25 min a ritmo tempo', descanso_segundos: 0, orden: 1 },
                    { nombre: 'Vuelta a la calma', series: 1, repeticiones: '10 min trote', descanso_segundos: 0, orden: 2 },
                ],
            },
            {
                nombre: 'Natación Series', dia_semana: 'Jueves', orden: 3,
                ejercicios: [
                    { nombre: 'Natación crol', series: 1, repeticiones: '300m calentamiento progresivo', descanso_segundos: 30, orden: 0 },
                    { nombre: 'Series de crol 50m', series: 8, repeticiones: '8x50m a ritmo con 15s recup', descanso_segundos: 15, orden: 1 },
                    { nombre: 'Series de crol 100m', series: 4, repeticiones: '4x100m a ritmo sprint con 30s recup', descanso_segundos: 30, orden: 2 },
                    { nombre: 'Pull buoy', series: 1, repeticiones: '200m pull buoy técnica', descanso_segundos: 0, orden: 3 },
                ],
            },
            {
                nombre: 'Brick Bici + Carrera', dia_semana: 'Viernes', orden: 4,
                ejercicios: [
                    { nombre: 'Rodillo tempo', series: 1, repeticiones: '30 min rodillo tempo', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Carrera a ritmo de 5K', series: 1, repeticiones: 'Transición rápida + 15 min trote a ritmo 5K', descanso_segundos: 0, orden: 1 },
                ],
            },
            {
                nombre: 'Carrera Larga', dia_semana: 'Sábado', orden: 5,
                ejercicios: [
                    { nombre: 'Carrera continua', series: 1, repeticiones: '45-60 min carrera continua zona 2', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Strides', series: 4, repeticiones: '80m técnica', descanso_segundos: 60, orden: 1 },
                ],
            },
        ],
    },
    // ══════════════════════════════════════════════════════════════
    // TRIATLÓN — OLÍMPICO
    // ══════════════════════════════════════════════════════════════
    {
        nombre: 'Triatlón Olímpico 12 semanas',
        descripcion: 'Programa para distancia olímpica (1.5km natación + 40km bici + 10km carrera). Basado en Friel (2021). Mayor volumen que sprint. Incluye bricks semanales, natación en aguas abiertas simulada y trabajo específico de transiciones.',
        tipo: 'mixto',
        duracion_semanas: 12,
        nivel: 'avanzado',
        objetivo: 'rendimiento',
        dias_por_semana: 7,
        sesiones: [
            {
                nombre: 'Natación Umbral', dia_semana: 'Lunes', orden: 0,
                ejercicios: [
                    { nombre: 'Natación crol', series: 1, repeticiones: '400m calentamiento progresivo', descanso_segundos: 30, orden: 0 },
                    { nombre: 'Series de crol 200m', series: 4, repeticiones: '200m a ritmo olímpico con 45s recup', descanso_segundos: 45, orden: 1 },
                    { nombre: 'Series de crol 50m', series: 8, repeticiones: '50m a tope con 20s recup', descanso_segundos: 20, orden: 2 },
                    { nombre: 'Pull buoy', series: 1, repeticiones: '400m pull buoy + drills técnica', descanso_segundos: 0, orden: 3 },
                ],
            },
            {
                nombre: 'Bici FTP', dia_semana: 'Martes', orden: 1,
                ejercicios: [
                    { nombre: 'Rodillo base', series: 1, repeticiones: '20 min rodillo suave', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Intervalos largos (FTP)', series: 3, repeticiones: '8-10 min a 100% FTP con 5 min recup', descanso_segundos: 300, orden: 1 },
                    { nombre: 'Rodillo recuperación', series: 1, repeticiones: '15 min rodillo suave', descanso_segundos: 0, orden: 2 },
                ],
            },
            {
                nombre: 'Carrera Umbral', dia_semana: 'Miércoles', orden: 2,
                ejercicios: [
                    { nombre: 'Trote de calentamiento', series: 1, repeticiones: '15 min trote', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Carrera umbral', series: 3, repeticiones: '5 min a ritmo 10K con 2 min recup trote', descanso_segundos: 120, orden: 1 },
                    { nombre: 'Vuelta a la calma', series: 1, repeticiones: '10 min trote', descanso_segundos: 0, orden: 2 },
                ],
            },
            {
                nombre: 'Natación Aguas Abiertas', dia_semana: 'Jueves', orden: 3,
                ejercicios: [
                    { nombre: 'Natación crol técnica', series: 1, repeticiones: '400m calentamiento + drills avistamiento', descanso_segundos: 30, orden: 0 },
                    { nombre: 'Natación a ritmo de competición', series: 1, repeticiones: '1000m continuo a ritmo de competición', descanso_segundos: 0, orden: 1 },
                    { nombre: 'Sighting drills', series: 1, repeticiones: '300m drills de avistamiento y respiración bilateral', descanso_segundos: 30, orden: 2 },
                    { nombre: 'Natación crol', series: 1, repeticiones: '100m vuelta a la calma', descanso_segundos: 0, orden: 3 },
                ],
            },
            {
                nombre: 'Brick Largo', dia_semana: 'Viernes', orden: 4,
                ejercicios: [
                    { nombre: 'Rodillo tempo', series: 1, repeticiones: '45-60 min bici a ritmo tempo', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Carrera a ritmo de 10K', series: 1, repeticiones: 'Transición rápida + 20 min a ritmo 10K', descanso_segundos: 0, orden: 1 },
                ],
            },
            {
                nombre: 'Carrera Larga', dia_semana: 'Sábado', orden: 5,
                ejercicios: [
                    { nombre: 'Carrera larga', series: 1, repeticiones: '60-90 min carrera continua zona 2', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Strides', series: 4, repeticiones: '80m', descanso_segundos: 60, orden: 1 },
                ],
            },
            {
                nombre: 'Natación Recuperación', dia_semana: 'Domingo', orden: 6,
                ejercicios: [
                    { nombre: 'Natación crol técnica', series: 1, repeticiones: '500m suave + drills de respiración y técnica', descanso_segundos: 30, orden: 0 },
                    { nombre: 'Pull buoy', series: 1, repeticiones: '300m pull buoy', descanso_segundos: 0, orden: 1 },
                    { nombre: 'Estiramiento global', series: 1, repeticiones: 'Rutina de estiramientos completa', descanso_segundos: 0, orden: 2 },
                ],
            },
        ],
    },
    // ══════════════════════════════════════════════════════════════
    // TRIATLÓN — MEDIO IRONMAN (70.3)
    // ══════════════════════════════════════════════════════════════
    {
        nombre: 'Triatlón Medio Ironman 16 semanas',
        descripcion: 'Programa para 70.3 (1.9km natación + 90km bici + 21.1km carrera). Basado en Friel (2021). Alto volumen con énfasis en resistencia aeróbica. Incluye bricks largos, natación en aguas abiertas, rodillos de 2-3h y carreras largas de 15-18km.',
        tipo: 'mixto',
        duracion_semanas: 16,
        nivel: 'avanzado',
        objetivo: 'rendimiento',
        dias_por_semana: 8,
        sesiones: [
            {
                nombre: 'Natación Volumen', dia_semana: 'Lunes', orden: 0,
                ejercicios: [
                    { nombre: 'Natación crol técnica', series: 1, repeticiones: '500m calentamiento + drills', descanso_segundos: 30, orden: 0 },
                    { nombre: 'Series de crol 400m', series: 3, repeticiones: '400m a ritmo 70.3 con 45s recup', descanso_segundos: 45, orden: 1 },
                    { nombre: 'Series de crol 200m', series: 4, repeticiones: '200m a ritmo con 30s recup', descanso_segundos: 30, orden: 2 },
                    { nombre: 'Pull buoy', series: 1, repeticiones: '500m vuelta a la calma + pull buoy', descanso_segundos: 0, orden: 3 },
                ],
            },
            {
                nombre: 'Rodillo Largo + Tempo', dia_semana: 'Martes', orden: 1,
                ejercicios: [
                    { nombre: 'Rodillo tempo', series: 1, repeticiones: '60-90 min: 30 min suave + 30 min tempo + 30 min suave', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Sentadilla con barra', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Gemelos de pie', series: 3, repeticiones: '12', descanso_segundos: 60, orden: 2 },
                ],
            },
            {
                nombre: 'Carrera Umbral + Cuestas', dia_semana: 'Miércoles', orden: 2,
                ejercicios: [
                    { nombre: 'Trote de calentamiento', series: 1, repeticiones: '15 min trote', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Carrera umbral', series: 3, repeticiones: '8 min a ritmo semi con 3 min recup', descanso_segundos: 180, orden: 1 },
                    { nombre: 'Cuestas largas', series: 5, repeticiones: '300m cuesta (ritmo 10K) con trote bajada', descanso_segundos: 90, orden: 2 },
                    { nombre: 'Vuelta a la calma', series: 1, repeticiones: '10 min trote', descanso_segundos: 0, orden: 3 },
                ],
            },
            {
                nombre: 'Natación Técnica + Series', dia_semana: 'Jueves', orden: 3,
                ejercicios: [
                    { nombre: 'Bilateral breathing drills', series: 1, repeticiones: '400m calentamiento + drills respiración bilateral', descanso_segundos: 30, orden: 0 },
                    { nombre: 'Series de crol 100m', series: 6, repeticiones: '6x100m a ritmo con 20s recup', descanso_segundos: 20, orden: 1 },
                    { nombre: 'Series de crol 200m', series: 3, repeticiones: '3x200m a ritmo 70.3 con 30s recup', descanso_segundos: 30, orden: 2 },
                    { nombre: 'Drill de codo alto', series: 1, repeticiones: '500m pull buoy + drills de codo alto', descanso_segundos: 0, orden: 3 },
                ],
            },
            {
                nombre: 'Brick Medio', dia_semana: 'Viernes', orden: 4,
                ejercicios: [
                    { nombre: 'Rodillo tempo', series: 1, repeticiones: '75-90 min bici: 45 min zona2 + 30 min tempo', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Carrera a ritmo de media maratón', series: 1, repeticiones: '25-30 min trote a ritmo semi', descanso_segundos: 0, orden: 1 },
                ],
            },
            {
                nombre: 'Natación Recuperación', dia_semana: 'Sábado', orden: 5,
                ejercicios: [
                    { nombre: 'Natación crol', series: 1, repeticiones: '1000m suave con pull buoy y drills', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Estiramiento global', series: 1, repeticiones: 'Rutina de estiramientos', descanso_segundos: 0, orden: 1 },
                ],
            },
            {
                nombre: 'Carrera Larga', dia_semana: 'Domingo', orden: 6,
                ejercicios: [
                    { nombre: 'Carrera larga con ritmo', series: 1, repeticiones: '90-120 min progresivo: zona2 hasta 12km, luego ritmo semi últimos 3-5km', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Vuelta a la calma', series: 1, repeticiones: '10 min trote + estiramientos', descanso_segundos: 0, orden: 1 },
                ],
            },
            {
                nombre: 'Rodillo Base', dia_semana: 'Domingo', orden: 7,
                ejercicios: [
                    { nombre: 'Rodillo base', series: 1, repeticiones: '60 min rodillo base zona 2 (segunda sesión del domingo)', descanso_segundos: 0, orden: 0 },
                ],
            },
        ],
    },
    // ══════════════════════════════════════════════════════════════
    // TRIATLÓN — IRONMAN
    // ══════════════════════════════════════════════════════════════
    {
        nombre: 'Triatlón Ironman 20 semanas',
        descripcion: 'Programa completo para distancia Ironman (3.8km natación + 180km bici + 42.2km carrera). Basado en Friel (2021). Máximo volumen: 10-12 sesiones/semana. Incluye bricks de 4-5h, natación de 3-4km, rodillos de 4-5h y carreras largas de 30km.',
        tipo: 'mixto',
        duracion_semanas: 20,
        nivel: 'avanzado',
        objetivo: 'rendimiento',
        dias_por_semana: 10,
        sesiones: [
            {
                nombre: 'Natación Larga', dia_semana: 'Lunes', orden: 0,
                ejercicios: [
                    { nombre: 'Natación crol técnica', series: 1, repeticiones: '600m calentamiento + drills avistamiento y respiración bilateral', descanso_segundos: 30, orden: 0 },
                    { nombre: 'Series de crol 400m', series: 2, repeticiones: '2x800m a ritmo IM con 60s recup', descanso_segundos: 60, orden: 1 },
                    { nombre: 'Series de crol 200m', series: 4, repeticiones: '4x200m a ritmo con 30s recup', descanso_segundos: 30, orden: 2 },
                    { nombre: 'Pull buoy', series: 1, repeticiones: '600m pull buoy + drills técnica', descanso_segundos: 0, orden: 3 },
                ],
            },
            {
                nombre: 'Rodillo Base + Tempo AM', dia_semana: 'Martes', orden: 1,
                ejercicios: [
                    { nombre: 'Rodillo base', series: 1, repeticiones: '45 min rodillo base zona 2 (sesión matinal)', descanso_segundos: 0, orden: 0 },
                ],
            },
            {
                nombre: 'Fuerza Gimnasio PM', dia_semana: 'Martes', orden: 2,
                ejercicios: [
                    { nombre: 'Sentadilla con barra', series: 4, repeticiones: '8-10', descanso_segundos: 120, orden: 0 },
                    { nombre: 'Peso muerto rumano', series: 3, repeticiones: '10-12', descanso_segundos: 90, orden: 1 },
                    { nombre: 'Gemelos de pie', series: 3, repeticiones: '12', descanso_segundos: 60, orden: 2 },
                    { nombre: 'Plancha', series: 3, repeticiones: '15', descanso_segundos: 45, orden: 3 },
                    { nombre: 'Pallof press', series: 3, repeticiones: '12', descanso_segundos: 45, orden: 4 },
                ],
            },
            {
                nombre: 'Carrera Umbral AM', dia_semana: 'Miércoles', orden: 3,
                ejercicios: [
                    { nombre: 'Trote de calentamiento', series: 1, repeticiones: '15 min trote', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Carrera umbral', series: 3, repeticiones: '10 min a ritmo semi con 3 min recup', descanso_segundos: 180, orden: 1 },
                    { nombre: 'Vuelta a la calma', series: 1, repeticiones: '10 min trote', descanso_segundos: 0, orden: 2 },
                ],
            },
            {
                nombre: 'Rodillo Tempo PM', dia_semana: 'Miércoles', orden: 4,
                ejercicios: [
                    { nombre: 'Rodillo tempo', series: 1, repeticiones: '60 min: 15 min suave + 30 min tempo + 15 min suave', descanso_segundos: 0, orden: 0 },
                ],
            },
            {
                nombre: 'Natación Técnica', dia_semana: 'Jueves', orden: 5,
                ejercicios: [
                    { nombre: 'Natación crol técnica', series: 1, repeticiones: '500m calentamiento + drills', descanso_segundos: 30, orden: 0 },
                    { nombre: 'Series de crol 200m', series: 5, repeticiones: '5x200m a ritmo IM con 30s recup', descanso_segundos: 30, orden: 1 },
                    { nombre: 'Series de crol 100m', series: 4, repeticiones: '4x100m a ritmo con 20s recup', descanso_segundos: 20, orden: 2 },
                    { nombre: 'Patada con tabla', series: 1, repeticiones: '400m patada con tabla', descanso_segundos: 0, orden: 3 },
                ],
            },
            {
                nombre: 'Brick Largo Clave', dia_semana: 'Sábado', orden: 6,
                ejercicios: [
                    { nombre: 'Rodillo base', series: 1, repeticiones: '3-5h bici: 2h zona2 + 1h tempo + final zona2', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Carrera a ritmo de media maratón', series: 1, repeticiones: 'Transición rápida + 30-60 min trote a ritmo maratón', descanso_segundos: 0, orden: 1 },
                ],
            },
            {
                nombre: 'Carrera Larga', dia_semana: 'Domingo', orden: 7,
                ejercicios: [
                    { nombre: 'Carrera larga con ritmo', series: 1, repeticiones: '2h-3h progresivo: zona2 hasta 25km, luego ritmo maratón últimos 5-7km', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Estiramiento global', series: 1, repeticiones: '15 min trote + estiramientos completos', descanso_segundos: 0, orden: 1 },
                ],
            },
            {
                nombre: 'Recuperación Activa', dia_semana: 'Domingo', orden: 8,
                ejercicios: [
                    { nombre: 'Natación crol', series: 1, repeticiones: '30-45 min natación suave + estiramientos', descanso_segundos: 0, orden: 0 },
                    { nombre: 'Mobility warm-up', series: 1, repeticiones: 'Rutina completa de movilidad y foam rolling', descanso_segundos: 0, orden: 1 },
                ],
            },
        ],
    },
]

/**
 * GET /api/plantillas-entreno/seed
 *
 * Inserta las 7 plantillas de entrenamiento base usando service role.
 * Busca el primer coach y asigna las plantillas.
 * Busca ejercicios por nombre en la BD existente.
 *
 * USO:
 *   curl -X GET http://localhost:3000/api/plantillas-entreno/seed
 */
export async function GET() {
    try {
        // 1. Buscar el primer coach
        const { data: coaches, error: coachError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('role', 'coach')
            .limit(1)

        if (coachError) {
            return NextResponse.json({ error: `Error al buscar coach: ${coachError.message}` }, { status: 500 })
        }

        if (!coaches || coaches.length === 0) {
            return NextResponse.json(
                { error: 'No hay ningún coach registrado. Crea tu cuenta primero desde /login.' },
                { status: 400 }
            )
        }

        const coachId = coaches[0].id

        // 2. Verificar si ya existen plantillas para este coach
        const { data: existentes } = await supabaseAdmin
            .from('plantillas_entrenamiento')
            .select('id')
            .eq('coach_id', coachId)
            .limit(1)

        if (existentes && existentes.length > 0) {
            return NextResponse.json({
                message: 'ℹ️ Las plantillas de entrenamiento ya están insertadas para este coach.',
                count: 0,
            })
        }

        // 3. Obtener todos los ejercicios para resolver nombres -> ids
        const { data: ejercicios, error: ejError } = await supabaseAdmin
            .from('ejercicios')
            .select('id, nombre')

        if (ejError || !ejercicios) {
            return NextResponse.json({ error: 'Error al obtener ejercicios de la BD' }, { status: 500 })
        }

        const ejerciciosMap = new Map(ejercicios.map((e: any) => [e.nombre, e.id]))
        const errores: string[] = []

        // 4. Insertar plantillas una por una
        let totalEjerciciosInsertados = 0
        let totalSesionesInsertadas = 0

        for (const plantilla of PLANTILLAS) {
            const { sesiones, progresion, ...plantillaData } = plantilla

            const insertData: any = { coach_id: coachId, ...plantillaData }
            if (progresion) {
                insertData.progresion = JSON.stringify(progresion)
            }

            const { data: nuevaPlantilla, error: pError } = await supabaseAdmin
                .from('plantillas_entrenamiento')
                .insert(insertData)
                .select('id')
                .single()

            if (pError || !nuevaPlantilla) {
                errores.push(`Error al insertar plantilla "${plantilla.nombre}": ${pError?.message}`)
                continue
            }

            for (const sesion of sesiones) {
                const { ejercicios: ejList, ...sesionData } = sesion

                const { data: nuevaSesion, error: sError } = await supabaseAdmin
                    .from('plantilla_sesiones')
                    .insert({ plantilla_id: nuevaPlantilla.id, ...sesionData })
                    .select('id')
                    .single()

                if (sError || !nuevaSesion) {
                    errores.push(`Error al insertar sesión "${sesion.nombre}": ${sError?.message}`)
                    continue
                }

                totalSesionesInsertadas++

                for (const ej of ejList) {
                    const ejercicioId = ejerciciosMap.get(ej.nombre)
                    if (!ejercicioId) {
                        errores.push(`Ejercicio "${ej.nombre}" no encontrado en BD (plantilla: ${plantilla.nombre})`)
                        continue
                    }

                    const ejInsert: any = {
                        sesion_id: nuevaSesion.id,
                        ejercicio_id: ejercicioId,
                        series: ej.series,
                        repeticiones: ej.repeticiones,
                        descanso_segundos: ej.descanso_segundos,
                        orden: ej.orden,
                    }
                    if (ej.rpe) {
                        ejInsert.rpe = ej.rpe
                    }

                    const { error: ejInsertError } = await supabaseAdmin
                        .from('plantilla_sesion_ejercicios')
                        .insert(ejInsert)

                    if (ejInsertError) {
                        errores.push(`Error al insertar ej "${ej.nombre}": ${ejInsertError.message}`)
                        continue
                    }

                    totalEjerciciosInsertados++
                }
            }
        }

        return NextResponse.json({
            message: `✅ ${PLANTILLAS.length} plantillas, ${totalSesionesInsertadas} sesiones, ${totalEjerciciosInsertados} ejercicios insertados.`,
            count: PLANTILLAS.length,
            warnings: errores.length > 0 ? errores : undefined,
        })
    } catch (error: any) {
        console.error('Error en seed de plantillas entrenamiento:', error)
        return NextResponse.json(
            { error: 'Error interno al insertar plantillas de entrenamiento' },
            { status: 500 }
        )
    }
}
