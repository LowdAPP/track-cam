import ExpoModulesCore

// Expõe o DockController ao JavaScript.
// Cada função devolve { ok, error? } em vez de rejeitar, para o ecrã poder
// mostrar exatamente o que o estabilizador aceitou e o que recusou.
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

    AsyncFunction("takeControl") { (promise: Promise) in
      self.run(promise) { await $0.takeControl() }
    }

    AsyncFunction("aim") {
      (x: Double, y: Double, width: Double, height: Double, intrinsics: [Double]?,
       referenceWidth: Double, referenceHeight: Double, promise: Promise) in
      self.run(promise) {
        await $0.aim(
          x: x, y: y, width: width, height: height,
          intrinsics: intrinsics, referenceWidth: referenceWidth, referenceHeight: referenceHeight)
      }
    }

    AsyncFunction("hold") { (promise: Promise) in
      self.run(promise) { await $0.hold() }
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
