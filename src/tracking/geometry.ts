/** Caixa de 0 a 1 na imagem direita, com a origem em cima à esquerda. */
export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface Point {
  x: number
  y: number
}

/** Quadrado em píxeis dentro da imagem. */
export interface PixelRegion {
  left: number
  top: number
  size: number
}

const MIN_CROP = 320

export function center(b: Box): Point {
  'worklet'
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 }
}

export function diagonal(b: Box): number {
  'worklet'
  return Math.hypot(b.w, b.h)
}

export function area(b: Box): number {
  'worklet'
  return Math.max(0, b.w) * Math.max(0, b.h)
}

export function iou(a: Box, b: Box): number {
  'worklet'
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  if (w <= 0 || h <= 0) return 0
  const inter = w * h
  const union = area(a) + area(b) - inter
  return union <= 0 ? 0 : inter / union
}

export function contains(b: Box, p: Point): boolean {
  'worklet'
  return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h
}

/** O DockKit conta o Y a partir de baixo. É o único sítio onde isso se converte. */
export function toDockRect(b: Box): Box {
  return { x: b.x, y: 1 - b.y - b.h, w: b.w, h: b.h }
}

/**
 * Quadrado em píxeis à volta de `around`, para o modelo ver o alvo com mais
 * detalhe: lado igual a 3 alturas da caixa, entre 320 px e a altura da imagem.
 */
export function cropRegion(around: Box, frameW: number, frameH: number): PixelRegion {
  'worklet'
  const maxSize = Math.min(frameW, frameH)
  const wanted = Math.round(3 * around.h * frameH)
  const size = Math.max(Math.min(MIN_CROP, maxSize), Math.min(wanted, maxSize))
  const cx = (around.x + around.w / 2) * frameW
  const cy = (around.y + around.h / 2) * frameH
  const left = Math.round(Math.max(0, Math.min(frameW - size, cx - size / 2)))
  const top = Math.round(Math.max(0, Math.min(frameH - size, cy - size / 2)))
  return { left, top, size }
}

/** Caixa relativa ao recorte -> caixa relativa à imagem inteira. */
export function fromCrop(b: Box, region: PixelRegion, frameW: number, frameH: number): Box {
  'worklet'
  return {
    x: (region.left + b.x * region.size) / frameW,
    y: (region.top + b.y * region.size) / frameH,
    w: (b.w * region.size) / frameW,
    h: (b.h * region.size) / frameH,
  }
}
