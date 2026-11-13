import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import DockModule, { type DockResult } from '../../modules/trackcam-dock'
import { report } from '../report/report'
import { toDockRect, type Box } from '../tracking/geometry'
import { steerVelocity } from './steer'

export interface Dock {
  connected: boolean
  name: string | null
  lastError: string | null
  /** Aponta o Osmo para a caixa. Descarta o pedido se o anterior ainda não respondeu. */
  aim(box: Box, zoom: number, gain: number): void
  /** Para os motores. */
  hold(): void
  control: DockControl
  setControl(control: DockControl): void
}

/**
 * Quem centra o alvo. 'direct': a app manda a velocidade dos motores e a mira é o
 * centro da caixa. 'dockkit': a app entrega a caixa ao iOS e é ele que enquadra
 * (no teste em casa subia para a cabeça e oscilava).
 */
export type DockControl = 'direct' | 'dockkit'

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
  control: DockControl
  /** última velocidade pedida aos motores, em graus por segundo (só no comando direto) */
  pan: number
  tilt: number
} = { aims: 0, refused: 0, yaw: null, pitch: null, control: 'direct', pan: 0, tilt: 0 }

export function useDock(): Dock {
  const [connected, setConnected] = useState(false)
  const [name, setName] = useState<string | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const connectedRef = useRef(false)
  const busy = useRef(false)
  const lastAimAt = useRef(0)
  const burst = useRef(0)
  const [control, setControlState] = useState<DockControl>('direct')
  const controlRef = useRef<DockControl>('direct')

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
      if (state.docked) {
        send(() =>
          DockModule.takeControl().then((result) => {
            report(`Osmo: comando assumido: ${JSON.stringify(result)}`, true)
            return result
          }),
        )
      }
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
    (box: Box, zoom: number, gain: number) => {
      if (!connectedRef.current || busy.current) return
      busy.current = true
      // Os primeiros pedidos de cada vez que começa a apontar ficam logo escritos no
      // relatório: se a app fechar aqui, fica a saber-se em que pedido foi.
      const now = Date.now()
      burst.current = now - lastAimAt.current > 1000 ? 1 : burst.current + 1
      lastAimAt.current = now
      const n = burst.current
      const loud = n <= 3
      dockStats.aims++

      let command: () => Promise<DockResult>
      let what: string
      if (controlRef.current === 'direct') {
        const v = steerVelocity(box, zoom, gain)
        dockStats.pan = (v.yaw * 180) / Math.PI
        dockStats.tilt = (v.pitch * 180) / Math.PI
        what = `motores pan ${dockStats.pan.toFixed(1)}°/s tilt ${dockStats.tilt.toFixed(1)}°/s`
        command = () => DockModule.steer(v.pitch, v.yaw)
      } else {
        // Sem a matriz da câmara, como no teste que funcionou com o Osmo Mobile 8.
        const r = toDockRect(box)
        const f = (v: number) => v.toFixed(3)
        what = `caixa x ${f(r.x)} y ${f(r.y)} l ${f(r.w)} a ${f(r.h)}`
        command = () => DockModule.aim(r.x, r.y, r.w, r.h, null, 0, 0)
      }
      if (loud) report(`Osmo: pedido ${n} enviado (${what})`, true)
      send(
        () =>
          command().then((result) => {
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
    dockStats.pan = 0
    dockStats.tilt = 0
    send(() => DockModule.hold())
  }, [send])

  const setControl = useCallback(
    (value: DockControl) => {
      report(`Osmo: comando ${value}`, true)
      controlRef.current = value
      dockStats.control = value
      setControlState(value)
      if (connectedRef.current) send(() => DockModule.hold())
    },
    [send],
  )

  return useMemo(
    () => ({ connected, name, lastError, aim, hold, control, setControl }),
    [connected, name, lastError, aim, hold, control, setControl],
  )
}
