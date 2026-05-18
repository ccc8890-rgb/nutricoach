'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Plus, Hash } from 'lucide-react'

interface TagInputProps {
    tags: string[]
    onChange: (tags: string[]) => void
    placeholder?: string
    maxTags?: number
    suggestions?: string[]
}

/**
 * TagInput — Input de tags con autocompletado local
 * 
 * Props:
 * - tags: string[] actuales
 * - onChange: callback cuando cambian
 * - placeholder: texto placeholder
 * - maxTags: máximo de tags permitidas (default: 10)
 * - suggestions: lista de tags sugeridos para autocompletado
 */
export function TagInput({
    tags,
    onChange,
    placeholder = 'Añadir tag…',
    maxTags = 10,
    suggestions = [],
}: TagInputProps) {
    const [input, setInput] = useState('')
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [selectedIdx, setSelectedIdx] = useState(-1)
    const inputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Filtrar sugerencias: no mostrar las ya seleccionadas, y coincidir con el texto
    const filteredSuggestions = input.trim()
        ? suggestions.filter(
            s => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s)
        )
        : suggestions.filter(s => !tags.includes(s))

    const addTag = useCallback((tag: string) => {
        const trimmed = tag.trim().toLowerCase()
        if (!trimmed || tags.includes(trimmed) || tags.length >= maxTags) return
        onChange([...tags, trimmed])
        setInput('')
        setShowSuggestions(false)
        setSelectedIdx(-1)
    }, [tags, onChange, maxTags])

    const removeTag = useCallback((tag: string) => {
        onChange(tags.filter(t => t !== tag))
    }, [tags, onChange])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            if (selectedIdx >= 0 && selectedIdx < filteredSuggestions.length) {
                addTag(filteredSuggestions[selectedIdx])
            } else if (input.trim()) {
                addTag(input)
            }
        } else if (e.key === 'Backspace' && !input && tags.length > 0) {
            removeTag(tags[tags.length - 1])
        } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedIdx(prev =>
                prev < filteredSuggestions.length - 1 ? prev + 1 : 0
            )
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedIdx(prev =>
                prev > 0 ? prev - 1 : filteredSuggestions.length - 1
            )
        } else if (e.key === 'Escape') {
            setShowSuggestions(false)
            setSelectedIdx(-1)
        }
    }

    // Cerrar sugerencias al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowSuggestions(false)
                setSelectedIdx(-1)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div ref={containerRef} className="relative">
            {/* Tags actuales */}
            <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map(tag => (
                    <span
                        key={tag}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-colors"
                        style={{
                            background: 'var(--accent-bg)',
                            color: 'var(--accent-dark)',
                            border: '1px solid var(--accent-ring)',
                        }}
                    >
                        <Hash size={10} />
                        {tag}
                        <button
                            onClick={() => removeTag(tag)}
                            className="ml-0.5 rounded-full hover:bg-black/10 transition-colors"
                            style={{ color: 'var(--accent-dark)' }}
                        >
                            <X size={12} />
                        </button>
                    </span>
                ))}
                {tags.length >= maxTags && (
                    <span className="text-xs px-2 py-1" style={{ color: 'var(--text-muted)' }}>
                        Máximo {maxTags} tags
                    </span>
                )}
            </div>

            {/* Input */}
            {tags.length < maxTags && (
                <div
                    className="flex items-center rounded-lg overflow-hidden transition-all duration-200"
                    style={{
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                    }}
                    onFocus={() => setShowSuggestions(true)}
                >
                    <Hash size={13} className="ml-2 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <input
                        ref={inputRef}
                        type="text"
                        className="flex-1 px-2 py-1.5 text-sm outline-none bg-transparent"
                        style={{ color: 'var(--text)' }}
                        placeholder={placeholder}
                        value={input}
                        onChange={e => {
                            setInput(e.target.value)
                            setShowSuggestions(true)
                            setSelectedIdx(-1)
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onKeyDown={handleKeyDown}
                    />
                    {input.trim() && (
                        <button
                            onClick={() => addTag(input)}
                            className="px-2 py-1.5 flex items-center gap-1 text-xs font-medium transition-colors"
                            style={{ color: 'var(--accent)' }}
                        >
                            <Plus size={13} /> Añadir
                        </button>
                    )}
                </div>
            )}

            {/* Sugerencias dropdown */}
            {showSuggestions && filteredSuggestions.length > 0 && (
                <div
                    className="absolute z-20 left-0 right-0 mt-1 rounded-lg overflow-hidden shadow-lg max-h-48 overflow-y-auto"
                    style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                    }}
                >
                    {filteredSuggestions.map((s, i) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => {
                                addTag(s)
                                inputRef.current?.focus()
                            }}
                            className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors"
                            style={{
                                background: i === selectedIdx ? 'var(--accent-bg)' : 'transparent',
                                color: i === selectedIdx ? 'var(--accent-dark)' : 'var(--text)',
                            }}
                            onMouseEnter={() => setSelectedIdx(i)}
                        >
                            <Hash size={11} style={{ color: 'var(--text-muted)' }} />
                            {s}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
