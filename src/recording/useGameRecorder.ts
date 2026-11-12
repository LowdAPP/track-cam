import { Directory, File, Paths } from 'expo-file-system'
import { Album, Asset, requestPermissionsAsync } from 'expo-media-library'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type Recorder,
  type RecordingFinishedReason,
  useVideoOutput,
} from 'react-native-vision-camera'

import { TrackCamClip } from '../../modules/trackcam-dock'
import {
  afterSave,
  afterSegment,
  gameId,
  GOAL_AFTER_SEC,
  goalClip,
  goalFileName,
  LOW_SPACE_BYTES,
  momentAt,
  SEGMENT_SECONDS,
  segmentFileName,
  type Moment,
  type SegmentEnd,
} from './segments'

export type RecorderStatus = 'idle' | 'recording' | 'interrupted'

/** Caminho de sistema (sem "file://") a partir de um URI do expo-file-system. */
function toPath(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ''))
}

/** Álbum das Fotografias onde ficam os vídeos dos golos. */
const GOALS_ALBUM = 'TrackCam Golos'
/** Quanto tempo o aviso "Golo guardado" fica no ecrã. */
const GOAL_NOTICE_MS = 4000

function remove(path: string) {
  try {
    new File(`file://${path}`).delete()
  } catch {
    // fica na pasta da app; não é grave
  }
}

/** Guarda nas Fotografias, no álbum dos golos. Sem acesso aos álbuns, guarda fora dele. */
async function saveGoal(path: string) {
  const uri = `file://${path}`
  try {
    const album = await Album.get(GOALS_ALBUM)
    if (album != null) await Asset.create(uri, album)
    else await Album.create(GOALS_ALBUM, [uri])
  } catch {
    await Asset.create(uri)
  }
}

interface Session {
  game: string
  dir: Directory
  segmentStarts: number[]
  moments: Moment[]
  userStopped: boolean
  current: Recorder | null
  prepared: Recorder | null
  /** golo à espera de ser cortado quando o vídeo atual fechar */
  pendingGoal: { tapMs: number; index: number } | null
  goals: number
  /** a app está a fechar o vídeo atual para cortar um golo */
  cutting: boolean
  /** quando se pediu para fechar o vídeo atual */
  endAt: number | null
  /** vídeo anterior, guardado até o seguinte fechar: um golo pode começar nele */
  previous: string | null
  /** vídeos que não chegaram às Fotografias: não se apagam da app */
  unsaved: Set<string>
}

