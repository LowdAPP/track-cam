import { afterSave, afterSegment, gameId, momentAt, segmentFileName } from './segments'

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
