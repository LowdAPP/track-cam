import { readFileSync, writeFileSync } from 'node:fs'

import { IDLE, pick, step, type PersonDetection, type TrackState } from '../../src/tracking/tracker'

// Bancada: corre o seguidor da app sobre as deteções de um vídeo real.
//   REPLAY=footage/jogo.detections.json FRAME=120 AT=0.42,0.55 npx jest tools/replay/replay.test.ts
// Sem REPLAY definido, este ficheiro não faz nada (por isso não pesa no `npm test`).
const file = process.env.REPLAY

interface Detections {
  fps: number
  frames: PersonDetection[][]
}

;(file ? test : test.skip)('replay', () => {
  const data = JSON.parse(readFileSync(file!, 'utf8')) as Detections
  const startFrame = Number(process.env.FRAME ?? 0)
  const [x, y] = (process.env.AT ?? '0.5,0.5').split(',').map(Number)
  const dtMs = 1000 / data.fps

  const picked = pick(IDLE, data.frames[startFrame] ?? [], { x: x!, y: y! })
  if (picked === IDLE) {
    const there = (data.frames[startFrame] ?? [])
      .map((p) => `(${(p.box.x + p.box.w / 2).toFixed(2)}, ${(p.box.y + p.box.h / 2).toFixed(2)})`)
      .join(' ')
    throw new Error(`Ninguém em AT=${x},${y} no frame ${startFrame}. Pessoas nesse frame: ${there}`)
  }

  let state: TrackState = picked
  const track: (Pick<TrackState, 'status' | 'box'> | null)[] = data.frames.map(() => null)
  const time: Record<string, number> = { tracking: 0, coasting: 0, lost: 0 }
  const transitions: string[] = []
  for (let i = startFrame; i < data.frames.length; i++) {
    const before = state.status
    if (i > startFrame) state = step(state, data.frames[i]!, dtMs)
    track[i] = { status: state.status, box: state.box }
    time[state.status] = (time[state.status] ?? 0) + dtMs / 1000
    if (state.status !== before && (state.status === 'lost' || before === 'lost')) {
      transitions.push(`  frame ${i} (${(i / data.fps).toFixed(1)} s): ${before} -> ${state.status}`)
    }
  }

  const out = file!.replace(/\.detections\.json$/, '.track.json')
  writeFileSync(out, JSON.stringify({ fps: data.fps, startFrame, track }))
  const lostCount = transitions.filter((t) => t.endsWith('-> lost')).length
  process.stdout.write(
    [
      '',
      `Seguimento a partir do frame ${startFrame}, ${((data.frames.length - startFrame) / data.fps).toFixed(0)} s de vídeo`,
      `  a seguir ${time.tracking!.toFixed(1)} s · a prever ${time.coasting!.toFixed(1)} s · perdido ${time.lost!.toFixed(1)} s`,
      `  ficou perdido ${lostCount} vez(es)`,
      ...transitions,
      `-> ${out}`,
      '',
    ].join('\n'),
  )
})
