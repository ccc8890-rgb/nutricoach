'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark'

export type ClaveEscala = 'general' | 'titulos' | 'textos'
export type Escalas = Record<ClaveEscala, number>

const ESCALAS_BASE: Escalas = { general: 1, titulos: 1, textos: 1 }

interface ThemeContextValue {
    theme: Theme
    toggleTheme: () => void
    setTheme: (t: Theme) => void
    escalas: Escalas
    setEscala: (clave: ClaveEscala, valor: number) => void
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: 'light',
    toggleTheme: () => { },
    setTheme: () => { },
    escalas: ESCALAS_BASE,
    setEscala: () => { },
})

export function useTheme() {
    return useContext(ThemeContext)
}

function getInitialTheme(): Theme {
    if (typeof window === 'undefined') return 'dark'
    const saved = localStorage.getItem('nutricoach-theme') as Theme | null
    if (saved === 'light' || saved === 'dark') return saved
    return 'dark'
}

const ESCALAS = [0.9, 1, 1.15, 1.3, 1.5]

function getEscalasIniciales(): Escalas {
    const res = { ...ESCALAS_BASE }
    try {
        for (const k of Object.keys(res) as ClaveEscala[]) {
            const n = Number(localStorage.getItem(`nutricoach-escala-${k}`) ?? (k === 'general' ? localStorage.getItem('nutricoach-escala') : null))
            if (ESCALAS.includes(n)) res[k] = n
        }
    } catch { /* sin almacenamiento */ }
    return res
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('dark')
    const [mounted, setMounted] = useState(false)
    const [escalas, setEscalas] = useState<Escalas>(ESCALAS_BASE)

    useEffect(() => {
        setThemeState(getInitialTheme())
        setEscalas(getEscalasIniciales())
        setMounted(true)
    }, [])

    useEffect(() => {
        if (!mounted) return
        const root = document.documentElement
        if (theme === 'light') {
            root.classList.add('light')
        } else {
            root.classList.remove('light')
        }
        localStorage.setItem('nutricoach-theme', theme)
    }, [theme, mounted])

    useEffect(() => {
        if (!mounted) return
        const root = document.documentElement
        for (const k of Object.keys(escalas) as ClaveEscala[]) {
            root.style.setProperty(`--coach-escala${k === 'general' ? '' : `-${k}`}`, String(escalas[k]))
            try { localStorage.setItem(`nutricoach-escala-${k}`, String(escalas[k])) } catch { /* sin almacenamiento */ }
        }
    }, [escalas, mounted])

    const setEscala = useCallback((clave: ClaveEscala, valor: number) => {
        setEscalas(prev => ({ ...prev, [clave]: valor }))
    }, [])

    const toggleTheme = useCallback(() => {
        setThemeState(prev => (prev === 'light' ? 'dark' : 'light'))
    }, [])

    const setTheme = useCallback((t: Theme) => {
        setThemeState(t)
    }, [])

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, escalas, setEscala }}>
            {children}
        </ThemeContext.Provider>
    )
}
