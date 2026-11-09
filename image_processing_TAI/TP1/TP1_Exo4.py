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
