import { signature, similarity } from '../../src/tracking/appearance'
import fixture from './fixtures/parity.json'

// A bancada em Python (detect.py) tem de calcular a mesma assinatura de cor
// que a app. O fixture é gerado por `python tools/replay/detect.py --fixture`.
test('a assinatura de cor da bancada Python é igual à da app', () => {
  const size = fixture.size
  const rgb = new Uint8Array(size * size * 3)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let color = [0, 200, 0]
      if (x >= 0.45 * size && x < 0.55 * size && y >= 0.3 * size && y < 0.6 * size) {
        color = y >= 0.5 * size ? [30, 40, 220] : [220, 20, 20]
      }
      rgb.set(color, (y * size + x) * 3)
    }
  }
  const look = signature(rgb, size, size, fixture.box)
  expect(look).toHaveLength(fixture.look.length)
  look.forEach((v, i) => expect(Math.abs(v - fixture.look[i]!)).toBeLessThanOrEqual(0.02))
  expect(similarity(look, fixture.look)).toBeGreaterThan(0.98)
  // a imagem tem duas cores no tronco: o teste só vale se o histograma não for trivial
  expect(look.filter((v) => v > 0.1).length).toBeGreaterThanOrEqual(2)
})
