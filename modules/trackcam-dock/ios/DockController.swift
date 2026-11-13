import AVFoundation
import DockKit
import Foundation
import Spatial
import simd

// Fala com o estabilizador pelo DockKit.
// Não depende do Expo, para poder ser verificado com o SDK do macOS.

typealias DockPayload = [String: Any]

/// O que o módulo Expo vê. Não menciona tipos do DockKit, para compilar
/// também quando o alvo mínimo da app é anterior ao iOS 18.
protocol DockControlling: AnyObject {
  var onState: ((DockPayload) -> Void)? { get set }
  var onMotion: ((DockPayload) -> Void)? { get set }
  func start()
  func stop()
  func takeControl() async -> DockPayload
  func aim(
    x: Double, y: Double, width: Double, height: Double,
    intrinsics: [Double]?, referenceWidth: Double, referenceHeight: Double
  ) async -> DockPayload
  func steer(pitch: Double, yaw: Double) async -> DockPayload
  func hold() async -> DockPayload
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
  private var steerCount = 0

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

  /// Assume o comando: desliga o seguimento do sistema, para o iOS não
  /// escolher sozinho quem seguir.
  func takeControl() async -> Payload {
    do {
      try await DockAccessoryManager.shared.setSystemTrackingEnabled(false)
      return ["ok": true, "systemTracking": DockAccessoryManager.shared.isSystemTrackingEnabled]
    } catch {
      return ["ok": false, "error": Self.text(error)]
    }
  }

  /// Aponta para uma caixa (0..1, com o Y contado a partir de baixo).
  /// `intrinsics` é a matriz 3x3 da câmara por linhas, em píxeis de uma imagem
  /// com as dimensões de referência; sem ela o DockKit usa valores por omissão.
  func aim(
    x: Double, y: Double, width: Double, height: Double,
    intrinsics: [Double]?, referenceWidth: Double, referenceHeight: Double
  ) async -> Payload {
    let observation = DockAccessory.Observation(
      identifier: 0,
      type: .humanBody,
      rect: CGRect(x: x, y: y, width: width, height: height)
    )
    var matrix: matrix_float3x3?
    var dimensions: CGSize?
    if let k = intrinsics, k.count == 9, referenceWidth > 0, referenceHeight > 0 {
      matrix = matrix_float3x3(rows: [
        SIMD3(Float(k[0]), Float(k[1]), Float(k[2])),
        SIMD3(Float(k[3]), Float(k[4]), Float(k[5])),
        SIMD3(Float(k[6]), Float(k[7]), Float(k[8])),
      ])
      dimensions = CGSize(width: referenceWidth, height: referenceHeight)
    }
    let info = DockAccessory.CameraInformation(
      captureDevice: .builtInWideAngleCamera,
      cameraPosition: .back,
      orientation: .corrected,
      cameraIntrinsics: matrix,
      referenceDimensions: dimensions
    )
    return await attempt { try await $0.track([observation], cameraInformation: info) }
  }

  /// Comando direto: velocidade dos motores em rad/s (pitch positivo desce,
  /// yaw positivo roda para a direita). Se não chegar outro comando em 0,4 s,
  /// os motores param sozinhos: a câmara nunca fica a rodar sem ninguém a mandar.
  func steer(pitch: Double, yaw: Double) async -> Payload {
    let mine = lock.withLock { () -> Int in
      steerCount += 1
      return steerCount
    }
    let result = await attempt {
      try await $0.setAngularVelocity(Vector3D(x: pitch, y: yaw, z: 0))
    }
    if pitch != 0 || yaw != 0 {
      Task { [weak self] in
        try? await Task.sleep(nanoseconds: 400_000_000)
        guard let self, self.lock.withLock({ self.steerCount }) == mine else { return }
        _ = await self.attempt { try await $0.setAngularVelocity(Vector3D()) }
      }
    }
    return result
  }

  /// Para os motores.
  func hold() async -> Payload {
    lock.withLock { steerCount += 1 }
    return await attempt { try await $0.setAngularVelocity(Vector3D()) }
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

  /// Nome do erro (por exemplo "notSupportedByDevice") e a descrição do sistema.
  private static func text(_ error: Error) -> String {
    let name = String(describing: error)
    let detail = error.localizedDescription
    return name == detail ? name : "\(name) (\(detail))"
  }
}
