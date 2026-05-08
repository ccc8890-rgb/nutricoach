'use client'

import AdminPrecios from '@/components/AdminPrecios'
import ErrorBoundary from '@/components/ui/ErrorBoundary'

export default function PreciosPage() {
    return (
        <ErrorBoundary>
            <AdminPrecios />
        </ErrorBoundary>
    )
}
