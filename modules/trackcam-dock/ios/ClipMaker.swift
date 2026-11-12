import AVFoundation

struct ClipError: LocalizedError {
  let message: String
  var errorDescription: String? { message }
}

// Corta um bocado do fim de um ou mais vídeos seguidos e grava-o num ficheiro novo.
// `fromEndSec`: onde o corte começa, a contar do fim do último vídeo.
// Os vídeos de origem não são alterados.
func makeClip(paths: [String], fromEndSec: Double, durationSec: Double, output: String) async throws {
  let composition = AVMutableComposition()
  guard
    let video = composition.addMutableTrack(
      withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)
  else { throw ClipError(message: "não foi possível preparar o corte") }
  var audio: AVMutableCompositionTrack?
  var cursor = CMTime.zero

  for path in paths {
    let asset = AVURLAsset(url: URL(fileURLWithPath: path))
    guard let source = try await asset.loadTracks(withMediaType: .video).first else { continue }
    let range = try await source.load(.timeRange)
    try video.insertTimeRange(range, of: source, at: cursor)
    video.preferredTransform = try await source.load(.preferredTransform)

    if let sound = try await asset.loadTracks(withMediaType: .audio).first {
      if audio == nil {
        audio = composition.addMutableTrack(
          withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
      }
      let soundRange = try await sound.load(.timeRange)
      let shared = CMTimeRangeGetIntersection(soundRange, otherRange: range)
      if shared.duration > .zero {
        let offset = CMTimeSubtract(shared.start, range.start)
        try audio?.insertTimeRange(shared, of: sound, at: CMTimeAdd(cursor, offset))
      }
    }
    cursor = CMTimeAdd(cursor, range.duration)
  }

  let total = cursor.seconds
  guard total > 0 else { throw ClipError(message: "o vídeo está vazio") }
  let start = max(0, total - fromEndSec)
  let length = min(durationSec, total - start)

  guard
    let export = AVAssetExportSession(
      asset: composition, presetName: AVAssetExportPreset1920x1080)
  else { throw ClipError(message: "não foi possível criar o vídeo do golo") }
  let outputURL = URL(fileURLWithPath: output)
  try? FileManager.default.removeItem(at: outputURL)
  export.outputURL = outputURL
  export.outputFileType = .mp4
  export.shouldOptimizeForNetworkUse = true
  export.timeRange = CMTimeRange(
    start: CMTime(seconds: start, preferredTimescale: 600),
    duration: CMTime(seconds: length, preferredTimescale: 600))

  await withCheckedContinuation { (done: CheckedContinuation<Void, Never>) in
    export.exportAsynchronously { done.resume() }
  }
  guard export.status == .completed else {
    throw ClipError(message: export.error?.localizedDescription ?? "o corte falhou")
  }
}
