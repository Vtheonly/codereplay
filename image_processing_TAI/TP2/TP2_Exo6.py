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

base = "Images/Images_TP2_EXO6_SR"
hr_files = sorted(glob.glob(os.path.join(base, "HR_GT_512x512", "*.jpg")))

print("=" * 60)
print(f"{'IMAGE':<15} | {'NEAREST 2x':<12} | {'BILINEAR 2x':<12} | {'BICUBIC 2x':<12}")
print("=" * 60)
