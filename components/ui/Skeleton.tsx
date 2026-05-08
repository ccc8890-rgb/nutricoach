'use client'

/**
 * Componentes Skeleton reutilizables para loading states.
 * Simulan la estructura visual del contenido real para una transición suave.
 */

interface SkeletonProps {
    className?: string
    style?: React.CSSProperties
}

/* ── Base ── */
function SkeletonBase({ className = '', style }: SkeletonProps) {
    return (
        <div
            className={`animate-pulse rounded-lg bg-gray-200 ${className}`}
            style={{ animationDuration: '1.5s', ...style }}
        />
    )
}

/* ── Card Skeleton ── */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
    return (
        <div className="card !p-4 space-y-3">
            <SkeletonBase className="h-4 w-3/4" />
            {Array.from({ length: lines }).map((_, i) => (
                <SkeletonBase
                    key={i}
                    className={`h-3 ${i === lines - 1 ? 'w-1/2' : 'w-full'}`}
                />
            ))}
        </div>
    )
}

/* ── Stat Card Skeleton ── */
export function SkeletonStatCard() {
    return (
        <div className="card !p-4 flex items-center gap-3">
            <SkeletonBase className="w-10 h-10 rounded-lg" />
            <div className="space-y-2 flex-1">
                <SkeletonBase className="h-3 w-20" />
                <SkeletonBase className="h-6 w-12" />
            </div>
        </div>
    )
}

/* ── Table Skeleton ── */
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
    return (
        <div className="card !p-4 space-y-3">
            {/* Header */}
            <div className="flex gap-4 pb-2 border-b border-gray-100">
                {Array.from({ length: cols }).map((_, i) => (
                    <SkeletonBase key={i} className="h-3 flex-1" />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, r) => (
                <div key={r} className="flex gap-4 py-1">
                    {Array.from({ length: cols }).map((_, c) => (
                        <SkeletonBase
                            key={c}
                            className={`h-3 ${c === 0 ? 'flex-[2]' : 'flex-1'}`}
                        />
                    ))}
                </div>
            ))}
        </div>
    )
}

/* ── Chart Skeleton ── */
export function SkeletonChart({ height = 200 }: { height?: number }) {
    return (
        <div className="card !p-4">
            <div className="flex items-center justify-between mb-4">
                <SkeletonBase className="h-4 w-36" />
                <SkeletonBase className="h-3 w-16" />
            </div>
            <SkeletonBase className="w-full rounded-lg" style={{ height }} />
            {/* Legend falso */}
            <div className="flex gap-4 mt-3">
                <SkeletonBase className="h-2 w-16" />
                <SkeletonBase className="h-2 w-16" />
                <SkeletonBase className="h-2 w-16" />
            </div>
        </div>
    )
}

/* ── Timeline Skeleton ── */
export function SkeletonTimeline({ items = 3 }: { items?: number }) {
    return (
        <div className="space-y-4 relative">
            <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-gray-100" />
            {Array.from({ length: items }).map((_, i) => (
                <div key={i} className="relative pl-10">
                    <SkeletonBase className="absolute left-[13px] top-[18px] w-[13px] h-[13px] rounded-full" />
                    <div className="card !p-4 space-y-2">
                        <SkeletonBase className="h-4 w-2/3" />
                        <SkeletonBase className="h-3 w-full" />
                        <SkeletonBase className="h-3 w-1/3" />
                    </div>
                </div>
            ))}
        </div>
    )
}

/* ── Profile Header Skeleton ── */
export function SkeletonProfile() {
    return (
        <div className="flex items-center gap-4 mb-6">
            <SkeletonBase className="w-12 h-12 rounded-full" />
            <div className="space-y-2">
                <SkeletonBase className="h-5 w-40" />
                <SkeletonBase className="h-3 w-56" />
            </div>
        </div>
    )
}

/* ── Dashboard grid Skeleton ── */
export function SkeletonDashboard() {
    return (
        <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonStatCard key={i} />
                ))}
            </div>
            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SkeletonChart height={180} />
                <SkeletonChart height={180} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SkeletonChart height={160} />
                <SkeletonCard lines={4} />
            </div>
        </div>
    )
}

/* ── Form Skeleton ── */
export function SkeletonForm({ fields = 4 }: { fields?: number }) {
    return (
        <div className="card !p-6 space-y-4">
            {Array.from({ length: fields }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                    <SkeletonBase className="h-3 w-24" />
                    <SkeletonBase className="h-10 w-full" />
                </div>
            ))}
            <div className="flex gap-3 pt-2">
                <SkeletonBase className="h-10 w-24" />
                <SkeletonBase className="h-10 w-24" />
            </div>
        </div>
    )
}
