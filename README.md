# TrackCam

App de iPhone que segue um jogador de futsal com um **DJI Osmo Mobile 8** em
tripé e grava o jogo inteiro. Toca-se no jogador, o Osmo roda para o manter no
centro, e um botão marca os momentos a cortar mais tarde.

## Estado

- **Base** (este branch): seguir um jogador, gravar o jogo em vídeos de 3
  minutos, marcar momentos, zoom à mão. Compila e instala; **ainda não foi
  testada num jogo**.
- Por fazer, por esta ordem: seguir a bola, detetar golos, cortar os melhores
  momentos sozinha.

## Preparar o Osmo

1. iPhone 12 ou mais recente, com iOS 18.5 ou superior.
2. **Retire o Módulo Multifunções** do Osmo. Com ele posto, é o módulo que
   segue e a app fica como "Osmo não ligado".
3. Feche a app DJI Mimo.
4. Encoste o iPhone ao Osmo para emparelhar por NFC. Se o aviso não aparecer,
   esqueça o Osmo nas definições de Bluetooth, reponha o Bluetooth do Osmo e
   tente outra vez.
5. Ponha o telemóvel **na horizontal**.

## Como usar

- **Toque no jogador** que quer seguir. A caixa dele fica destacada e o Osmo
  começa a rodar.
- **1x, 2x, 3x** (em baixo): zoom.
- **Botão vermelho** (à direita): começa e para a gravação.
- **Jogador / Jogada**: em *Jogador* segue quem se tocar; em *Jogada* aponta
  para o meio de toda a gente à vista e move-se devagar (não é preciso tocar em
  ninguém). É um atalho enquanto não há deteção da bola: conta também bancos e
  árbitros que estejam na imagem. Ainda não foi testado num iPhone.
- **GOLO** (aparece ao gravar): guarda um vídeo à parte com os 12 segundos antes
  do toque e os 5 a seguir, nas Fotografias, álbum **TrackCam Golos**, pronto a
  partilhar. O jogo continua a gravar; para cortar, a app fecha a parte atual e
  abre a seguinte. Ainda não foi testado num iPhone.
- **Marcar momento** (aparece ao gravar): regista o instante, para cortar depois.
- **Largar alvo**: deixa de seguir e o Osmo fica parado.
- **Osmo: app / iOS** (aparece com o Osmo ligado, quando não está a gravar):
  escolhe quem centra o alvo. Em **app** (o normal), a app manda a velocidade
  dos motores e aponta ao centro da caixa. Em **iOS**, entrega a caixa ao
  sistema; no teste em casa a câmara subia para a cabeça e oscilava. O comando
  pela app ainda não foi testado num iPhone.
- **Relatório** (aparece quando não está a gravar): abre a partilha do iPhone
  com um ficheiro de texto do que a app fez (toques, quando perdeu o jogador,
  fps, o que o Osmo aceitou e recusou). O ficheiro guarda também as sessões
  anteriores, incluindo as que acabaram com a app a fechar. Ainda não foi
  testado num iPhone.
- Se aparecer **"Jogador perdido"**, o Osmo para e o zoom abre para 1x. A app
  continua a procurá-lo; para retomar já, toque nele outra vez. Se trocar de
  jogador num cruzamento, toque no certo.

Em cima vê-se o estado do Osmo, o tempo de gravação e a parte em curso.

## Onde ficam os vídeos

- Os vídeos vão para a app **Fotografias**, em partes de até 3 minutos
  (`2026-11-11_18-30-05_parte-01.mov`, `parte-02`, …), 1080p, com som e sem as
  caixas por cima.
- Os momentos marcados ficam em `momentos.json`, na app **Ficheiros** →
  *No meu iPhone* → *TrackCam* → `jogos/<data do jogo>/`. Cada momento diz a
  parte e o segundo dentro dela.
- Um jogo de 40 minutos ocupa cerca de 2,5 GB.
- Se uma chamada ou outra app interromper a gravação, ela **não retoma
  sozinha**: a app avisa e é preciso tocar em gravar outra vez.

## Como obter o .ipa (sem Xcode no Mac)

1. Faça push do branch; ou lance o build à mão:
   `gh workflow run ios-ipa.yml --ref <branch>`.
2. No separador **Actions** do GitHub, descarregue o artefacto `TrackCam-ipa`.
3. Instale o `TrackCam.ipa` no iPhone com o SideStore ou o AltStore.

Com conta Apple gratuita, a app tem de ser renovada a cada 7 dias. O Osmo não
funciona no Expo Go nem no simulador.

## Desenvolver

```bash
npm test            # testes
npx tsc --noEmit    # tipos
npx expo lint       # lint
```

Para instalar pacotes, use sempre `npx expo install <pacote>`.

Para experimentar o seguidor em vídeos de jogos reais, sem telemóvel, veja a
[bancada de replay](tools/replay/README.md). Os vídeos ficam em `footage/`,
que o git ignora: o repositório é público, **nunca os adicione a um commit**.

## Peças

| Pasta | O que faz |
|---|---|
| `src/app/` | Rotas (Expo Router) |
| `src/screen/` | Ecrã de jogo: câmara, caixas, controlos, avisos |
| `src/detection/` | Modelo de deteção: imagem inteira e recorte à volta do alvo |
| `src/tracking/` | Seguidor: posição, velocidade, cor do equipamento, readquisição |
| `src/dock/` | Comandos para o Osmo |
| `src/recording/` | Gravação em partes e momentos |
| `modules/trackcam-dock/` | Módulo nativo (Swift) que fala com o Osmo pelo DockKit |
| `tools/replay/` | Bancada de replay com vídeos reais |
| `docs/superpowers/` | Desenho e plano da base |

As constantes do seguidor estão em `src/tracking/config.ts`.

## Limitações conhecidas

- Entre colegas com o mesmo equipamento, a app arrisca e continua; pode
  trocar de jogador num cruzamento.
- O modelo é pequeno e genérico (EfficientDet-Lite0, no CPU): vê bem pessoas,
  mas ainda não serve para seguir a bola.
- Só iOS.
