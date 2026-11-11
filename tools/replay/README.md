# Bancada de replay

Corre o seguidor da app sobre vídeos reais de jogos, fora do telemóvel, para
ver onde ele troca de jogador ou o perde e afinar as constantes em
`src/tracking/config.ts`.

Os vídeos ficam em `footage/`, que o git ignora. **Nunca os adicione a um
commit**: o repositório é público.

## Preparar (uma vez)

```bash
uv venv --python cpython-3.12-macos-aarch64 tools/replay/.venv
uv pip install --python tools/replay/.venv/bin/python opencv-python ai-edge-litert
```

Num Mac com Apple Silicon o Python tem de ser o nativo (`aarch64`): o
`ai-edge-litert` não existe para o Python Intel.

## Usar

```bash
PY=tools/replay/.venv/bin/python

# 1. Detetar as pessoas em cada frame (o mesmo modelo da app)
$PY tools/replay/detect.py footage/jogo.mp4 --seconds 120

# 2. Seguir alguém: FRAME é o frame onde "toca", AT é o ponto (0 a 1) nesse frame
REPLAY=footage/jogo.detections.json FRAME=0 AT=0.42,0.55 npx jest tools/replay/replay.test.ts

# 3. Ver o resultado desenhado por cima do vídeo
$PY tools/replay/draw.py footage/jogo.mp4 footage/jogo.track.json
open footage/jogo.track.mp4
```

Se o ponto `AT` não acertar em ninguém, o passo 2 lista as pessoas que existem
nesse frame.

## Limites

- A bancada só faz o primeiro passe da app (a imagem inteira reduzida a
  320×320). Na app, o segundo passe vê o alvo com mais detalhe, por isso o
  telemóvel deve portar-se igual ou melhor do que aqui.
- Num vídeo já gravado a câmara não responde ao seguidor: serve para avaliar
  se ele mantém o jogador certo, não se o Osmo o centra.
