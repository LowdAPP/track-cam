import { center, type Box } from '../tracking/geometry'

/** Constantes do comando direto dos motores do Osmo. Ângulos em radianos. */
export const STEER = {
  // campo de visão horizontal da câmara principal a 1x, a gravar vídeo (aproximado)
  horizontalFov: (62 * Math.PI) / 180,
  // a imagem é 16:9
  aspect: 9 / 16,
  // erro abaixo disto: não mexe, para a imagem não tremer
  deadZone: (1 * Math.PI) / 180,
  // velocidade máxima de cada motor, por segundo
  maxSpeed: 1,
  // Subir e descer fica desligado: no treino o motor de cima/baixo quase não respondeu
  // e não deu para confirmar o sentido. Num campo visto de lado chega rodar.
  tilt: false,
} as const

/** Velocidades dos motores, em radianos por segundo. */
export interface Velocity {
  /** positivo = a câmara desce */
  pitch: number
  /** positivo = a câmara roda para a direita */
  yaw: number
}

/**
 * Velocidade para levar o centro de `box` ao centro da imagem: proporcional ao
 * ângulo que falta (`gain` por segundo). Assim a câmara abranda ao chegar, em vez
 * de passar do sítio. Com mais zoom o mesmo desvio na imagem é um ângulo menor.
 */
export function steerVelocity(box: Box, zoom: number, gain: number): Velocity {
  const c = center(box)
  const halfW = Math.tan(STEER.horizontalFov / 2) / Math.max(1, zoom)
  const halfH = halfW * STEER.aspect
  const toSpeed = (offset: number, half: number) => {
    const angle = Math.atan(offset * 2 * half)
    if (Math.abs(angle) < STEER.deadZone) return 0
    return Math.max(-STEER.maxSpeed, Math.min(STEER.maxSpeed, gain * angle))
  }
  return { yaw: toSpeed(c.x - 0.5, halfW), pitch: STEER.tilt ? toSpeed(c.y - 0.5, halfH) : 0 }
}
