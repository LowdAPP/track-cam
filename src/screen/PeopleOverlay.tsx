import { StyleSheet, Text, View } from 'react-native'

import type { TrackStatus } from '../tracking/tracker'
import type { FollowView } from './useFollow'
import type { Mapper } from './mapper'

interface Props {
  view: FollowView
  mapper: Mapper | null
}

/** As caixas por cima da imagem. Só existem no ecrã: não entram no vídeo gravado. */
export function PeopleOverlay({ view, mapper }: Props) {
  if (mapper == null) return null
  const following = view.status === 'tracking' || view.status === 'coasting'
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {view.people.map((p, i) => (
        <View key={i} style={[styles.box, following && styles.boxDim, mapper.boxToView(p.box)]} />
      ))}
      {view.target != null && (
        <View style={[styles.target, targetStyle(view.status), mapper.boxToView(view.target)]}>
          <Text style={[styles.tag, view.status === 'lost' && styles.tagLost]}>
            {label(view.status)}
          </Text>
        </View>
      )}
    </View>
  )
}

function label(status: TrackStatus): string {
  if (status === 'lost') return 'visto aqui pela última vez'
  if (status === 'coasting') return 'a prever'
  return 'a seguir'
}

function targetStyle(status: TrackStatus) {
  if (status === 'lost') return styles.targetLost
  if (status === 'coasting') return styles.targetCoasting
  return null
}

const styles = StyleSheet.create({
  box: { position: 'absolute', borderWidth: 2, borderRadius: 6, borderColor: '#5dcaa5' },
  boxDim: { opacity: 0.55 },
  target: { position: 'absolute', borderWidth: 3, borderRadius: 6, borderColor: '#ffd54a' },
  targetCoasting: { borderStyle: 'dashed' },
  targetLost: { borderStyle: 'dashed', borderColor: '#ff6b5e' },
  tag: {
    position: 'absolute',
    left: -3,
    top: -22,
    fontSize: 12,
    fontWeight: '600',
    color: '#111',
    backgroundColor: '#ffd54a',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tagLost: { backgroundColor: '#ff6b5e', color: '#fff' },
})
