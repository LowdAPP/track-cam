import { center, type Point } from './geometry'
import { IDLE, pick, rescale, step, type PersonDetection, type TrackState } from './tracker'

const oneHot = (i: number) => Array.from({ length: 64 }, (_, k) => (k === i ? 1 : 0))
const RED = oneHot(48)
const BLUE = oneHot(3)

/** Pessoa com caixa 0.05 x 0.2 centrada em (x, y). */
function person(x: number, y: number, look: number[]): PersonDetection {
  return { box: { x: x - 0.025, y: y - 0.1, w: 0.05, h: 0.2 }, score: 0.9, look }
}
const range = (n: number) => Array.from({ length: n }, (_, i) => i)
function run(state: TrackState, frames: PersonDetection[][]): TrackState {
  return frames.reduce((s, f) => step(s, f, 33), state)
}
function lostState(look: number[], at: Point): TrackState {
  return {
    status: 'lost',
    box: person(at.x, at.y, look).box,
    velocity: { x: 0, y: 0 },
    reference: look,
    recent: look,
    unseenMs: 2000,
    candidate: null,
    others: [],
  }
}

test('segue um jogador sozinho que se move', () => {
  let s = pick(IDLE, [person(0.3, 0.5, RED)], { x: 0.3, y: 0.5 })
  s = run(s, range(30).map((i) => [person(0.3 + i * 0.005, 0.5, RED)]))
  expect(s.status).toBe('tracking')
  expect(center(s.box!).x).toBeCloseTo(0.445, 1)
})

test('cruzamento com adversário de outra cor: fica no mesmo', () => {
  let s = pick(IDLE, [person(0.3, 0.5, RED), person(0.6, 0.5, BLUE)], { x: 0.3, y: 0.5 })
  // vermelho vai para a direita, azul para a esquerda; cruzam-se a meio
  s = run(
    s,
    range(40).map((i) => [person(0.3 + i * 0.0075, 0.5, RED), person(0.6 - i * 0.0075, 0.5, BLUE)]),
  )
  expect(s.status).toBe('tracking')
  expect(center(s.box!).x).toBeGreaterThan(0.55)
})

test('cruzamento com colega da mesma cor: arrisca pelo movimento e não declara perdido', () => {
  let s = pick(IDLE, [person(0.3, 0.5, RED), person(0.6, 0.5, RED)], { x: 0.3, y: 0.5 })
  s = run(s, range(10).map((i) => [person(0.3 + i * 0.0075, 0.5, RED), person(0.6, 0.5, RED)]))
  const frames = range(30).map((i) => [
    person(0.375 + i * 0.0075, 0.5, RED),
    person(0.6 - i * 0.0075, 0.5, RED),
  ])
  const states = frames.map((f) => (s = step(s, f, 33)))
  expect(states.every((st) => st.status !== 'lost')).toBe(true)
  expect(center(s.box!).x).toBeGreaterThan(0.55) // manteve o que ia para a direita
})

test('segunda caixa em cima do alvo que fica sozinha: continua a seguir', () => {
  // o detetor dá duas caixas quase iguais para o alvo e depois só a segunda
  let s = pick(IDLE, [person(0.3, 0.5, RED)], { x: 0.3, y: 0.5 })
  s = run(s, range(5).map(() => [person(0.3, 0.5, RED), person(0.31, 0.5, RED)]))
  s = run(s, range(10).map(() => [person(0.31, 0.5, RED)]))
  expect(s.status).toBe('tracking')
})

test('a cor muda aos poucos (luz, pose): continua a seguir', () => {
  const mix = (t: number) => RED.map((v, k) => v * (1 - t) + BLUE[k]! * t)
  let s = pick(IDLE, [person(0.3, 0.5, RED)], { x: 0.3, y: 0.5 })
  s = run(s, range(60).map((i) => [person(0.3, 0.5, mix(i / 60))]))
  expect(s.status).toBe('tracking')
})

test('não salta para alguém a mais de uma caixa de distância num só frame', () => {
  let s = pick(IDLE, [person(0.3, 0.5, RED)], { x: 0.3, y: 0.5 })
  s = step(s, [person(0.5, 0.5, RED)], 33)
  expect(s.status).toBe('coasting')
  expect(center(s.box!).x).toBeCloseTo(0.3, 1)
})

test('tapado por instantes: prevê e retoma', () => {
  let s = pick(IDLE, [person(0.3, 0.5, RED)], { x: 0.3, y: 0.5 })
  s = run(s, range(10).map((i) => [person(0.3 + i * 0.005, 0.5, RED)]))
  s = run(s, range(15).map(() => [])) // 0,5 s sem o ver
  expect(s.status).toBe('coasting')
  s = step(s, [person(0.43, 0.5, RED)], 33)
  expect(s.status).toBe('tracking')
})

