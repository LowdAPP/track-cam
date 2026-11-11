import AVFoundation
import DockKit
import Foundation
import Spatial

// SPIKE (descartável): experimenta o que o estabilizador aceita via DockKit.
// Não depende do Expo, para poder ser verificado com o SDK do macOS.

typealias DockPayload = [String: Any]

/// O que o módulo Expo vê. Não menciona tipos do DockKit, para compilar
/// também quando o alvo mínimo da app é anterior ao iOS 18.
protocol DockControlling: AnyObject {
  var onState: ((DockPayload) -> Void)? { get set }
  var onMotion: ((DockPayload) -> Void)? { get set }
  func start()
  func stop()
  func setSystemTracking(_ enabled: Bool) async -> DockPayload
  func selectSubject(x: Double, y: Double) async -> DockPayload
  func track(
    x: Double, y: Double, width: Double, height: Double,
    isPerson: Bool, orientation: String
  ) async -> DockPayload
  func setVelocity(pitch: Double, yaw: Double) async -> DockPayload
  func rotateBy(pitch: Double, yaw: Double) async -> DockPayload
  func animateYes() async -> DockPayload
}

func makeDockController() -> DockControlling? {
  if #available(iOS 18.0, macOS 15.0, *) { return DockController() }
  return nil
}

@available(iOS 18.0, macOS 15.0, *)
final class DockController: DockControlling, @unchecked Sendable {
  typealias Payload = DockPayload

  var onState: ((Payload) -> Void)?
  var onMotion: ((Payload) -> Void)?

  private let lock = NSLock()
  private var current: DockAccessory?
  private var stateTask: Task<Void, Never>?
  private var motionTask: Task<Void, Never>?

  private var accessory: DockAccessory? {
    get { lock.withLock { current } }
    set { lock.withLock { current = newValue } }
  }

  /// Começa a ouvir ligações e desligações do estabilizador.
  func start() {
    guard stateTask == nil else { return }
    stateTask = Task { [weak self] in
      do {
        for await change in try DockAccessoryManager.shared.accessoryStateChanges {
          guard let self else { return }
          let docked = change.state == .docked && change.accessory != nil
          self.accessory = docked ? change.accessory : nil
          self.onState?(self.describe(change))
          self.watchMotion(docked ? change.accessory : nil)
        }
      } catch {
        self?.onState?(["docked": false, "error": Self.text(error)])
      }
    }
  }

  func stop() {
    stateTask?.cancel()
    stateTask = nil
    motionTask?.cancel()
    motionTask = nil
  }

  func setSystemTracking(_ enabled: Bool) async -> Payload {
    do {
      try await DockAccessoryManager.shared.setSystemTrackingEnabled(enabled)
      return ["ok": true]
    } catch {
      return ["ok": false, "error": Self.text(error)]
    }
  }

  /// Escolhe a pessoa nesse ponto (0..1) para o seguimento do sistema.
  func selectSubject(x: Double, y: Double) async -> Payload {
    await attempt { try await $0.selectSubject(at: CGPoint(x: x, y: y)) }
  }

  /// Seguimento próprio: envia uma caixa (0..1) para o DockKit centrar.
  func track(
    x: Double, y: Double, width: Double, height: Double,
    isPerson: Bool, orientation: String
  ) async -> Payload {
    let observation = DockAccessory.Observation(
      identifier: 0,
      type: isPerson ? .humanBody : .object,
      rect: CGRect(x: x, y: y, width: width, height: height)
    )
    let info = DockAccessory.CameraInformation(
      captureDevice: .builtInWideAngleCamera,
      cameraPosition: .back,
      orientation: Self.orientation(orientation),
      cameraIntrinsics: nil,
      referenceDimensions: nil
    )
    return await attempt { try await $0.track([observation], cameraInformation: info) }
  }

  /// Velocidade dos motores em rad/s (pitch = cima/baixo, yaw = esquerda/direita).
  func setVelocity(pitch: Double, yaw: Double) async -> Payload {
    await attempt { try await $0.setAngularVelocity(Vector3D(x: pitch, y: yaw, z: 0)) }
  }

  /// Roda um ângulo relativo, em radianos.
  func rotateBy(pitch: Double, yaw: Double) async -> Payload {
    await attempt {
      _ = try await $0.setOrientation(
        Vector3D(x: pitch, y: yaw, z: 0), duration: .seconds(1), relative: true)
    }
  }

  func animateYes() async -> Payload {
    await attempt { _ = try await $0.animate(motion: .yes) }
  }

  // MARK: - Internos

  private func attempt(_ operation: (DockAccessory) async throws -> Void) async -> Payload {
    guard let accessory else {
      return ["ok": false, "error": "sem estabilizador ligado"]
    }
    do {
      try await operation(accessory)
      return ["ok": true]
    } catch {
      return ["ok": false, "error": Self.text(error)]
    }
  }

  private func watchMotion(_ accessory: DockAccessory?) {
    motionTask?.cancel()
    motionTask = nil
    guard let accessory else { return }
    motionTask = Task { [weak self] in
      do {
        var last = Date.distantPast
        for await motion in try accessory.motionStates {
          // 4 vezes por segundo chega para ver no ecrã
          guard Date().timeIntervalSince(last) > 0.25 else { continue }
          last = Date()
          let degrees = 180 / Double.pi
          var payload: Payload = [
            "pitch": motion.angularPositions.x * degrees,
            "yaw": motion.angularPositions.y * degrees,
          ]
          if let error = motion.error { payload["error"] = Self.text(error) }
          self?.onMotion?(payload)
        }
      } catch {
        self?.onMotion?(["error": Self.text(error)])
      }
    }
  }

  private func describe(_ change: DockAccessory.StateChange) -> Payload {
    var payload: Payload = [
      "docked": change.state == .docked,
      "trackingButtonEnabled": change.trackingButtonEnabled,
      "systemTracking": DockAccessoryManager.shared.isSystemTrackingEnabled,
    ]
    if let accessory = change.accessory {
      payload["name"] = accessory.identifier.name
      payload["model"] = accessory.hardwareModel ?? ""
      payload["firmware"] = accessory.firmwareVersion ?? ""
    }
    return payload
  }

  private static func orientation(_ name: String) -> DockAccessory.CameraOrientation {
    switch name {
    case "landscapeLeft": return .landscapeLeft
    case "landscapeRight": return .landscapeRight
    case "portrait": return .portrait
    default: return .corrected
    }
  }

  /// Nome do erro (por exemplo "notSupportedByDevice") e a descrição do sistema.
  private static func text(_ error: Error) -> String {
    let name = String(describing: error)
    let detail = error.localizedDescription
    return name == detail ? name : "\(name) (\(detail))"
  }
}
