import { Directory, File, Paths } from 'expo-file-system'
import { Asset, requestPermissionsAsync } from 'expo-media-library'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type Recorder,
  type RecordingFinishedReason,
  useMicrophonePermission,
  useVideoOutput,
} from 'react-native-vision-camera'

import {
  afterSave,
  afterSegment,
  gameId,
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

interface Session {
  game: string
  dir: Directory
  segmentStarts: number[]
  moments: Moment[]
  userStopped: boolean
  current: Recorder | null
  prepared: Recorder | null
}

/** Grava o jogo em vídeos seguidos de até 3 minutos e guarda-os nas Fotografias. */
export function useGameRecorder() {
  const videoOutput = useVideoOutput({ enableAudio: true })
  const microphone = useMicrophonePermission()
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [elapsedSec, setElapsedSec] = useState(0)
  const [segment, setSegment] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [moments, setMoments] = useState(0)
  const session = useRef<Session | null>(null)
  const startedAt = useRef(0)

  useEffect(() => {
    if (status !== 'recording') return
    const timer = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt.current) / 1000))
    }, 500)
    return () => clearInterval(timer)
  }, [status])

  const save = useCallback(async (path: string) => {
    let saved = false
    try {
      await Asset.create(`file://${path}`)
      saved = true
    } catch {
      saved = false
    }
    const next = afterSave(saved, path)
    if (next.notice != null) setNotice(next.notice)
    if (next.deleteLocal) {
      try {
        new File(`file://${path}`).delete()
      } catch {
        // fica na pasta da app; não é grave
      }
    }
  }, [])

  const startSegment = useCallback(
    async (s: Session, index: number) => {
      const filePath = (i: number) => toPath(new File(s.dir, segmentFileName(s.game, i)).uri)
      const settings = (i: number) => ({ filePath: filePath(i), maxDuration: SEGMENT_SECONDS })

      const finished = (path: string, reason: SegmentEnd) => {
        if (session.current !== s) return
        const next = afterSegment(reason, s.userStopped)
        if (next.kind === 'start-next') {
          startSegment(s, index + 1).catch((e) => {
            session.current = null
            setStatus('interrupted')
            setNotice(`A gravação parou: ${String(e)}. Toque em gravar para continuar.`)
          })
        } else {
          session.current = null
          setStatus(next.kind === 'finish' ? 'idle' : 'interrupted')
          if (next.kind === 'interrupted') setNotice(next.message)
        }
        save(path)
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
    [save, videoOutput],
  )

  const start = useCallback(async () => {
    if (session.current != null) return
    setNotice(null)
    if (!microphone.hasPermission && !(await microphone.requestPermission())) {
      setNotice('Sem permissão para o microfone. Ative-a nas Definições para gravar com som.')
      return
    }
    const library = await requestPermissionsAsync(true)
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
    }
    session.current = s
    startedAt.current = Date.now()
    setElapsedSec(0)
    setMoments(0)
    try {
      await startSegment(s, 0)
    } catch (e) {
      session.current = null
      setStatus('idle')
      setNotice(`Não foi possível começar a gravar: ${String(e)}`)
    }
  }, [microphone, startSegment])

  const stop = useCallback(async () => {
    const s = session.current
    if (s == null || s.current == null) return
    s.userStopped = true
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

  return useMemo(
    () => ({ videoOutput, status, elapsedSec, segment, notice, moments, start, stop, mark }),
    [videoOutput, status, elapsedSec, segment, notice, moments, start, stop, mark],
  )
}

export type GameRecorder = ReturnType<typeof useGameRecorder>
