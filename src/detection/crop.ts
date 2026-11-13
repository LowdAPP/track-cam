import type { PixelRegion } from '../tracking/geometry'

/** Imagem YUV 4:2:0 em dois planos: Y, e CbCr intercalado a meia resolução. */
export interface YuvPlanes {
  y: Uint8Array
  yRowBytes: number
  uv: Uint8Array
  uvRowBytes: number
  /** false = gama de vídeo (Y de 16 a 235), o habitual na câmara do iPhone */
  fullRange: boolean
}

/**
 * Recorta `region` e reduz para `size` x `size` RGB intercalado, por vizinho
 * mais próximo. Escreve em `out` (size * size * 3) sem alocar memória.
 * Conversão BT.601, de gama completa ou de vídeo.
 */
export function cropToRgb(
  planes: YuvPlanes,
  region: PixelRegion,
  size: number,
  out: Uint8Array,
): void {
  'worklet'
  const { y, yRowBytes, uv, uvRowBytes } = planes
  const lumaScale = planes.fullRange ? 1 : 255 / 219
  const lumaOffset = planes.fullRange ? 0 : 16
  const chromaScale = planes.fullRange ? 1 : 255 / 224
  // Corre em cada frame no telemóvel, sem compilador rápido: tudo o que não depende
  // do píxel é calculado antes, e não há chamadas a funções dentro do ciclo.
  const crR = 1.402 * chromaScale
  const cbG = -0.344136 * chromaScale
  const crG = -0.714136 * chromaScale
  const cbB = 1.772 * chromaScale
  const scale = region.size / size
  const lumaAt = new Int32Array(size)
  const chromaAt = new Int32Array(size)
  for (let i = 0; i < size; i++) {
    const px = region.left + Math.floor((i + 0.5) * scale)
    lumaAt[i] = px
    chromaAt[i] = (px >> 1) * 2
  }
  let o = 0
  for (let j = 0; j < size; j++) {
    const py = region.top + Math.floor((j + 0.5) * scale)
    const yRow = py * yRowBytes
    const uvRow = (py >> 1) * uvRowBytes
    for (let i = 0; i < size; i++) {
      const luma = (y[yRow + lumaAt[i]!]! - lumaOffset) * lumaScale + 0.5
      const uvAt = uvRow + chromaAt[i]!
      const cb = uv[uvAt]! - 128
      const cr = uv[uvAt + 1]! - 128
      const r = luma + crR * cr
      const g = luma + cbG * cb + crG * cr
      const b = luma + cbB * cb
      out[o] = r < 0 ? 0 : r > 255 ? 255 : r
      out[o + 1] = g < 0 ? 0 : g > 255 ? 255 : g
      out[o + 2] = b < 0 ? 0 : b > 255 ? 255 : b
      o += 3
    }
  }
}
