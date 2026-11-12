import { useCallback, useEffect, useRef, useState } from 'react'
import { type GestureResponderEvent, Pressable, StyleSheet, Text, View } from 'react-native'
import {
  Camera,
  type CameraRef,
  useCameraPermission,
  useMicrophonePermission,
} from 'react-native-vision-camera'

import { type FrameResult, useDetection } from '../detection/useDetection'
import { useDock } from '../dock/useDock'
import { useGameRecorder } from '../recording/useGameRecorder'
import { Controls } from './Controls'
import { makeMapper, type Mapper } from './mapper'
import { PeopleOverlay } from './PeopleOverlay'
import { StatusBanner } from './StatusBanner'
import { useFollow } from './useFollow'

/**
 * Pede a câmara e o microfone antes de abrir a câmara. A sessão da câmara
 * falha ao arrancar se gravar com som sem o microfone já estar decidido.
 */
export function CameraScreen() {
  const camera = useCameraPermission()
  const microphone = useMicrophonePermission()
  const asking = useRef(false)

  useEffect(() => {
    if (asking.current) return
    const ask = camera.canRequestPermission
      ? camera.requestPermission
      : microphone.canRequestPermission
        ? microphone.requestPermission
        : null
    if (ask == null) return
    asking.current = true
    ask()
      .catch(() => false)
      .finally(() => {
        asking.current = false
      })
  }, [camera, microphone])

  const pending = camera.canRequestPermission || microphone.canRequestPermission
  if (pending || !camera.hasPermission) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.message}>
          {pending
            ? 'A pedir permissões…'
            : 'Sem permissão para a câmara. Ative-a nas Definições do iPhone, em TrackCam.'}
        </Text>
      </View>
    )
  }
  return <GameScreen audio={microphone.hasPermission} />
}

function GameScreen({ audio }: { audio: boolean }) {
  const cameraRef = useRef<CameraRef>(null)
  const [error, setError] = useState<string | null>(null)

  const [mapper, setMapper] = useState<Mapper | null>(null)
  const mapperKey = useRef('')

  const dock = useDock()
  const follow = useFollow(dock)
  const { onFrame } = follow

  // Cada frame diz onde ficam os seus cantos; a pré-visualização converte-os
  // em posições no ecrã. É isso que liga as caixas à imagem.
  const onResult = useCallback(
    (result: FrameResult) => {
      const preview = cameraRef.current
      if (preview != null) {
        try {
          const [o, x, y] = result.corners.map((c) => preview.convertCameraPointToViewPoint(c))
          const key = [o, x, y].map((p) => `${p!.x.toFixed(1)},${p!.y.toFixed(1)}`).join(' ')
          if (key !== mapperKey.current) {
            mapperKey.current = key
            setMapper(makeMapper(o!, x!, y!))
          }
        } catch {
          // a pré-visualização ainda não está pronta
        }
      }
      onFrame(result)
    },
    [onFrame],
  )

  const detection = useDetection({ focus: follow.focus, onResult, onError: setError })
  const recorder = useGameRecorder(audio)

  const onTap = (e: GestureResponderEvent) => {
    if (mapper == null) return
    follow.tap(mapper.toFrame({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }))
  }

  let problem: string | null = null
  if (detection.problem != null) problem = detection.problem
  else if (error != null) problem = `Erro: ${error}`

  return (
    <View style={styles.root}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device="back"
        isActive={true}
        zoom={follow.view.zoom}
        outputs={[detection.frameOutput, recorder.videoOutput]}
        onError={(e) => setError(e.message)}
      />
      <Pressable
        accessibilityLabel="Imagem da câmara. Toque num jogador para o seguir."
        style={StyleSheet.absoluteFill}
        onPress={onTap}
      >
        <PeopleOverlay view={follow.view} mapper={mapper} />
      </Pressable>
      <StatusBanner
        dock={dock}
        view={follow.view}
        recorder={recorder}
        problem={problem}
        ready={detection.ready}
      />
      <Controls
        view={follow.view}
        recorder={recorder}
        onZoom={follow.setZoom}
        onMode={follow.setMode}
        onDrop={follow.drop}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  message: { color: '#fff', fontSize: 17, textAlign: 'center' },
})
