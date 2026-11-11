import { blend, similarity } from './appearance'
import { TRACK } from './config'
import { area, center, contains, diagonal, iou, type Box, type Point } from './geometry'

export interface PersonDetection {
  box: Box
  score: number
  /** assinatura de cor do tronco */
  look: number[]
}

export type TrackStatus = 'idle' | 'tracking' | 'coasting' | 'lost'

export interface TrackState {
  status: TrackStatus
  /** melhor estimativa atual do alvo (vista ou prevista) */
  box: Box | null
  /** por segundo */
  velocity: Point
  reference: number[] | null
  /** há quanto tempo não vê o alvo */
  unseenMs: number
  /** candidato a readquirir enquanto perdido */
  candidate: { box: Box; frames: number } | null
  /**
   * As outras pessoas do frame anterior. Uma deteção que continua uma delas
   * não pode ser o alvo: é assim que um colega com o mesmo equipamento não
   * herda o seguimento quando o alvo fica tapado ou sai da imagem.
   */
  others: Box[]
}

export const IDLE: TrackState = {
  status: 'idle',
  box: null,
  velocity: { x: 0, y: 0 },
  reference: null,
  unseenMs: 0,
  candidate: null,
  others: [],
}

export function drop(): TrackState {
  return IDLE
}

/**
 * O dono tocou neste ponto da imagem (0 a 1). Devolve o estado com o novo
 * alvo, ou o mesmo estado se não tocou em ninguém.
 */
export function pick(state: TrackState, detections: PersonDetection[], at: Point): TrackState {
  let chosen: PersonDetection | null = null
  let best = Infinity
  for (const d of detections) {
    if (!contains(d.box, at)) continue
    const c = center(d.box)
    const dist = Math.hypot(c.x - at.x, c.y - at.y)
    if (dist < best) {
      best = dist
      chosen = d
    }
  }
  if (chosen == null) return state
  return {
    status: 'tracking',
    box: chosen.box,
    velocity: { x: 0, y: 0 },
    reference: chosen.look,
    unseenMs: 0,
    candidate: null,
    others: boxesExcept(detections, chosen),
  }
}

