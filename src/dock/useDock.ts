import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import DockModule, { type DockResult } from '../../modules/trackcam-dock'
import { toDockRect, type Box } from '../tracking/geometry'

export interface Dock {
  connected: boolean
  name: string | null
  lastError: string | null
  /** Aponta o Osmo para a caixa. Descarta o pedido se o anterior ainda não respondeu. */
  aim(box: Box, intrinsics: number[] | null, refW: number, refH: number): void
  /** Para os motores. */
  hold(): void
}

export function useDock(): Dock {
  const [connected, setConnected] = useState(false)
  const [name, setName] = useState<string | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const connectedRef = useRef(false)
  const busy = useRef(false)

  const note = useCallback((result: DockResult) => {
    setLastError((prev) => {
      const next = result.ok ? null : (result.error ?? 'erro desconhecido')
      return prev === next ? prev : next
    })
  }, [])

  useEffect(() => {
    const sub = DockModule.addListener('onDockState', (state) => {
      connectedRef.current = state.docked
      setConnected(state.docked)
      setName(state.docked ? (state.name ?? null) : null)
      if (state.error) setLastError(state.error)
      // Sempre que o Osmo liga (ou volta a ligar), a app assume o comando.
      if (state.docked) DockModule.takeControl().then(note)
    })
    DockModule.start().then(note)
    return () => sub.remove()
  }, [note])

  const aim = useCallback(
    (box: Box, intrinsics: number[] | null, refW: number, refH: number) => {
      if (!connectedRef.current || busy.current) return
      busy.current = true
      const r = toDockRect(box)
      DockModule.aim(r.x, r.y, r.w, r.h, intrinsics, refW, refH)
        .then(note)
        .finally(() => {
          busy.current = false
        })
    },
    [note],
  )

  const hold = useCallback(() => {
    if (!connectedRef.current) return
    DockModule.hold().then(note)
  }, [note])

  return useMemo(
    () => ({ connected, name, lastError, aim, hold }),
    [connected, name, lastError, aim, hold],
  )
}
