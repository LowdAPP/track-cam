import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import DockModule, { type DockResult } from '../../modules/trackcam-dock'
import { report } from '../report/report'
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

/**
 * Contas para o relatório. Há um só Osmo, por isso é um objeto único que vai
 * sendo atualizado, fora do estado do React (não muda o que se vê no ecrã).
 */
export const dockStats: {
  /** pedidos de apontar enviados */
  aims: number
  /** pedidos que o Osmo recusou */
  refused: number
  /** posição dos motores em graus; null enquanto o Osmo não a disser */
  yaw: number | null
  pitch: number | null
} = { aims: 0, refused: 0, yaw: null, pitch: null }

export function useDock(): Dock {
  const [connected, setConnected] = useState(false)
  const [name, setName] = useState<string | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const connectedRef = useRef(false)
  const busy = useRef(false)
  const lastAimAt = useRef(0)
  const burst = useRef(0)

  const note = useCallback((result: DockResult) => {
    setLastError((prev) => {
      const next = result.ok ? null : (result.error ?? 'erro desconhecido')
      if (prev !== next) report(next == null ? 'Osmo: voltou a aceitar' : `Osmo recusou: ${next}`)
      return prev === next ? prev : next
    })
  }, [])

  // Um comando para o Osmo nunca pode fechar a app: se a chamada falhar (ao ser feita
  // ou mais tarde), o erro vai para o ecrã e o jogo continua a gravar.
  const send = useCallback(
    (command: () => Promise<DockResult>, done?: () => void) => {
      const failed = (e: unknown) => {
        report(`Osmo: erro na chamada: ${String(e)}`, true)
        setLastError(String(e))
      }
      try {
        command()
          .then(note, failed)
          .finally(() => done?.())
      } catch (e) {
        failed(e)
        done?.()
      }
    },
    [note],
  )

  useEffect(() => {
    const sub = DockModule.addListener('onDockState', (state) => {
      connectedRef.current = state.docked
      report(`Osmo: ${JSON.stringify(state)}`, true)
      setConnected(state.docked)
      setName(state.docked ? (state.name ?? null) : null)
      if (state.error) setLastError(state.error)
      // Sempre que o Osmo liga (ou volta a ligar), a app assume o comando.
      if (state.docked) send(() => DockModule.takeControl())
    })
    const motion = DockModule.addListener('onDockMotion', (m) => {
      if (m.yaw != null) dockStats.yaw = m.yaw
      if (m.pitch != null) dockStats.pitch = m.pitch
    })
    send(() => DockModule.start())
    return () => {
      sub.remove()
      motion.remove()
    }
  }, [send])

  const aim = useCallback(
    (box: Box, intrinsics: number[] | null, refW: number, refH: number) => {
      if (!connectedRef.current || busy.current) return
      busy.current = true
      const r = toDockRect(box)
      // Sem a matriz da câmara, como no teste que funcionou com o Osmo Mobile 8: com ela
      // a app fechava ao começar a seguir (suspeita por confirmar; ver README).
      void intrinsics
      void refW
      void refH
      // Os primeiros pedidos de cada vez que começa a apontar ficam logo escritos no
      // relatório: se a app fechar aqui, fica a saber-se em que pedido foi.
      const now = Date.now()
      burst.current = now - lastAimAt.current > 1000 ? 1 : burst.current + 1
      lastAimAt.current = now
      const n = burst.current
      const loud = n <= 3
      dockStats.aims++
      if (loud) {
        const f = (v: number) => v.toFixed(3)
        report(`Osmo: pedido ${n} enviado (x ${f(r.x)} y ${f(r.y)} l ${f(r.w)} a ${f(r.h)})`, true)
      }
      send(
        () =>
          DockModule.aim(r.x, r.y, r.w, r.h, null, 0, 0).then((result) => {
            if (!result.ok) dockStats.refused++
            if (loud) report(`Osmo: pedido ${n} ${result.ok ? 'aceite' : `recusado: ${result.error}`}`, true)
            return result
          }),
        () => {
          busy.current = false
        },
      )
    },
    [send],
  )

  const hold = useCallback(() => {
    if (!connectedRef.current) return
    send(() => DockModule.hold())
  }, [send])

  return useMemo(
    () => ({ connected, name, lastError, aim, hold }),
    [connected, name, lastError, aim, hold],
  )
}
