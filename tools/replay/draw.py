"""Desenha o resultado do seguidor por cima do vídeo.

    python tools/replay/draw.py footage/jogo.mp4 footage/jogo.track.json  -> footage/jogo.track.mp4

Amarelo: a seguir. Laranja: a prever (sem ver). Vermelho: perdido (última posição).
Verde fino: todas as pessoas detetadas, se existir o ficheiro .detections.json ao lado.
"""

import json
import os
import sys

import cv2

COLORS = {"tracking": (74, 213, 255), "coasting": (0, 140, 255), "lost": (60, 60, 255)}
LABELS = {"tracking": "a seguir", "coasting": "a prever", "lost": "PERDIDO"}


def main(video, track_path):
    with open(track_path) as f:
        data = json.load(f)
    detections_path = track_path.replace(".track.json", ".detections.json")
    people = None
    every = 1
    if os.path.exists(detections_path):
        with open(detections_path) as f:
            d = json.load(f)
        people, every = d["frames"], d.get("every", 1)

    cap = cv2.VideoCapture(video)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    out_path = track_path.replace(".track.json", ".track.mp4")
    writer = cv2.VideoWriter(out_path, cv2.VideoWriter_fourcc(*"mp4v"), data["fps"], (width, height))

    def rect(box):
        return (
            (int(box["x"] * width), int(box["y"] * height)),
            (int((box["x"] + box["w"]) * width), int((box["y"] + box["h"]) * height)),
        )

    index = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if index % every == 0:
            i = index // every
            if i >= len(data["track"]):
                break
            if people is not None and i < len(people):
                for p in people[i]:
                    a, b = rect(p["box"])
                    cv2.rectangle(frame, a, b, (120, 220, 120), 1)
            t = data["track"][i]
            if t is not None and t["box"] is not None:
                a, b = rect(t["box"])
                color = COLORS[t["status"]]
                cv2.rectangle(frame, a, b, color, 3)
                cv2.putText(frame, LABELS[t["status"]], (a[0], max(20, a[1] - 8)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
            cv2.putText(frame, f"frame {i}", (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            writer.write(frame)
        index += 1
    cap.release()
    writer.release()
    print("escrito", out_path)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
