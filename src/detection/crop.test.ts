import type { PixelRegion } from '../tracking/geometry'
import { cropToRgb, type YuvPlanes } from './crop'

function solidYuv(w: number, h: number, y: number, cb: number, cr: number, rowBytes = w): YuvPlanes {
  const uvRows = Math.ceil(h / 2)
  const planes: YuvPlanes = {
    y: new Uint8Array(rowBytes * h).fill(y),
    yRowBytes: rowBytes,
    uv: new Uint8Array(rowBytes * uvRows),
    uvRowBytes: rowBytes,
  }
  for (let i = 0; i < planes.uv.length; i += 2) {
    planes.uv[i] = cb
    planes.uv[i + 1] = cr
  }
  return planes
}

function fillY(planes: YuvPlanes, region: PixelRegion, value: number): void {
  for (let y = region.top; y < region.top + region.size; y++) {
    for (let x = region.left; x < region.left + region.size; x++) {
      planes.y[y * planes.yRowBytes + x] = value
    }
  }
}

test('imagem cinzenta fica cinzenta', () => {
  const planes = solidYuv(64, 64, 128, 128, 128)
  const out = new Uint8Array(8 * 8 * 3)
  cropToRgb(planes, { left: 0, top: 0, size: 64 }, 8, out)
  expect([...out].every((v) => Math.abs(v - 128) <= 2)).toBe(true)
})

test('recorta a zona pedida', () => {
  const planes = solidYuv(64, 64, 16, 128, 128) // escuro
  fillY(planes, { left: 32, top: 0, size: 32 }, 235) // metade direita clara
  const out = new Uint8Array(4 * 4 * 3)
  cropToRgb(planes, { left: 32, top: 0, size: 32 }, 4, out)
  expect(Math.min(...out)).toBeGreaterThan(200)
})

test('respeita o bytesPerRow maior do que a largura', () => {
  const planes = solidYuv(60, 60, 200, 128, 128, /* rowBytes */ 64)
  const out = new Uint8Array(4 * 4 * 3)
  cropToRgb(planes, { left: 0, top: 0, size: 60 }, 4, out)
  expect(Math.min(...out)).toBeGreaterThan(190)
})

test('converte a cor: vermelho puro em YCbCr dá vermelho em RGB', () => {
  const planes = solidYuv(16, 16, 76, 85, 255) // BT.601 gama completa
  const out = new Uint8Array(3)
  cropToRgb(planes, { left: 0, top: 0, size: 16 }, 1, out)
  expect(out[0]).toBeGreaterThan(240)
  expect(out[1]).toBeLessThan(15)
  expect(out[2]).toBeLessThan(15)
})
