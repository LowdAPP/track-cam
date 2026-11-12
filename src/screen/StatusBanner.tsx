import { StyleSheet, Text, View } from 'react-native'

import type { Dock } from '../dock/useDock'
import type { GameRecorder } from '../recording/useGameRecorder'
import type { FollowView } from './useFollow'

interface Props {
  dock: Dock
  view: FollowView
  recorder: GameRecorder
  /** problema que impede a app de funcionar (permissão, modelo, câmara) */
  problem: string | null
  ready: boolean
}

const clock = (sec: number) =>
  `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`

export function StatusBanner({ dock, view, recorder, problem, ready }: Props) {
  let hint: string | null = null
  if (problem != null) hint = problem
  else if (!ready) hint = 'A carregar…'
  else if (view.status === 'lost') hint = 'Jogador perdido · a procurar… Toque nele para retomar'
  else if (view.status === 'idle') hint = 'Toque no jogador que quer seguir'

  const frame = view.frame
  const diagnostics = [
    `${view.fps.toFixed(0)} fps`,
    frame != null ? `${frame.processMs.toFixed(0)} ms${frame.usedCrop ? ' (2 passes)' : ''}` : null,
    `${view.people.length} pessoas`,
    dock.lastError != null ? `Osmo: ${dock.lastError}` : null,
  ]
    .filter((v) => v != null)
    .join(' · ')

  return (
    <View pointerEvents="none" style={styles.root}>
      <View style={styles.row}>
        {recorder.status === 'recording' && (
          <Text style={[styles.pill, styles.rec]}>
            ● REC {clock(recorder.elapsedSec)} · parte {recorder.segment + 1}
          </Text>
        )}
        <Text style={[styles.pill, !dock.connected && styles.warn]}>
          {dock.connected
            ? 'Osmo ligado'
            : 'Osmo não ligado — emparelhe por NFC e retire o Módulo Multifunções'}
        </Text>
      </View>
      {hint != null && (
        <Text style={[styles.pill, styles.hint, (problem != null || view.status === 'lost') && styles.warn]}>
          {hint}
        </Text>
      )}
      {recorder.goalSaved && (
        <Text style={[styles.pill, styles.ok]}>Golo guardado nas Fotografias</Text>
      )}
      {recorder.notice != null && <Text style={[styles.pill, styles.warn]}>{recorder.notice}</Text>}
      <Text style={styles.diagnostics}>{diagnostics}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 16, top: 12, right: 120, gap: 6, alignItems: 'flex-start' },
  row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill: {
    color: '#fff',
    fontSize: 13,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    overflow: 'hidden',
  },
  hint: { fontSize: 15, fontWeight: '600' },
  rec: { backgroundColor: '#c0392b', fontVariant: ['tabular-nums'] },
  warn: { backgroundColor: '#c0392b' },
  ok: { backgroundColor: '#2e9d48' },
  diagnostics: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    overflow: 'hidden',
    fontVariant: ['tabular-nums'],
  },
})
