import Sidebar from '@/components/Sidebar'
import { ToastProvider } from '@/components/ui/Toast'

export default function PreciosLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
            <Sidebar />
            <main className="flex-1 overflow-auto pb-nav-safe layout-main">
                <div className="p-6 max-w-5xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    )
}
