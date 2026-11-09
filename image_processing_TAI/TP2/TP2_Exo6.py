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

for i in range(1, min(6, len(hr_files) + 1)):
    hr = cv2.imread(os.path.join(base, "HR_GT_512x512", f"HR_GT_{i}.jpg"), cv2.IMREAD_GRAYSCALE)
    lr256 = cv2.imread(os.path.join(base, "LR_256x256", f"LR_256_{i}.jpg"), cv2.IMREAD_GRAYSCALE)
    
    sr_near = cv2.resize(lr256, (512, 512), interpolation=cv2.INTER_NEAREST)
    sr_linear = cv2.resize(lr256, (512, 512), interpolation=cv2.INTER_LINEAR)
    sr_cubic = cv2.resize(lr256, (512, 512), interpolation=cv2.INTER_CUBIC)
