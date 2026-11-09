import math
import cv2
import numpy as np
from utils.generate_fixtures import generate_all_fixtures

generate_all_fixtures()

# MSE and PSNR metrics
def calculate_mse(img1, img2):
    diff = img1.astype(np.float64) - img2.astype(np.float64)
    return float(np.mean(diff ** 2))
