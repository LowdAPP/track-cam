import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createSynchronizable } from 'react-native-worklets'

import type { FrameResult } from '../detection/useDetection'
import { dockStats, type Dock } from '../dock/useDock'
import { describeBox, sampleLine } from '../report/format'
import { report } from '../report/report'
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

// Quão depressa o Osmo fecha o desvio (por segundo). A jogada é mais calma: a mira
// dela já vem suavizada, e somar pressa a esse atraso fazia a câmara oscilar.
const PLAYER_GAIN = 2
const PLAY_GAIN = 1.2

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
  const lastStatus = useRef<string>('player/idle')
  const lastSampleAt = useRef(0)
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

  /** Relatório: cada mudança de estado, e uma linha de estado de vez em quando. */
  const record = useCallback((m: FollowMode, status: TrackStatus, target: Box | null) => {
    const f = frame.current
    const d = dockRef.current
    const line = () =>
      sampleLine({
        mode: m,
        status,
        zoom: zoom.current,
        fps: fps.current,
        processMs: f?.processMs ?? 0,
        twoPasses: f?.usedCrop ?? false,
        people: people.current.length,
        target,
        docked: d.connected,
        aims: dockStats.aims,
        refused: dockStats.refused,
        yaw: dockStats.yaw,
        pitch: dockStats.pitch,
        control: dockStats.control,
        pan: dockStats.pan,
        tilt: dockStats.tilt,
      })
    const now = Date.now()
    const key = `${m}/${status}`
    if (key !== lastStatus.current) {
      report(`MUDOU ${lastStatus.current} -> ${key} | ${line()}`)
      if (status === 'lost') {
        // quem estava à vista quando o perdeu: é o que permite perceber porquê
        const seen = people.current.map((p) => describeBox(p.box)).join(' ; ')
        report(`  à vista ao perder: ${seen || 'ninguém'}`)
      }
      lastStatus.current = key
      lastSampleAt.current = now
      return
    }
    // a seguir alguém: 1 linha por segundo; parado: 1 de 10 em 10 segundos
    const every = status === 'idle' ? 10000 : 1000
    if (now - lastSampleAt.current >= every) {
      lastSampleAt.current = now
      report(line())
    }
  }, [])

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
      if (command.kind === 'aim' && settled.box != null) {
        dockRef.current.aim(settled.box, zoom.current, PLAYER_GAIN)
      } else if (command.kind === 'hold' && lastCommand.current === 'aim') {
        dockRef.current.hold()
      } else if (command.kind === 'none' && lastCommand.current === 'aim') {
        dockRef.current.hold()
      }
      lastCommand.current = command.kind
      record('player', settled.status, settled.box)

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
    [focus, record],
  )

  /** Modo jogada: a mira é o meio dos jogadores. Não há alvo nem segundo passe de detalhe. */
  const applyPlay = useCallback(
    (next: PlayState) => {
      const decision = decide(next, chosenZoom.current, zoom.current)
      zoom.current = decision.zoom
      play.current = next
      focus.setBlocking(null)

      const command = decision.command
      if (command.kind === 'aim') {
        dockRef.current.aim(command.box, zoom.current, PLAY_GAIN)
      } else if (lastCommand.current === 'aim') {
        dockRef.current.hold()
      }
      lastCommand.current = command.kind
      record('play', next.status, next.box)

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
    [focus, record],
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
      const hit = next !== state.current
      report(
        `TOQUE em ${at.x.toFixed(2)},${at.y.toFixed(2)}: ${hit ? `apanhou ${describeBox(next.box)}` : 'ninguém aí'} (${people.current.length} pessoas à vista)`,
        true,
      )
      if (hit) apply(next)
    },
    [apply],
  )

  const drop = useCallback(() => {
    report('LARGAR ALVO')
    apply(dropTarget())
  }, [apply])

  const setZoom = useCallback(
    (value: number) => {
      report(`ZOOM escolhido ${value}x`)
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
      report(`MODO ${value}`)
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
