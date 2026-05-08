'use client'

import { useState, useEffect } from 'react'

/**
 * Hook que devuelve un valor "debounced".
 * Útil para búsquedas en inputs sin disparar queries en cada tecla.
 *
 * @param value - El valor a debouncear
 * @param delay - Milisegundos de espera (default: 300)
 */
export function useDebounce<T>(value: T, delay = 300): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value)

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay)
        return () => clearTimeout(timer)
    }, [value, delay])

    return debouncedValue
}
