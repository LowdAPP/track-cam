# TrackCam (MVP v0)

App de iPhone que deteta jogadores e bola com a câmara, deixa escolher um alvo
com um toque e mostra o desvio do alvo em relação ao centro (pan/tilt).
Ainda não grava vídeo nem fala com motores.

## Estado

- Compila em TypeScript, o bundle iOS é gerado e o `expo prebuild` passa.
- **Nunca correu num iPhone.** O primeiro build no GitHub Actions e o primeiro
  arranque no telemóvel são o teste real.

## Como obter o .ipa (sem Xcode no Mac)

1. Crie um repositório no GitHub e faça push desta pasta para o branch `main`.
2. O workflow `iOS IPA (sem assinatura)` corre sozinho (separador **Actions**).
3. No fim, descarregue o artefacto `TrackCam-ipa` e extraia o `TrackCam.ipa`.
4. Instale o `.ipa` no iPhone com o SideStore ou o AltStore.

Com conta Apple gratuita, a app tem de ser renovada a cada 7 dias.

## Como usar

- Segure o telemóvel deitado (a app só funciona em paisagem).
- As caixas verdes são jogadores; as laranja são bolas.
- Toque numa caixa para a seguir. O círculo amarelo é o alvo.
- Em baixo aparece o desvio: `pan` (esquerda/direita) e `tilt` (cima/baixo),
  de -100% a 100%. É este valor que mais tarde vai para os motores.
- Em cima aparecem os fps, o número de deteções e qualquer erro.

## Peças

| Ficheiro | O que faz |
|---|---|
| `App.tsx` | Câmara, deteção em cada frame, caixas, alvo e leitura pan/tilt |
| `src/detection.ts` | Constantes do modelo, seguimento do alvo e cálculo do erro |
| `assets/efficientdet.tflite` | Modelo EfficientDet-Lite0 (COCO), 320×320 |
| `.github/workflows/ios-ipa.yml` | Build do `.ipa` no GitHub Actions |

## Limitações conhecidas

- O modelo é pequeno e genérico: vê bem pessoas, mas a bola ao longe deve
  falhar muitas vezes. Se o teste em campo confirmar, troca-se por um YOLO.
- O seguimento é simples (a deteção mais próxima da última posição). Quando
  dois jogadores se cruzam, pode saltar para o outro.
- O modelo corre no CPU. O delegate Core ML fica para depois de a base funcionar.

## Próximos passos

1. Fazer o primeiro build e corrigir o que falhar.
2. Testar num jogo, do sítio do tripé.
3. v1: gravar vídeo, Bluetooth (BLE) e firmware do ESP32.
