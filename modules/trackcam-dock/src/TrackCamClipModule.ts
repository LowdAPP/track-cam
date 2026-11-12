import { NativeModule, requireNativeModule } from 'expo'

import type { DockResult } from './TrackCamDock.types'

declare class TrackCamClipModule extends NativeModule {
  /**
   * Corta um bocado do fim de um ou mais vídeos seguidos (caminhos de sistema, por ordem)
   * e grava-o em `output`. `fromEndSec` é onde o corte começa, a contar do fim do último vídeo.
   */
  makeClip(
    paths: string[],
    fromEndSec: number,
    durationSec: number,
    output: string,
  ): Promise<DockResult>
}

export default requireNativeModule<TrackCamClipModule>('TrackCamClip')
