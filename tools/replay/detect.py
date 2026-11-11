"""Corre o modelo de deteção da app sobre um vídeo e guarda as pessoas encontradas.

    python tools/replay/detect.py footage/jogo.mp4            -> footage/jogo.detections.json
    python tools/replay/detect.py --fixture                   -> tools/replay/fixtures/parity.json

Faz o mesmo que o primeiro passe da app: a imagem inteira esticada para 320x320.
Não faz o segundo passe (o recorte à volta do alvo), por isso é o pior caso.
"""

import argparse
import json
import math
import os
import sys

MODEL_SIZE = 320
MIN_PERSON_SCORE = 0.35
CLASS_PERSON = 0
SAMPLES = 12
BINS = 64
HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(HERE, "..", "..", "assets", "efficientdet.tflite")


def signature(pixel, width, height, box):
    """Igual a `signature` em src/tracking/appearance.ts. `pixel(x, y)` devolve (r, g, b)."""
    bins = [0] * BINS
    left = box["x"] + box["w"] * 0.25
    top = box["y"] + box["h"] * 0.2
    w = box["w"] * 0.5
    h = box["h"] * 0.4
    count = 0
    for j in range(SAMPLES):
        py = math.floor((top + ((j + 0.5) / SAMPLES) * h) * height)
        if py < 0 or py >= height:
            continue
        for i in range(SAMPLES):
            px = math.floor((left + ((i + 0.5) / SAMPLES) * w) * width)
            if px < 0 or px >= width:
                continue
            r, g, b = pixel(px, py)
            bins[((int(r) >> 6) << 4) | ((int(g) >> 6) << 2) | (int(b) >> 6)] += 1
            count += 1
    if count == 0:
        return [1 / BINS] * BINS
    return [v / count for v in bins]


def write_fixture():
    """Imagem sintética: fundo verde com um tronco vermelho e uma faixa azul."""
    size = MODEL_SIZE

    def pixel(x, y):
        if 0.45 * size <= x < 0.55 * size and 0.30 * size <= y < 0.60 * size:
            return (30, 40, 220) if y >= 0.50 * size else (220, 20, 20)
        return (0, 200, 0)

    box = {"x": 0.4, "y": 0.2, "w": 0.2, "h": 0.6}
    out = {"size": size, "box": box, "look": signature(pixel, size, size, box)}
    path = os.path.join(HERE, "fixtures", "parity.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=1)
    print("escrito", path)


def detect(video, target_fps, max_seconds):
    import cv2
    import numpy as np
    from ai_edge_litert.interpreter import Interpreter

    interpreter = Interpreter(model_path=MODEL)
    interpreter.allocate_tensors()
    input_index = interpreter.get_input_details()[0]["index"]
    outputs = interpreter.get_output_details()

    cap = cv2.VideoCapture(video)
    if not cap.isOpened():
        sys.exit(f"não consegui abrir {video}")
    source_fps = cap.get(cv2.CAP_PROP_FPS) or 30
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    every = max(1, round(source_fps / target_fps))
    fps = source_fps / every

    frames = []
    index = 0
    while True:
        ok, bgr = cap.read()
        if not ok:
            break
        if index % every == 0:
            rgb = cv2.cvtColor(cv2.resize(bgr, (MODEL_SIZE, MODEL_SIZE)), cv2.COLOR_BGR2RGB)
            interpreter.set_tensor(input_index, rgb[np.newaxis, ...])
            interpreter.invoke()
            boxes = interpreter.get_tensor(outputs[0]["index"])[0]
            classes = interpreter.get_tensor(outputs[1]["index"])[0]
            scores = interpreter.get_tensor(outputs[2]["index"])[0]
            count = int(interpreter.get_tensor(outputs[3]["index"])[0])
            people = []
            for i in range(min(count, len(scores))):
                if int(classes[i]) != CLASS_PERSON or scores[i] < MIN_PERSON_SCORE:
                    continue
                ymin, xmin, ymax, xmax = (float(v) for v in boxes[i])
                box = {"x": xmin, "y": ymin, "w": xmax - xmin, "h": ymax - ymin}
                if box["w"] <= 0 or box["h"] <= 0:
                    continue
                look = signature(lambda x, y: rgb[y, x], MODEL_SIZE, MODEL_SIZE, box)
                people.append(
                    {
                        "box": {k: round(v, 4) for k, v in box.items()},
                        "score": round(float(scores[i]), 3),
                        "look": [round(v, 3) for v in look],
                    }
                )
            frames.append(people)
            if max_seconds and len(frames) >= max_seconds * fps:
                break
        index += 1
    cap.release()

    out = os.path.splitext(video)[0] + ".detections.json"
    with open(out, "w") as f:
        json.dump({"fps": fps, "every": every, "width": width, "height": height, "frames": frames}, f)
    seen = sum(1 for p in frames if p)
    print(f"{len(frames)} frames a {fps:.1f} fps, {seen} com pessoas -> {out}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("video", nargs="?")
    parser.add_argument("--fixture", action="store_true")
    parser.add_argument("--fps", type=float, default=30, help="fps a simular (a app corre a 30)")
    parser.add_argument("--seconds", type=float, default=0, help="processar só os primeiros N segundos")
    args = parser.parse_args()
    if args.fixture:
        write_fixture()
    elif args.video:
        detect(args.video, args.fps, args.seconds)
    else:
        parser.print_help()
