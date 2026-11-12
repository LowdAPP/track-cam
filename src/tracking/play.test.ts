import { center } from './geometry'
import { PLAY, PLAY_START, playStep } from './play'
import type { PersonDetection } from './tracker'

const person = (x: number, y: number, w = 0.04, h = 0.14): PersonDetection => ({
  box: { x: x - w / 2, y: y - h / 2, w, h },
  score: 0.8,
  look: [],
})

test('a jogada começa no meio dos jogadores à vista', () => {
  const s = playStep(PLAY_START, [person(0.2, 0.4), person(0.4, 0.6), person(0.6, 0.5)], 33)
  expect(s.status).toBe('tracking')
  expect(center(s.box!).x).toBeCloseTo(0.4)
  expect(center(s.box!).y).toBeCloseTo(0.5)
  expect(s.box!.w).toBeCloseTo(0.04)
  expect(s.box!.h).toBeCloseTo(0.14)
})

test('quando os jogadores mudam de sítio, a mira vai atrás aos poucos', () => {
  let s = playStep(PLAY_START, [person(0.3, 0.5), person(0.4, 0.5)], 33)
  const moved = [person(0.7, 0.5), person(0.8, 0.5)]
  s = playStep(s, moved, 33)
  // um frame depois ainda está perto de onde estava
  expect(center(s.box!).x).toBeGreaterThan(0.35)
  expect(center(s.box!).x).toBeLessThan(0.4)
  for (let i = 0; i < 90; i++) s = playStep(s, moved, 33)
  // três segundos depois já lá chegou
  expect(center(s.box!).x).toBeCloseTo(0.75, 1)
})

test('sem ninguém à vista por instantes, mantém a mira', () => {
  let s = playStep(PLAY_START, [person(0.3, 0.5)], 33)
  s = playStep(s, [], 500)
  expect(s.status).toBe('coasting')
  expect(center(s.box!).x).toBeCloseTo(0.3)
})

test('sem ninguém à vista durante muito tempo, fica perdida', () => {
  let s = playStep(PLAY_START, [person(0.3, 0.5)], 33)
  s = playStep(s, [], PLAY.coastMs + 1)
  expect(s.status).toBe('lost')
  // e recomeça logo que volta a ver alguém, sem arrastar a mira antiga
  s = playStep(s, [person(0.8, 0.5)], 33)
  expect(s.status).toBe('tracking')
  expect(center(s.box!).x).toBeCloseTo(0.8)
})

test('antes de ver alguém não há mira', () => {
  const s = playStep(PLAY_START, [], 33)
  expect(s.status).toBe('lost')
  expect(s.box).toBeNull()
})
