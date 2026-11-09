import cv2
import numpy as np
from utils.generate_fixtures import generate_all_fixtures

generate_all_fixtures()

im = cv2.imread('Images/camera-man.jpg', cv2.IMREAD_GRAYSCALE)

def non_maximum_suppression(magnitude, orientation_rad):
    h, w = magnitude.shape
    nms = np.zeros((h, w), dtype=np.float32)
    angle = np.rad2deg(orientation_rad) % 180

    for i in range(1, h - 1):
        for j in range(1, w - 1):
            q, r = 255, 255
            a = angle[i, j]
            if (0 <= a < 22.5) or (157.5 <= a <= 180):
                q, r = magnitude[i, j + 1], magnitude[i, j - 1]
            elif 22.5 <= a < 67.5:
                q, r = magnitude[i + 1, j - 1], magnitude[i - 1, j + 1]
            elif 67.5 <= a < 112.5:
                q, r = magnitude[i + 1, j], magnitude[i - 1, j]
            elif 112.5 <= a < 157.5:
                q, r = magnitude[i - 1, j - 1], magnitude[i + 1, j + 1]

            nms[i, j] = magnitude[i, j] if (magnitude[i, j] >= q and magnitude[i, j] >= r) else 0
    return nms

def hysteresis_threshold(img, t_low=30, t_high=70):
    h, w = img.shape
    out = np.zeros((h, w), dtype=np.uint8)
    strong_i, strong_j = np.where(img >= t_high)
    weak_i, weak_j = np.where((img >= t_low) & (img < t_high))
    out[strong_i, strong_j] = 255
    out[weak_i, weak_j] = 50
    
    for i in range(1, h - 1):
        for j in range(1, w - 1):
            if out[i, j] == 50:
                out[i, j] = 255 if (out[i-1:i+2, j-1:j+2] == 255).any() else 0
    return out

def generic_edge_detection(image, kx, ky, sb=30, sh=70):
    gx = cv2.filter2D(image.astype(np.float32), -1, kx)
    gy = cv2.filter2D(image.astype(np.float32), -1, ky)
    mag = np.hypot(gx, gy)
    ori = np.arctan2(gy, gx)
    nms = non_maximum_suppression(mag, ori)
    return hysteresis_threshold(nms, sb, sh)

def sobel_edge_detection(im, sb=30, sh=70):
    kx = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=np.float32)
    ky = np.array([[1, 2, 1], [0, 0, 0], [-1, -2, -1]], dtype=np.float32)
    return generic_edge_detection(im, kx, ky, sb, sh)

edges_sobel = sobel_edge_detection(im)
edges_canny = cv2.Canny(im, 30, 70)
print("[TP3_Exo2] Edge detectors executed successfully.")
