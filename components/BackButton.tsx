'use client'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

interface BackButtonProps {
    href?: string
    label?: string
}

export default function BackButton({ href, label = 'Volver' }: BackButtonProps) {
    const router = useRouter()

    const handleClick = () => {
        if (href) {
            router.push(href)
        } else {
            router.back()
        }
    }

    return (
        <button
            onClick={handleClick}
            className="fixed top-4 left-4 z-30 lg:hidden w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95"
            style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
            }}
            aria-label={label}
        >
            <ChevronLeft size={20} style={{ color: 'var(--text)' }} />
        </button>
    )
}
