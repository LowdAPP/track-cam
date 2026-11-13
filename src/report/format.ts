import type { Box } from '../tracking/geometry'

const two = (n: number) => String(n).padStart(2, '0')

/** Hora do dia com milésimos, para ordenar o que aconteceu. */
export function stamp(d: Date): string {
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`
}

/** Centro e tamanho da caixa, em fração da imagem. */
export function describeBox(b: Box | null): string {
  if (b == null) return 'sem caixa'
  const f = (v: number) => v.toFixed(2)
  return `centro ${f(b.x + b.w / 2)},${f(b.y + b.h / 2)} tamanho ${f(b.w)}x${f(b.h)}`
}

export interface Sample {
  mode: string
  status: string
  zoom: number
  fps: number
  processMs: number
  twoPasses: boolean
  people: number
  target: Box | null
  docked: boolean
  aims: number
  refused: number
  yaw: number | null
  pitch: number | null
}

/** Uma linha com o estado da app num instante. */
export function sampleLine(s: Sample): string {
  const osmo = s.docked
    ? `Osmo ligado, pedidos ${s.aims} (recusados ${s.refused})` +
      (s.yaw != null && s.pitch != null
        ? `, motores ${s.yaw.toFixed(0)}° / ${s.pitch.toFixed(0)}°`
        : '')
    : 'Osmo desligado'
  return [
    `estado ${s.mode}/${s.status}`,
    `zoom ${s.zoom}x`,
    `${s.fps.toFixed(0)} fps`,
    `${s.processMs.toFixed(0)} ms${s.twoPasses ? ' (2 passes)' : ''}`,
    `${s.people} pessoas`,
    `alvo ${describeBox(s.target)}`,
    osmo,
  ].join(' | ')
}
