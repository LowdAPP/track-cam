import type { Box, Point } from '../tracking/geometry'

export interface ViewRect {
  left: number
  top: number
  width: number
  height: number
}

export interface Mapper {
  /** ponto do frame (0 a 1) -> ponto do ecrã */
  toView(p: Point): Point
  /** ponto do ecrã -> ponto do frame (0 a 1) */
  toFrame(p: Point): Point
  boxToView(b: Box): ViewRect
}

/**
 * Conversão entre o frame e o ecrã, a partir da posição no ecrã de três
 * cantos do frame: (0,0), (1,0) e (0,1). Funciona com a pré-visualização
 * cortada, espelhada ou rodada.
 */
export function makeMapper(origin: Point, xEnd: Point, yEnd: Point): Mapper {
  const ax = xEnd.x - origin.x
  const ay = xEnd.y - origin.y
  const bx = yEnd.x - origin.x
  const by = yEnd.y - origin.y
  const det = ax * by - bx * ay

  const toView = (p: Point): Point => ({
    x: origin.x + p.x * ax + p.y * bx,
    y: origin.y + p.x * ay + p.y * by,
  })
  const toFrame = (p: Point): Point => {
    if (det === 0) return { x: 0.5, y: 0.5 }
    const dx = p.x - origin.x
    const dy = p.y - origin.y
    return { x: (dx * by - dy * bx) / det, y: (dy * ax - dx * ay) / det }
  }
  const boxToView = (b: Box): ViewRect => {
    const p = toView({ x: b.x, y: b.y })
    const q = toView({ x: b.x + b.w, y: b.y + b.h })
    return {
      left: Math.min(p.x, q.x),
      top: Math.min(p.y, q.y),
      width: Math.abs(q.x - p.x),
      height: Math.abs(q.y - p.y),
    }
  }
  return { toView, toFrame, boxToView }
}
