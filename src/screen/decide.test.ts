import type { Box } from '../tracking/geometry'
import { IDLE, type TrackState } from '../tracking/tracker'
import { decide } from './decide'

const CENTERED: Box = { x: 0.45, y: 0.4, w: 0.1, h: 0.2 }
const OFF_CENTER: Box = { x: 0.1, y: 0.4, w: 0.1, h: 0.2 }
const state = (status: TrackState['status'], box: Box): TrackState => ({
  ...IDLE,
  status,
  box,
  reference: [],
})

test('a seguir ou a prever: aponta para a caixa com o zoom escolhido', () => {
  expect(decide(state('tracking', CENTERED), 2, 2)).toEqual({
    zoom: 2,
    command: { kind: 'aim', box: CENTERED },
  })
  expect(decide(state('coasting', CENTERED), 3, 3).command.kind).toBe('aim')
})

test('perdido: para o Osmo e abre o zoom para 1x', () => {
  expect(decide(state('lost', CENTERED), 3, 3)).toEqual({ zoom: 1, command: { kind: 'hold' } })
})

test('sem alvo: não manda nada e respeita o zoom escolhido', () => {
  expect(decide(IDLE, 2, 1)).toEqual({ zoom: 2, command: { kind: 'none' } })
})

test('reencontrado a 1x longe do centro: só fecha o zoom quando o alvo couber na imagem', () => {
  // a 3x, um alvo em x=0.15 ficaria fora da imagem; espera que o Osmo o centre
  expect(decide(state('tracking', OFF_CENTER), 3, 1).zoom).toBe(1)
  expect(decide(state('tracking', CENTERED), 3, 1).zoom).toBe(3)
})

test('a prever não mexe no zoom', () => {
  expect(decide(state('coasting', CENTERED), 3, 1).zoom).toBe(1)
})
