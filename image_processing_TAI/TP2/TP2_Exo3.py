import math
import cv2
import numpy as np
from utils.generate_fixtures import generate_all_fixtures

generate_all_fixtures()

NAGAO_OFFSETS = [
    [(0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)],
    [(0, 0), (-1, 0), (-2, 0), (-1, -1), (-2, -1), (-1, 1), (-2, 1)],
    [(0, 0), (1, 0), (2, 0), (1, -1), (2, -1), (1, 1), (2, 1)],
    [(0, 0), (0, 1), (0, 2), (-1, 1), (-1, 2), (1, 1), (1, 2)],
    [(0, 0), (0, -1), (0, -2), (-1, -1), (-1, -2), (1, -1), (1, -2)],
    [(0, 0), (-1, 0), (-1, 1), (-1, 2), (-2, 1), (-2, 2), (0, 1)],
    [(0, 0), (-1, 0), (-1, -1), (-1, -2), (-2, -1), (-2, -2), (0, -1)],
    [(0, 0), (1, 0), (1, 1), (1, 2), (2, 1), (2, 2), (0, 1)],
    [(0, 0), (1, 0), (1, -1), (1, -2), (2, -1), (2, -2), (0, -1)]
]

def filtreNagao(im, taille_filtre=5):
    h, w = im.shape
    rad = taille_filtre // 2
    scale = rad / 2.0
    padded = np.pad(im.astype(np.float64), rad, mode='reflect')
    output = np.zeros((h, w), dtype=np.uint8)

    scaled_regions = []
    for reg in NAGAO_OFFSETS:
        scaled_reg = set()
        for dy, dx in reg:
            s_dy = int(round(dy * scale))
            s_dx = int(round(dx * scale))
            scaled_reg.add((s_dy, s_dx))
        scaled_regions.append(list(scaled_reg))

    for y in range(h):
        for x in range(w):
            py, px = y + rad, x + rad
            best_var = float('inf')
            best_mean = padded[py, px]
