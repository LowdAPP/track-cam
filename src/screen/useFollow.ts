import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createSynchronizable } from 'react-native-worklets'

import type { FrameResult } from '../detection/useDetection'
import type { Dock } from '../dock/useDock'
import type { Box, Point } from '../tracking/geometry'
import { PLAY_START, playStep, type PlayState } from '../tracking/play'
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

/** O que a câmara segue: um jogador escolhido, ou o conjunto dos jogadores. */
export type FollowMode = 'player' | 'play'

export interface FollowView {
  mode: FollowMode
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
  const mode = useRef<FollowMode>('player')
  const play = useRef<PlayState>(PLAY_START)
  const people = useRef<PersonDetection[]>([])
  const frame = useRef<FrameResult | null>(null)
  const chosenZoom = useRef(1)
  const zoom = useRef(1)
  const lastFrameAt = useRef(0)
  const lastCommand = useRef<Command['kind']>('none')
  const fps = useRef(0)
  const [view, setView] = useState<FollowView>({
    mode: 'player',
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
        mode: 'player',
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

  /** Modo jogada: a mira é o meio dos jogadores. Não há alvo nem segundo passe de detalhe. */
  const applyPlay = useCallback(
    (next: PlayState) => {
      const decision = decide(next, chosenZoom.current, zoom.current)
      zoom.current = decision.zoom
      play.current = next
      focus.setBlocking(null)

      const command = decision.command
      if (command.kind === 'aim' && frame.current != null) {
        const f = frame.current
        dockRef.current.aim(command.box, f.intrinsics, f.frameW, f.frameH)
      } else if (command.kind !== 'aim' && lastCommand.current === 'aim') {
        dockRef.current.hold()
      }
      lastCommand.current = command.kind

      setView({
        mode: 'play',
        status: next.status,
        people: people.current,
        target: next.box,
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
      if (mode.current === 'play') applyPlay(playStep(play.current, result.people, dtMs))
      else apply(step(state.current, result.people, dtMs))
    },
    [apply, applyPlay],
  )

  /** `at` em coordenadas do frame (0 a 1). */
  const tap = useCallback(
    (at: Point) => {
      if (mode.current === 'play') return
      const next = pick(state.current, people.current, at)
      if (next !== state.current) apply(next)
    },
    [apply],
  )

  const drop = useCallback(() => apply(dropTarget()), [apply])

  const setZoom = useCallback(
    (value: number) => {
      chosenZoom.current = value
      if (mode.current === 'play') applyPlay(play.current)
      else apply(state.current)
    },
    [apply, applyPlay],
  )

  /** Trocar de modo recomeça do zero: larga o jogador, ou esquece a jogada. */
  const setMode = useCallback(
    (value: FollowMode) => {
      if (mode.current === value) return
      mode.current = value
      play.current = PLAY_START
      if (value === 'play') {
        state.current = IDLE
        applyPlay(PLAY_START)
      } else {
        apply(dropTarget())
      }
    },
    [apply, applyPlay],
  )

  return useMemo(
    () => ({ view, focus, onFrame, tap, drop, setZoom, setMode }),
    [view, focus, onFrame, tap, drop, setZoom, setMode],
  )
}
