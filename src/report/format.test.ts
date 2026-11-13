import { describeBox, sampleLine, stamp } from './format'

test('a hora tem milésimos', () => {
  expect(stamp(new Date(2026, 10, 13, 9, 5, 7, 42))).toBe('09:05:07.042')
})

test('a caixa é descrita pelo centro e pelo tamanho', () => {
  expect(describeBox({ x: 0.4, y: 0.2, w: 0.2, h: 0.4 })).toBe('centro 0.50,0.40 tamanho 0.20x0.40')
  expect(describeBox(null)).toBe('sem caixa')
})

test('a linha de estado diz o que o Osmo fez', () => {
  const base = {
    mode: 'player',
    status: 'tracking',
    zoom: 2,
    fps: 14.6,
    processMs: 61.2,
    twoPasses: true,
    people: 7,
    target: { x: 0.4, y: 0.2, w: 0.2, h: 0.4 },
    aims: 120,
    refused: 3,
    yaw: 12.4,
    pitch: -3.2,
    control: 'direct',
    pan: 14.2,
    tilt: -2.6,
  }
  expect(sampleLine({ ...base, docked: true })).toBe(
    'estado player/tracking | zoom 2x | 15 fps | 61 ms (detalhe) | 7 pessoas | ' +
      'alvo centro 0.50,0.40 tamanho 0.20x0.40 | Osmo ligado (direct), pedidos 120 (recusados 3), a pedir pan 14°/s tilt -3°/s, motores 12° / -3°',
  )
  expect(sampleLine({ ...base, docked: false })).toContain('| Osmo desligado')
})
