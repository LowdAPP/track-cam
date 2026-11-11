import { center, type Box } from '../tracking/geometry'
import type { TrackState } from '../tracking/tracker'

/** Até onde o centro do alvo pode ficar do centro da imagem depois de fechar o zoom. */
const SAFE_AFTER_ZOOM = 0.35

export type Command = { kind: 'aim'; box: Box } | { kind: 'hold' } | { kind: 'none' }

/**
 * Decide o zoom e o comando para o Osmo a partir do estado do seguidor.
 * `chosenZoom` é o que o dono escolheu; `currentZoom` é o que está aplicado.
 */
export function decide(
  state: TrackState,
  chosenZoom: number,
  currentZoom: number,
): { zoom: number; command: Command } {
  if (state.status === 'idle' || state.box == null) {
    return { zoom: chosenZoom, command: { kind: 'none' } }
  }
  if (state.status === 'lost') {
    // parar e abrir o campo de visão, para o dono (ou a app) o reencontrar
    return { zoom: 1, command: { kind: 'hold' } }
  }
  let zoom = currentZoom
  if (state.status === 'tracking' && currentZoom !== chosenZoom) {
    // Só volta ao zoom escolhido quando o alvo continuar dentro da imagem depois disso.
    const factor = chosenZoom / currentZoom
    const c = center(state.box)
    const fits =
      Math.abs(c.x - 0.5) * factor <= SAFE_AFTER_ZOOM &&
      Math.abs(c.y - 0.5) * factor <= SAFE_AFTER_ZOOM
    if (factor < 1 || fits) zoom = chosenZoom
  }
  return { zoom, command: { kind: 'aim', box: state.box } }
}
