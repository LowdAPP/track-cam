import { useCallback } from 'react'
import { useTensorflowModel } from 'react-native-fast-tflite'
import { type Frame, useFrameOutput } from 'react-native-vision-camera'
import { useResizer } from 'react-native-vision-camera-resizer'
import { scheduleOnRN, type Synchronizable } from 'react-native-worklets'

import { cropRegion, fromCrop, type Box, type Point } from '../tracking/geometry'
import type { PersonDetection } from '../tracking/tracker'
import { cropToRgb } from './crop'
import { decodePeople, merge, MODEL_SIZE } from './model'

/** O passe de detalhe só corre para alvos mais baixos do que esta fração da imagem. */
const DETAIL_BELOW_HEIGHT = 0.25
/**
 * Com um alvo pequeno, a imagem inteira só é vista de N em N frames. Medido no
 * pavilhão: a 1x só o passe de detalhe vê o jogador, por isso é ele que corre sempre;
 * a imagem inteira serve para saber onde andam os outros.
 */
const FULL_EVERY = 3

export interface FrameResult {
  people: PersonDetection[]
  /** matriz 3x3 da câmara por linhas, em píxeis do frame; null se a câmara não a entregar */
  intrinsics: number[] | null
  frameW: number
  frameH: number
  /**
   * Os cantos (0,0), (1,0) e (0,1) do frame em coordenadas de câmara. Servem
   * para converter caixas do frame em posições no ecrã.
   */
  corners: [Point, Point, Point]
  /** tempo gasto a processar este frame */
  processMs: number
  /** o passe de detalhe à volta do alvo correu neste frame? */
  usedCrop: boolean
}

interface Options {
  /** Zona onde olhar com detalhe; null quando não há alvo. Lida na thread da câmara. */
  focus: Synchronizable<Box | null>
  onResult: (result: FrameResult) => void
  onError: (message: string) => void
}

export function useDetection({ focus, onResult, onError }: Options) {
  // Corre no CPU; o delegate Core ML fica para se os fps não chegarem.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- os modelos carregam-se com require()
  const tflite = useTensorflowModel(require('../../assets/efficientdet.tflite'), [])
  const model = tflite.state === 'loaded' ? tflite.model : undefined

  // Redimensiona cada frame para a entrada do modelo, na GPU.
  const resizerState = useResizer({
    width: MODEL_SIZE,
    height: MODEL_SIZE,
    channelOrder: 'rgb',
    dataType: 'uint8',
    scaleMode: 'stretch',
    pixelLayout: 'interleaved',
  })
  const resizer = resizerState.resizer

  // Corre em cada frame, na thread da câmara.
  const onFrame = useCallback(
    (frame: Frame) => {
      'worklet'
      try {
        if (model == null || resizer == null) return
        const started = Date.now()

        const target = focus.getDirty()
        const store = globalThis as unknown as {
          __trackCamCrop?: Uint8Array<ArrayBuffer>
          __trackCamTurn?: number
        }
        const turn = (store.__trackCamTurn ?? 0) + 1
        store.__trackCamTurn = turn
        const detail = target != null && target.h < DETAIL_BELOW_HEIGHT

        // 1.º passe: a imagem inteira, reduzida.
        let people: PersonDetection[] = []
        if (!detail || turn % FULL_EVERY === 0) {
          const resized = resizer.resize(frame)
          const fullRgb = new Uint8Array(resized.getPixelBuffer())
          people = decodePeople(model.runSync([fullRgb.buffer]) as ArrayBuffer[], fullRgb)
          resized.dispose()
        }

        // 2.º passe: um recorte à volta do alvo, sem reduzir tanto.
        let usedCrop = false
        if (target != null && detail) {
          const planes = frame.getPlanes()
          if (planes.length >= 2) {
            if (store.__trackCamCrop == null) {
              store.__trackCamCrop = new Uint8Array(new ArrayBuffer(MODEL_SIZE * MODEL_SIZE * 3))
            }
            const cropRgb = store.__trackCamCrop
            const region = cropRegion(target, frame.width, frame.height)
            cropToRgb(
              {
                y: new Uint8Array(planes[0]!.getPixelBuffer()),
                yRowBytes: planes[0]!.bytesPerRow,
                uv: new Uint8Array(planes[1]!.getPixelBuffer()),
                uvRowBytes: planes[1]!.bytesPerRow,
                fullRange: String(frame.pixelFormat).endsWith('full'),
              },
              region,
              MODEL_SIZE,
              cropRgb,
            )
            const found = decodePeople(model.runSync([cropRgb.buffer]) as ArrayBuffer[], cropRgb)
            for (const p of found) p.box = fromCrop(p.box, region, frame.width, frame.height)
            people = merge(people, found)
            usedCrop = true
          }
        }

        const corners: [Point, Point, Point] = [
          frame.convertFramePointToCameraPoint({ x: 0, y: 0 }),
          frame.convertFramePointToCameraPoint({ x: frame.width, y: 0 }),
          frame.convertFramePointToCameraPoint({ x: 0, y: frame.height }),
        ]
        scheduleOnRN(onResult, {
          people,
          intrinsics: frame.cameraIntrinsicMatrix ?? null,
          frameW: frame.width,
          frameH: frame.height,
          corners,
          processMs: Date.now() - started,
          usedCrop,
        })
      } catch (e) {
        scheduleOnRN(onError, String(e))
      } finally {
        frame.dispose()
      }
    },
    [model, resizer, focus, onResult, onError],
  )

  const frameOutput = useFrameOutput({
    pixelFormat: 'yuv',
    enablePhysicalBufferRotation: true,
    enableCameraMatrixDelivery: true,
    onFrame,
  })

  let problem: string | null = null
  if (tflite.state === 'error') problem = `Modelo: ${tflite.error.message}`
  else if (resizerState.state === 'error') problem = `Resizer: ${resizerState.error.message}`

  return { frameOutput, ready: model != null && resizer != null, problem }
}