test('desaparece: perdido ao fim de 1,2 s, e não adota um adversário', () => {
  let s = pick(IDLE, [person(0.3, 0.5, RED), person(0.34, 0.5, BLUE)], { x: 0.3, y: 0.5 })
  s = run(s, range(40).map(() => [person(0.34, 0.5, BLUE)]))
  expect(s.status).toBe('lost')
})

test('sai pela borda: perdido de imediato, sem saltar para quem está perto da borda', () => {
  let s = pick(IDLE, [person(0.9, 0.5, RED)], { x: 0.9, y: 0.5 })
  s = run(s, range(8).map((i) => [person(0.9 + i * 0.012, 0.5, RED), person(0.85, 0.5, RED)]))
  s = run(s, range(4).map(() => [person(0.85, 0.5, RED)]))
  expect(s.status).toBe('lost')
  // o colega que já estava à vista nunca é readquirido, mesmo andando pelo campo
  s = run(s, range(60).map((i) => [person(0.85 - i * 0.005, 0.5, RED)]))
  expect(s.status).toBe('lost')
})

test('jogador perto da câmara, a tocar nas bordas de cima a baixo: não é dado como a sair', () => {
  const big = (x: number, y: number): PersonDetection => ({
    box: { x: x - 0.1, y: y - 0.45, w: 0.2, h: 0.9 },
    score: 0.9,
    look: RED,
  })
  let s = pick(IDLE, [big(0.5, 0.5)], { x: 0.5, y: 0.5 })
  // a câmara sobe: ele desce na imagem e a caixa passa da borda de baixo...
  s = run(s, range(6).map((i) => [big(0.5, 0.5 + i * 0.02)]))
  // ...e depois a câmara corrige de repente
  s = step(s, [big(0.5, 0.5)], 165)
  expect(s.status).toBe('tracking')
})

test('perdido: quem já estava à vista é ignorado, mas o alvo que reaparece é retomado', () => {
  let s = pick(IDLE, [person(0.5, 0.5, RED), person(0.2, 0.5, RED)], { x: 0.5, y: 0.5 })
  s = run(s, range(70).map(() => [person(0.2, 0.5, RED)])) // o alvo desaparece 2,3 s
  expect(s.status).toBe('lost')
  s = run(s, range(3).map(() => [person(0.2, 0.5, RED), person(0.52, 0.5, RED)]))
  expect(s.status).toBe('tracking')
  expect(center(s.box!).x).toBeCloseTo(0.52)
})

test('perdido: readquire só com semelhança clara durante 3 frames', () => {
  let s = lostState(RED, { x: 0.5, y: 0.5 })
  s = run(s, range(2).map(() => [person(0.2, 0.5, RED), person(0.7, 0.5, BLUE)]))
  expect(s.status).toBe('lost')
  s = step(s, [person(0.2, 0.5, RED), person(0.7, 0.5, BLUE)], 33)
  expect(s.status).toBe('tracking')
  expect(center(s.box!).x).toBeCloseTo(0.2)
})

test('perdido com dois da mesma cor à vista: não escolhe sozinho', () => {
  let s = lostState(RED, { x: 0.5, y: 0.5 })
  s = run(s, range(30).map(() => [person(0.2, 0.5, RED), person(0.7, 0.5, RED)]))
  expect(s.status).toBe('lost')
})

test('pick resolve por coordenadas, não pelo índice', () => {
  const a = person(0.2, 0.5, RED)
  const b = person(0.7, 0.5, BLUE)
  expect(center(pick(IDLE, [b, a], { x: 0.2, y: 0.5 }).box!).x).toBeCloseTo(0.2)
  expect(pick(IDLE, [a, b], { x: 0.45, y: 0.5 })).toBe(IDLE) // tocou no vazio
})

test('nunca produz NaN', () => {
  let s = pick(IDLE, [person(0.3, 0.5, RED)], { x: 0.3, y: 0.5 })
  s = run(s, [[], [], [person(0.3, 0.5, RED)]])
  s = step(s, [], 0)
  expect(Number.isFinite(s.box!.x) && Number.isFinite(s.velocity.x)).toBe(true)
})

test('rescale: ao mudar o zoom, as posições afastam-se ou aproximam-se do centro', () => {
  let s = pick(IDLE, [person(0.6, 0.5, RED), person(0.3, 0.5, BLUE)], { x: 0.6, y: 0.5 })
  s = rescale(s, 2) // de 1x para 2x
  expect(center(s.box!).x).toBeCloseTo(0.7)
  expect(s.box!.w).toBeCloseTo(0.1)
  expect(s.box!.h).toBeCloseTo(0.4)
  expect(center(s.others[0]!.box).x).toBeCloseTo(0.1)
  expect(rescale(IDLE, 2)).toBe(IDLE)
  expect(rescale(s, 1)).toBe(s)
})
