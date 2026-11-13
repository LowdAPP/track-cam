import { steerVelocity, STEER } from './steer'

const at = (x: number, y: number) => ({ x: x - 0.05, y: y - 0.1, w: 0.1, h: 0.2 })

test('alvo no centro: a câmara fica parada', () => {
  expect(steerVelocity(at(0.5, 0.5), 1, 2)).toEqual({ pitch: 0, yaw: 0 })
  expect(steerVelocity(at(0.505, 0.49), 1, 2)).toEqual({ pitch: 0, yaw: 0 })
})

test('alvo à direita e em baixo: roda para a direita e desce', () => {
  const v = steerVelocity(at(0.8, 0.7), 1, 2)
  expect(v.yaw).toBeGreaterThan(0)
  expect(v.pitch).toBeGreaterThan(0)
})

test('alvo à esquerda e em cima: roda para a esquerda e sobe', () => {
  const v = steerVelocity(at(0.2, 0.3), 1, 2)
  expect(v.yaw).toBeLessThan(0)
  expect(v.pitch).toBeLessThan(0)
})

test('quanto mais longe do centro, mais depressa, até ao máximo', () => {
  const near = steerVelocity(at(0.6, 0.5), 1, 2).yaw
  const far = steerVelocity(at(0.9, 0.5), 1, 2).yaw
  expect(far).toBeGreaterThan(near)
  expect(steerVelocity(at(1, 0.5), 1, 50).yaw).toBe(STEER.maxSpeed)
})

test('na borda da imagem a 1x o ângulo é metade do campo de visão', () => {
  // ganho 1: a velocidade é o próprio ângulo
  expect(steerVelocity(at(1, 0.5), 1, 1).yaw).toBeCloseTo(STEER.horizontalFov / 2)
})

test('com zoom o mesmo desvio pede menos velocidade', () => {
  expect(steerVelocity(at(0.8, 0.5), 2, 2).yaw).toBeLessThan(steerVelocity(at(0.8, 0.5), 1, 2).yaw)
})
