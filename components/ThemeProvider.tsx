'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
    theme: Theme
    toggleTheme: () => void
    setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: 'light',
    toggleTheme: () => { },
    setTheme: () => { },
})

export function useTheme() {
    return useContext(ThemeContext)
}

function getInitialTheme(): Theme {
    if (typeof window === 'undefined') return 'light'
    const saved = localStorage.getItem('nutricoach-theme') as Theme | null
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('light')
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setThemeState(getInitialTheme())
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

    const toggleTheme = useCallback(() => {
        setThemeState(prev => (prev === 'light' ? 'dark' : 'light'))
    }, [])

    const setTheme = useCallback((t: Theme) => {
        setThemeState(t)
    }, [])

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}
