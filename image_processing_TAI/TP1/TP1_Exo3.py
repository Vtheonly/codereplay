import os
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
