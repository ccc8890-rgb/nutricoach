'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
    theme: Theme
    toggleTheme: () => void
    setTheme: (t: Theme) => void
    escala: number
    setEscala: (e: number) => void
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: 'light',
    toggleTheme: () => { },
    setTheme: () => { },
    escala: 1,
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

function getEscalaInicial(): number {
    try {
        const n = Number(localStorage.getItem('nutricoach-escala'))
        return ESCALAS.includes(n) ? n : 1
    } catch {
        return 1
    }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('dark')
    const [mounted, setMounted] = useState(false)
    const [escala, setEscalaState] = useState(1)

    useEffect(() => {
        setThemeState(getInitialTheme())
        setEscalaState(getEscalaInicial())
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
        document.documentElement.style.setProperty('--coach-escala', String(escala))
        try { localStorage.setItem('nutricoach-escala', String(escala)) } catch { /* sin almacenamiento */ }
    }, [escala, mounted])

    const setEscala = useCallback((e: number) => setEscalaState(e), [])

    const toggleTheme = useCallback(() => {
        setThemeState(prev => (prev === 'light' ? 'dark' : 'light'))
    }, [])

    const setTheme = useCallback((t: Theme) => {
        setThemeState(t)
    }, [])

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, escala, setEscala }}>
            {children}
        </ThemeContext.Provider>
    )
}
