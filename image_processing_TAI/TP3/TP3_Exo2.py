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
