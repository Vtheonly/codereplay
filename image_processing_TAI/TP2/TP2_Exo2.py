import math
import cv2
import numpy as np
from utils.generate_fixtures import generate_all_fixtures

generate_all_fixtures()

# MSE and PSNR metrics
def calculate_mse(img1, img2):
    diff = img1.astype(np.float64) - img2.astype(np.float64)
    return float(np.mean(diff ** 2))

def calculate_psnr(orig, deg, r=255.0):
    mse = calculate_mse(orig, deg)
    if mse == 0:
        return float('inf')
    return 10.0 * math.log10((r ** 2) / mse)

# 2) Custom Mean Filter
def filtreMoyenne(image, taille_masque):
    if taille_masque % 2 == 0:
        raise ValueError("Mask size must be odd")
    rad = taille_masque // 2
    padded = np.pad(image.astype(np.float64), rad, mode='reflect')
    res = np.zeros_like(image, dtype=np.uint8)
    for y in range(image.shape[0]):
        for x in range(image.shape[1]):
            res[y, x] = int(round(np.mean(padded[y:y + taille_masque, x:x + taille_masque])))
    return res

# 3) Custom Median Filter
def filtreMedian(image, taille_voisinage):
    if taille_voisinage % 2 == 0:
        raise ValueError("Neighborhood size must be odd")
    rad = taille_voisinage // 2
    padded = np.pad(image, rad, mode='reflect')
    res = np.zeros_like(image)
    for y in range(image.shape[0]):
        for x in range(image.shape[1]):
            res[y, x] = int(np.median(padded[y:y + taille_voisinage, x:x + taille_voisinage]))
    return res
