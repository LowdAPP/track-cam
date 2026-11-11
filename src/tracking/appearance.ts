import type { Box } from './geometry'

/** 4 níveis por canal RGB. */
export const SIGNATURE_BINS = 64

const SAMPLES = 12

/**
 * Histograma de cor normalizado (soma 1) do tronco da pessoa: os 50% centrais
 * em largura, dos 20% aos 60% da altura da caixa. É aí que está o equipamento,
 * com pouco fundo e sem pernas nem cabeça.
 */
export function signature(rgb: Uint8Array, imageW: number, imageH: number, box: Box): number[] {
  'worklet'
  const bins: number[] = new Array(SIGNATURE_BINS).fill(0)
  const left = box.x + box.w * 0.25
  const top = box.y + box.h * 0.2
  const width = box.w * 0.5
  const height = box.h * 0.4
  let count = 0
  for (let j = 0; j < SAMPLES; j++) {
    const py = Math.floor((top + ((j + 0.5) / SAMPLES) * height) * imageH)
    if (py < 0 || py >= imageH) continue
    for (let i = 0; i < SAMPLES; i++) {
      const px = Math.floor((left + ((i + 0.5) / SAMPLES) * width) * imageW)
      if (px < 0 || px >= imageW) continue
      const o = (py * imageW + px) * 3
      const bin = ((rgb[o]! >> 6) << 4) | ((rgb[o + 1]! >> 6) << 2) | (rgb[o + 2]! >> 6)
      bins[bin]! += 1
      count++
    }
  }
  if (count === 0) return bins.map(() => 1 / SIGNATURE_BINS)
  return bins.map((v) => v / count)
}

/** Interseção de histogramas, de 0 (nada em comum) a 1 (iguais). */
export function similarity(a: number[], b: number[]): number {
  'worklet'
  let sum = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) sum += Math.min(a[i]!, b[i]!)
  return sum
}

/** Mistura lenta da referência com uma nova observação. */
export function blend(reference: number[], observed: number[], weight: number): number[] {
  return reference.map((v, i) => v * (1 - weight) + (observed[i] ?? 0) * weight)
}
