# TrackCam — Base (projeto 1 de 4)

Data: 2026-11-11

## Intenção

O dono da app filma os jogos de futsal dos filhos com um iPhone 15 montado
num DJI Osmo Mobile 8, em tripé. Hoje usa o seguimento da própria DJI: segue
um jogador, mas troca de jogador quando dois se cruzam e sobretudo quando o
zoom está mais fechado. Quando isso acontece, ele vai ao tripé e corrige à mão.

A base substitui esse uso: uma app que grava o jogo inteiro, segue o jogador
escolhido através do Osmo, e deixa corrigir com um toque no ecrã em vez de
mexer no Osmo.

É também o alicerce dos projetos seguintes, que **não fazem parte deste
documento**:

2. Seguir a bola no futsal (deteção fiável ao longe, seguir a jogada).
3. Golos: marcar as balizas, detetar o golo, seguir quem marcou.
4. Cortar os melhores momentos.

## O que ficou provado antes deste desenho

Uma versão de teste descartável (branch `spike/dockkit`) correu no iPhone 15
com o Osmo Mobile 8 (modelo `DS308`, firmware `1.0.0`):

- A deteção atual (EfficientDet-Lite0, CPU) corre a 30 fps no iPhone 15.
- O Osmo liga-se pelo DockKit da Apple depois de emparelhado por NFC.
- **Seguimento próprio funciona:** a app envia a caixa do alvo com
  `DockAccessory.track(_:cameraInformation:)` e o Osmo centra-o. 422 caixas
  aceites, 0 recusadas.
- **A caixa tem de ir com o Y contado a partir de baixo** (origem em baixo à
  esquerda, valores de 0 a 1), com a orientação `.corrected`. Com a origem em
  cima o Osmo foge para o teto.
- **Controlo direto dos motores funciona:** `setAngularVelocity`,
  `setOrientation` relativo e `animate` foram aceites e o Osmo mexeu-se.
- O seguimento do sistema (`setSystemTrackingEnabled(true)` e
  `selectSubject(at:)`) também é aceite.
- O Osmo comunica os ângulos atuais de pan e tilt (`motionStates`).
- **O Módulo Multifunções da DJI tem de estar desencaixado** e a app DJI Mimo
  fechada; caso contrário o DockKit fica desativado e a app não vê o Osmo.
- Um `.ipa` sem assinatura, instalado por SideStore/AltStore, consegue usar o
  DockKit.
- O dono avaliou o movimento do Osmo no seguimento próprio (`track`) como
  parecido com o da DJI.

**Não foi verificado** e é o primeiro risco a tirar no dispositivo, antes de
construir o resto por cima:

- O seguimento com zoom acima de 1x. O teste passou `cameraIntrinsics: nil`;
  com a imagem mais fechada o Osmo pode exagerar ou oscilar.
- O seguimento e os 30 fps de deteção enquanto se grava vídeo.
- O que o Osmo faz quando as caixas deixam de chegar (para, continua, volta
  ao centro?). O teste nunca enviou nada ao perder o alvo.

O código do teste serve de referência, não de base: o módulo nativo
`modules/trackcam-dock` (Swift, DockKit) pode ser reaproveitado; o painel de
teste em `App.tsx` é para deitar fora.

## Objetivos

1. **Ligar ao Osmo** e mostrar com clareza se está pronto ou não, e porquê
   (não emparelhado / módulo encaixado são indistinguíveis para a app: basta
   dizer "Osmo não ligado" e listar as duas causas).
2. **Escolher o jogador com um toque** numa das pessoas detetadas.
3. **Seguir esse jogador**: o Osmo mantém-no perto do centro da imagem.
4. **Não trocar de jogador em silêncio.** Num cruzamento ou oclusão, a app
   tenta manter o mesmo jogador usando o aspeto (cor do equipamento, tamanho
   da caixa) e o movimento (posição prevista), não só a caixa mais próxima.
   O jogador seguido é de campo e os colegas usam o mesmo equipamento, por
   isso a cor só o separa de adversários e do árbitro. **Na dúvida entre
   colegas, a app arrisca e continua**, guiada pelo movimento; pode enganar-se
   de vez em quando e o dono corrige com um toque. Só declara o jogador
   perdido quando não tem candidato plausível (saiu da imagem, ficou tapado
   tempo demais, ou só restam pessoas de aspeto claramente diferente).
5. **Jogador perdido:** aviso bem visível no ecrã, o Osmo para de rodar e o
   zoom abre para 1x. Se a app reencontrar o jogador com confiança, retoma
   sozinha e repõe o zoom anterior. Um toque em qualquer pessoa define o alvo
   de imediato — é sempre a correção garantida.
6. **Trocar de alvo a meio** com um toque noutra pessoa, sem parar a gravação.
7. **Zoom manual** durante o jogo (pelo menos 1x, 2x, 3x).
8. **Gravar o jogo inteiro** em vídeo com som, sem caixas, avisos nem botões
   na imagem gravada, e guardá-lo na app Fotografias do iPhone. O jogo fica
   em **vários vídeos seguidos de até 3 minutos cada**, sem falhas percetíveis
   entre eles, para que uma interrupção só custe o bocado em curso.
9. **Marcar momentos** durante a gravação: um botão que guarda o instante
   (em que vídeo e a que segundo dele, e a hora real) para uso futuro no
   projeto 4.

## Não-objetivos

