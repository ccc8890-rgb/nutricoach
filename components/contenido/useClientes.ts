'use client'

import { useCallback, useEffect, useState } from 'react'
import { clientePorDefecto, etiquetarClientes, type ClienteApi, type ClienteLista } from '@/lib/contenido/clientes'
import { api } from './api'

const CLAVE = 'contenido:cliente'

// Clientes con dieta activa y el elegido (se recuerda entre pestañas y recargas).
export function useClientes() {
  const [clientes, setClientes] = useState<ClienteLista[]>([])
  const [clienteId, setClienteIdEstado] = useState('')

  useEffect(() => {
    api<{ clientes?: ClienteApi[] } | ClienteApi[]>('/api/clientes').then(r => {
      if (!r.ok) return
      const crudos = Array.isArray(r.data) ? r.data : r.data.clientes ?? []
      const lista = etiquetarClientes(crudos)
      let guardado: string | null = null
      try { guardado = localStorage.getItem(CLAVE) } catch { /* sin almacenamiento */ }
      setClientes(lista)
      setClienteIdEstado(prev => prev || clientePorDefecto(lista, guardado, crudos))
    })
  }, [])

  const setClienteId = useCallback((id: string) => {
    setClienteIdEstado(id)
    try { localStorage.setItem(CLAVE, id) } catch { /* sin almacenamiento */ }
  }, [])

  return { clientes, clienteId, setClienteId }
}
