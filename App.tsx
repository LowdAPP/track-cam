import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useTensorflowModel } from 'react-native-fast-tflite'
import {
  Camera,
  type CameraRef,
  type Frame,
  useCameraPermission,
  useFrameOutput,
} from 'react-native-vision-camera'
import { useResizer } from 'react-native-vision-camera-resizer'
import { scheduleOnRN } from 'react-native-worklets'
import {
  CLASS_BALL,
  CLASS_PERSON,
  type Detection,
  MIN_SCORE_BALL,
  MIN_SCORE_PERSON,
  MODEL_SIZE,
  type RawDetection,
  type Target,
  targetError,
  updateTarget,
} from './src/detection'

const LOST_LIMIT = 30

export default function App() {
  const { hasPermission, requestPermission } = useCameraPermission()
  const cameraRef = useRef<CameraRef>(null)

  const [size, setSize] = useState({ width: 0, height: 0 })
  const [detections, setDetections] = useState<Detection[]>([])
  const [target, setTarget] = useState<Target | null>(null)
  const [fps, setFps] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const sizeRef = useRef(size)
  sizeRef.current = size
  const lastResult = useRef(0)

  useEffect(() => {
    if (!hasPermission) requestPermission()
  }, [hasPermission, requestPermission])

  // Modelo de deteção (corre no CPU; o delegate Core ML fica para depois).
  const tflite = useTensorflowModel(require('./assets/efficientdet.tflite'), [])
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

  // Recebe as deteções do frame processor (já na thread do React).
  const onResult = useCallback((raw: RawDetection[]) => {
    const now = Date.now()
    if (lastResult.current > 0) {
      const dt = now - lastResult.current
      if (dt > 0) setFps((prev) => prev * 0.8 + (1000 / dt) * 0.2)
    }
    lastResult.current = now

    const preview = cameraRef.current
    if (preview == null) return
    const next: Detection[] = []
    try {
      for (const r of raw) {
        const a = preview.convertCameraPointToViewPoint({ x: r.ax, y: r.ay })
        const b = preview.convertCameraPointToViewPoint({ x: r.bx, y: r.by })
        const left = Math.min(a.x, b.x)
        const top = Math.min(a.y, b.y)
        const width = Math.abs(a.x - b.x)
        const height = Math.abs(a.y - b.y)
        next.push({
          kind: r.kind,
          score: r.score,
          left,
          top,
          width,
          height,
          cx: left + width / 2,
          cy: top + height / 2,
        })
      }
    } catch {
      // a pré-visualização ainda não está pronta
      return
    }
    setDetections(next)
    setTarget((prev) => {
      if (prev == null) return prev
      const maxJump = sizeRef.current.width * 0.25
      return updateTarget(prev, next, maxJump)
    })
  }, [])

  const onWorkletError = useCallback((message: string) => {
    setError(message)
  }, [])

  // Corre em cada frame, na thread da câmara.
  const onFrame = useCallback(
    (frame: Frame) => {
      'worklet'
      try {
        if (model == null || resizer == null) return
        const resized = resizer.resize(frame)
        const outputs = model.runSync([resized.getPixelBuffer()])
        resized.dispose()

        const boxes = new Float32Array(outputs[0]!)
        const classes = new Float32Array(outputs[1]!)
        const scores = new Float32Array(outputs[2]!)
        const count = Math.min(scores.length, new Float32Array(outputs[3]!)[0] ?? 0)

        const result: RawDetection[] = []
        for (let i = 0; i < count; i++) {
          const cls = classes[i]
          const score = scores[i] ?? 0
          const isPerson = cls === CLASS_PERSON && score >= MIN_SCORE_PERSON
          const isBall = cls === CLASS_BALL && score >= MIN_SCORE_BALL
          if (!isPerson && !isBall) continue
          const ymin = boxes[i * 4] ?? 0
          const xmin = boxes[i * 4 + 1] ?? 0
          const ymax = boxes[i * 4 + 2] ?? 0
          const xmax = boxes[i * 4 + 3] ?? 0
          const a = frame.convertFramePointToCameraPoint({
            x: xmin * frame.width,
            y: ymin * frame.height,
          })
          const b = frame.convertFramePointToCameraPoint({
            x: xmax * frame.width,
            y: ymax * frame.height,
          })
          result.push({
            kind: isBall ? 'ball' : 'person',
            score,
            ax: a.x,
            ay: a.y,
            bx: b.x,
            by: b.y,
          })
        }
        scheduleOnRN(onResult, result)
      } catch (e) {
        scheduleOnRN(onWorkletError, String(e))
      } finally {
        frame.dispose()
      }
    },
    [model, resizer, onResult, onWorkletError],
  )

  const frameOutput = useFrameOutput({
    pixelFormat: 'yuv',
    enablePhysicalBufferRotation: true,
    onFrame,
  })

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setSize({ width, height })
  }, [])

  const err = target != null ? targetError(target, size.width, size.height) : null
  const targetLost = target != null && target.lost > LOST_LIMIT

  let status = 'A carregar…'
  if (!hasPermission) status = 'Sem permissão para a câmara'
  else if (tflite.state === 'error') status = `Modelo: ${tflite.error.message}`
  else if (resizerState.state === 'error') status = `Resizer: ${resizerState.error.message}`
  else if (error != null) status = `Erro: ${error}`
  else if (model != null && resizer != null)
    status = `${fps.toFixed(0)} fps · ${detections.length} deteções`

  return (
    <View style={styles.root} onLayout={onLayout}>
      <StatusBar hidden />
      {hasPermission && (
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device="back"
          isActive={true}
          outputs={[frameOutput]}
          onError={(e) => setError(e.message)}
        />
      )}

      {detections.map((d, i) => (
        <Pressable
          key={i}
          onPress={() => setTarget({ kind: d.kind, cx: d.cx, cy: d.cy, lost: 0 })}
          style={[
            styles.box,
            d.kind === 'ball' ? styles.boxBall : styles.boxPerson,
            { left: d.left, top: d.top, width: d.width, height: d.height },
          ]}
        >
          <Text style={styles.boxLabel}>
            {d.kind === 'ball' ? 'bola' : 'jogador'} {(d.score * 100).toFixed(0)}%
          </Text>
        </Pressable>
      ))}

      <View pointerEvents="none" style={styles.centerMark} />

      {target != null && (
        <View
          pointerEvents="none"
          style={[
            styles.target,
            targetLost && styles.targetLost,
            { left: target.cx - 22, top: target.cy - 22 },
          ]}
        />
      )}

      <View pointerEvents="none" style={styles.statusBar}>
        <Text style={styles.statusText}>{status}</Text>
      </View>

      <View style={styles.bottomBar}>
        {target == null || err == null ? (
          <Text style={styles.statusText}>Toque num jogador ou na bola para seguir</Text>
        ) : (
          <>
            <Text style={styles.statusText}>
              {targetLost ? 'Alvo perdido · ' : ''}
              pan {(err.pan * 100).toFixed(0)}% · tilt {(err.tilt * 100).toFixed(0)}%
            </Text>
            <Pressable style={styles.button} onPress={() => setTarget(null)}>
              <Text style={styles.buttonText}>Largar alvo</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  box: { position: 'absolute', borderWidth: 2, borderRadius: 6 },
  boxPerson: { borderColor: '#5dcaa5' },
  boxBall: { borderColor: '#e07a3a' },
  boxLabel: {
    position: 'absolute',
    left: 0,
    top: -18,
    color: '#fff',
    fontSize: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  centerMark: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 10,
    height: 10,
    marginLeft: -5,
    marginTop: -5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  target: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: '#ffd54a',
  },
  targetLost: { borderColor: '#e24b4a', borderStyle: 'dashed' },
  statusBar: {
    position: 'absolute',
    left: 16,
    top: 12,
    right: 16,
  },
  bottomBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusText: {
    color: '#fff',
    fontSize: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  button: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonText: { color: '#111', fontSize: 13, fontWeight: '500' },
})
