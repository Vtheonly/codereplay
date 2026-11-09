#!/usr/bin/env python3
"""
Complete Automated Codebase Generator for TAI (Advanced Image Processing)
Covers all exercises across TP1, TP2, and TP3.
"""

import os
import sys





FILES = {}

# =====================================================================
# REQUIREMENTS
# =====================================================================
FILES["requirements.txt"] = """numpy>=1.24.0
opencv-python>=4.8.0
opencv-contrib-python>=4.8.0
matplotlib>=3.7.0
scipy>=1.10.0
"""

# =====================================================================
# FIXTURE GENERATOR UTILITY
# =====================================================================
FILES["utils/generate_fixtures.py"] = '''import os
import cv2
import numpy as np

def generate_all_fixtures(base_dir="Images"):
    os.makedirs(base_dir, exist_ok=True)

    # 1. BoatsColor.bmp
    p = os.path.join(base_dir, "BoatsColor.bmp")
    if not os.path.exists(p):
        img = np.zeros((300, 400, 3), dtype=np.uint8)
        img[:150, :] = [235, 180, 100]  # Sky (BGR)
        img[150:, :] = [180, 100, 30]   # Water
        cv2.circle(img, (200, 150), 40, (30, 30, 220), -1)  # Boat hull/buoy
        cv2.imwrite(p, img)

    # 2. flower.bmp / counter.jpg / compteur.jpg
    for fname in ["flower.bmp", "counter.jpg", "compteur.jpg"]:
        p = os.path.join(base_dir, fname)
        if not os.path.exists(p):
            img = np.full((256, 256), 45, dtype=np.uint8)
            cv2.putText(img, "48720", (30, 140), cv2.FONT_HERSHEY_SIMPLEX, 1.8, 220, 4)
            cv2.rectangle(img, (20, 60), (236, 180), 180, 2)
            cv2.imwrite(p, img)

    # 3. pepper.bmp
    p = os.path.join(base_dir, "pepper.bmp")
    if not os.path.exists(p):
        img = np.zeros((300, 500, 3), dtype=np.uint8)
        img[:] = [70, 40, 30]
        cv2.circle(img, (180, 150), 75, (35, 190, 45), -1)
        cv2.circle(img, (320, 140), 85, (25, 30, 230), -1)
        cv2.circle(img, (250, 210), 65, (15, 210, 245), -1)
        cv2.imwrite(p, img)

    # 4. cameraman.bmp / camera-man.jpg
    for fname in ["cameraman.bmp", "camera-man.jpg"]:
        p = os.path.join(base_dir, fname)
        if not os.path.exists(p):
            img = np.zeros((256, 256), dtype=np.uint8)
            img[:130, :] = 200
            img[130:, :] = 50
            cv2.circle(img, (128, 90), 32, 20, -1)
            cv2.rectangle(img, (110, 122), (146, 220), 20, -1)
            cv2.line(img, (140, 130), (200, 220), 10, 4)
            cv2.imwrite(p, img)

    # 5. Globules_rouges.jpg
    p = os.path.join(base_dir, "Globules_rouges.jpg")
    if not os.path.exists(p):
        img = np.full((350, 350), 210, dtype=np.uint8)
        rng = np.random.default_rng(42)
        for _ in range(40):
            cx, cy = rng.integers(30, 320, size=2)
            r = rng.integers(14, 22)
            cv2.circle(img, (int(cx), int(cy)), int(r), int(rng.integers(30, 70)), -1)
        cv2.imwrite(p, img)

    # 6. glaucome-haut-gauche.jpg
    p = os.path.join(base_dir, "glaucome-haut-gauche.jpg")
    if not os.path.exists(p):
        img = np.zeros((300, 300, 3), dtype=np.uint8)
        img[:] = [10, 30, 110]
        cv2.circle(img, (150, 150), 90, (30, 140, 240), -1)
        cv2.circle(img, (130, 130), 40, (180, 230, 255), -1)
        cv2.imwrite(p, img)

    # 7. Cerveau_AVC1.JPG
    p = os.path.join(base_dir, "Cerveau_AVC1.JPG")
    if not os.path.exists(p):
        img = np.zeros((350, 350), dtype=np.uint8)
        cv2.ellipse(img, (175, 175), (130, 150), 0, 0, 360, 120, -1)
        cv2.ellipse(img, (175, 175), (110, 130), 0, 0, 360, 70, -1)
        cv2.circle(img, (260, 140), 25, 215, -1)
        cv2.imwrite(p, img)

    # 8. Super-Resolution Dataset Structure
    sr_base = os.path.join(base_dir, "Images_TP2_EXO6_SR")
    dirs = [
        os.path.join(sr_base, "HR_GT_512x512"),
        os.path.join(sr_base, "LR_256x256"),
        os.path.join(sr_base, "LR_128x128"),
    ]
    for d in dirs:
        os.makedirs(d, exist_ok=True)

    for i in range(1, 24):
        hr_path = os.path.join(dirs[0], f"HR_GT_{i}.jpg")
        lr256_path = os.path.join(dirs[1], f"LR_256_{i}.jpg")
        lr128_path = os.path.join(dirs[2], f"LR_128_{i}.jpg")

        if not os.path.exists(hr_path):
            hr = np.full((512, 512), 240, dtype=np.uint8)
            cv2.putText(hr, f"Doc Text {i}", (40, 150), cv2.FONT_HERSHEY_SIMPLEX, 2.0, 20, 4)
            cv2.putText(hr, "will sagen: de", (40, 260), cv2.FONT_HERSHEY_COMPLEX, 1.6, 30, 3)
            cv2.putText(hr, "verstehe auch d", (40, 360), cv2.FONT_HERSHEY_COMPLEX, 1.6, 30, 3)
            cv2.imwrite(hr_path, hr)

            lr256 = cv2.resize(hr, (256, 256), interpolation=cv2.INTER_AREA)
            lr128 = cv2.resize(hr, (128, 128), interpolation=cv2.INTER_AREA)
            cv2.imwrite(lr256_path, lr256)
            cv2.imwrite(lr128_path, lr128)

if __name__ == "__main__":
    generate_all_fixtures()
'''

