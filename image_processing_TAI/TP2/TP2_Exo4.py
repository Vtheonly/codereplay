import cv2
import numpy as np
from utils.generate_fixtures import generate_all_fixtures

generate_all_fixtures()

im1 = cv2.imread('Images/Globules_rouges.jpg', cv2.IMREAD_GRAYSCALE)
_, imb1 = cv2.threshold(im1, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

# 1) Morphological operations
for ksize in [3, 5, 7]:
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (ksize, ksize))
    eroded = cv2.erode(imb1, kernel)
    dilated = cv2.dilate(imb1, kernel)
    opened = cv2.morphologyEx(imb1, cv2.MORPH_OPEN, kernel)
    closed = cv2.morphologyEx(imb1, cv2.MORPH_CLOSE, kernel)

# 2) Cell separation and counting
kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
cleaned = cv2.morphologyEx(imb1, cv2.MORPH_OPEN, kernel, iterations=2)
dist_transform = cv2.distanceTransform(cleaned, cv2.DIST_L2, 5)
_, sure_fg = cv2.threshold(dist_transform, 0.4 * dist_transform.max(), 255, 0)
sure_fg = np.uint8(sure_fg)
