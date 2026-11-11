import ExpoModulesCore

// SPIKE (descartável): expõe o DockController ao JavaScript.
// Cada função devolve { ok, error? } em vez de rejeitar, para o ecrã de teste
// poder mostrar exatamente o que o estabilizador aceitou e o que recusou.
public class TrackCamDockModule: Module {
  private var controller: DockControlling?

  public func definition() -> ModuleDefinition {
    Name("TrackCamDock")

    Events("onDockState", "onDockMotion")

    OnDestroy {
      self.controller?.stop()
    }

    AsyncFunction("start") { (promise: Promise) in
      self.run(promise) { controller in
        controller.start()
        return ["ok": true]
      }
    }

    AsyncFunction("setSystemTracking") { (enabled: Bool, promise: Promise) in
      self.run(promise) { await $0.setSystemTracking(enabled) }
    }

    AsyncFunction("selectSubject") { (x: Double, y: Double, promise: Promise) in
      self.run(promise) { await $0.selectSubject(x: x, y: y) }
    }

    AsyncFunction("track") {
      (x: Double, y: Double, width: Double, height: Double, isPerson: Bool,
       orientation: String, promise: Promise) in
      self.run(promise) {
        await $0.track(
          x: x, y: y, width: width, height: height,
          isPerson: isPerson, orientation: orientation)
      }
    }

    AsyncFunction("setVelocity") { (pitch: Double, yaw: Double, promise: Promise) in
      self.run(promise) { await $0.setVelocity(pitch: pitch, yaw: yaw) }
    }

    AsyncFunction("rotateBy") { (pitch: Double, yaw: Double, promise: Promise) in
      self.run(promise) { await $0.rotateBy(pitch: pitch, yaw: yaw) }
    }

    AsyncFunction("animateYes") { (promise: Promise) in
      self.run(promise) { await $0.animateYes() }
    }
  }

  private func run(
    _ promise: Promise,
    _ operation: @escaping (DockControlling) async -> DockPayload
  ) {
    if controller == nil {
      let created = makeDockController()
      created?.onState = { [weak self] payload in self?.sendEvent("onDockState", payload) }
      created?.onMotion = { [weak self] payload in self?.sendEvent("onDockMotion", payload) }
      controller = created
    }
    guard let controller else {
      promise.resolve(["ok": false, "error": "requer iOS 18 ou superior"])
      return
    }
    Task {
      let result = await operation(controller)
      promise.resolve(result)
    }
  }
}