FILES["utils/__init__.py"] = "from .generate_fixtures import generate_all_fixtures\n"

# =====================================================================
# TP1 FILES
# =====================================================================
FILES["TP1/TP1_Exo2.py"] = '''import cv2
import numpy as np
from utils.generate_fixtures import generate_all_fixtures

generate_all_fixtures()

# 1. Reading an image
img = cv2.imread('Images/BoatsColor.bmp')
if img is None:
    raise FileNotFoundError("Could not find Images/BoatsColor.bmp")

# 2. Loading / converting to grayscale
gray_img = cv2.imread('Images/BoatsColor.bmp', cv2.IMREAD_GRAYSCALE)
gray_img2 = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# 3. Read pixel at (100, 150)
pixel = img[100, 150]
print(f"The BGR values of Pixel at (100, 150) are: {pixel}")

# 4. Dimensions
height, width, channels = img.shape
print(f"Height: {height} pixels")
print(f"Width: {width} pixels")
print(f"Channels: {channels}")

# 5. Modifying center horizontal scanline to pure red [B=0, G=0, R=255]
annotated = img.copy()
center_row = height // 2
annotated[center_row, :] = [0, 0, 255]

cv2.imshow('Input Image', img)
cv2.imshow('Image loaded in grayscale', gray_img)
cv2.imshow('Image converted to grayscale', gray_img2)
cv2.imshow('Centerline Red', annotated)

print("[TP1_Exo2] Displaying. Press any key to continue...")
cv2.waitKey(0)
cv2.destroyAllWindows()
'''

FILES["TP1/TP1_Exo3.py"] = '''import os
import cv2
import numpy as np
from utils.generate_fixtures import generate_all_fixtures

generate_all_fixtures()

# Read target image
path = 'Images/counter.jpg' if os.path.exists('Images/counter.jpg') else 'Images/flower.bmp'
img = cv2.imread(path)
img_ng = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
height, width = img_ng.shape

# Solution 1: OpenCV primitive
_, imgb1 = cv2.threshold(img_ng, 80, 255, cv2.THRESH_BINARY)

# Solution 2: Explicit manual nested loops
imgb2 = np.zeros((height, width), dtype=np.uint8)
for i in range(height):
    for j in range(width):
        if img_ng[i, j] > 80:
            imgb2[i, j] = 255

# Solution 3: Vectorized NumPy
imgb3 = np.where(img_ng > 80, np.uint8(255), np.uint8(0))

assert np.array_equal(imgb1, imgb2)
assert np.array_equal(imgb1, imgb3)
print("[TP1_Exo3] Verified: All binarization implementations match bit-for-bit.")

cv2.imwrite('Images/imgb1.jpg', imgb1)

cv2.imshow('Original Grayscale', img_ng)
cv2.imshow('Binary OpenCV (imgb1)', imgb1)
cv2.imshow('Binary Loop (imgb2)', imgb2)
cv2.waitKey(0)
cv2.destroyAllWindows()
'''

