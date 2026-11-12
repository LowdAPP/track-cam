import {
  afterSave,
  afterSegment,
  gameId,
  goalClip,
  goalFileName,
  momentAt,
  segmentFileName,
} from './segments'

test('nomes', () => {
  const g = gameId(new Date(2026, 10, 11, 18, 30, 5))
  expect(g).toBe('2026-11-11_18-30-05')
  expect(segmentFileName(g, 0)).toBe('2026-11-11_18-30-05_parte-01.mov')
  expect(segmentFileName(g, 11)).toBe('2026-11-11_18-30-05_parte-12.mov')
})

test('momento: segmento e segundo dentro dele', () => {
  const m = momentAt([1000, 181000], 190500)
  expect(m.segment).toBe(1)
  expect(m.offsetSec).toBeCloseTo(9.5)
  expect(m.at).toBe(new Date(190500).toISOString())
})

test('momento antes de o primeiro segmento arrancar conta como o início', () => {
  expect(momentAt([1000], 500)).toMatchObject({ segment: 0, offsetSec: 0 })
  expect(momentAt([], 500)).toMatchObject({ segment: 0, offsetSec: 0 })
})

test('depois de um segmento', () => {
  expect(afterSegment('max-duration-reached', false)).toEqual({ kind: 'start-next' })
  expect(afterSegment('max-file-size-reached', false)).toEqual({ kind: 'start-next' })
  expect(afterSegment('stopped', true)).toEqual({ kind: 'finish' })
  expect(afterSegment('error', false).kind).toBe('interrupted')
  expect(afterSegment('stopped', false).kind).toBe('interrupted')
  expect(afterSegment('max-duration-reached', true)).toEqual({ kind: 'finish' })
})

test('só apaga o ficheiro local depois de guardado', () => {
  expect(afterSave(true, '/x/a.mov')).toEqual({ deleteLocal: true, notice: null })
  const failed = afterSave(false, '/x/a.mov')
  expect(failed.deleteLocal).toBe(false)
  expect(failed.notice).toContain('a.mov')
})

test('nome do vídeo de um golo', () => {
  expect(goalFileName('2026-11-11_18-30-05', 0)).toBe('2026-11-11_18-30-05_golo-01.mp4')
})

test('golo: 12 s antes do toque e 5 s depois', () => {
  // o vídeo acabou 5 s depois do toque
  expect(goalClip(100_000, 105_000)).toEqual({ fromEndSec: 17, durationSec: 17 })
})

test('golo: se a gravação parou antes dos 5 s, fica o que houver', () => {
  expect(goalClip(100_000, 102_000)).toEqual({ fromEndSec: 14, durationSec: 14 })
  expect(goalClip(100_000, 99_000)).toEqual({ fromEndSec: 12, durationSec: 12 })
})

test('golo: se o vídeo acabou mais tarde, o corte não passa dos 5 s depois do toque', () => {
  expect(goalClip(100_000, 108_000)).toEqual({ fromEndSec: 20, durationSec: 17 })
})

test('fechar um vídeo para cortar um golo não interrompe o jogo', () => {
  expect(afterSegment('stopped', false, true)).toEqual({ kind: 'start-next' })
  expect(afterSegment('stopped', true, true)).toEqual({ kind: 'finish' })
  expect(afterSegment('error', false, true).kind).toBe('interrupted')
})
