'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import FormularioCliente from '@/components/FormularioCliente'
import type { Cuestionario } from '@/types'
import { useToast } from '@/components/ui/Toast'

export default function CuestionarioPublicoPage() {
    const { addToast } = useToast()
    const { codigo } = useParams<{ codigo: string }>()
    const [cuestionario, setCuestionario] = useState<Cuestionario | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [enviando, setEnviando] = useState(false)
    const [enviado, setEnviado] = useState(false)

    useEffect(() => {
        async function load() {
            if (!codigo) return
            const { data, error } = await supabase
                .from('cuestionarios')
                .select('*')
                .eq('codigo_publico', codigo)
                .eq('activo', true)
                .single()

            if (error || !data) {
                setError('Cuestionario no encontrado o no disponible')
                setLoading(false)
                return
            }

            setCuestionario(data as Cuestionario)
            setLoading(false)
        }
        load()
    }, [codigo])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8FAFC' }}>
                <div className="w-8 h-8 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" style={{ borderColor: '#1C1C1E', borderTopColor: 'transparent' }} />
            </div>
        )
    }

    if (error || !cuestionario) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8FAFC' }}>
                <div className="card max-w-md w-full text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">😕</span>
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Cuestionario no disponible</h1>
                    <p className="text-gray-500">{error || 'Este cuestionario no existe o ha sido desactivado'}</p>
                </div>
            </div>
        )
    }

    async function handleSubmit(
        respuestas: Record<string, string | string[] | number>,
        nombre?: string,
        email?: string
    ) {
        setEnviando(true)
        try {
            const res = await fetch('/api/respuestas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    codigo_publico: codigo,
                    respuestas,
                    nombre_cliente: nombre,
                    email_cliente: email,
                }),
            })
            if (!res.ok) throw new Error('Error al enviar')
            setEnviado(true)
        } catch (err) {
            console.error('Error al enviar respuestas:', err)
            addToast({ type: 'error', title: 'Error', message: 'Hubo un error al enviar tus respuestas. Por favor, inténtalo de nuevo.' })
        } finally {
            setEnviando(false)
        }
    }

    if (enviado) {
        return (
            <div className="min-h-screen py-12 px-4" style={{ background: '#F8FAFC' }}>
                <div className="max-w-md mx-auto text-center animate-fade-in">
                    <div className="card py-12">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#F2F2F7' }}>
                            <span className="text-3xl">✅</span>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">¡Respuestas enviadas!</h2>
                        <p className="text-gray-500">Gracias por completar el cuestionario. Tu coach revisará tus respuestas pronto.</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen py-12 px-4" style={{ background: '#F8FAFC' }}>
            <div className="max-w-2xl mx-auto">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 animate-fade-in" style={{ background: '#F2F2F7' }}>
                        <span className="text-3xl">📋</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">{cuestionario.titulo}</h1>
                    {cuestionario.descripcion && (
                        <p className="text-gray-500 mt-2">{cuestionario.descripcion}</p>
                    )}
                </div>

                <FormularioCliente
                    cuestionario={cuestionario}
                    onSubmit={handleSubmit}
                    enviando={enviando}
                    enviado={enviado}
                />
            </div>
        </div>
    )
}