FILES["TP1/TP1_Exo4.py"] = '''import cv2
import numpy as np
from utils.generate_fixtures import generate_all_fixtures

generate_all_fixtures()

# 1) Read image im1
im1 = cv2.imread('Images/pepper.bmp')
# 2) Read size (height, width)
h, w = im1.shape[:2]
print(f"Height: {h}, Width: {w}")

# 3) Resize by dividing size by 2 -> im2
im2 = cv2.resize(im1, (w // 2, h // 2), interpolation=cv2.INTER_LINEAR)

# 4) Crop region [y_start=30:y_end=150, x_start=200:x_end=400] -> im3
im3 = im1[30:150, 200:400].copy()

# 5) Copy im1 -> im4, draw blue rectangle + text "My rectangle" in green at [x=200, y=20]
im4 = im1.copy()
cv2.rectangle(im4, (200, 30), (400, 150), (255, 0, 0), thickness=2)
cv2.putText(im4, 'My rectangle', (200, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

# 6) Rotate im1 by 90 degrees -> im5
center = (w / 2.0, h / 2.0)
matrix = cv2.getRotationMatrix2D(center, 90.0, 1.0)
im5 = cv2.warpAffine(im1, matrix, (w, h))

# 7) Apply Gaussian blur -> im6
im6 = cv2.GaussianBlur(im1, (15, 15), 0)

# 8) Display all images
cv2.imshow('im1 - Original', im1)
cv2.imshow('im2 - Half Scaled', im2)
cv2.imshow('im3 - Cropped ROI', im3)
cv2.imshow('im4 - Annotated', im4)
cv2.imshow('im5 - Rotated 90', im5)
cv2.imshow('im6 - Gaussian Blur', im6)

cv2.waitKey(0)
cv2.destroyAllWindows()
'''

FILES["TP1/TP1_Exo5.py"] = '''import cv2
import numpy as np
import matplotlib.pyplot as plt
from utils.generate_fixtures import generate_all_fixtures

generate_all_fixtures()

# 1) Read grayscale (im1) and color (im2)
im1 = cv2.imread('Images/cameraman.bmp', cv2.IMREAD_GRAYSCALE)
im2 = cv2.imread('Images/pepper.bmp', cv2.IMREAD_COLOR)

# 2) Calculate histograms via cv2.calcHist()
hist1 = cv2.calcHist([im1], [0], None, [256], [0, 256])
hist2_B = cv2.calcHist([im2], [0], None, [256], [0, 256])
hist2_G = cv2.calcHist([im2], [1], None, [256], [0, 256])
hist2_R = cv2.calcHist([im2], [2], None, [256], [0, 256])

# 4) Custom histogram algorithm
def custom_calc_hist(channel_2d):
    counts = np.bincount(channel_2d.ravel(), minlength=256)
    return counts.astype(np.float32).reshape(-1, 1)

histp1 = custom_calc_hist(im1)
b, g, r = cv2.split(im2)
histp2_B = custom_calc_hist(b)
histp2_G = custom_calc_hist(g)
histp2_R = custom_calc_hist(r)

# Verify custom vs OpenCV
np.testing.assert_array_equal(hist1, histp1)
np.testing.assert_array_equal(hist2_B, histp2_B)
np.testing.assert_array_equal(hist2_G, histp2_G)
np.testing.assert_array_equal(hist2_R, histp2_R)
print("[TP1_Exo5] Verified: Custom histogram computation matches OpenCV 100%.")

# 3) Display with matplotlib
fig, axs = plt.subplots(2, 2, figsize=(12, 8))
axs[0, 0].imshow(im1, cmap='gray')
axs[0, 0].set_title('im1: Cameraman')
axs[0, 0].axis('off')

axs[0, 1].plot(hist1, color='black', label='Grayscale')
axs[0, 1].set_title('Histogram im1')
axs[0, 1].set_xlim([0, 256])
axs[0, 1].legend()

im2_rgb = cv2.cvtColor(im2, cv2.COLOR_BGR2RGB)
axs[1, 0].imshow(im2_rgb)
axs[1, 0].set_title('im2: Pepper')
axs[1, 0].axis('off')

axs[1, 1].plot(hist2_R, color='red', label='Red')
axs[1, 1].plot(hist2_G, color='green', label='Green')
axs[1, 1].plot(hist2_B, color='blue', label='Blue')
axs[1, 1].set_title('Color Histograms im2')
axs[1, 1].set_xlim([0, 256])
axs[1, 1].legend()

plt.tight_layout()
plt.show()
'''

