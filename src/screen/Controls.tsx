import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { GameRecorder } from '../recording/useGameRecorder'
import { ZOOM_STEPS, type FollowView } from './useFollow'

interface Props {
  view: FollowView
  recorder: GameRecorder
  onZoom: (zoom: number) => void
  onDrop: () => void
}

export function Controls({ view, recorder, onZoom, onDrop }: Props) {
  const recording = recorder.status === 'recording'
  return (
    <>
      <View style={styles.right}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={recording ? 'Parar a gravação' : 'Gravar'}
          onPress={recording ? recorder.stop : recorder.start}
          style={styles.record}
        >
          <View style={recording ? styles.recordStop : styles.recordDot} />
        </Pressable>
        {recording && (
          <Pressable accessibilityRole="button" onPress={recorder.mark} style={styles.button}>
            <Text style={styles.buttonText}>Marcar{'\n'}momento</Text>
            {recorder.moments > 0 && <Text style={styles.count}>{recorder.moments}</Text>}
          </Pressable>
        )}
      </View>

      <View style={styles.bottom}>
        <View style={styles.zoom}>
          {ZOOM_STEPS.map((z) => (
            <Pressable
              key={z}
              accessibilityRole="button"
              accessibilityLabel={`Zoom ${z} vezes`}
              onPress={() => onZoom(z)}
              style={[styles.zoomStep, view.chosenZoom === z && styles.zoomOn]}
            >
              <Text style={[styles.zoomText, view.chosenZoom === z && styles.zoomTextOn]}>{z}x</Text>
            </Pressable>
          ))}
        </View>
        {view.status !== 'idle' && (
          <Pressable accessibilityRole="button" onPress={onDrop} style={styles.button}>
            <Text style={styles.buttonText}>Largar alvo</Text>
          </Pressable>
        )}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  right: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  record: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordDot: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#e53935' },
  recordStop: { width: 26, height: 26, borderRadius: 5, backgroundColor: '#e53935' },
  bottom: {
    position: 'absolute',
    left: 16,
    right: 104,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  zoom: { flexDirection: 'row', gap: 8 },
  zoomStep: {
    minWidth: 48,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  zoomOn: { backgroundColor: '#ffd54a' },
  zoomText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  zoomTextOn: { color: '#111', fontWeight: '700' },
  button: {
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  buttonText: { color: '#111', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  count: { color: '#111', fontSize: 11, fontVariant: ['tabular-nums'] },
})
