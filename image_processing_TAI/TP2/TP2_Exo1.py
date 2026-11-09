import cv2
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
