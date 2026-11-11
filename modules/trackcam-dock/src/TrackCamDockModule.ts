import { NativeModule, requireNativeModule } from 'expo'

import type { DockResult, TrackCamDockModuleEvents } from './TrackCamDock.types'

declare class TrackCamDockModule extends NativeModule<TrackCamDockModuleEvents> {
  /** Começa a ouvir ligações e desligações do estabilizador. */
  start(): Promise<DockResult>
  /** Assume o comando: desliga o seguimento do sistema. */
  takeControl(): Promise<DockResult>
  /**
   * Aponta para uma caixa de 0 a 1, já com o Y contado a partir de baixo.
   * `intrinsics` é a matriz 3x3 da câmara por linhas, ou null.
   */
  aim(
    x: number,
    y: number,
    width: number,
    height: number,
    intrinsics: number[] | null,
    referenceWidth: number,
    referenceHeight: number,
  ): Promise<DockResult>
  /** Para os motores. */
  hold(): Promise<DockResult>
}

export default requireNativeModule<TrackCamDockModule>('TrackCamDock')
