import type { PersonDetection } from '../tracking/tracker'
import { decodePeople, merge } from './model'

interface Raw {
  box: [number, number, number, number] // ymin, xmin, ymax, xmax
  cls: number
  score: number
}

function modelOutputs(items: Raw[]): ArrayBuffer[] {
  const boxes = new Float32Array(25 * 4)
  const classes = new Float32Array(25)
  const scores = new Float32Array(25)
  items.forEach((it, i) => {
    boxes.set(it.box, i * 4)
    classes[i] = it.cls
    scores[i] = it.score
  })
  return [boxes.buffer, classes.buffer, scores.buffer, new Float32Array([items.length]).buffer]
}

const det = (box: PersonDetection['box']): PersonDetection => ({ box, score: 0.9, look: [] })

test('decodePeople filtra por classe e score e converte a caixa', () => {
  const out = modelOutputs([
    { box: [0.1, 0.2, 0.5, 0.4], cls: 0, score: 0.9 }, // pessoa
    { box: [0, 0, 1, 1], cls: 36, score: 0.9 }, // bola: fora
    { box: [0, 0, 1, 1], cls: 0, score: 0.2 }, // fraca: fora
  ])
  const people = decodePeople(out, new Uint8Array(320 * 320 * 3))
  expect(people).toHaveLength(1)
  const { x, y, w, h } = people[0]!.box // as saídas são Float32
  expect([x, y, w, h].map((v) => Math.round(v * 1000) / 1000)).toEqual([0.2, 0.1, 0.2, 0.4])
  expect(people[0]!.look).toHaveLength(64)
})

test('decodePeople ignora caixas degeneradas e não passa da contagem', () => {
  const out = modelOutputs([{ box: [0.5, 0.5, 0.5, 0.5], cls: 0, score: 0.9 }])
  new Float32Array(out[2]!)[5] = 0.99 // lixo para lá da contagem
  expect(decodePeople(out, new Uint8Array(320 * 320 * 3))).toHaveLength(0)
})

test('merge prefere o recorte quando se sobrepõem e mantém os restantes', () => {
  const a = det({ x: 0.1, y: 0.1, w: 0.1, h: 0.3 })
  const a2 = det({ x: 0.11, y: 0.1, w: 0.1, h: 0.3 })
  const b = det({ x: 0.6, y: 0.1, w: 0.1, h: 0.3 })
  expect(merge([a, b], [a2])).toEqual([a2, b])
})
