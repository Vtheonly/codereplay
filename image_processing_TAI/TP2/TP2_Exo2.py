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
