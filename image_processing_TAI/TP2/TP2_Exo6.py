import os
import glob
import math
import cv2
import numpy as np
from utils.generate_fixtures import generate_all_fixtures

generate_all_fixtures()

def calculate_psnr(orig, deg):
    mse = np.mean((orig.astype(np.float64) - deg.astype(np.float64)) ** 2)
    return float('inf') if mse == 0 else 10.0 * math.log10((255.0 ** 2) / mse)