/** Avança um frame. `dtMs` é o tempo desde o frame anterior. */
export function step(state: TrackState, detections: PersonDetection[], dtMs: number): TrackState {
  if (state.status === 'idle' || state.box == null || state.reference == null) return state
  const dt = Math.max(0, dtMs)
  if (state.status === 'lost') return search(state, state.reference, detections, dt)
  return follow(state, state.box, state.reference, detections, dt)
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function moved(box: Box, to: Point): Box {
  return { x: to.x - box.w / 2, y: to.y - box.h / 2, w: box.w, h: box.h }
}

function boxesExcept(detections: PersonDetection[], except: PersonDetection | null): Box[] {
  return detections.filter((d) => d !== except).map((d) => d.box)
}

/** A caixa prevista está encostada a uma borda e a mover-se para fora dela? */
function leaving(predicted: Box, v: Point): boolean {
  const m = TRACK.edgeMargin
  return (
    (predicted.x < m && v.x < 0) ||
    (predicted.x + predicted.w > 1 - m && v.x > 0) ||
    (predicted.y < m && v.y < 0) ||
    (predicted.y + predicted.h > 1 - m && v.y > 0)
  )
}

/**
 * Deteções que continuam uma das outras pessoas do frame anterior: para cada
 * uma dessas pessoas, a deteção que mais se sobrepõe a ela. Se essa deteção
 * se sobrepuser ainda mais a `target`, fica livre para ser o alvo.
 */
function claimed(
  others: Box[],
  detections: PersonDetection[],
  target: Box | null,
): Set<PersonDetection> {
  const out = new Set<PersonDetection>()
  for (const o of others) {
    let best: PersonDetection | null = null
    let bestIou: number = TRACK.claimIou
    for (const d of detections) {
      const v = iou(o, d.box)
      if (v >= bestIou) {
        bestIou = v
        best = d
      }
    }
    if (best == null) continue
    if (target != null && iou(target, best.box) > bestIou) continue
    out.add(best)
  }
  return out
}

function follow(
  state: TrackState,
  box: Box,
  reference: number[],
  detections: PersonDetection[],
  dtMs: number,
): TrackState {
  const dt = dtMs / 1000
  const c = center(box)
  const predicted = { x: c.x + state.velocity.x * dt, y: c.y + state.velocity.y * dt }
  const predictedBox = moved(box, predicted)
  const atEdge = leaving(predictedBox, state.velocity)
  const radius = atEdge
    ? TRACK.edgeGate
    : clamp(
        diagonal(box) * TRACK.gateDiagonals * (1 + (TRACK.gateGrowthPerSec * state.unseenMs) / 1000),
        TRACK.gateMin,
        TRACK.gateMax,
      )
  const taken = claimed(state.others, detections, predictedBox)

  let winner: PersonDetection | null = null
  let bestScore = -Infinity
  let candidates = 0
  const boxArea = area(box)
  for (const d of detections) {
    if (taken.has(d)) continue
    const dc = center(d.box)
    const dist = Math.hypot(dc.x - predicted.x, dc.y - predicted.y)
    if (dist >= radius) continue
    const ratio = boxArea > 0 ? area(d.box) / boxArea : 1
    if (ratio < TRACK.areaRatioMin || ratio > TRACK.areaRatioMax) continue
    const look = similarity(d.look, reference)
    if (look < TRACK.clearlyDifferent) continue
    candidates++
    const score =
      TRACK.weightMotion * (1 - dist / radius) +
      TRACK.weightLook * look +
      TRACK.weightSize * Math.min(ratio, 1 / ratio)
    if (score > bestScore) {
      bestScore = score
      winner = d
    }
  }

  if (winner == null) {
    const unseenMs = state.unseenMs + dtMs
    const lost = atEdge || unseenMs > TRACK.coastMs
    return {
      status: lost ? 'lost' : 'coasting',
      box: lost ? box : predictedBox,
      velocity: lost
        ? { x: 0, y: 0 }
        : { x: state.velocity.x * TRACK.velocityDamping, y: state.velocity.y * TRACK.velocityDamping },
      reference,
      unseenMs,
      candidate: null,
      others: boxesExcept(detections, null),
    }
  }

  const seen = center(winner.box)
  const rx = seen.x - predicted.x
  const ry = seen.y - predicted.y
  const next = { x: predicted.x + TRACK.alpha * rx, y: predicted.y + TRACK.alpha * ry }
  const gain = dt > 0 ? TRACK.beta / dt : 0
  const w = box.w + TRACK.sizeSmoothing * (winner.box.w - box.w)
  const h = box.h + TRACK.sizeSmoothing * (winner.box.h - box.h)
  return {
    status: 'tracking',
    box: { x: next.x - w / 2, y: next.y - h / 2, w, h },
    velocity: { x: state.velocity.x + gain * rx, y: state.velocity.y + gain * ry },
    reference: candidates === 1 ? blend(reference, winner.look, TRACK.referenceBlend) : reference,
    unseenMs: 0,
    candidate: null,
    others: boxesExcept(detections, winner),
  }
}

/**
 * Perdido: só retoma sozinho quando aparece alguém novo, claramente parecido
 * com o alvo, durante alguns frames seguidos.
 */
function search(
  state: TrackState,
  reference: number[],
  detections: PersonDetection[],
  dtMs: number,
): TrackState {
  const unseenMs = state.unseenMs + dtMs
  const still = { ...state, velocity: { x: 0, y: 0 }, unseenMs }
  if (unseenMs < TRACK.coastMs + TRACK.reacquireSettleMs) {
    return { ...still, candidate: null, others: boxesExcept(detections, null) }
  }

  const taken = claimed(state.others, detections, state.candidate?.box ?? null)
  let best: PersonDetection | null = null
  let bestLook = -Infinity
  let second = 0
  for (const d of detections) {
    if (taken.has(d)) continue
    const look = similarity(d.look, reference)
    if (look > bestLook) {
      second = Math.max(second, bestLook)
      bestLook = look
      best = d
    } else if (look > second) {
      second = look
    }
  }
  const clear =
    best != null &&
    bestLook >= TRACK.reacquireSimilarity &&
    bestLook - second >= TRACK.reacquireMargin
  if (!clear || best == null) {
    return { ...still, candidate: null, others: boxesExcept(detections, null) }
  }

  const same =
    state.candidate != null && iou(state.candidate.box, best.box) >= TRACK.claimIou
  const frames = same ? state.candidate!.frames + 1 : 1
  if (frames >= TRACK.reacquireFrames) {
    return {
      status: 'tracking',
      box: best.box,
      velocity: { x: 0, y: 0 },
      reference,
      unseenMs: 0,
      candidate: null,
      others: boxesExcept(detections, best),
    }
  }
  return { ...still, candidate: { box: best.box, frames }, others: boxesExcept(detections, best) }
}

/**
 * O zoom mudou por um fator (novo / antigo): tudo o que o seguidor guarda
 * afasta-se ou aproxima-se do centro da imagem na mesma proporção.
 */
export function rescale(state: TrackState, factor: number): TrackState {
  if (state.status === 'idle' || factor === 1 || !(factor > 0)) return state
  const scale = (b: Box): Box => ({
    x: 0.5 + (b.x - 0.5) * factor,
    y: 0.5 + (b.y - 0.5) * factor,
    w: b.w * factor,
    h: b.h * factor,
  })
  return {
    ...state,
    box: state.box == null ? null : scale(state.box),
    velocity: { x: state.velocity.x * factor, y: state.velocity.y * factor },
    candidate:
      state.candidate == null ? null : { ...state.candidate, box: scale(state.candidate.box) },
    others: state.others.map(scale),
  }
}
