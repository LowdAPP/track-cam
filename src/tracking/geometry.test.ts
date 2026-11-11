import { cropRegion, fromCrop, iou, toDockRect } from './geometry'

test('toDockRect conta o Y a partir de baixo', () => {
  const r = toDockRect({ x: 0.1, y: 0.2, w: 0.3, h: 0.5 })
  expect(r.x).toBeCloseTo(0.1)
  expect(r.y).toBeCloseTo(0.3)
  expect(r.w).toBeCloseTo(0.3)
  expect(r.h).toBeCloseTo(0.5)
})

test('iou', () => {
  const a = { x: 0, y: 0, w: 0.2, h: 0.2 }
  expect(iou(a, a)).toBeCloseTo(1)
  expect(iou(a, { x: 0.1, y: 0, w: 0.2, h: 0.2 })).toBeCloseTo(1 / 3)
  expect(iou(a, { x: 0.5, y: 0.5, w: 0.1, h: 0.1 })).toBe(0)
})

test('cropRegion: lado = 3x a altura da caixa, entre 320 px e a altura da imagem', () => {
  const r = cropRegion({ x: 0.45, y: 0.4, w: 0.05, h: 0.2 }, 1920, 1080)
  expect(r.size).toBe(648) // 3 * 0.2 * 1080
  expect(r.left).toBe(1920 * 0.475 - 324) // centrado no centro da caixa
  expect(cropRegion({ x: 0.5, y: 0.5, w: 0.01, h: 0.02 }, 1920, 1080).size).toBe(320)
  expect(cropRegion({ x: 0.5, y: 0.1, w: 0.2, h: 0.8 }, 1920, 1080).size).toBe(1080)
})

test('cropRegion nunca sai da imagem', () => {
  const r = cropRegion({ x: 0.97, y: 0.0, w: 0.03, h: 0.2 }, 1920, 1080)
  expect(r.left + r.size).toBeLessThanOrEqual(1920)
  expect(r.top).toBeGreaterThanOrEqual(0)
})

test('fromCrop é o inverso do recorte', () => {
  const region = { left: 960, top: 0, size: 540 }
  expect(fromCrop({ x: 0, y: 0, w: 1, h: 1 }, region, 1920, 1080)).toEqual({
    x: 0.5,
    y: 0,
    w: 0.28125,
    h: 0.5,
  })
})
