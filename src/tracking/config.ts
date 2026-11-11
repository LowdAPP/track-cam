/** Constantes do seguidor. Posições em fração da imagem (0 a 1), tempos em ms. */
export const TRACK = {
  // filtro de posição / velocidade
  alpha: 0.6,
  beta: 0.2,
  sizeSmoothing: 0.3,
  // raio de procura = 1.5 diagonais da caixa, entre gateMin e gateMax...
  gateDiagonals: 1.5,
  gateMin: 0.08,
  gateMax: 0.35,
  // ...e cresce enquanto prevê sem ver
  gateGrowthPerSec: 2,
  areaRatioMin: 0.5,
  areaRatioMax: 2,
  // semelhança de cor abaixo disto: não é ele
  clearlyDifferent: 0.35,
  weightMotion: 0.5,
  weightLook: 0.3,
  weightSize: 0.2,
  // tempo máximo a prever sem ver
  coastMs: 1200,
  velocityDamping: 0.9,
  // a referência de cor só se atualiza quando há um único candidato
  referenceBlend: 0.05,
  reacquireSimilarity: 0.6,
  reacquireMargin: 0.1,
  reacquireFrames: 3,
  // depois de perdido, espera isto antes de tentar readquirir (o zoom a abrir baralha as posições)
  reacquireSettleMs: 600,
  // sobreposição mínima para dizer que uma deteção é a mesma pessoa do frame anterior
  claimIou: 0.3,
  // caixa prevista a menos disto de uma borda, a mover-se para fora = a sair da imagem
  edgeMargin: 0.02,
  // nesse caso só conta quem estiver mesmo em cima da previsão
  edgeGate: 0.05,
} as const
