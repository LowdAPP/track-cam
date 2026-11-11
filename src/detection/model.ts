import { signature } from '../tracking/appearance'
import { iou } from '../tracking/geometry'
import type { PersonDetection } from '../tracking/tracker'

// Modelo: EfficientDet-Lite0 (COCO), entrada 320x320 RGB uint8.
// Saídas: [0] caixas (25x4: ymin, xmin, ymax, xmax, de 0 a 1),
//         [1] classes (25), [2] scores (25), [3] número de deteções.
export const MODEL_SIZE = 320
export const CLASS_PERSON = 0
export const MIN_PERSON_SCORE = 0.35

/**
 * Saídas do modelo -> pessoas. A assinatura de cor é tirada de `rgb`, a imagem
 * 320x320 que o modelo viu, por isso as caixas ficam relativas a essa imagem.
 */
export function decodePeople(outputs: ArrayBuffer[], rgb: Uint8Array): PersonDetection[] {
  'worklet'
  const boxes = new Float32Array(outputs[0]!)
  const classes = new Float32Array(outputs[1]!)
  const scores = new Float32Array(outputs[2]!)
  const count = Math.min(scores.length, new Float32Array(outputs[3]!)[0] ?? 0)
  const people: PersonDetection[] = []
  for (let i = 0; i < count; i++) {
    const score = scores[i] ?? 0
    if (classes[i] !== CLASS_PERSON || score < MIN_PERSON_SCORE) continue
    const ymin = boxes[i * 4] ?? 0
    const xmin = boxes[i * 4 + 1] ?? 0
    const ymax = boxes[i * 4 + 2] ?? 0
    const xmax = boxes[i * 4 + 3] ?? 0
    const box = { x: xmin, y: ymin, w: xmax - xmin, h: ymax - ymin }
    if (!(box.w > 0 && box.h > 0)) continue
    people.push({ box, score, look: signature(rgb, MODEL_SIZE, MODEL_SIZE, box) })
  }
  return people
}

/**
 * Junta as deteções dos dois passes: primeiro as do recorte, depois as da
 * imagem inteira que não se sobrepõem (IoU > 0.5) a nenhuma do recorte.
 */
export function merge(full: PersonDetection[], crop: PersonDetection[]): PersonDetection[] {
  'worklet'
  const out = crop.slice()
  for (const f of full) {
    let duplicate = false
    for (const c of crop) {
      if (iou(f.box, c.box) > 0.5) {
        duplicate = true
        break
      }
    }
    if (!duplicate) out.push(f)
  }
  return out
}
