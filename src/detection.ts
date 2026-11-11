// Modelo: EfficientDet-Lite0 (COCO), entrada 320x320 RGB uint8.
// Saídas: [0] caixas (25x4: ymin, xmin, ymax, xmax, normalizadas),
//         [1] classes (25), [2] scores (25), [3] número de deteções.
export const MODEL_SIZE = 320
export const CLASS_PERSON = 0
export const CLASS_BALL = 36

export const MIN_SCORE_PERSON = 0.35
export const MIN_SCORE_BALL = 0.2

export type TargetKind = 'person' | 'ball'

/** Deteção em coordenadas de câmara (o que o frame processor envia para o JS). */
export interface RawDetection {
  kind: TargetKind
  score: number
  // dois cantos opostos, em coordenadas de câmara
  ax: number
  ay: number
  bx: number
  by: number
  // caixa de 0 a 1 na imagem direita, origem em cima à esquerda
  nx: number
  ny: number
  nw: number
  nh: number
}

/** Deteção já convertida para coordenadas do ecrã. */
export interface Detection {
  kind: TargetKind
  score: number
  left: number
  top: number
  width: number
  height: number
  cx: number
  cy: number
  nx: number
  ny: number
  nw: number
  nh: number
}

export interface Target {
  kind: TargetKind
  cx: number
  cy: number
  // última caixa conhecida, de 0 a 1 na imagem
  nx: number
  ny: number
  nw: number
  nh: number
  /** quantos resultados seguidos sem encontrar o alvo */
  lost: number
}

/**
 * Segue o alvo de um resultado para o seguinte: escolhe a deteção do mesmo
 * tipo mais próxima da última posição conhecida, dentro de um raio máximo.
 */
export function updateTarget(
  target: Target,
  detections: Detection[],
  maxJump: number,
): Target {
  let best: Detection | undefined
  let bestDist = maxJump
  for (const d of detections) {
    if (d.kind !== target.kind) continue
    const dist = Math.hypot(d.cx - target.cx, d.cy - target.cy)
    if (dist < bestDist) {
      best = d
      bestDist = dist
    }
  }
  if (best == null) return { ...target, lost: target.lost + 1 }
  return {
    kind: target.kind,
    cx: best.cx,
    cy: best.cy,
    nx: best.nx,
    ny: best.ny,
    nw: best.nw,
    nh: best.nh,
    lost: 0,
  }
}

/**
 * Erro do alvo em relação ao centro do ecrã, de -1 a 1 em cada eixo.
 * É este o valor que mais tarde vai por Bluetooth para os motores.
 */
export function targetError(
  target: Target,
  viewWidth: number,
  viewHeight: number,
): { pan: number; tilt: number } {
  if (viewWidth === 0 || viewHeight === 0) return { pan: 0, tilt: 0 }
  const pan = (target.cx - viewWidth / 2) / (viewWidth / 2)
  const tilt = (viewHeight / 2 - target.cy) / (viewHeight / 2)
  return {
    pan: Math.max(-1, Math.min(1, pan)),
    tilt: Math.max(-1, Math.min(1, tilt)),
  }
}
