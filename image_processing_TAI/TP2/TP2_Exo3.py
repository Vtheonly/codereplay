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

            for reg in scaled_regions:
                vals = [padded[py + dy, px + dx] for dy, dx in reg]
                var = np.var(vals)
                if var < best_var:
                    best_var = var
                    best_mean = np.mean(vals)

            output[y, x] = int(round(best_mean))

    return output

im1 = cv2.imread('Images/cameraman.bmp', cv2.IMREAD_GRAYSCALE)
im2 = cv2.imread('Images/cameraman_bruit_gauss_sig0_001.bmp', cv2.IMREAD_GRAYSCALE)
im3 = cv2.imread('Images/cameraman_bruit_sel_poivre_p_10.bmp', cv2.IMREAD_GRAYSCALE)

print("[+] Running Nagao Filter across window scales...")
for size in [5, 7]:
    res_gauss = filtreNagao(im2, taille_filtre=size)
    res_sp = filtreNagao(im3, taille_filtre=size)
    p_gauss = cv2.PSNR(im1, res_gauss)
    p_sp = cv2.PSNR(im1, res_sp)
    print(f"Nagao {size}x{size} -> PSNR on Gaussian: {p_gauss:.2f} dB | S&P: {p_sp:.2f} dB")
