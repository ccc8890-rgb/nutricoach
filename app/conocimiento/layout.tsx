import Sidebar from '@/components/Sidebar'

export default function ConocimientoLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
            <Sidebar />
            <main className="flex-1 overflow-auto pb-nav-safe">
                {children}
            </main>
        </div>
    )
}
