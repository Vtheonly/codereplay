import cv2
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
