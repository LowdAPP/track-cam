/** Duração máxima de cada vídeo do jogo. */
export const SEGMENT_SECONDS = 180
/** Abaixo disto avisa-se antes de começar a gravar. */
export const LOW_SPACE_BYTES = 4_000_000_000

const two = (n: number) => String(n).padStart(2, '0')

/** Identificador do jogo a partir da hora de início: "2026-11-11_18-30-05". */
export function gameId(start: Date): string {
  const date = `${start.getFullYear()}-${two(start.getMonth() + 1)}-${two(start.getDate())}`
  const time = `${two(start.getHours())}-${two(start.getMinutes())}-${two(start.getSeconds())}`
  return `${date}_${time}`
}

export function segmentFileName(game: string, index: number): string {
  return `${game}_parte-${two(index + 1)}.mov`
}

/** Quanto do jogo fica no vídeo de um golo, antes e depois do toque no botão. */
export const GOAL_BEFORE_SEC = 12
export const GOAL_AFTER_SEC = 5

export function goalFileName(game: string, index: number): string {
  return `${game}_golo-${two(index + 1)}.mp4`
}

export interface GoalClip {
  /** onde o corte começa, em segundos a contar do fim do vídeo */
  fromEndSec: number
  durationSec: number
}

/** O corte de um golo, sabendo quando se tocou no botão e quando o vídeo acabou. */
export function goalClip(tapMs: number, endMs: number): GoalClip {
  const afterSec = Math.max(0, (endMs - tapMs) / 1000)
  return {
    fromEndSec: GOAL_BEFORE_SEC + afterSec,
    durationSec: GOAL_BEFORE_SEC + Math.min(afterSec, GOAL_AFTER_SEC),
  }
}

export interface Moment {
  /** só nos golos; os outros momentos não têm */
  kind?: 'golo'

  /** índice do vídeo (parte) em que o momento caiu */
  segment: number
  /** segundos desde o início desse vídeo */
  offsetSec: number
  /** hora real, ISO 8601 */
  at: string
}

/** `segmentStartsMs` são as horas de início de cada parte, por ordem. */
export function momentAt(segmentStartsMs: number[], nowMs: number): Moment {
  let segment = 0
  for (let i = 0; i < segmentStartsMs.length; i++) {
    if (segmentStartsMs[i]! <= nowMs) segment = i
  }
  const start = segmentStartsMs[segment] ?? nowMs
  return {
    segment,
    offsetSec: Math.max(0, (nowMs - start) / 1000),
    at: new Date(nowMs).toISOString(),
  }
}

export type SegmentEnd = 'stopped' | 'max-duration-reached' | 'max-file-size-reached' | 'error'

export type AfterSegment =
  | { kind: 'start-next' }
  | { kind: 'finish' }
  | { kind: 'interrupted'; message: string }

/**
 * O que fazer quando um vídeo termina. Depois de uma interrupção a app não retoma sozinha.
 * `cutForGoal`: foi a app que fechou o vídeo, para cortar um golo.
 */
export function afterSegment(
  reason: SegmentEnd,
  userStopped: boolean,
  cutForGoal = false,
): AfterSegment {
  if (userStopped) return { kind: 'finish' }
  if (
    reason === 'max-duration-reached' ||
    reason === 'max-file-size-reached' ||
    (reason === 'stopped' && cutForGoal)
  ) {
    return { kind: 'start-next' }
  }
  return {
    kind: 'interrupted',
    message: 'A gravação foi interrompida. Toque em gravar para continuar.',
  }
}

export interface AfterSave {
  deleteLocal: boolean
  notice: string | null
}

/** O ficheiro local só se apaga depois de estar nas Fotografias. */
export function afterSave(saved: boolean, localPath: string): AfterSave {
  if (saved) return { deleteLocal: true, notice: null }
  const name = localPath.split('/').pop() ?? localPath
  return {
    deleteLocal: false,
    notice: `Não foi possível guardar ${name} nas Fotografias. O vídeo ficou na app (Ficheiros > TrackCam > jogos).`,
  }
}
