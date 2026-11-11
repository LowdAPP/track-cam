import { StyleSheet, Text, View } from 'react-native'

export function CameraScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>TrackCam</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 20 },
})
