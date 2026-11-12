import ExpoModulesCore

// Corta o vídeo de um golo a partir dos vídeos do jogo.
// Devolve { ok, error? } em vez de rejeitar, como o TrackCamDock.
public class TrackCamClipModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TrackCamClip")

    AsyncFunction("makeClip") {
      (paths: [String], fromEndSec: Double, durationSec: Double, output: String, promise: Promise) in
      Task {
        do {
          try await makeClip(
            paths: paths, fromEndSec: fromEndSec, durationSec: durationSec, output: output)
          promise.resolve(["ok": true])
        } catch {
          promise.resolve(["ok": false, "error": error.localizedDescription])
        }
      }
    }
  }
}
