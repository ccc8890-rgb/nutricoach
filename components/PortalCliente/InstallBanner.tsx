'use client'

import { useInstallPrompt } from '@/hooks/useInstallPrompt'

export default function InstallBanner() {
    const { canInstall, install, dismiss } = useInstallPrompt()

    if (!canInstall) return null

    return (
        <div
            className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
            style={{
                background: 'white',
                borderTop: '1px solid #E5E7EB',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
            }}
        >
            <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                    <span className="text-white text-lg">🏋️</span>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">Añade NutriCoach</p>
                    <p className="text-xs text-gray-500">Acceso directo desde tu pantalla de inicio</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={dismiss}
                        className="text-xs text-gray-400 px-2 py-1"
                    >
                        No, gracias
                    </button>
                    <button
                        onClick={install}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
                        style={{ background: '#22c55e' }}
                    >
                        Instalar
                    </button>
                </div>
            </div>
        </div>
    )
}
