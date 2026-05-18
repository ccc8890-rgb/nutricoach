'use client'

import { useEffect, useState, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'pwa-install-dismissed-at'
const DISMISS_DAYS = 30

export function useInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [canInstall, setCanInstall] = useState(false)

    useEffect(() => {
        // Comprobar si el usuario ya descartó el banner recientemente
        const dismissedAt = localStorage.getItem(DISMISS_KEY)
        if (dismissedAt) {
            const days = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24)
            if (days < DISMISS_DAYS) return // No mostrar
        }

        const handler = (e: Event) => {
            e.preventDefault()
            setDeferredPrompt(e as BeforeInstallPromptEvent)
            setCanInstall(true)
        }

        window.addEventListener('beforeinstallprompt', handler)
        return () => window.removeEventListener('beforeinstallprompt', handler)
    }, [])

    const install = useCallback(async () => {
        if (!deferredPrompt) return
        await deferredPrompt.prompt()
        await deferredPrompt.userChoice
        setDeferredPrompt(null)
        setCanInstall(false)
    }, [deferredPrompt])

    const dismiss = useCallback(() => {
        localStorage.setItem(DISMISS_KEY, Date.now().toString())
        setCanInstall(false)
    }, [])

    return { canInstall, install, dismiss }
}
