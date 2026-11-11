/** Constantes do seguidor. Posições em fração da imagem (0 a 1), tempos em ms. */
export const TRACK = {
  // filtro de posição / velocidade
  alpha: 0.6,
  beta: 0.2,
  sizeSmoothing: 0.3,
  // raio de procura à volta da previsão = uma fração da diagonal da caixa...
  gateDiagonals: 0.6,
  gateMin: 0.04,
  gateMax: 0.35,
  // ...mais o que o alvo pode ter andado desde a última vez que foi visto (por segundo)
  gateSpeed: 0.3,
  areaRatioMin: 0.5,
  areaRatioMax: 2,
  // semelhança de cor com o aspeto recente abaixo disto: não é ele
  clearlyDifferent: 0.6,
  // o aspeto recente acompanha a luz e a pose; a referência é a do toque e muda devagar
  recentBlend: 0.5,
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
  // quem se sobrepõe tanto ao alvo não se distingue dele: não conta como outra pessoa
  mergedIou: 0.4,
  // uma pessoa que o detetor falha por instantes continua a contar como já estando à vista
  otherMemoryMs: 400,
  // caixa prevista a menos disto de uma borda, a mover-se para fora = a sair da imagem
  edgeMargin: 0.02,
  // nesse caso só conta quem estiver mesmo em cima da previsão
  edgeGate: 0.05,
} as const
