import { NativeModule, requireNativeModule } from 'expo'

import type {
  DockOrientation,
  DockResult,
  TrackCamDockModuleEvents,
} from './TrackCamDock.types'

declare class TrackCamDockModule extends NativeModule<TrackCamDockModuleEvents> {
  start(): Promise<DockResult>
  setSystemTracking(enabled: boolean): Promise<DockResult>
  /** Ponto de 0 a 1 em cada eixo. */
  selectSubject(x: number, y: number): Promise<DockResult>
  /** Caixa de 0 a 1 em cada eixo. */
  track(
    x: number,
    y: number,
    width: number,
    height: number,
    isPerson: boolean,
    orientation: DockOrientation,
  ): Promise<DockResult>
  /** Velocidades em rad/s. */
  setVelocity(pitch: number, yaw: number): Promise<DockResult>
  /** Ângulos relativos em radianos. */
  rotateBy(pitch: number, yaw: number): Promise<DockResult>
  animateYes(): Promise<DockResult>
}

export default requireNativeModule<TrackCamDockModule>('TrackCamDock')
