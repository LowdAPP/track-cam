import { makeMapper } from './mapper'

// ecrã de 800x400 a mostrar o frame inteiro, sem rotação
const plain = makeMapper({ x: 0, y: 0 }, { x: 800, y: 0 }, { x: 0, y: 400 })

test('frame -> ecrã', () => {
  expect(plain.toView({ x: 0.5, y: 0.25 })).toEqual({ x: 400, y: 100 })
  expect(plain.boxToView({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 })).toEqual({
    left: 200,
    top: 200,
    width: 400,
    height: 100,
  })
})

test('ecrã -> frame é o inverso', () => {
  const p = plain.toFrame({ x: 400, y: 100 })
  expect(p.x).toBeCloseTo(0.5)
  expect(p.y).toBeCloseTo(0.25)
})

test('pré-visualização cortada e espelhada: a caixa fica com tamanho positivo', () => {
  // o frame ocupa de x=900 (esquerda do frame) a x=-100, e de y=-50 a y=450
  const m = makeMapper({ x: 900, y: -50 }, { x: -100, y: -50 }, { x: 900, y: 450 })
  const r = m.boxToView({ x: 0.1, y: 0.1, w: 0.2, h: 0.2 })
  expect(r.left).toBeCloseTo(600)
  expect(r.top).toBeCloseTo(0)
  expect(r.width).toBeCloseTo(200)
  expect(r.height).toBeCloseTo(100)
  const back = m.toFrame({ x: 700, y: 50 })
  expect(back.x).toBeCloseTo(0.2)
  expect(back.y).toBeCloseTo(0.2)
})

test('cantos degenerados não rebentam', () => {
  const m = makeMapper({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 })
  const p = m.toFrame({ x: 10, y: 10 })
  expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
})