- Seguir a bola; detetar balizas ou golos; cortar ou editar vídeo.
- Android, iPad, modo retrato, câmara frontal.
- Motores próprios / ESP32 / Bluetooth direto (o Osmo substitui tudo isso).
- Publicar na App Store.

## O que seria um falhanço, mesmo funcionando

- A câmara largar o jogador para seguir alguém claramente diferente (um
  adversário, o árbitro) sem avisar. Uma troca ocasional entre colegas com o
  mesmo equipamento é aceite.
- Declarar "perdido" a toda a hora quando a equipa está junta.
- Perder a gravação a meio de um jogo (app fecha, falta de espaço, chamada
  telefónica) sem ficar com o que já estava gravado.
- A gravação sair com caixas ou botões por cima.
- O seguimento ficar pior do que o da DJI no caso simples (um jogador sem
  cruzamentos).

## Como se usa

Telemóvel na horizontal, câmara de trás, montado no Osmo em tripé. O dono
fica por perto e toca no ecrã quando é preciso.

1. **Antes de começar:** indicador do Osmo; uma caixa por pessoa detetada;
   mensagem "Toque no jogador que quer seguir"; seletor de zoom; botão de
   gravar.
2. **A gravar e a seguir:** indicador de gravação com o tempo; o alvo com
   caixa destacada; os outros com caixa discreta e tocáveis; botão de marcar
   momento; botão de largar o alvo.
3. **Jogador perdido:** aviso "Jogador perdido · a procurar…"; última posição
   conhecida assinalada; todas as pessoas tocáveis.

Gravar e seguir são independentes: pode gravar-se sem alvo (câmara parada) e
seguir sem gravar.

## Restrições

- Expo SDK 58, React Native 0.88, `react-native-vision-camera` 5, TypeScript.
  Seguir o `AGENTS.md` do repositório (Expo Router em `src/app/`, consultar a
  documentação da versão antes de usar APIs do Expo).
- Não há Xcode nesta máquina. O Swift que só usa DockKit verifica-se com
  `swiftc -typecheck` contra o SDK do macOS; tudo o resto só compila no
  GitHub Actions (`.github/workflows/ios-ipa.yml`, cerca de 10 minutos).
- O teste real é sempre no iPhone do dono, com o Osmo. Cada ida ao telemóvel
  custa-lhe tempo: a app deve mostrar no ecrã informação suficiente para
  diagnosticar um problema por um print.
- DockKit exige iOS 18 para parte das APIs usadas; o iPhone alvo cumpre.
- O repositório é público.

## Decisões já tomadas

Pelo dono:
- A ordem dos quatro projetos e o âmbito da base acima.
- Na dúvida entre colegas de equipa, arriscar e continuar em vez de parar.
- O jogo fica em vários vídeos de até 3 minutos.
- O comportamento do ecrã nos três momentos (viu um esboço e aprovou).
- Quando o jogador se perde, a correção é tocar nele.
- Guarda o jogo inteiro.

Por quem escreveu este documento (o dono ouviu e não contestou; pode mudar):
- Vídeo guardado na app Fotografias.
- A gravação inclui som (obriga a pedir permissão de microfone e a lidar com
  interrupções de áudio, como uma chamada). Depois de uma interrupção a app
  não retoma sozinha: mostra que parou e o dono volta a carregar em gravar.
- O dono tem vídeos de jogos dos filhos. Servem para testar a lógica de
  seguimento fora do telemóvel, mas **nunca entram no repositório**, que é
  público: ficam numa pasta local ignorada pelo git. Ainda não se sabe se
  foram filmados do sítio do tripé nem com que zoom.
- Gravação em 1080p a 30 fps (cerca de 2,5 GB por 40 minutos).
- O botão de marcar momento entra já na base.
- Ao perder o jogador, o zoom abre sozinho para 1x e volta ao valor anterior
  ao reencontrá-lo.
- A versão de teste é descartada e a app é refeita com estrutura própria.
- Os momentos marcados ficam guardados no telemóvel, associados ao vídeo
  (formato à escolha de quem constrói), sem interface para os ver nesta fase.

## Deixado a quem constrói

- **Como comandar o Osmo:** entregar a caixa ao DockKit (`track`) ou comandar
  os motores diretamente (`setAngularVelocity`) com um controlador próprio.
  Ambos funcionam. O primeiro é o mais simples, já provou centrar o alvo a 1x
  e o dono achou-o tão suave como a DJI; o segundo dá controlo sobre a
  suavidade e sobre parar quando o alvo se perde. Os três pontos não
  verificados acima decidem entre os dois.
  Parar de rodar ao perder o alvo é obrigatório em qualquer dos casos.
- **Como reconhecer o jogador pelo aspeto** e que limiar de confiança separa
  "é ele" de "perdido". Tem de ser lógica testável sem telemóvel (funções
  puras com testes), porque o ciclo de teste no dispositivo é caro.
- Onde enquadrar o alvo (o centro da caixa ou um ponto mais acima).
- Como garantir que as caixas não entram no vídeo e que a deteção continua a
  30 fps enquanto grava.
- Como passar de um vídeo de 3 minutos para o seguinte sem perder imagens.
- Estrutura de ficheiros, testes e lint (o repositório não tem lint nem
  testes configurados; o `AGENTS.md` pede lint e typecheck antes de fechar).
- Se o modelo de deteção atual chega para pessoas a esta distância ou se
  convém acelerá-lo (delegate Core ML). A troca por um modelo específico de
  futsal pertence ao projeto 2.