/** Grava o jogo em vídeos seguidos de até 3 minutos e guarda-os nas Fotografias. */
export function useGameRecorder(audio: boolean) {
  const videoOutput = useVideoOutput({ enableAudio: audio })
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [elapsedSec, setElapsedSec] = useState(0)
  const [segment, setSegment] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [moments, setMoments] = useState(0)
  const [goals, setGoals] = useState(0)
  const [savingGoal, setSavingGoal] = useState(false)
  const [goalSaved, setGoalSaved] = useState(false)
  const session = useRef<Session | null>(null)
  const startedAt = useRef(0)
  // o segmento seguinte arranca a partir do fim do anterior, por isso a função chama-se a si própria
  const startSegmentRef = useRef<(s: Session, index: number) => Promise<void>>(async () => {})

  useEffect(() => {
    if (status !== 'recording') return
    const timer = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt.current) / 1000))
    }, 500)
    return () => clearInterval(timer)
  }, [status])

  useEffect(() => {
    if (!goalSaved) return
    const timer = setTimeout(() => setGoalSaved(false), GOAL_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [goalSaved])

  /** Guarda um vídeo do jogo nas Fotografias. O ficheiro da app é apagado mais tarde. */
  const save = useCallback(async (s: Session, path: string) => {
    let saved = false
    try {
      await Asset.create(`file://${path}`)
      saved = true
    } catch {
      saved = false
    }
    const next = afterSave(saved, path)
    if (next.notice != null) setNotice(next.notice)
    if (!next.deleteLocal) s.unsaved.add(path)
  }, [])

  /** Corta o golo do fim dos vídeos dados e guarda-o nas Fotografias. */
  const cutGoal = useCallback(
    async (s: Session, goal: { tapMs: number; index: number }, paths: string[], endMs: number) => {
      const output = toPath(new File(s.dir, goalFileName(s.game, goal.index)).uri)
      const clip = goalClip(goal.tapMs, endMs)
      try {
        const result = await TrackCamClip.makeClip(paths, clip.fromEndSec, clip.durationSec, output)
        if (!result.ok) throw new Error(result.error ?? 'o corte falhou')
        await saveGoal(output)
        remove(output)
        if (session.current === s || s.userStopped) {
          setGoals((n) => n + 1)
          setGoalSaved(true)
        }
      } catch (e) {
        setNotice(
          `Não foi possível guardar o vídeo do golo (${String(e)}). O golo está no vídeo do jogo.`,
        )
      } finally {
        setSavingGoal(false)
      }
    },
    [],
  )

  const startSegment = useCallback(
    async (s: Session, index: number) => {
      const filePath = (i: number) => toPath(new File(s.dir, segmentFileName(s.game, i)).uri)
      const settings = (i: number) => ({ filePath: filePath(i), maxDuration: SEGMENT_SECONDS })

      const finished = (path: string, reason: SegmentEnd) => {
        if (session.current !== s) return
        const endMs = s.endAt ?? Date.now()
        const goal = s.pendingGoal
        const before = s.previous
        const next = afterSegment(reason, s.userStopped, s.cutting)
        const last = next.kind !== 'start-next'
        s.endAt = null
        s.pendingGoal = null
        s.cutting = false
        s.previous = last ? null : path
        if (next.kind === 'start-next') {
          startSegmentRef.current(s, index + 1).catch((e) => {
            session.current = null
            setStatus('interrupted')
            setNotice(`A gravação parou: ${String(e)}. Toque em gravar para continuar.`)
          })
        } else {
          session.current = null
          setStatus(next.kind === 'finish' ? 'idle' : 'interrupted')
          if (next.kind === 'interrupted') setNotice(next.message)
        }
        // O golo primeiro, para ficar pronto a partilhar; só depois se apagam os ficheiros da app.
        void (async () => {
          if (goal != null) {
            await cutGoal(s, goal, before != null ? [before, path] : [path], endMs)
          }
          await save(s, path)
          if (before != null && !s.unsaved.has(before)) remove(before)
          if (last && !s.unsaved.has(path)) remove(path)
        })()
      }

      const recorder = s.prepared ?? (await videoOutput.createRecorder(settings(index)))
      s.prepared = null
      s.current = recorder
      await recorder.startRecording(
        (path: string, reason: RecordingFinishedReason) => finished(path, reason),
        () => finished(recorder.filePath, 'error'),
      )
      s.segmentStarts[index] = Date.now()
      setSegment(index)
      setStatus('recording')

      // Prepara já o vídeo seguinte, para a troca ser o mais rápida possível.
      try {
        s.prepared = await videoOutput.createRecorder(settings(index + 1))
      } catch {
        s.prepared = null
      }
    },
    [cutGoal, save, videoOutput],
  )
  useEffect(() => {
    startSegmentRef.current = startSegment
  }, [startSegment])

  const start = useCallback(async () => {
    if (session.current != null) return
    setNotice(
      audio ? null : 'A gravar sem som: falta a permissão do microfone (Definições → TrackCam).',
    )
    // Acesso completo, para os golos irem para um álbum próprio; se for recusado, basta poder guardar.
    let library = await requestPermissionsAsync(false)
    if (!library.granted) library = await requestPermissionsAsync(true)
    if (!library.granted) {
      setNotice('Sem permissão para guardar nas Fotografias. Ative-a nas Definições.')
      return
    }
    if (Paths.availableDiskSpace < LOW_SPACE_BYTES) {
      const gb = (Paths.availableDiskSpace / 1e9).toFixed(1)
      setNotice(`Pouco espaço livre (${gb} GB). Um jogo de 40 minutos ocupa cerca de 2,5 GB.`)
    }

    const game = gameId(new Date())
    const dir = new Directory(Paths.document, 'jogos', game)
    dir.create({ intermediates: true, idempotent: true })
    const s: Session = {
      game,
      dir,
      segmentStarts: [],
      moments: [],
      userStopped: false,
      current: null,
      prepared: null,
      pendingGoal: null,
      goals: 0,
      cutting: false,
      endAt: null,
      previous: null,
      unsaved: new Set(),
    }
    session.current = s
    startedAt.current = Date.now()
    setElapsedSec(0)
    setMoments(0)
    setGoals(0)
    setSavingGoal(false)
    setGoalSaved(false)
    try {
      await startSegment(s, 0)
    } catch (e) {
      session.current = null
      setStatus('idle')
      setNotice(`Não foi possível começar a gravar: ${String(e)}`)
    }
  }, [audio, startSegment])

  const stop = useCallback(async () => {
    const s = session.current
    if (s == null || s.current == null) return
    s.userStopped = true
    s.endAt = Date.now()
    try {
      await s.current.stopRecording()
    } catch (e) {
      session.current = null
      setStatus('idle')
      setNotice(`Erro ao parar a gravação: ${String(e)}`)
    }
  }, [])

  const mark = useCallback(() => {
    const s = session.current
    if (s == null) return
    s.moments.push(momentAt(s.segmentStarts, Date.now()))
    setMoments(s.moments.length)
    try {
      new File(s.dir, 'momentos.json').write(JSON.stringify(s.moments, null, 2))
    } catch (e) {
      setNotice(`Não foi possível guardar o momento: ${String(e)}`)
    }
  }, [])

  /** Golo: fecha o vídeo atual daqui a uns segundos e corta-lhe o fim para um vídeo à parte. */
  const goal = useCallback(() => {
    const s = session.current
    if (s == null || s.current == null || s.userStopped || s.pendingGoal != null) return
    const tapMs = Date.now()
    s.pendingGoal = { tapMs, index: s.goals++ }
    setSavingGoal(true)
    s.moments.push({ kind: 'golo', ...momentAt(s.segmentStarts, tapMs) })
    try {
      new File(s.dir, 'momentos.json').write(JSON.stringify(s.moments, null, 2))
    } catch {
      // o vídeo do golo não depende desta lista
    }
    setTimeout(() => {
      // se o vídeo já fechou entretanto (3 minutos, ou parou-se a gravação), o golo já foi cortado
      if (session.current !== s || s.pendingGoal?.tapMs !== tapMs) return
      const recorder = s.current
      if (s.userStopped || recorder == null) return
      s.cutting = true
      s.endAt = Date.now()
      recorder.stopRecording().catch((e: unknown) => {
        s.cutting = false
        s.endAt = null
        s.pendingGoal = null
        setSavingGoal(false)
        setNotice(`Não foi possível cortar o golo: ${String(e)}. O golo está no vídeo do jogo.`)
      })
    }, GOAL_AFTER_SEC * 1000)
  }, [])

  return useMemo(
    () => ({
      videoOutput,
      status,
      elapsedSec,
      segment,
      notice,
      moments,
      goals,
      savingGoal,
      goalSaved,
      start,
      stop,
      mark,
      goal,
    }),
    [
      videoOutput,
      status,
      elapsedSec,
      segment,
      notice,
      moments,
      goals,
      savingGoal,
      goalSaved,
      start,
      stop,
      mark,
      goal,
    ],
  )
}

export type GameRecorder = ReturnType<typeof useGameRecorder>