# =====================================================================
# TP2 FILES
# =====================================================================
FILES["TP2/TP2_Exo1.py"] = '''import cv2
import numpy as np
from utils.generate_fixtures import generate_all_fixtures

generate_all_fixtures()

def sp_noise(image, prob):
    output = image.copy()
    num_channels = 1 if len(image.shape) == 2 else image.shape[2]
    white = 255 if num_channels == 1 else np.array([255] * num_channels, dtype=np.uint8)
    black = 0 if num_channels == 1 else np.array([0] * num_channels, dtype=np.uint8)

    probs = np.random.random(output.shape[:2])
    output[probs < (prob / 2.0)] = black
    output[probs > 1.0 - (prob / 2.0)] = white
    return output

# 1) Read grayscale cameraman.bmp into 2D array im1
im1 = cv2.imread('Images/cameraman.bmp', cv2.IMREAD_GRAYSCALE)

# 2) Additive Gaussian Noise sigma^2 = 100 -> sigma = 10
gaussian_noise = np.zeros(im1.shape, np.float32)
cv2.randn(gaussian_noise, 0.0, 10.0)
im2 = np.clip(im1.astype(np.float32) + gaussian_noise, 0, 255).astype(np.uint8)
cv2.imwrite('Images/cameraman_bruit_gauss_sig0_001.bmp', im2)

# 3) Salt & Pepper noise p = 10% -> im3
im3 = sp_noise(im1, prob=0.10)
cv2.imwrite('Images/cameraman_bruit_sel_poivre_p_10.bmp', im3)

# 4) Display and compare
cv2.imshow('im1 - Original', im1)
cv2.imshow('im2 - Gaussian Noise (var=100)', im2)
cv2.imshow('im3 - Salt & Pepper Noise (p=0.10)', im3)
print("[TP2_Exo1] Displaying noise models. Press any key to continue...")
cv2.waitKey(0)
cv2.destroyAllWindows()
'''

FILES["TP2/TP2_Exo2.py"] = '''import math
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

# Homework: Adaptive Local Mean Filter
def filtreMoyenne_adaptative(image, taille_masque=5, noise_var=100.0):
    rad = taille_masque // 2
    padded = np.pad(image.astype(np.float64), rad, mode='reflect')
    res = np.zeros_like(image, dtype=np.float64)
    for y in range(image.shape[0]):
        for x in range(image.shape[1]):
            window = padded[y:y + taille_masque, x:x + taille_masque]
            l_mean = np.mean(window)
            l_var = np.var(window)
            if l_var < noise_var:
                factor = 1.0
            else:
                factor = noise_var / l_var
            res[y, x] = l_mean + (1.0 - factor) * (image[y, x] - l_mean)
    return np.clip(np.round(res), 0, 255).astype(np.uint8)

# Main
im1 = cv2.imread('Images/cameraman.bmp', cv2.IMREAD_GRAYSCALE)
im2 = cv2.imread('Images/cameraman_bruit_gauss_sig0_001.bmp', cv2.IMREAD_GRAYSCALE)
im3 = cv2.imread('Images/cameraman_bruit_sel_poivre_p_10.bmp', cv2.IMREAD_GRAYSCALE)

# Benchmark filters
results = []
def bench(name, target, out):
    p = calculate_psnr(im1, out)
    results.append((name, target, p))

# Mean
bench("Mean 3x3", "Gaussian", cv2.blur(im2, (3, 3)))
bench("Mean 5x5", "Gaussian", cv2.blur(im2, (5, 5)))
bench("Mean 7x7", "Gaussian", cv2.blur(im2, (7, 7)))
bench("Fast Integral Mean 7x7", "Gaussian", filtreMoyenne_integral(im2, 7))

# Gauss
for s in [2.0, 1.5, 1.0, 0.5]:
    bench(f"Gauss 3x3 s={s}", "Gaussian", cv2.GaussianBlur(im2, (3, 3), s))
    bench(f"Gauss 5x5 s={s}", "Gaussian", cv2.GaussianBlur(im2, (5, 5), s))

# Median
bench("Median 3x3", "S&P", cv2.medianBlur(im3, 3))
bench("Median 5x5", "S&P", cv2.medianBlur(im3, 5))
bench("Median 7x7", "S&P", cv2.medianBlur(im3, 7))

# Bilateral
bench("Bilateral d=7", "Gaussian", cv2.bilateralFilter(im2, 7, 40, 40))
bench("Bilateral d=7", "S&P", cv2.bilateralFilter(im3, 7, 40, 40))

# Adaptive
bench("Adaptive Mean 5x5", "Gaussian", filtreMoyenne_adaptative(im2, 5, 100.0))

print("=" * 65)
print(f"{'FILTER':<30} | {'NOISE TYPE':<12} | {'PSNR (dB)':<10}")
print("=" * 65)
for name, ntype, p in results:
    print(f"{name:<30} | {ntype:<12} | {p:.2f} dB")
print("=" * 65)
'''

