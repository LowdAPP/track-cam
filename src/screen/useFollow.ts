import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createSynchronizable } from 'react-native-worklets'

import type { FrameResult } from '../detection/useDetection'
import type { Dock } from '../dock/useDock'
import type { Box, Point } from '../tracking/geometry'
import {
  drop as dropTarget,
  IDLE,
  pick,
  rescale,
  step,
  type PersonDetection,
  type TrackState,
  type TrackStatus,
} from '../tracking/tracker'

import { decide, type Command } from './decide'

export const ZOOM_STEPS = [1, 2, 3] as const

export interface FollowView {
  status: TrackStatus
  people: PersonDetection[]
  target: Box | null
  /** o zoom efetivamente aplicado */
  zoom: number
  /** o zoom que o dono escolheu */
  chosenZoom: number
  frame: FrameResult | null
  fps: number
}

/** A única ligação entre deteção, seguidor, Osmo e zoom. */
export function useFollow(dock: Dock) {
  const focus = useMemo(() => createSynchronizable<Box | null>(null), [])
  // O estado do Osmo muda (liga, desliga, erros) sem que isso deva recriar o
  // processamento dos frames: por isso é lido através de uma referência.
  const dockRef = useRef(dock)
  useEffect(() => {
    dockRef.current = dock
  }, [dock])
  const state = useRef<TrackState>(IDLE)
  const people = useRef<PersonDetection[]>([])
  const frame = useRef<FrameResult | null>(null)
  const chosenZoom = useRef(1)
  const zoom = useRef(1)
  const lastFrameAt = useRef(0)
  const lastCommand = useRef<Command['kind']>('none')
  const fps = useRef(0)
  const [view, setView] = useState<FollowView>({
    status: 'idle',
    people: [],
    target: null,
    zoom: 1,
    chosenZoom: 1,
    frame: null,
    fps: 0,
  })

  const apply = useCallback(
    (next: TrackState) => {
      const decision = decide(next, chosenZoom.current, zoom.current)
      // O zoom muda as posições de tudo: o seguidor acompanha essa mudança.
      const settled =
        decision.zoom === zoom.current ? next : rescale(next, decision.zoom / zoom.current)
      zoom.current = decision.zoom
      state.current = settled

      const active = settled.status === 'tracking' || settled.status === 'coasting'
      focus.setBlocking(active ? settled.box : null)

      const command = decision.command
      if (command.kind === 'aim' && settled.box != null && frame.current != null) {
        const f = frame.current
        dockRef.current.aim(settled.box, f.intrinsics, f.frameW, f.frameH)
      } else if (command.kind === 'hold' && lastCommand.current === 'aim') {
        dockRef.current.hold()
      } else if (command.kind === 'none' && lastCommand.current === 'aim') {
        dockRef.current.hold()
      }
      lastCommand.current = command.kind

      setView({
        status: settled.status,
        people: people.current,
        target: settled.box,
        zoom: zoom.current,
        chosenZoom: chosenZoom.current,
        frame: frame.current,
        fps: fps.current,
      })
    },
    [focus],
  )

  const onFrame = useCallback(
    (result: FrameResult) => {
      const now = Date.now()
      const dtMs = lastFrameAt.current > 0 ? now - lastFrameAt.current : 0
      lastFrameAt.current = now
      if (dtMs > 0) fps.current = fps.current * 0.8 + (1000 / dtMs) * 0.2
      people.current = result.people
      frame.current = result
      apply(step(state.current, result.people, dtMs))
    },
    [apply],
  )

  /** `at` em coordenadas do frame (0 a 1). */
  const tap = useCallback(
    (at: Point) => {
      const next = pick(state.current, people.current, at)
      if (next !== state.current) apply(next)
    },
    [apply],
  )

  const drop = useCallback(() => apply(dropTarget()), [apply])

  const setZoom = useCallback(
    (value: number) => {
      chosenZoom.current = value
      apply(state.current)
    },
    [apply],
  )

  return useMemo(
    () => ({ view, focus, onFrame, tap, drop, setZoom }),
    [view, focus, onFrame, tap, drop, setZoom],
  )
}
