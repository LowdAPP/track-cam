import { blend, signature, similarity } from './appearance'
import type { Box } from './geometry'

type Rgb = [number, number, number]

function solidImage(w: number, h: number, [r, g, b]: Rgb): Uint8Array {
  const out = new Uint8Array(w * h * 3)
  for (let i = 0; i < w * h; i++) {
    out[i * 3] = r
    out[i * 3 + 1] = g
    out[i * 3 + 2] = b
  }
  return out
}

function paint(img: Uint8Array, size: number, box: Box, [r, g, b]: Rgb): void {
  for (let y = Math.floor(box.y * size); y < Math.ceil((box.y + box.h) * size); y++) {
    for (let x = Math.floor(box.x * size); x < Math.ceil((box.x + box.w) * size); x++) {
      const i = (y * size + x) * 3
      img[i] = r
      img[i + 1] = g
      img[i + 2] = b
    }
  }
}

test('mesma cor -> 1; cores diferentes -> 0', () => {
  const red = solidImage(320, 320, [220, 20, 20])
  const blue = solidImage(320, 320, [20, 20, 220])
  const box = { x: 0.4, y: 0.2, w: 0.2, h: 0.6 }
  expect(similarity(signature(red, 320, 320, box), signature(red, 320, 320, box))).toBeCloseTo(1)
  expect(similarity(signature(red, 320, 320, box), signature(blue, 320, 320, box))).toBe(0)
})

test('só olha para o tronco: o fundo à volta não conta', () => {
  const img = solidImage(320, 320, [0, 200, 0]) // relva
  paint(img, 320, { x: 0.45, y: 0.32, w: 0.1, h: 0.24 }, [220, 20, 20]) // tronco vermelho
  const s = signature(img, 320, 320, { x: 0.4, y: 0.2, w: 0.2, h: 0.6 })
  const allRed = signature(solidImage(320, 320, [220, 20, 20]), 320, 320, { x: 0, y: 0, w: 1, h: 1 })
  expect(similarity(s, allRed)).toBeCloseTo(1)
})

test('assinatura soma 1 e tem 64 posições; caixa fora da imagem não rebenta', () => {
  const s = signature(solidImage(320, 320, [1, 2, 3]), 320, 320, { x: 1.2, y: 1.2, w: 0.1, h: 0.1 })
  expect(s).toHaveLength(64)
  expect(s.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
})

test('blend(ref, obs, 0.25) fica a um quarto do caminho', () => {
  expect(blend([1, 0], [0, 1], 0.25)).toEqual([0.75, 0.25])
})
