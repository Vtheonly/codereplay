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

# Homework: Fast Integral Image Mean Filter (O(1) per pixel)
def filtreMoyenne_integral(image, taille_masque):
    rad = taille_masque // 2
    h, w = image.shape
    padded = np.pad(image.astype(np.float64), rad, mode='reflect')
    ii = np.zeros((padded.shape[0] + 1, padded.shape[1] + 1), dtype=np.float64)
    ii[1:, 1:] = np.cumsum(np.cumsum(padded, axis=0), axis=1)
    
    area = taille_masque * taille_masque
    sums = (ii[taille_masque:h + taille_masque, taille_masque:w + taille_masque]
            + ii[0:h, 0:w]
            - ii[0:h, taille_masque:w + taille_masque]
            - ii[taille_masque:h + taille_masque, 0:w])
    return np.clip(np.round(sums / area), 0, 255).astype(np.uint8)
