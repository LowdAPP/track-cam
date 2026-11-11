import type { PixelRegion } from '../tracking/geometry'

/** Imagem YUV 4:2:0 em dois planos: Y, e CbCr intercalado a meia resolução. */
export interface YuvPlanes {
  y: Uint8Array
  yRowBytes: number
  uv: Uint8Array
  uvRowBytes: number
}

function byte(v: number): number {
  'worklet'
  return v < 0 ? 0 : v > 255 ? 255 : v
}

/**
 * Recorta `region` e reduz para `size` x `size` RGB intercalado, por vizinho
 * mais próximo. Escreve em `out` (size * size * 3) sem alocar memória.
 * Conversão BT.601 de gama completa.
 */
export function cropToRgb(
  planes: YuvPlanes,
  region: PixelRegion,
  size: number,
  out: Uint8Array,
): void {
  'worklet'
  const { y, yRowBytes, uv, uvRowBytes } = planes
  const scale = region.size / size
  let o = 0
  for (let j = 0; j < size; j++) {
    const py = region.top + Math.floor((j + 0.5) * scale)
    const yRow = py * yRowBytes
    const uvRow = (py >> 1) * uvRowBytes
    for (let i = 0; i < size; i++) {
      const px = region.left + Math.floor((i + 0.5) * scale)
      const luma = y[yRow + px]!
      const uvAt = uvRow + (px >> 1) * 2
      const cb = uv[uvAt]! - 128
      const cr = uv[uvAt + 1]! - 128
      out[o++] = byte(luma + 1.402 * cr)
      out[o++] = byte(luma - 0.344136 * cb - 0.714136 * cr)
      out[o++] = byte(luma + 1.772 * cb)
    }
  }
}
