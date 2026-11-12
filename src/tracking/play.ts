import { center, type Box } from './geometry'
import type { PersonDetection, TrackStatus } from './tracker'

/** Constantes do modo "seguir a jogada". Tempos em ms. */
export const PLAY = {
  // quanto tempo a mira demora a chegar a um sítio novo (cerca de dois terços do caminho)
  followMs: 600,
  // tempo máximo a manter a mira sem ver ninguém
  coastMs: 1500,
} as const

export interface PlayState {
  status: TrackStatus
  /** onde a câmara deve apontar: o meio dos jogadores à vista, do tamanho de um jogador */
  box: Box | null
  /** há quanto tempo não vê ninguém */
  unseenMs: number
}

export const PLAY_START: PlayState = { status: 'lost', box: null, unseenMs: 0 }

/**
 * Seguir a jogada: a mira é o meio de toda a gente à vista e move-se devagar.
 * Medido nos vídeos de jogo, o meio simples é mais calmo e fica mais perto da
 * ação do que a mediana ou o grupo mais denso.
 */
export function playStep(state: PlayState, people: PersonDetection[], dtMs: number): PlayState {
  if (people.length === 0) {
    const unseenMs = state.unseenMs + dtMs
    if (state.box == null || state.status === 'lost' || unseenMs > PLAY.coastMs) {
      return { status: 'lost', box: state.box, unseenMs }
    }
    return { status: 'coasting', box: state.box, unseenMs }
  }

  let x = 0
  let y = 0
  let w = 0
  let h = 0
  for (const p of people) {
    const c = center(p.box)
    x += c.x
    y += c.y
    w += p.box.w
    h += p.box.h
  }
  const n = people.length
  const seen: Box = { x: (x - w / 2) / n, y: (y - h / 2) / n, w: w / n, h: h / n }

  const from = state.status === 'lost' ? null : state.box
  if (from == null) return { status: 'tracking', box: seen, unseenMs: 0 }
  const k = 1 - Math.exp(-dtMs / PLAY.followMs)
  const toward = (a: number, b: number) => a + (b - a) * k
  return {
    status: 'tracking',
    box: {
      x: toward(from.x, seen.x),
      y: toward(from.y, seen.y),
      w: toward(from.w, seen.w),
      h: toward(from.h, seen.h),
    },
    unseenMs: 0,
  }
}
