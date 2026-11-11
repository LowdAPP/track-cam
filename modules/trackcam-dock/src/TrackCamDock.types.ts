/** Resultado de cada pedido ao estabilizador: aceitou, ou recusou e porquê. */
export type DockResult = { ok: boolean; error?: string }

export type DockState = {
  docked: boolean
  name?: string
  model?: string
  firmware?: string
  trackingButtonEnabled?: boolean
  systemTracking?: boolean
  error?: string
}

/** Posição dos motores, em graus. */
export type DockMotion = { pitch?: number; yaw?: number; error?: string }

export type DockOrientation = 'corrected' | 'landscapeRight' | 'landscapeLeft' | 'portrait'

export type TrackCamDockModuleEvents = {
  onDockState: (state: DockState) => void
  onDockMotion: (motion: DockMotion) => void
}
